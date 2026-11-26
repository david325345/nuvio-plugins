'use strict';
// SKTorrent – plugin pro Nuvio na Apple TV: CZ/SK torrenty ze sktorrent.eu přes Real-Debrid a/nebo TorBox.
// Hledání, parser, řazení i přehrání jsou kód addonu SKTorrent (sktorrent-realdebrid-docker/lib),
// přibalený při sestavení (build.mjs). Tady je jen napojení na Nuvio: nastavení, přihlášení na SKT,
// odkazy až při spuštění a katalog „SKTorrent“.
const H = require('skt/handlers');
const { activeProviders, rdVerify, tbVerify } = require('skt/debrid');
const { sktLogin } = require('skt/skt');
const archive = require('skt/archive');
const { sha256hex } = require('../../shared/hash');

const VERSION = '1.0.2';
const ADDON_VERSION = typeof __ADDON_VERSION__ === 'string' ? __ADDON_VERSION__ : 'dev';
const ARCHIVE_URL = typeof __ARCHIVE_URL__ === 'string' ? __ARCHIVE_URL__ : '';
// informační videa (stahuje se, fronta…) a logo z veřejného repozitáře addonu
const PUBLIC = 'https://raw.githubusercontent.com/david325345/sktorrent-realdebrid-docker/main/public/';

// ───────────── nastavení ─────────────
function onSettings() {
    const form = [
        { type: 'info', label: `SKTorrent ${VERSION}`,
          description: 'CZ/SK filmy a seriály ze sktorrent.eu, přehrávání přes Real-Debrid a/nebo TorBox. ' +
              'Hledání a parser jsou stejné jako v addonu SKTorrent. Zadej aspoň jeden klíč.' },
        { type: 'text', key: 'rd_token', label: 'Real-Debrid API token', isPassword: true, placeholder: 'real-debrid.com/apitoken' },
        { type: 'text', key: 'tb_key', label: 'TorBox API klíč', isPassword: true, placeholder: 'torbox.app → Settings → API' },
        { type: 'text', key: 'skt_user', label: 'SKTorrent – uživatelské jméno', placeholder: 'nepovinné – s účtem je vidět víc' },
        { type: 'text', key: 'skt_pass', label: 'SKTorrent – heslo', isPassword: true },
        { type: 'toggle', key: 'skt_search', label: 'Katalog „SKTorrent“ ve vyhledávání', defaultValue: true },
        { type: 'text', key: 'tmdb_key', label: 'Vlastní TMDB API klíč', placeholder: 'nepovinné – jinak se použije klíč z Nuvia' }
    ];
    if (ARCHIVE_URL) {
        form.push(
            { type: 'toggle', key: 'archive', label: 'Pomoct vylepšit hledání (anonymně)', defaultValue: false },
            { type: 'info', label: 'Co se při zapnutí odesílá',
              description: 'Po každém hledání se na server addonu SKTorrent pošle anonymní záznam: co se hledalo (titul, ID, díl) ' +
                  'a názvy nalezených torrentů s tím, jestli prošly. Bez klíčů, přihlášení a jakýchkoli údajů o tobě. ' +
                  'Z těchto záznamů se opravuje parser, takže to pomůže vylepšit hledání pro všechny.' });
    }
    return form;
}

function readSettings(raw) {
    const s = raw || (typeof SCRAPER_SETTINGS === 'object' && SCRAPER_SETTINGS) || {};
    const text = k => (s[k] == null ? '' : String(s[k]).trim());
    const bool = (k, def) => (typeof s[k] === 'boolean' ? s[k] : s[k] === 'true' ? true : s[k] === 'false' ? false : def);
    const nuvioTmdb = typeof TMDB_API_KEY === 'string' ? TMDB_API_KEY.trim() : '';
    return {
        rdToken: text('rd_token'), tbKey: text('tb_key'),
        sktUser: text('skt_user'), sktPassword: s.skt_pass == null ? '' : String(s.skt_pass),
        sktSearch: bool('skt_search', true),
        tmdbKey: text('tmdb_key') || nuvioTmdb,
        archive: bool('archive', false)
    };
}

// ───────────── přihlášení na SKT (cookies uid/pass) ─────────────
// Jméno a heslo jsou v Klíčence (nastavení pluginu); cookies se drží v paměti a v localStorage 30 dní.
const LOGIN_KEY = 'skt-login';
let loginMem = null;
const loginId = s => sha256hex(`${s.sktUser}\n${s.sktPassword}`).slice(0, 16);
function storedLogin(s) {
    if (loginMem && loginMem.id === loginId(s)) return loginMem;
    try {
        const v = JSON.parse(localStorage.getItem(LOGIN_KEY) || 'null');
        if (v && v.id === loginId(s) && v.exp > Date.now()) return (loginMem = v);
    } catch (e) { /* nic */ }
    return null;
}
async function sktCookies(s, fresh = false) {
    if (!s.sktUser || !s.sktPassword) return { uid: '', pass: '' };
    const have = !fresh && storedLogin(s);
    if (have) return have;
    let r = null;
    try { r = await sktLogin(s.sktUser, s.sktPassword); } catch (e) { console.warn(`SKT přihlášení selhalo: ${e.message}`); }
    if (!r) return { uid: '', pass: '' };
    loginMem = { id: loginId(s), uid: r.uid, pass: r.pass, exp: Date.now() + 30 * 24 * 3600 * 1000 };
    try { localStorage.setItem(LOGIN_KEY, JSON.stringify(loginMem)); } catch (e) { /* jen v paměti */ }
    return loginMem;
}

async function toCfg(s) {
    const c = await sktCookies(s);
    archive.configure({ on: s.archive, url: ARCHIVE_URL, version: `${ADDON_VERSION}+nuvio-${VERSION}` });
    return { rdToken: s.rdToken, tmdbKey: s.tmdbKey, sktUid: c.uid, sktPass: c.pass, sktSearch: s.sktSearch, tbKey: s.tbKey };
}

// ───────────── odkazy pro obsluhu addonu ─────────────
// Každý seznam streamů dostane vlastní značku: Nuvio drží vyřešený odkaz 10 minut, a torrent, který se
// teprve stahoval (informační video), se tak při dalším otevření streamů vyřeší znovu.
function link() {
    const n = Date.now().toString(36);
    return {
        play: (prov, hash, sel) => ({ resolve: { p: prov, h: hash, s: sel || {}, n } }),
        file: name => ({ url: PUBLIC + name }),
        fileUrl: name => PUBLIC + name
    };
}

// ───────────── streamy ─────────────
function addonId(type, season, episode, ctx) {
    const vid = String((ctx && ctx.videoId) || '');
    if (/^skt[a-f0-9]{40}$/i.test(vid) || /^csfd:\d+/.test(vid)) return vid;
    const imdb = (ctx && ctx.imdbId) || (/^tt\d+/.test(vid) ? vid.split(':')[0] : null);
    if (!imdb) return null;
    if (type === 'series') {
        const s = season != null ? season : ctx && ctx.season, e = episode != null ? episode : ctx && ctx.episode;
        return s && e ? `${imdb}:${s}:${e}` : null;
    }
    return imdb;
}

async function getStreams(tmdbId, mediaType, season, episode, ctx) {
    const s = readSettings();
    if (!s.rdToken && !s.tbKey) return [];
    const type = mediaType === 'movie' ? 'movie' : 'series';
    const id = addonId(type, season, episode, ctx);
    if (!id) return [];
    const cfg = await toCfg(s);
    const r = await H.streamsFor(type, id, cfg, link());
    return r.streams || [];
}

// Odkaz se vytváří až při spuštění: přidání do RD/TorBoxu, výběr souboru, odkaz (jako /play addonu)
async function resolveStream(payload) {
    const s = readSettings();
    const cfg = await toCfg(s);
    if (!payload || !payload.p || !payload.h) throw new Error('Neznámý stream.');
    const r = await H.playFor(cfg, payload.p, payload.h, payload.s || {}, { archiveIt: true });
    if (r.url) return r.url;
    if (r.file) return PUBLIC + r.file;
    throw new Error(r.error || 'Přehrání se nepodařilo.');
}

// ───────────── katalog a detail ─────────────
async function getCatalog(type, id, extra) {
    const s = readSettings();
    if (id !== 'skt-search' || !s.sktSearch) return { metas: [] };
    const cfg = await toCfg(s);
    return H.catalogFor((extra && extra.search) || '', cfg, link());
}

async function getMeta(type, id) {
    return H.metaFor(id);
}

// ───────────── tlačítko Ověřit ─────────────
const TB_PLANS = { 0: 'Free', 1: 'Essential', 2: 'Pro', 3: 'Standard' };
async function onVerify(raw) {
    const s = readSettings(raw);
    const parts = [];
    let ok = true;
    if (!s.rdToken && !s.tbKey) { ok = false; parts.push('Zadej Real-Debrid token nebo TorBox klíč.'); }
    const [u, t] = await Promise.all([s.rdToken ? rdVerify(s.rdToken) : null, s.tbKey ? tbVerify(s.tbKey) : null]);
    if (s.rdToken) {
        if (u) parts.push(`Real-Debrid: ${u.username}, ${u.type}${u.expiration ? ` do ${new Date(u.expiration).toLocaleDateString('cs-CZ')}` : ''}.`);
        else { ok = false; parts.push('Real-Debrid: neplatný token.'); }
    }
    if (s.tbKey) {
        if (t) parts.push(`TorBox: ${TB_PLANS[t.plan] ?? `plán ${t.plan}`}${t.premium_expires_at ? ` do ${new Date(t.premium_expires_at).toLocaleDateString('cs-CZ')}` : ''}.`);
        else { ok = false; parts.push('TorBox: neplatný klíč.'); }
    }
    if (s.sktUser || s.sktPassword) {
        const c = await sktCookies(s, true);
        if (c.uid) parts.push('SKTorrent: přihlášení v pořádku.');
        else { ok = false; parts.push('SKTorrent: přihlášení se nepovedlo (jméno, heslo, nebo SKT neodpovídá).'); }
    } else parts.push('SKTorrent: bez účtu.');
    return { ok, message: parts.join(' ') };
}

module.exports = { getStreams, resolveStream, getCatalog, getMeta, onSettings, onVerify, _test: { addonId, readSettings, activeProviders } };
