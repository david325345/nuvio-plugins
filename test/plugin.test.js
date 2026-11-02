// Runs usenet-direct.js the way Nuvio on Apple TV does: in a bare JavaScript
// context with the app's polyfills (fetch, URL, timers, localStorage…), against
// a local fake Newznab indexer and TVmaze. Usage: node test/plugin.test.js
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const polyfills = fs.readFileSync(path.join(__dirname, 'nuvio-tvos-polyfills.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '..', 'usenet-direct.js'), 'utf8');
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

function runtime(storage, testHooks) {
  const done = [];
  const logs = [];
  const timers = new Map();
  const controllers = new Map();
  const ctx = vm.createContext({});
  ctx.__nuvioNative = {
    log: (level, msg) => logs.push(`${level}: ${msg}`),
    setTimer: (id, ms) => timers.set(id, setTimeout(() => { timers.delete(id); ctx.__nuvioTimerFired(id); }, ms)),
    clearTimer: (id) => { clearTimeout(timers.get(id)); timers.delete(id); },
    fetch: (id, url, json) => {
      const opts = JSON.parse(json);
      const controller = new AbortController();
      controllers.set(id, controller);
      fetch(url, { method: opts.method, headers: opts.headers, body: opts.body, signal: controller.signal })
        .then(async (res) => {
          const headers = {};
          res.headers.forEach((v, k) => { headers[k] = v; });
          ctx.__nuvioFetchDone(id, JSON.stringify({ status: res.status, statusText: res.statusText, headers, url: res.url, text: await res.text() }));
        })
        .catch((e) => ctx.__nuvioFetchDone(id, JSON.stringify({ error: String(e.message || e) })));
    },
    abortFetch: (id) => controllers.get(id)?.abort(),
    digest: (alg, b64) => crypto.createHash(alg.replace('-', '').toLowerCase()).update(Buffer.from(b64, 'base64')).digest('base64'),
    hmac: (alg, k, b64) => crypto.createHmac(alg.replace('-', '').toLowerCase(), Buffer.from(k, 'base64')).update(Buffer.from(b64, 'base64')).digest('base64'),
    randomBytes: (n) => crypto.randomBytes(n).toString('base64'),
    storageGet: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
    storageSet: (k, v) => { storage[k] = v; return true; },
    storageRemove: (k) => { delete storage[k]; },
    storageClear: () => { for (const k of Object.keys(storage)) delete storage[k]; },
    storageKeys: () => Object.keys(storage).sort(),
    done: (json, error) => done.push({ json, error }),
  };
  vm.runInContext(polyfills, ctx);
  ctx.__usenetDirectTest = testHooks;
  return {
    logs,
    async call(settings, name, args) {
      vm.runInContext(`globalThis.SCRAPER_ID = 'usenet-direct'; globalThis.SCRAPER_SETTINGS = ${JSON.stringify(settings)};`, ctx);
      vm.runInContext(`var module = { exports: {} }; var exports = module.exports; (function() {\n${plugin}\n})();`, ctx);
      const before = done.length;
      vm.runInContext(`__nuvioInvoke(${JSON.stringify(name)}, ${JSON.stringify(args)})`, ctx);
      while (done.length === before) await new Promise((r) => setTimeout(r, 5));
      const result = done[before];
      if (result.error) throw new Error(result.error);
      return JSON.parse(result.json);
    },
  };
}

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.stack || String(e)]); }
}

(async () => {
  const requests = [];
  let limitMode = false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    requests.push(url);
    if (url.pathname === '/tvmaze/lookup/shows') {
      if (url.searchParams.get('imdb') === 'tt2193021') {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ id: 36, name: 'Arrow', externals: { thetvdb: 257655, imdb: 'tt2193021' } }));
      }
      res.statusCode = 404;
      return res.end('null');
    }
    if (url.pathname !== '/api') { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', 'application/xml');
    if (limitMode) return res.end('<?xml version="1.0"?><error code="429" description="Request limit reached"/>');
    if (url.searchParams.get('apikey') !== 'GOODKEY') return res.end('<?xml version="1.0"?><error code="100" description="Incorrect user credentials"/>');
    const t = url.searchParams.get('t');
    if (t === 'caps') return res.end(fixture('caps.xml'));
    if (t === 'movie' && url.searchParams.get('imdbid') === '0816692') return res.end(fixture('movie-interstellar.xml'));
    if (t === 'tvsearch' && url.searchParams.get('tvdbid') === '257655' && url.searchParams.get('season') === '4' && url.searchParams.get('ep') === '2') {
      return res.end(fixture('tv-arrow-s04e02.xml'));
    }
    return res.end(fixture('empty.xml'));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const hooks = { urls: { nzbgeek: `${base}/api`, althub: `${base}/api` }, tvmaze: `${base}/tvmaze` };
  const settings = { key_nzbgeek: 'GOODKEY' };

  await test('settings form lists the four indexers and preferences', async () => {
    const rt = runtime({}, hooks);
    const layout = await rt.call({}, 'onSettings', []);
    const keys = layout.map((f) => f.key).filter(Boolean);
    for (const k of ['key_nzbgeek', 'key_althub', 'key_usenetcrawler', 'key_dognzb', 'custom_url', 'max_res', 'prefer_cz']) assert.ok(keys.includes(k), k);
    assert.equal(layout.find((f) => f.key === 'key_dognzb').isPassword, true);
  });

  await test('movie: streams with nzbUrl straight to the indexer, cached afterwards', async () => {
    const storage = {};
    const rt = runtime(storage, hooks);
    requests.length = 0;
    const streams = await rt.call(settings, 'getStreams', ['157336', 'movie', null, null, { imdbId: 'tt0816692', platform: 'tvos' }]);
    assert.equal(streams.length, 2, 'password-protected release dropped');
    for (const s of streams) {
      assert.match(s.name, /^UD · NZBGeek/);
      const nzb = new URL(s.nzbUrl);
      assert.equal(nzb.searchParams.get('t'), 'get');
      assert.equal(nzb.searchParams.get('apikey'), 'GOODKEY');
      assert.ok(nzb.searchParams.get('id'));
      assert.match(s.description, /^🔎 NZBGeek\n/);
      assert.ok(s.behaviorHints.bingeGroup.startsWith('usenet-direct|'));
    }
    assert.ok(requests.some((u) => u.searchParams.get('t') === 'movie'));
    assert.ok(rt.logs.some((l) => /Usenet Direct tt0816692 → 2 · NZBGeek 3 \[imdbid\]/.test(l)), rt.logs.join('\n'));

    const again = runtime(storage, hooks);
    const before = requests.length;
    const cached = await again.call(settings, 'getStreams', ['157336', 'movie', null, null, { imdbId: 'tt0816692' }]);
    assert.equal(cached.length, 2);
    assert.equal(requests.length, before, 'second search came from localStorage');
  });

  await test('series: IMDb → TVmaze → tvdbid, season/episode filter', async () => {
    const rt = runtime({}, hooks);
    requests.length = 0;
    const streams = await rt.call(settings, 'getStreams', ['1412', 'tv', 4, 2, { imdbId: 'tt2193021' }]);
    assert.ok(streams.length >= 1, 'found episode releases');
    const search = requests.find((u) => u.searchParams.get('t') === 'tvsearch');
    assert.equal(search.searchParams.get('tvdbid'), '257655');
    assert.equal(search.searchParams.get('cat'), '5000');
    assert.ok(requests.some((u) => u.pathname === '/tvmaze/lookup/shows'));
    assert.ok(streams.every((s) => /S04E02/i.test(s.behaviorHints.filename)), streams.map((s) => s.behaviorHints.filename).join('\n'));
  });

  await test('IMDb id falls back to the first argument; no id means no search', async () => {
    const rt = runtime({}, hooks);
    const streams = await rt.call(settings, 'getStreams', ['tt0816692', 'movie', null, null]);
    assert.equal(streams.length, 2);
    const none = await rt.call(settings, 'getStreams', ['157336', 'movie', null, null]);
    assert.deepEqual(none, []);
  });

  await test('no keys: nothing is searched', async () => {
    const rt = runtime({}, hooks);
    requests.length = 0;
    assert.deepEqual(await rt.call({}, 'getStreams', ['tt0816692', 'movie', null, null, { imdbId: 'tt0816692' }]), []);
    assert.equal(requests.length, 0);
  });

  await test('verify reports each indexer, wrong keys included', async () => {
    const rt = runtime({}, hooks);
    const ok = await rt.call(settings, 'onVerify', [settings]);
    assert.equal(ok.ok, true);
    assert.match(ok.message, /NZBGeek ✓ \(series by tvdbid, tvmazeid\)/);
    const bad = await rt.call(settings, 'onVerify', [{ key_nzbgeek: 'GOODKEY', key_althub: 'WRONG' }]);
    assert.equal(bad.ok, false);
    assert.match(bad.message, /altHUB ✕ Incorrect user credentials \(100\)/);
  });

  await test('daily limit: indexer skipped until midnight UTC', async () => {
    const storage = {};
    const rt = runtime(storage, hooks);
    limitMode = true;
    requests.length = 0;
    const first = await rt.call(settings, 'getStreams', ['x', 'movie', null, null, { imdbId: 'tt0111161' }]);
    assert.deepEqual(first, []);
    assert.ok(rt.logs.some((l) => /Request limit reached \(429\)/.test(l)), rt.logs.join('\n'));
    const after = requests.length;
    await rt.call(settings, 'getStreams', ['x', 'movie', null, null, { imdbId: 'tt0068646' }]);
    assert.equal(requests.filter((u) => u.searchParams.get('t') === 'movie').length, 1, 'no second search while blocked');
    assert.ok(requests.length - after <= 1);
    limitMode = false;
  });

  server.close();
  let failed = 0;
  for (const r of results) {
    console.log(r[0], r[1]);
    if (r[0] !== 'ok') { failed++; console.log(r[2]); }
  }
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
