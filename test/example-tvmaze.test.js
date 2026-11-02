// Runs examples/tvmaze-example.js the way Nuvio on Apple TV does, against a
// local fake TVmaze. Usage: node test/example-tvmaze.test.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createRuntime } = require('./harness');

const code = fs.readFileSync(path.join(__dirname, '..', 'examples', 'tvmaze-example.js'), 'utf8');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.stack || String(e)]); }
}

const severance = {
  id: 44933, name: 'Severance', url: 'https://www.tvmaze.com/shows/44933/severance', premiered: '2022-02-18', ended: null,
  genres: ['Drama', 'Science-Fiction'], rating: { average: 8.6 }, image: { medium: 'https://img/m.jpg', original: 'https://img/o.jpg' },
  summary: '<p>Mark leads a team &amp; more.</p>', externals: { imdb: 'tt11280740' }
};
const local = {
  id: 7, name: 'Local Show', url: 'https://www.tvmaze.com/shows/7/local', premiered: '2020-01-01', ended: '2021-05-01',
  genres: ['Comedy'], rating: { average: null }, image: null, summary: null, externals: { imdb: null }
};

(async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    requests.push(url.pathname + url.search);
    const send = (body, status = 200) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
    if (url.pathname === '/schedule/web') {
      return send([{ _embedded: { show: severance } }, { _embedded: { show: severance } }, { _embedded: { show: local } }]);
    }
    if (url.pathname === '/search/shows') return send([{ score: 1, show: severance }]);
    if (url.pathname === '/shows/7') {
      return send(Object.assign({}, local, { _embedded: { episodes: [
        { id: 1, name: 'Pilot', season: 1, number: 1, airdate: '2020-01-01', image: null, summary: '<p>First.</p>' }
      ] } }));
    }
    if (url.pathname === '/lookup/shows') return url.searchParams.get('imdb') === 'tt11280740' ? send(severance) : send(null, 404);
    if (url.pathname === '/shows/44933/episodebynumber') return send({ id: 9, url: 'https://www.tvmaze.com/episodes/9', rating: { average: 9.1 } });
    send({}, 404);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const storage = {};
  const rt = () => createRuntime({ code, scraperId: 'tvmaze-example', storage, globals: { __exampleTest: { tvmaze: base } } });

  await test('today: one item per show, IMDb ids where known, own ids otherwise', async () => {
    const { metas } = await rt().call({}, 'getCatalog', ['series', 'today', {}]);
    assert.deepEqual(metas.map((m) => m.id), ['tt11280740', 'tvmaze:7']);
    assert.equal(metas[0].description, 'Mark leads a team & more.');
    assert.equal(metas[0].releaseInfo, '2022–');
    assert.equal(metas[1].releaseInfo, '2020–2021');
  });

  await test('today is cached in localStorage; genre and skip filter it', async () => {
    requests.length = 0;
    const { metas } = await rt().call({}, 'getCatalog', ['series', 'today', { genre: 'Comedy' }]);
    assert.deepEqual(metas.map((m) => m.name), ['Local Show']);
    const skipped = await rt().call({}, 'getCatalog', ['series', 'today', { skip: '1' }]);
    assert.equal(skipped.metas.length, 1);
    assert.equal(requests.length, 0);
  });

  await test('search', async () => {
    const { metas } = await rt().call({}, 'getCatalog', ['series', 'search', { search: 'severance' }]);
    assert.deepEqual(metas.map((m) => m.name), ['Severance']);
    assert.deepEqual((await rt().call({}, 'getCatalog', ['series', 'search', {}])).metas, []);
  });

  await test('metadata for own ids, with episodes', async () => {
    const { meta } = await rt().call({}, 'getMeta', ['series', 'tvmaze:7']);
    assert.equal(meta.id, 'tvmaze:7');
    assert.equal(meta.videos.length, 1);
    assert.equal(meta.videos[0].id, 'tvmaze:7:1:1');
    assert.equal(meta.videos[0].overview, 'First.');
  });

  await test('ratings for a show and an episode', async () => {
    assert.deepEqual(await rt().call({}, 'getRatings', ['series', 'tt11280740', {}]),
      [{ source: 'tvmaze', value: 8.6, url: 'https://www.tvmaze.com/shows/44933/severance' }]);
    assert.deepEqual(await rt().call({}, 'getRatings', ['series', 'tt11280740:1:2', {}]),
      [{ source: 'tvmaze', value: 9.1, url: 'https://www.tvmaze.com/episodes/9' }]);
    assert.deepEqual(await rt().call({}, 'getRatings', ['series', 'tt0000001', {}]), []);
  });

  await test('the IMDb lookup is remembered', async () => {
    requests.length = 0;
    await rt().call({}, 'getRatings', ['series', 'tt11280740', {}]);
    assert.ok(!requests.some((r) => r.startsWith('/lookup/shows')), requests.join(', '));
  });

  server.close();
  for (const [state, name, detail] of results) console.log(`${state} ${name}${detail ? '\n' + detail : ''}`);
  const failed = results.filter((r) => r[0] !== 'ok').length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
