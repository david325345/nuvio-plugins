// The Apple TV extensions of the plugin format, run through the harness:
// kept-alive state, emit, NUVIO.files / NUVIO.settings / NUVIO.server,
// handleRequest and resolveStream. Usage: node test/platform.test.js
'use strict';
const assert = require('node:assert/strict');
const { createRuntime } = require('./harness');

const code = `
var searches = 0;

async function getStreams(id, type, season, episode, context) {
  searches += 1;
  var first = [{ name: 'Fast', resolve: { ident: 'a1' } }];
  if (context && context.emit) context.emit(first);
  await new Promise(function (r) { setTimeout(r, 10); });
  return first.concat([{ name: 'Slow', resolve: { ident: 'b2' } }]);
}

async function resolveStream(payload) {
  var links = JSON.parse(NUVIO.files.read('links.json') || '{}');
  return links[payload.ident] || null;
}

function handleRequest(request) {
  if (request.method === 'POST' && request.path === '/save') {
    NUVIO.settings.save({ token: request.form.token });
    return { redirect: request.baseUrl };
  }
  if (request.path === '/playlist.m3u8') {
    return { contentType: 'application/vnd.apple.mpegurl', body: '#EXTM3U\\n' + NUVIO.server.url('seg/1.ts') };
  }
  return '<form method="post" action="save"><input name="token" value="' + (NUVIO.settings.get().token || '') + '"></form>';
}

function count() { return searches; }

function remember() {
  NUVIO.files.write('links.json', JSON.stringify({ a1: 'https://cdn.example.com/a1.mkv' }));
  return NUVIO.files.usage();
}

module.exports = { getStreams: getStreams, resolveStream: resolveStream, handleRequest: handleRequest, count: count, remember: remember };
`;

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.stack || String(e)]); }
}

(async () => {
  await test('kept alive: module variables survive between calls', async () => {
    const alive = createRuntime({ code, scraperId: 'demo', keepAlive: true });
    await alive.call({}, 'getStreams', ['tt1', 'movie', null, null, {}]);
    await alive.call({}, 'getStreams', ['tt1', 'movie', null, null, {}]);
    assert.equal(await alive.call({}, 'count', []), 2);
    const fresh = createRuntime({ code, scraperId: 'demo' });
    await fresh.call({}, 'getStreams', ['tt1', 'movie', null, null, {}]);
    assert.equal(await fresh.call({}, 'count', []), 0, 'reloaded for every call, as on Android');
  });

  await test('emit: early streams, then the full list', async () => {
    const rt = createRuntime({ code, scraperId: 'demo' });
    const streams = await rt.call({}, 'getStreams', ['tt1', 'movie', null, null, {}], { emitIndex: 4 });
    assert.deepEqual(rt.emitted.map((list) => list.map((s) => s.name)), [['Fast']]);
    assert.deepEqual(streams.map((s) => s.name), ['Fast', 'Slow']);
  });

  await test('resolveStream reads what the plugin stored in NUVIO.files', async () => {
    const files = {};
    const rt = createRuntime({ code, scraperId: 'demo', files });
    assert.equal(await rt.call({}, 'remember', []), 39);
    assert.ok(files['links.json']);
    assert.equal(await rt.call({}, 'resolveStream', [{ ident: 'a1' }, { platform: 'tvos' }]), 'https://cdn.example.com/a1.mkv');
    assert.equal(await rt.call({}, 'resolveStream', [{ ident: 'zz' }, { platform: 'tvos' }]), null);
  });

  await test('handleRequest: a settings page that saves, and a route for the player', async () => {
    const rt = createRuntime({ code, scraperId: 'demo' });
    const page = await rt.call({ token: 'old' }, 'handleRequest', [{ method: 'GET', path: '/', query: {}, headers: {}, body: '', baseUrl: 'http://tv/t/plugin/k/', origin: 'setup' }]);
    assert.match(page, /value="old"/);
    const saved = await rt.call({}, 'handleRequest', [{ method: 'POST', path: '/save', form: { token: 'new' }, baseUrl: 'http://tv/t/plugin/k/', origin: 'setup' }]);
    assert.deepEqual(saved, { redirect: 'http://tv/t/plugin/k/' });
    assert.deepEqual(rt.savedSettings, { token: 'new' });
    const playlist = await rt.call({}, 'handleRequest', [{ method: 'GET', path: '/playlist.m3u8', baseUrl: '', origin: 'device' }]);
    assert.equal(playlist.body, '#EXTM3U\nhttp://127.0.0.1:8766/test/plugin/demo/seg/1.ts');
  });

  await test('a missing function is reported', async () => {
    const rt = createRuntime({ code: 'module.exports = {};', scraperId: 'demo' });
    await assert.rejects(rt.call({}, 'resolveStream', [{}]), /no resolveStream\(\) function/);
  });

  let failed = 0;
  for (const r of results) {
    console.log(r[0], r[1]);
    if (r[0] !== 'ok') { failed++; console.log(r[2]); }
  }
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
