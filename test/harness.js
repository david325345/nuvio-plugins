// Runs a plugin the way Nuvio on Apple TV does: in a bare JavaScript context
// with the app's polyfills (fetch, URL, timers, localStorage, crypto…). Use it
// to test your own plugins with Node 18+:
//
//   const { createRuntime } = require('./harness');
//   const rt = createRuntime({ code: fs.readFileSync('my-plugin.js', 'utf8'), scraperId: 'my-plugin' });
//   const streams = await rt.call({ apiKey: '…' }, 'getStreams', ['tt0133093', 'movie', null, null, { imdbId: 'tt0133093' }]);
//
// `call(settings, name, args)` sets SCRAPER_SETTINGS, loads the plugin and
// awaits the exported function; `logs` collects console output.
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const polyfills = fs.readFileSync(path.join(__dirname, 'nuvio-tvos-polyfills.js'), 'utf8');

function createRuntime({ code, scraperId = 'plugin', storage = {}, globals = {} }) {
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
  Object.assign(ctx, globals);
  return {
    logs,
    async call(settings, name, args) {
      vm.runInContext(`globalThis.SCRAPER_ID = ${JSON.stringify(scraperId)}; globalThis.SCRAPER_SETTINGS = ${JSON.stringify(settings || {})};`, ctx);
      vm.runInContext(`var module = { exports: {} }; var exports = module.exports; (function() {\n${code}\n})();`, ctx);
      const before = done.length;
      vm.runInContext(`__nuvioInvoke(${JSON.stringify(name)}, ${JSON.stringify(args)})`, ctx);
      while (done.length === before) await new Promise((r) => setTimeout(r, 5));
      const result = done[before];
      if (result.error) throw new Error(result.error);
      return JSON.parse(result.json);
    },
  };
}

module.exports = { createRuntime };
