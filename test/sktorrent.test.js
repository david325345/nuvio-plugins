// Plugin SKTorrent (sktorrent/sktorrent.js) tak, jak běží na Apple TV (harness s polyfilly Nuvia
// a cheerio přes test/dom-natives.js), proti napodobenému SKT, Real-Debridu, TorBoxu a TMDB.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRuntime } = require('./harness');
const domNatives = require('./dom-natives');

const code = fs.readFileSync(path.join(__dirname, '..', 'sktorrent', 'sktorrent.js'), 'utf8');
const A = 'a'.repeat(40), B = 'b'.repeat(40);
const PUBLIC = 'https://raw.githubusercontent.com/david325345/sktorrent-realdebrid-docker/main/public/';
const requests = [];

// ───────────── napodobené služby ─────────────
const skHtml = items => `<table>${items.map(([h, n]) => `<tr><td><b>Seriály CZ</b><a href="details.php?id=${h}" title="${n}"><img src="p.jpg"></a> Velkost 1.2 GB | Odosielaju : 5</td></tr>`).join('')}</table>`;
const rdFiles = { [A]: [{ id: 1, path: '/Show.S01E05.mkv', bytes: 900 }],
    [B]: [{ id: 1, path: '/Show S01/Show.S01E04.mkv', bytes: 800 }, { id: 2, path: '/Show S01/Show.S01E05.mkv', bytes: 800 }] };
const rdCached = new Set([B]);
const rdT = {}; let rdId = 0;
const tbCached = new Set([B]);
const tbT = {}; let tbId = 100;
const tbFilesOf = { [B]: [{ id: 0, name: 'Show S01/Show.S01E05.mkv', short_name: 'Show.S01E05.mkv', size: 800 }, { id: 7, name: 'Show S01/Show.S01E04.mkv', short_name: 'Show.S01E04.mkv', size: 800 }] };

const json = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const m = (opts.method || 'GET').toUpperCase();
    const q = Object.fromEntries(u.searchParams);
    requests.push({ m, url: `${u.host}${u.pathname}`, q, headers: opts.headers || {}, body: opts.body });
    if (u.host === 'sktorrent.eu') {
        if (u.pathname === '/torrent/login.php') {
            const f = new URLSearchParams(opts.body);
            if (f.get('uid') === 'david' && f.get('pwd') === 'heslo') {
                // Apple TV spojí víc Set-Cookie do jedné hlavičky (čárkou)
                return new Response('', { status: 302, headers: { location: '/torrent/index.php', 'set-cookie': 'uid=777; expires=Wed, 21 Oct 2027 07:28:00 GMT; path=/, pass=abc123; path=/' } });
            }
            return new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } });
        }
        const words = String(q.search || '').toLowerCase().split(' ').filter(Boolean);
        const html = skHtml([[A, 'Show S01E05 CZ'], [B, 'Show S01 CZ komplet']].filter(([, n]) => words.every(w => n.toLowerCase().includes(w))));
        return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (u.host === 'api.themoviedb.org') {
        if (u.pathname.includes('/find/')) return json({ movie_results: [], tv_results: [{ id: 5, name: 'Show', first_air_date: '2020-01-01' }] });
        if (u.pathname.includes('/tv/5')) return json({ name: 'Show', first_air_date: '2020-01-01' });
        return json({}, 404);
    }
    if (u.host === 'api.real-debrid.com') {
        const body = new URLSearchParams(opts.body || '');
        const p = u.pathname;
        if (p.endsWith('/user')) return json({ username: 'david', type: 'premium', expiration: '2027-01-01T00:00:00Z' });
        if (p.endsWith('/torrents') && m === 'GET') return json(Object.values(rdT).map(t => ({ id: t.id, hash: t.hash, status: t.status, progress: 0, links: t.links })));
        if (p.endsWith('/torrents/addMagnet')) {
            const h = body.get('magnet').match(/btih:([a-f0-9]{40})/)[1]; const id = `rd${++rdId}`;
            rdT[id] = { id, hash: h, status: 'waiting_files_selection', files: rdFiles[h].map(f => ({ ...f, selected: 0 })), links: [] };
            return json({ id });
        }
        if (p.includes('/torrents/selectFiles/')) {
            const t = rdT[p.split('/').pop()]; const ids = body.get('files').split(',').map(Number);
            t.files.forEach(f => { f.selected = ids.includes(f.id) ? 1 : 0; });
            if (rdCached.has(t.hash)) { t.status = 'downloaded'; t.links = t.files.filter(f => f.selected).sort((a, b) => a.id - b.id).map(f => `L-${t.id}-${f.id}`); }
            else t.status = 'downloading';
            return new Response(null, { status: 204 });
        }
        if (p.includes('/torrents/info/')) { const t = rdT[p.split('/').pop()]; return json({ id: t.id, hash: t.hash, status: t.status, progress: t.status === 'downloaded' ? 100 : 0, files: t.files, links: t.links }); }
        if (p.endsWith('/unrestrict/link')) return json({ download: `https://rd.cdn/${body.get('link')}` });
    }
    if (u.host === 'api.torbox.app') {
        const p = u.pathname;
        if (p.endsWith('/user/me')) return json({ success: true, data: { plan: 2, premium_expires_at: '2027-01-01T00:00:00Z' } });
        if (p.endsWith('/checkcached')) { const d = {}; String(q.hash).split(',').forEach(h => { if (tbCached.has(h)) d[h] = { name: 'x', size: 1, hash: h }; }); return json({ success: true, data: d }); }
        if (p.endsWith('/mylist')) return q.id ? json({ success: true, data: tbT[q.id] }) : json({ success: true, data: Object.values(tbT) });
        if (p.endsWith('/getqueued')) return json({ success: true, data: [] });
        if (p.endsWith('/createtorrent')) {
            const magnet = decodeURIComponent((String(opts.body).match(/name="magnet"\r\n\r\n([^\r]+)/) || [])[1] || '');
            const h = (magnet.match(/btih:([a-f0-9]{40})/) || [])[1]; const id = ++tbId; const cached = tbCached.has(h);
            tbT[id] = { id, hash: h, download_state: cached ? 'cached' : 'downloading', download_present: cached, download_finished: cached, progress: cached ? 1 : 0.1, files: cached ? tbFilesOf[h] : [] };
            return json({ success: true, detail: cached ? 'Found Cached Torrent' : 'Added', data: { torrent_id: id, hash: h } });
        }
        if (p.endsWith('/requestdl')) return json({ success: true, data: `https://tb.cdn/${q.torrent_id}/${q.file_id}` });
    }
    return json({}, 404);   // ČSFD, OMDb…
};

// ───────────── testy ─────────────
const KEYS = { rd_token: 'RDTOKEN', tb_key: 'TBKEY' };
const EPISODE = ['5', 'tv', 1, 5, { imdbId: 'tt0000001', videoId: 'tt0000001:1:5', type: 'tv', season: 1, episode: 5, platform: 'tvos' }];
const runtime = () => createRuntime({ code, scraperId: 'sktorrent', keepAlive: true, natives: domNatives(), globals: { TMDB_API_KEY: 'tmdbkey' } });
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('díl seriálu: 2 torrenty × RD a TorBox, odkaz až při spuštění', async () => {
    const rt = runtime();
    const streams = await rt.call(KEYS, 'getStreams', EPISODE);
    assert.deepEqual(streams.map(s => s.name.split('\n')[0]), ['SKT+RD', 'SKT+TB', 'SKT+RD', 'SKT+TB ⚡']);
    assert.ok(streams.every(s => !s.url && s.resolve && s.resolve.h && s.resolve.s.season === 1 && s.resolve.s.episode === 5));
    assert.deepEqual(streams.map(s => [s.resolve.p, s.resolve.h]), [['rd', A], ['tb', A], ['rd', B], ['tb', B]]);
    // přehrání B E05 přes RD a TorBox
    const rd = await rt.call(KEYS, 'resolveStream', [streams[2].resolve, { platform: 'tvos' }]);
    assert.equal(rd, 'https://rd.cdn/L-rd1-2');
    const tb = await rt.call(KEYS, 'resolveStream', [streams[3].resolve, { platform: 'tvos' }]);
    assert.match(tb, /^https:\/\/tb\.cdn\/\d+\/0$/);
    // A není v cache RD → informační video z repozitáře addonu
    const dl = await rt.call(KEYS, 'resolveStream', [streams[0].resolve, { platform: 'tvos' }]);
    assert.equal(dl, `${PUBLIC}downloading.mp4`);
    assert.ok(rt.logs.some(l => /tt0000001/.test(l)), 'řádky do Logs');
});

test('každý seznam streamů má jinou značku (Nuvio drží odkaz 10 min)', async () => {
    const rt = runtime();
    const a = await rt.call(KEYS, 'getStreams', EPISODE);
    await new Promise(r => setTimeout(r, 5));
    const b = await rt.call(KEYS, 'getStreams', EPISODE);
    assert.notEqual(a[0].resolve.n, b[0].resolve.n);
});

test('přihlášení na SKT: cookies uid/pass v dotazech na SKT, ne v archivu ani logu', async () => {
    const rt = runtime();
    const before = requests.length;
    await rt.call({ ...KEYS, skt_user: 'david', skt_pass: 'heslo' }, 'getStreams', ['5', 'tv', 1, 4, { imdbId: 'tt0000001', videoId: 'tt0000001:1:4', type: 'tv' }]);
    const mine = requests.slice(before);
    assert.ok(mine.some(r => r.url === 'sktorrent.eu/torrent/login.php'), 'přihlášení');
    const search = mine.filter(r => r.url === 'sktorrent.eu/torrent/torrents_v2.php');
    assert.ok(search.length > 0);
    const cookie = Object.entries(search[0].headers).find(([k]) => k.toLowerCase() === 'cookie');
    assert.equal(cookie && cookie[1], 'uid=777; pass=abc123');
    assert.ok(!rt.logs.join('\n').includes('abc123'), 'cookies ne v logu');
});

test('katalog SKTorrent a detail torrentu', async () => {
    const rt = runtime();
    const { metas } = await rt.call(KEYS, 'getCatalog', ['movie', 'skt-search', { search: 'show' }]);
    assert.deepEqual(metas.map(m => m.id), [`skt${A}`, `skt${B}`]);
    const { meta } = await rt.call(KEYS, 'getMeta', ['movie', `skt${B}`]);
    assert.match(meta.description, /Seriály CZ/);
    const off = await rt.call({ ...KEYS, skt_search: false }, 'getCatalog', ['movie', 'skt-search', { search: 'show' }]);
    assert.deepEqual(off.metas, []);
    const direct = await rt.call(KEYS, 'getStreams', [`skt${B}`, 'movie', null, null, { videoId: `skt${B}`, type: 'movie' }]);
    assert.ok(direct.length >= 2 && direct.every(s => s.resolve && s.resolve.h === B));
});

test('Ověřit: RD, TorBox a přihlášení na SKT', async () => {
    const rt = runtime();
    const ok = await rt.call({}, 'onVerify', [{ ...KEYS, skt_user: 'david', skt_pass: 'heslo' }]);
    assert.equal(ok.ok, true, ok.message);
    assert.match(ok.message, /Real-Debrid: david, premium/);
    assert.match(ok.message, /TorBox: Pro/);
    assert.match(ok.message, /SKTorrent: přihlášení v pořádku/);
    const bad = await rt.call({}, 'onVerify', [{ ...KEYS, skt_user: 'david', skt_pass: 'spatne' }]);
    assert.equal(bad.ok, false);
    const none = await rt.call({}, 'onVerify', [{}]);
    assert.equal(none.ok, false);
});

test('bez klíčů nic, nastavení bez archivu, dokud není adresa serveru', async () => {
    const rt = runtime();
    assert.deepEqual(await rt.call({}, 'getStreams', EPISODE), []);
    const form = await rt.call({}, 'onSettings', []);
    assert.ok(form.find(f => f.key === 'rd_token').isPassword);
    assert.ok(form.find(f => f.key === 'skt_pass').isPassword);
    assert.ok(!form.some(f => f.key === 'archive'));
});

(async () => {
    let failed = 0;
    for (const [name, fn] of tests) {
        try { await fn(); console.log(`ok   ${name}`); }
        catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.stack.split('\n').slice(0, 4).join('\n     ')}`); }
    }
    console.log(`\n${tests.length - failed}/${tests.length} ok`);
    process.exit(failed ? 1 : 0);
})();
