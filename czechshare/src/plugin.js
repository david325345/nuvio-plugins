'use strict';
// CzechShare (Webshare + Hellspy + Fastshare) – plugin pro Nuvio na Apple TV.
// Hledání, parser a řazení jsou jádro addonu CzechShare (webshare-stremio-docker/lib/engine.js),
// přibalené při sestavení (build.mjs). Tady je jen napojení na Nuvio: nastavení, streamy s odkazem
// až při spuštění, katalogy „Webshare / Hellspy / Fastshare Hledat“ a anonymní archiv hledání.
// Každý zdroj se zapne sám: Webshare a Fastshare vyplněním účtu, Hellspy přepínačem.
const E = require('webshare-engine');

const VERSION = '1.1.2';
const ENGINE_VERSION = typeof __ENGINE_VERSION__ === 'string' ? __ENGINE_VERSION__ : 'dev';
// obrázky (pozadí, logo) z veřejného repozitáře addonu
const ASSETS = 'https://raw.githubusercontent.com/david325345/webshare-stremio-docker/main/public';
// archiv hledání na serveru addonu (jen se zapnutou volbou „Pomoct vylepšit hledání“)
const ARCHIVE_URL = 'https://webshare-stremio.freeddns.org/api/archive';

// ───────────── nastavení ─────────────
function onSettings() {
    return [
        { type: 'info', label: `CzechShare ${VERSION}`,
          description: 'Filmy, seriály a anime z Webshare.cz, Hellspy a Fastshare – české a slovenské názvy, CZ/SK dabing a titulky na prvním místě. ' +
              'Zapni si, co používáš: Webshare a Fastshare vyplněním účtu (Webshare přehrává s VIP, Fastshare s neomezeným stahováním nebo kreditem), ' +
              'Hellspy je zdarma bez účtu. Hledání a parser jsou stejné jako v addonu CzechShare.' },
        { type: 'text', key: 'username', label: 'Webshare – uživatelské jméno', placeholder: 'prázdné = bez Webshare' },
        { type: 'text', key: 'password', label: 'Webshare – heslo', isPassword: true },
        { type: 'toggle', key: 'hellspy', label: 'Hellspy', defaultValue: true },
        { type: 'text', key: 'fs_username', label: 'Fastshare – uživatelské jméno', placeholder: 'prázdné = bez Fastshare' },
        { type: 'text', key: 'fs_password', label: 'Fastshare – heslo', isPassword: true },
        { type: 'toggle', key: 'ws_search', label: 'Katalog „Webshare Hledat“ ve vyhledávání', defaultValue: true },
        { type: 'toggle', key: 'hs_search', label: 'Katalog „Hellspy Hledat“ ve vyhledávání', defaultValue: true },
        { type: 'toggle', key: 'fs_search', label: 'Katalog „Fastshare Hledat“ ve vyhledávání', defaultValue: true },
        { type: 'text', key: 'tmdb_key', label: 'Vlastní TMDB API klíč', placeholder: 'nepovinné – jinak se použije klíč z Nuvia' },
        { type: 'toggle', key: 'archive', label: 'Pomoct vylepšit hledání (anonymně)', defaultValue: false },
        { type: 'info', label: 'Co se při zapnutí odesílá',
          description: 'Po každém hledání se na server addonu CzechShare pošle anonymní záznam: co se hledalo (titul, ID, díl) ' +
              'a názvy nalezených souborů s tím, jestli prošly. Bez jmen, hesel a jakýchkoli údajů o tobě. ' +
              'Z těchto záznamů se opravuje parser, takže to pomůže vylepšit hledání pro všechny.' }
    ];
}

function readSettings(raw) {
    const s = raw || (typeof SCRAPER_SETTINGS === 'object' && SCRAPER_SETTINGS) || {};
    const text = k => (s[k] == null ? '' : String(s[k]).trim());
    const bool = (k, def) => (typeof s[k] === 'boolean' ? s[k] : s[k] === 'true' ? true : s[k] === 'false' ? false : def);
    const cfg = {};
    if (text('username') && s.password) { cfg.username = text('username'); cfg.password = String(s.password); }
    if (text('fs_username') && s.fs_password) { cfg.fs_username = text('fs_username'); cfg.fs_password = String(s.fs_password); }
    cfg.hellspy = bool('hellspy', true);
    cfg.enable_direct_search = bool('ws_search', true);
    cfg.hellspy_search = bool('hs_search', true);
    cfg.fastshare_search = bool('fs_search', true);
    if (text('tmdb_key')) cfg.tmdb_api_key = text('tmdb_key');
    return { cfg, archive: bool('archive', false) };
}
const anySource = cfg => E.hasWs(cfg) || E.hsOn(cfg) || E.hasFs(cfg);

// ───────────── anonymní archiv hledání ─────────────
let archiveOn = false;
E.hooks.version = `${ENGINE_VERSION}+nuvio-${VERSION}`;
E.hooks.archiveOn = () => archiveOn;
E.hooks.archive = rec => {
    // odeslat na pozadí, výsledky hledání na to nečekají
    fetch(ARCHIVE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record: rec }) })
        .catch(() => {});
};

// ───────────── ID z Nuvia → ID addonu ─────────────
const OWN_ID = /^(webshare-|hellspy-|fastshare-)/;
const ANIME_ID = /^(kitsu|anilist):\d+/;
function addonId(type, season, episode, ctx) {
    const vid = String((ctx && ctx.videoId) || '');
    if (OWN_ID.test(vid) || ANIME_ID.test(vid) || /^csfd:\d+/.test(vid)) return vid;
    let imdb = (ctx && ctx.imdbId) || (/^tt\d+/.test(vid) ? vid.split(':')[0] : null);
    if (!imdb) return null;
    if (type === 'series') {
        const s = season != null ? season : ctx && ctx.season, e = episode != null ? episode : ctx && ctx.episode;
        return s && e ? `${imdb}:${s}:${e}` : null;
    }
    return imdb;
}

// ───────────── streamy ─────────────
// odkaz až při spuštění – ve streamu je jen to, co resolveStream potřebuje (žádné tokeny ani session)
function toPluginStream(item, subs) {
    const st = E.toStream(item, '', '');
    delete st.url;
    delete st.subtitles;
    const f = item.f;
    if (f.hs) {
        st.resolve = { h: String(f.id), x: String(f.hash), q: item.conv || 'best' };
        if (subs && subs.length) {
            st.subtitles = subs.map((x, i) => ({ id: `hs-${f.id}-${i}`, lang: x.lang || 'und', url: x.url }));
        }
    } else if (f.fs) {
        st.resolve = { f: String(f.id), n: f.name };
    } else {
        st.resolve = { w: String(f.ident) };
    }
    return st;
}

async function hellspySubs(items) {
    const out = new Map();
    await Promise.all(items.filter(it => it.f.hs && it.info && it.info.subs && it.info.subs.length).map(async it => {
        if (out.has(it.f.id)) return;
        try {
            const d = await E.hsDetail(it.f.id, it.f.hash);   // v mezipaměti z hledání
            out.set(it.f.id, d ? d.subs : []);
        } catch (e) { out.set(it.f.id, []); }
    }));
    return out;
}

async function streamsFor(type, id, cfg) {
    let items;
    if (id.startsWith('webshare-')) {
        if (!E.hasWs(cfg)) return [];
        const r = await E.withToken(cfg, t => E.wsFileInfo(t, id.slice(9)));
        if (!r.info || r.info.ok === false) return [];
        items = E.rankFiles([{ f: r.info, exact: true, info: r.info }]);
    } else if (id.startsWith('hellspy-')) {
        if (!E.hsOn(cfg)) return [];
        const hf = await E.hsFileFromId(id);
        if (!hf) return [];
        items = E.rankFiles(E.expandHellspy([{ f: hf.f, exact: true, info: hf.info }]));
    } else if (id.startsWith('fastshare-')) {
        if (!E.hasFs(cfg)) return [];
        const f = E.fsFileFromId(id);
        if (!f) return [];
        items = E.rankFiles([{ f, exact: true, info: { len: f.len } }]);
    } else {
        const res = await E.findFiles(type, id, cfg);
        items = res.items.slice(0, type === 'movie' ? 30 : 25);
        const p = res.plan;
        const nHs = items.filter(it => it.f.hs).length, nFs = items.filter(it => it.f.fs).length;
        console.log(`${type} ${id} ${p ? (p.isAnime ? `anime AL${p.anilistId}` : p.source) : 'bez názvů'}` +
            `${p ? ` | názvy: ${p.names.map(n => n.text).join(' / ')}` : ''}` +
            ` | dotazů ${res.queries || 0}, souborů ${res.total || 0}, streamů ${items.length}` +
            `${nHs || nFs ? ` (${[nHs && `Hellspy ${nHs}`, nFs && `Fastshare ${nFs}`].filter(Boolean).join(', ')})` : ''}` +
            `${res.cached ? ' (cache)' : ` | ${res.ms} ms`}`);
    }
    const subs = await hellspySubs(items);
    return items.map(it => toPluginStream(it, it.f.hs ? subs.get(it.f.id) : null));
}

async function getStreams(tmdbId, mediaType, season, episode, ctx) {
    const { cfg, archive } = readSettings();
    archiveOn = archive;
    if (!anySource(cfg)) return [];
    const type = mediaType === 'movie' ? 'movie' : 'series';
    const id = addonId(type, season, episode, ctx);
    if (!id) return [];
    return streamsFor(type, id, cfg);
}

// Odkaz se vytváří až při spuštění: Webshare file_link z tvé IP, Hellspy převod MP4,
// Fastshare čerstvá session (drží 55 min) + stream=1
async function resolveStream(payload) {
    const { cfg } = readSettings();
    if (payload && payload.w) {
        if (!E.hasWs(cfg)) throw new Error('V nastavení pluginu chybí účet Webshare.');
        const r = await E.withToken(cfg, t => E.wsFileLink(t, payload.w));
        if (!r.link) throw new Error('Soubor není dostupný (smazaný, nebo účet bez VIP).');
        return r.link;
    }
    if (payload && payload.h) {
        const d = await E.hsDetail(payload.h, payload.x);
        const keys = d ? Object.keys(d.conv).sort((a, b) => E.convHeight(b) - E.convHeight(a)) : [];
        const link = d && (d.conv[payload.q] || (keys.length ? d.conv[keys[0]] : null));
        if (!link) throw new Error('Soubor na Hellspy není dostupný.');
        return link;
    }
    if (payload && /^\d+$/.test(String(payload.f || ''))) {
        if (!E.hasFs(cfg)) throw new Error('V nastavení pluginu chybí účet Fastshare.');
        try {
            return await E.fsPlayLink(cfg, String(payload.f), payload.n);
        } catch (e) {
            if (e instanceof E.FsError) throw new Error('Přihlášení k Fastshare se nepovedlo – zkontroluj jméno a heslo v nastavení pluginu.');
            throw new Error('Fastshare teď neodpovídá, zkus to znovu.');
        }
    }
    throw new Error('Neznámý stream.');
}

// ───────────── katalogy a detail souboru ─────────────
async function getCatalog(type, id, extra) {
    const { cfg, archive } = readSettings();
    archiveOn = archive;
    const ex = extra || {};
    if (id === 'webshare_search') return { metas: await E.handleCatalog(type, ex, cfg, ASSETS) };
    if (id === 'hellspy_search') return { metas: await E.handleCatalogHs(type, ex, cfg, ASSETS) };
    if (id === 'fastshare_search') return { metas: await E.handleCatalogFs(type, ex, cfg, ASSETS) };
    return { metas: [] };
}

async function getMeta(type, id) {
    const { cfg } = readSettings();
    return { meta: await E.handleMeta(type, id, cfg, ASSETS) };
}

// ───────────── tlačítko Ověřit ─────────────
async function onVerify(raw) {
    const { cfg } = readSettings(raw);
    const s = raw || {};
    const parts = [];
    let ok = true;
    if (E.hasWs(cfg)) {
        try {
            const token = await E.wsLogin(cfg.username, cfg.password);
            const ud = await E.wsUserData(token).catch(() => null);
            if (!ud) parts.push('Webshare: přihlášení v pořádku.');
            else if (ud.vip) parts.push(`Webshare: přihlášení v pořádku, VIP ještě ${ud.vipDays} dní.`);
            else parts.push('Webshare: přihlášení v pořádku, ale účet nemá VIP – soubory z Webshare nepůjde přehrát.');
        } catch (e) {
            ok = false;
            parts.push(`Webshare: ${e instanceof E.WsError ? e.message : 'neodpovídá, zkus to znovu.'}`);
        }
    } else if (s.username || s.password) {
        ok = false;
        parts.push('Webshare: vyplň jméno i heslo.');
    }
    if (E.hasFs(cfg)) {
        try {
            const r = await E.fsLogin(cfg.fs_username, cfg.fs_password);
            if (r.unlimited) parts.push('Fastshare: přihlášení v pořádku, neomezené stahování.');
            else if (r.creditMB > 0) {
                const credit = r.creditMB >= 1024 ? `${(r.creditMB / 1024).toFixed(1).replace('.', ',')} GB` : `${r.creditMB} MB`;
                parts.push(`Fastshare: přihlášení v pořádku, kredit ${credit}.`);
            } else parts.push('Fastshare: přihlášení v pořádku, ale účet nemá neomezené stahování ani kredit – přehrávání nemusí fungovat.');
        } catch (e) {
            ok = false;
            parts.push(e instanceof E.FsError ? e.message : 'Fastshare neodpovídá, zkus to znovu.');
        }
    } else if (s.fs_username || s.fs_password) {
        ok = false;
        parts.push('Fastshare: vyplň jméno i heslo.');
    }
    if (E.hsOn(cfg)) {
        try {
            await E.hsSearch('matrix', 1);
            parts.push('Hellspy odpovídá.');
        } catch (e) {
            ok = false;
            parts.push(`Hellspy neodpovídá (${e.message}).`);
        }
    }
    if (!anySource(cfg)) { ok = false; parts.push('Vyplň účet Webshare nebo Fastshare, nebo zapni Hellspy.'); }
    return { ok, message: parts.join(' ') };
}

module.exports = { getStreams, resolveStream, getCatalog, getMeta, onSettings, onVerify, _test: { addonId, readSettings, E } };
