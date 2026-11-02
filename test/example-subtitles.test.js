// Runs examples/opensubtitles-example.js the way Nuvio on Apple TV does,
// against a local fake OpenSubtitles add-on. Usage: node test/example-subtitles.test.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createRuntime } = require('./harness');

const code = fs.readFileSync(path.join(__dirname, '..', 'examples', 'opensubtitles-example.js'), 'utf8');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.stack || String(e)]); }
}

(async () => {
  const requests = [];
  let failing = false;
  const server = http.createServer((req, res) => {
    requests.push(decodeURIComponent(req.url));
    if (failing) { res.statusCode = 500; return res.end('{}'); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      subtitles: [
        { id: '1', url: 'https://subs.example/1.srt', lang: 'cze' },
        { id: '2', url: 'https://subs.example/2.srt', lang: 'eng' },
        { id: '3', url: 'https://subs.example/3.srt', lang: 'slo' },
        { id: '4', lang: 'cze' }
      ]
    }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const rt = () => createRuntime({ code, scraperId: 'opensubtitles-example', globals: { __exampleTest: { base } } });

  await test('Czech and Slovak by default, with the Stremio extras in the path', async () => {
    requests.length = 0;
    const subs = await rt().call({}, 'getSubtitles', ['series', 'tt0903747:1:1', { filename: 'Breaking Bad S01E01.mkv', videoSize: 123 }]);
    assert.deepEqual(subs.map((s) => s.lang), ['cze', 'slo']);
    assert.equal(subs[0].label, 'OpenSubtitles CZE');
    assert.equal(requests[0], '/subtitles/series/tt0903747:1:1/filename=Breaking Bad S01E01.mkv&videoSize=123.json');
  });

  await test('the language setting filters', async () => {
    const english = await rt().call({ languages: 'en' }, 'getSubtitles', ['movie', 'tt0133093', {}]);
    assert.deepEqual(english.map((s) => s.url), ['https://subs.example/2.srt']);
    const all = await rt().call({ languages: 'all' }, 'getSubtitles', ['movie', 'tt0133093', {}]);
    assert.equal(all.length, 3);
  });

  await test('other ids are skipped without a request', async () => {
    requests.length = 0;
    assert.deepEqual(await rt().call({}, 'getSubtitles', ['series', 'kitsu:1:1', {}]), []);
    assert.equal(requests.length, 0);
  });

  await test('errors reach the app (Test button, logs)', async () => {
    failing = true;
    await assert.rejects(() => rt().call({}, 'getSubtitles', ['movie', 'tt0133093', {}]), /HTTP 500/);
    failing = false;
  });

  await test('onSettings describes the form', async () => {
    const layout = await rt().call({}, 'onSettings', []);
    assert.equal(layout[0].key, 'languages');
    assert.equal(layout[0].defaultValue, 'cs-sk');
  });

  server.close();
  for (const [state, name, detail] of results) console.log(`${state} ${name}${detail ? '\n' + detail : ''}`);
  const failed = results.filter((r) => r[0] !== 'ok').length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
