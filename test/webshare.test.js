// Plugin Webshare (webshare/webshare.js) tak, jak běží na Apple TV (harness s polyfilly Nuvia),
// proti napodobenému Webshare API, Hellspy, TMDB, indexeru a serveru archivu.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRuntime } = require('./harness');
const H = require('../webshare/src/hash');

const code = fs.readFileSync(path.join(__dirname, '..', 'webshare', 'webshare.js'), 'utf8');
const sha1hex = s => require('node:crypto').createHash('sha1').update(s).digest('hex');

// ───────────── napodobené služby (fetch v Node, kterým harness posílá požadavky pluginu) ─────────────
const SALT = '$1$Ab12Cd34$';
const PASSWORD = 'tajné heslo';
const requests = [];
const archived = [];
const xml = body => `<?xml version="1.0" encoding="UTF-8"?><response>${body}</response>`;
const file = (ident, name, size) => `<file><ident>${ident}</ident><name>${name}</name><type>mkv</type><img></img><size>${size}</size>` +
    '<positive_votes>2</positive_votes><negative_votes>0</negative_votes><password>0</password></file>';
const WS_FILES = {
    ws1: ['Matrix (1999) CZ dabing 1080p.mkv', 8_400_000_000, 'CZE'],
    ws2: ['The.Matrix.1999.1080p.BluRay.x264.mkv', 9_100_000_000, 'ENG'],
    ws3: ['Matrix Reloaded (2003) CZ.mkv', 7_000_000_000, 'CZE'],
    ws4: ['Frieren S01E05 1080p CZ titulky.mkv', 1_400_000_000, 'JPN']
};

function webshare(endpoint, form) {
    if (endpoint === 'salt') return form.get('username_or_email') === 'david' ? xml(`<status>OK</status><salt>${SALT}</salt>`) : xml('<status>FATAL</status><code>SALT_FATAL_1</code>');
    if (endpoint === 'login') {
        const good = form.get('password') === sha1hex(H.md5crypt(PASSWORD, SALT));
        return good ? xml('<status>OK</status><token>TOKEN1</token>') : xml('<status>FATAL</status><code>LOGIN_FATAL_1</code>');
    }
    if (form.get('wst') !== 'TOKEN1') return xml('<status>FATAL</status><code>NO_TOKEN</code>');
    if (endpoint === 'user_data') return xml('<status>OK</status><vip>1</vip><vip_days>42</vip_days>');
    if (endpoint === 'search') {
        const what = form.get('what').toLowerCase();
        const hits = Object.entries(WS_FILES).filter(([, [n]]) => what.split(/\s+/).every(w => n.toLowerCase().includes(w)));
        return xml(`<status>OK</status><total>${hits.length}</total>` + hits.map(([id, [n, s]]) => file(id, n, s)).join(''));
    }
    if (endpoint === 'file_info') {
        const f = WS_FILES[form.get('ident')];
        if (!f) return xml('<status>FATAL</status><code>FILE_INFO_FATAL_1</code>');
        const anime = /frieren/i.test(f[0]);
        return xml(`<status>OK</status><name>${f[0]}</name><size>${f[1]}</size><available>1</available><length>${anime ? 1440 : 8160}</length>` +
            `<video><stream><format>H264</format><width>1920</width><height>800</height></stream></video>` +
            `<audio><stream><format>AC3</format><channels>6</channels><language>${f[2]}</language></stream></audio>`);
    }
    if (endpoint === 'file_link') return xml(`<status>OK</status><link>https://free.example/dl/${form.get('ident')}.mkv</link>`);
    return xml('<status>FATAL</status>');
}

const HS_ITEMS = [
    { id: 501, title: 'Matrix 1999 CZ dabing', fileHash: 'aa11', size: 2_100_000_000, duration: 8150, thumbs: ['https://img.hellspy.example/501.jpg'] },
    { id: 502, title: 'Matrix 1999 CZ dabing', fileHash: 'bb22', size: 2_100_000_000, duration: 8150, thumbs: [] },
    { id: 503, title: 'Kung Fu Panda 2008', fileHash: 'cc33', size: 900_000_000, duration: 5400, thumbs: [] }
];
function hellspy(u) {
    if (u.pathname === '/gw/search') {
        const q = (u.searchParams.get('query') || '').toLowerCase();
        return { items: HS_ITEMS.filter(i => q.split(/\s+/).every(w => i.title.toLowerCase().includes(w))) };
    }
    const m = u.pathname.match(/^\/gw\/video\/(\d+)\/(\w+)$/);
    if (m) {
        const it = HS_ITEMS.find(i => String(i.id) === m[1]);
        if (!it) return null;
        return { title: it.title, filename: `${it.title}.mkv`, size: it.size, duration: it.duration, thumbs: it.thumbs,
            conversions: { 720: `https://cdn.hellspy.example/${it.id}/720.mp4?ts=1`, 1080: `https://cdn.hellspy.example/${it.id}/1080.mp4?ts=1` },
            subtitles: [{ language: 'cze', url: `https://cdn.hellspy.example/${it.id}/cze.vtt` }] };
    }
    return null;
}

function tmdb(u) {
    if (u.pathname === '/3/find/tt0133093') return { movie_results: [{ id: 603 }], tv_results: [] };
    if (u.pathname === '/3/movie/603') return {
        id: 603, original_title: 'The Matrix', original_language: 'en', release_date: '1999-03-30', runtime: 136,
        translations: { translations: [{ iso_639_1: 'cs', iso_3166_1: 'CZ', data: { title: 'Matrix' } }, { iso_639_1: 'en', iso_3166_1: 'US', data: { title: 'The Matrix' } }] },
        alternative_titles: { titles: [] }
    };
    if (u.pathname === '/3/find/tt5958606' || u.pathname === '/3/find/tt22248376') return { movie_results: [], tv_results: [{ id: 209867 }] };
    if (u.pathname === '/3/tv/209867') return {
        id: 209867, original_name: '葬送のフリーレン', original_language: 'ja', first_air_date: '2023-09-29',
        translations: { translations: [{ iso_639_1: 'en', iso_3166_1: 'US', data: { name: 'Frieren: Beyond Journey\'s End' } }] },
        alternative_titles: { results: [] }
    };
    if (/^\/3\/tv\/209867\/season\/1/.test(u.pathname)) return { episodes: [{ episode_number: 5, runtime: 24 }] };
    return null;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    requests.push(`${opts.method || 'GET'} ${u.host}${u.pathname}${u.search}`);
    if (u.host === 'webshare.cz') {
        const form = new URLSearchParams(opts.body || '');
        return new Response(webshare(u.pathname.split('/')[2], form), { headers: { 'content-type': 'text/xml; charset=UTF-8' } });
    }
    if (u.host === 'api.hellspy.to') { const b = hellspy(u); return b ? json(b) : json({ error: 'not found' }, 404); }
    if (u.host === 'api.themoviedb.org') { const b = tmdb(u); return b ? json(b) : json({ status_code: 34 }, 404); }
    if (u.host === 'indexer.ddnsfree.com') {
        if (u.searchParams.get('anilist') === '154587') return json({ anilist_id: 154587, imdb_id: 'tt22248376', type: 'TV', title: 'Sousou no Frieren',
            title_en: 'Frieren: Beyond Journey\'s End', titles: ['Sousou no Frieren', 'Frieren'], season: 1, episode: 5 });
        return json({}, 404);
    }
    if (u.host === 'webshare-stremio.freeddns.org') { archived.push(JSON.parse(opts.body)); return json({ ok: true }); }
    return json({}, 404);   // ČSFD, Cinemeta…
};

// ───────────── testy ─────────────
const ACCOUNT = { username: 'david', password: PASSWORD };
const MATRIX = ['603', 'movie', null, null, { imdbId: 'tt0133093', tmdbId: '603', videoId: 'tt0133093', type: 'movie', platform: 'tvos' }];
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('MD5-crypt jako openssl passwd -1', () => {
    assert.equal(H.md5crypt('password', '$1$saltsalt$'), '$1$saltsalt$qjXMvbEw8oaL.CzflDtaK/');
});

test('film: Webshare i Hellspy, jiný díl série vyřazený, odkaz až při spuštění', async () => {
    const rt = createRuntime({ code, scraperId: 'webshare', keepAlive: true, globals: { TMDB_API_KEY: 'tmdbkey123' } });
    const streams = await rt.call(ACCOUNT, 'getStreams', MATRIX);
    const ws = streams.filter(s => s.resolve && s.resolve.w);
    const hs = streams.filter(s => s.resolve && s.resolve.h);
    assert.ok(ws.length >= 2, 'Webshare streamy');
    assert.ok(hs.length >= 1, 'Hellspy streamy');
    assert.ok(!streams.some(s => /Reloaded/.test(s.title)), 'Matrix Reloaded nepatří k filmu Matrix');
    assert.ok(streams.every(s => !s.url), 'žádná adresa předem – jen resolve');
    assert.match(streams[0].title, /Matrix \(1999\) CZ dabing/, 'CZ dabing první');
    assert.match(streams[0].title, /🇨🇿 CZ/);
    // Hellspy: dvě kopie se stejnou velikostí → jedna; titulky přímo z Hellspy
    assert.equal(new Set(hs.map(s => s.resolve.h)).size, 1);
    assert.ok(hs.every(s => s.subtitles && s.subtitles[0].url === `https://cdn.hellspy.example/${s.resolve.h}/cze.vtt`));
    // přehrání
    const wsLink = await rt.call(ACCOUNT, 'resolveStream', [ws[0].resolve, { platform: 'tvos' }]);
    assert.equal(wsLink, `https://free.example/dl/${ws[0].resolve.w}.mkv`);
    const hsLink = await rt.call(ACCOUNT, 'resolveStream', [hs[0].resolve, { platform: 'tvos' }]);
    assert.equal(hsLink, `https://cdn.hellspy.example/${hs[0].resolve.h}/${hs[0].resolve.q}.mp4?ts=1`);
    assert.ok(rt.logs.some(l => /movie tt0133093 tmdb \| názvy: Matrix/.test(l)), 'řádek do Logs');
    // mezipaměť v NUVIO.files (TMDB, detail souborů) po uložení
    await new Promise(r => setTimeout(r, 16000));
    assert.ok(Object.keys(rt.files).some(n => /^cache-tmdb\.json$/.test(n)), 'TMDB v NUVIO.files');
});

test('bez účtu Webshare jen Hellspy', async () => {
    const rt = createRuntime({ code, scraperId: 'webshare', keepAlive: true, globals: { TMDB_API_KEY: 'tmdbkey123' } });
    const streams = await rt.call({}, 'getStreams', MATRIX);
    assert.ok(streams.length > 0);
    assert.ok(streams.every(s => s.resolve && s.resolve.h));
    const none = await rt.call({ hellspy: false }, 'getStreams', MATRIX);
    assert.deepEqual(none, []);
});

test('anime z AniListu (anilist:ID:díl) přes resolve-ids indexeru', async () => {
    const rt = createRuntime({ code, scraperId: 'webshare', keepAlive: true, globals: { TMDB_API_KEY: 'tmdbkey123' } });
    const before = requests.length;
    const streams = await rt.call(ACCOUNT, 'getStreams', ['154587', 'tv', null, 5, { videoId: 'anilist:154587:5', type: 'tv', platform: 'tvos' }]);
    const mine = requests.slice(before);
    assert.ok(mine.some(r => /indexer\.ddnsfree\.com\/api\/resolve-ids\?anilist=154587&episode=5/.test(r)), 'resolve-ids s anilist');
    assert.ok(streams.some(s => /Frieren S01E05/.test(s.title)), 'díl 5 nalezený');
});

test('archiv hledání: výchozí vypnutý, zapnutý pošle anonymní záznam', async () => {
    const rt = createRuntime({ code, scraperId: 'webshare', keepAlive: true, globals: { TMDB_API_KEY: 'tmdbkey123' } });
    archived.length = 0;
    await rt.call(ACCOUNT, 'getStreams', [...MATRIX.slice(0, 4), { ...MATRIX[4], imdbId: 'tt0133093' }]);
    await new Promise(r => setTimeout(r, 300));
    assert.equal(archived.length, 0, 'bez volby nic');
    // nové hledání (jiné ID, aby nešlo z mezipaměti výsledků)
    const rt2 = createRuntime({ code, scraperId: 'webshare', keepAlive: true, globals: { TMDB_API_KEY: 'tmdbkey123' } });
    await rt2.call({ ...ACCOUNT, archive: true }, 'getStreams', ['154587', 'tv', null, 5, { videoId: 'anilist:154587:5', type: 'tv', platform: 'tvos' }]);
    await new Promise(r => setTimeout(r, 300));
    assert.equal(archived.length, 1);
    const rec = archived[0].record;
    assert.equal(rec.kind, 'stream');
    assert.equal(rec.id, 'anilist:154587:5');
    assert.match(rec.v, /\+nuvio-/);
    const text = JSON.stringify(archived[0]);
    assert.ok(!text.includes('david') && !text.includes(PASSWORD) && !text.includes('TOKEN1'), 'nic o uživateli');
});

test('katalog Webshare Hledat a detail souboru', async () => {
    const rt = createRuntime({ code, scraperId: 'webshare', keepAlive: true, globals: { TMDB_API_KEY: 'tmdbkey123' } });
    const { metas } = await rt.call(ACCOUNT, 'getCatalog', ['movie', 'webshare_search', { search: 'matrix' }]);
    assert.ok(metas.length >= 3);
    assert.ok(metas.every(m => /^webshare-ws\d$/.test(m.id)));
    const { meta } = await rt.call(ACCOUNT, 'getMeta', ['movie', metas[0].id]);
    assert.equal(meta.id, metas[0].id);
    assert.match(meta.description, /💾/);
    const hsCat = await rt.call(ACCOUNT, 'getCatalog', ['movie', 'hellspy_search', { search: 'matrix' }]);
    assert.equal(hsCat.metas.length, 1, 'stejná velikost = jedna položka');
    const own = await rt.call(ACCOUNT, 'getStreams', ['webshare-ws1', 'movie', null, null, { videoId: 'webshare-ws1', type: 'movie' }]);
    assert.deepEqual(own.map(s => s.resolve), [{ w: 'ws1' }]);
});

test('Ověřit: VIP, špatné heslo, bez účtu', async () => {
    const rt = createRuntime({ code, scraperId: 'webshare', keepAlive: true });
    const good = await rt.call({}, 'onVerify', [ACCOUNT]);
    assert.equal(good.ok, true);
    assert.match(good.message, /VIP ještě 42 dní/);
    assert.match(good.message, /Hellspy odpovídá/);
    const bad = await rt.call({}, 'onVerify', [{ username: 'david', password: 'spatne' }]);
    assert.equal(bad.ok, false);
    assert.match(bad.message, /Špatné jméno nebo heslo/);
    const none = await rt.call({}, 'onVerify', [{}]);
    assert.equal(none.ok, true);
    assert.match(none.message, /bez účtu/);
});

test('nastavení: archiv ve výchozím stavu vypnutý a popsaný', async () => {
    const rt = createRuntime({ code, scraperId: 'webshare' });
    const form = await rt.call({}, 'onSettings', []);
    const archive = form.find(f => f.key === 'archive');
    assert.equal(archive.defaultValue, false);
    assert.match(form.map(f => f.description || '').join(' '), /anonymní záznam.*vylepšit hledání pro všechny/s);
    const pw = form.find(f => f.key === 'password');
    assert.equal(pw.isPassword, true);
});

(async () => {
    let failed = 0;
    for (const [name, fn] of tests) {
        try { await fn(); console.log(`ok   ${name}`); }
        catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.stack.split('\n').slice(0, 3).join('\n     ')}`); }
    }
    console.log(`\n${tests.length - failed}/${tests.length} ok`);
    process.exit(failed ? 1 : 0);
})();
