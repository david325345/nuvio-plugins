// Runs a plugin the way Nuvio on Apple TV does: in a bare JavaScript context
// with the app's polyfills (fetch, URL, timers, localStorage, crypto,
// NUVIO.files…). Use it to test your own plugins with Node 18+:
//
//   const { createRuntime } = require('./harness');
//   const rt = createRuntime({ code: fs.readFileSync('my-plugin.js', 'utf8'), scraperId: 'my-plugin' });
//   const streams = await rt.call({ apiKey: '…' }, 'getStreams', ['tt0133093', 'movie', null, null, { imdbId: 'tt0133093' }]);
//
// `call(settings, name, args, options)` sets SCRAPER_SETTINGS, loads the
// plugin (once with `keepAlive: true`, as Apple TV does for plugins that list
// `tvos` in `supportedPlatforms`) and awaits the exported function.
// `options.emitIndex` gives that argument `emit(list)`; the lists land in
// `options.onEmit` and in `rt.emitted`. `logs` collects console output,
// `files` the plugin's NUVIO.files and `savedSettings` what NUVIO.settings.save stored.
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const polyfills = fs.readFileSync(path.join(__dirname, 'nuvio-tvos-polyfills.js'), 'utf8');
const FILES_LIMIT = 50 * 1024 * 1024;

function createRuntime({ code, scraperId = 'plugin', storage = {}, files = {}, globals = {}, keepAlive = false }) {
  const done = new Map();
  const emitHandlers = new Map();
  const logs = [];
  const timers = new Map();
  const controllers = new Map();
  const runtime = { logs, files, emitted: [], savedSettings: null };
  let nextCallId = 1;
  let loaded = false;
  const ctx = vm.createContext({});
  const usage = () => Object.values(files).reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  ctx.__nuvioNative = {
    log: (level, msg) => logs.push(`${level}: ${msg}`),
    setTimer: (id, ms) => timers.set(id, setTimeout(() => { timers.delete(id); ctx.__nuvioTimerFired(id); }, ms)),
    clearTimer: (id) => { clearTimeout(timers.get(id)); timers.delete(id); },
    fetch: (id, url, json) => {
      const opts = JSON.parse(json);
      const controller = new AbortController();
      controllers.set(id, controller);
      const started = Date.now();
      fetch(url, { method: opts.method, headers: opts.headers, body: opts.body, signal: controller.signal, redirect: opts.redirect || 'follow' })
        .then(async (res) => {
          const headers = {};
          res.headers.forEach((v, k) => { headers[k] = v; });
          const text = await res.text();
          logs.push(`net: ${opts.method || 'GET'} ${url} → ${res.status} · ${Date.now() - started} ms`);
          ctx.__nuvioFetchDone(id, JSON.stringify({ status: res.status, statusText: res.statusText, headers, url: res.url, text }));
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
    settingsSave: (json) => { runtime.savedSettings = JSON.parse(json); return true; },
    fileRead: (name) => (Object.prototype.hasOwnProperty.call(files, name) ? files[name] : null),
    fileWrite: (name, text) => {
      const old = Object.prototype.hasOwnProperty.call(files, name) ? Buffer.byteLength(files[name]) : 0;
      if (!name || usage() - old + Buffer.byteLength(text) > FILES_LIMIT) return false;
      files[name] = text;
      return true;
    },
    fileRemove: (name) => { delete files[name]; },
    fileList: () => Object.keys(files).sort(),
    fileUsage: () => usage(),
    routeURL: (p) => `http://127.0.0.1:8766/test/plugin/${scraperId}/${String(p).replace(/^\/+/, '')}`,
    emit: (callId, json) => { const handler = emitHandlers.get(callId); if (handler) handler(JSON.parse(json)); },
    done: (json, error, callId) => done.set(callId, { json, error }),
  };
  vm.runInContext(polyfills, ctx);
  Object.assign(ctx, globals);
  runtime.call = async function (settings, name, args, options = {}) {
    vm.runInContext(`globalThis.SCRAPER_ID = ${JSON.stringify(scraperId)}; globalThis.SCRAPER_SETTINGS = ${JSON.stringify(settings || {})};`, ctx);
    if (!keepAlive || !loaded) {
      vm.runInContext(`var module = { exports: {} }; var exports = module.exports; (function() {\n${code}\n})();`, ctx);
      loaded = true;
    }
    const callId = nextCallId++;
    runtime.emitted = [];
    emitHandlers.set(callId, (list) => { runtime.emitted.push(list); if (options.onEmit) options.onEmit(list); });
    const emitIndex = typeof options.emitIndex === 'number' ? options.emitIndex : -1;
    vm.runInContext(`__nuvioInvoke(${JSON.stringify(name)}, ${JSON.stringify(args || [])}, ${callId}, ${emitIndex})`, ctx);
    while (!done.has(callId)) await new Promise((r) => setTimeout(r, 5));
    const result = done.get(callId);
    done.delete(callId);
    emitHandlers.delete(callId);
    if (result.error === '__missing__') throw new Error(`The plugin has no ${name}() function.`);
    if (result.error) throw new Error(result.error);
    return JSON.parse(result.json);
  };
  return runtime;
}

module.exports = { createRuntime };
