// SKTorrent 1.0.1 – plugin pro Nuvio na Apple TV. SESTAVENO, needitovat ručně.
// Zdroj: github.com/david325345/nuvio-plugins/tree/main/sktorrent/src + kód addonu github.com/david325345/sktorrent-realdebrid-docker 3.10.1 (b32345b).
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// shared/timers.js
function _setTimeout(fn, ms, ...args) {
  return wrap(st(fn, ms, ...args));
}
function _clearTimeout(t) {
  ct(unwrap(t));
}
var st, ct, si, ci, wrap, unwrap;
var init_timers = __esm({
  "shared/timers.js"() {
    st = globalThis.setTimeout;
    ct = globalThis.clearTimeout;
    si = globalThis.setInterval;
    ci = globalThis.clearInterval;
    wrap = (id) => ({ id, unref() {
      return this;
    }, ref() {
      return this;
    }, hasRef() {
      return true;
    } });
    unwrap = (t) => t && typeof t === "object" ? t.id : t;
  }
});

// shared/formdata.js
var require_formdata = __commonJS({
  "shared/formdata.js"(exports2, module2) {
    "use strict";
    init_timers();
    init_node_globals();
    var FormData = class {
      constructor() {
        this._fields = [];
      }
      append(name, value) {
        this._fields.push([String(name), String(value)]);
      }
      set(name, value) {
        this._fields = this._fields.filter(([n]) => n !== String(name));
        this.append(name, value);
      }
      get(name) {
        const f = this._fields.find(([n]) => n === String(name));
        return f ? f[1] : null;
      }
      has(name) {
        return this._fields.some(([n]) => n === String(name));
      }
      entries() {
        return this._fields.slice()[Symbol.iterator]();
      }
      multipart() {
        const boundary = "----NuvioFormBoundary" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const body = this._fields.map(([n, v]) => `--${boundary}\r
Content-Disposition: form-data; name="${n.replace(/"/g, "%22")}"\r
\r
${v}\r
`).join("") + `--${boundary}--\r
`;
        return { body, contentType: `multipart/form-data; boundary=${boundary}` };
      }
    };
    module2.exports = FormData;
  }
});

// shared/node-globals.js
var import_formdata, env, _process, _setImmediate;
var init_node_globals = __esm({
  "shared/node-globals.js"() {
    import_formdata = __toESM(require_formdata());
    env = true ? JSON.parse('{"CSFD_URL":"","CSFD_PUBLIC_URL":"https://csfd-rating.duckdns.org"}') : {};
    _process = { env, on() {
      return _process;
    }, once() {
      return _process;
    }, exit() {
    }, platform: "tvos", versions: {} };
    _setImmediate = (fn, ...args) => setTimeout(() => fn(...args), 0);
  }
});

// shared/axios.js
var require_axios = __commonJS({
  "shared/axios.js"(exports2, module2) {
    "use strict";
    init_timers();
    init_node_globals();
    var FormDataShim2 = require_formdata();
    function axiosError(message, code, extra) {
      const e = new Error(message);
      e.isAxiosError = true;
      e.code = code;
      return Object.assign(e, extra);
    }
    function buildUrl(url, params) {
      if (!params) return url;
      const pairs = [];
      for (const [k, v] of Object.entries(params)) {
        if (v === void 0 || v === null) continue;
        pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
      if (!pairs.length) return url;
      return url + (url.includes("?") ? "&" : "?") + pairs.join("&");
    }
    var splitCookies = (v) => (Array.isArray(v) ? v : String(v || "").split(/,(?=\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=)/)).map((s) => s.trim()).filter(Boolean);
    async function request(defaults, config) {
      const cfg = Object.assign({}, defaults, config);
      cfg.headers = Object.assign({}, defaults.headers, config.headers);
      const method = String(cfg.method || "get").toUpperCase();
      const url = buildUrl(cfg.url, cfg.params);
      const headers = {};
      for (const [k, v] of Object.entries(cfg.headers)) if (v !== void 0 && v !== null) headers[k] = String(v);
      const has = (name) => Object.keys(headers).some((k) => k.toLowerCase() === name);
      let body;
      const data = cfg.data;
      if (data !== void 0 && data !== null && method !== "GET" && method !== "HEAD") {
        if (typeof data === "string") {
          body = data;
          if (!has("content-type")) headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else if (data instanceof FormDataShim2 || data && typeof data.multipart === "function") {
          const mp = data.multipart();
          body = mp.body;
          headers["Content-Type"] = mp.contentType;
        } else if (typeof URLSearchParams === "function" && data instanceof URLSearchParams) {
          body = data.toString();
          if (!has("content-type")) headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else {
          body = JSON.stringify(data);
          if (!has("content-type")) headers["Content-Type"] = "application/json";
        }
      }
      const ctrl = new AbortController();
      let timedOut = false, canceled = false;
      const timer = cfg.timeout ? _setTimeout(() => {
        timedOut = true;
        ctrl.abort();
      }, cfg.timeout) : null;
      const outer = cfg.signal;
      const onAbort = () => {
        canceled = true;
        ctrl.abort();
      };
      if (outer) {
        if (outer.aborted) onAbort();
        else if (outer.addEventListener) outer.addEventListener("abort", onAbort);
      }
      let resp, text;
      try {
        resp = await fetch(url, { method, headers, body, signal: ctrl.signal, redirect: cfg.maxRedirects === 0 ? "manual" : "follow" });
        text = await resp.text();
      } catch (e) {
        if (timedOut) throw axiosError(`timeout of ${cfg.timeout}ms exceeded`, "ECONNABORTED", { config: cfg });
        if (canceled) throw axiosError("canceled", "ERR_CANCELED", { name: "CanceledError", config: cfg });
        throw axiosError(String(e && e.message || e), "ERR_NETWORK", { config: cfg });
      } finally {
        if (timer) _clearTimeout(timer);
        if (outer && outer.removeEventListener) outer.removeEventListener("abort", onAbort);
      }
      if (!resp.status) throw axiosError(resp.statusText || "Network Error", "ERR_NETWORK", { config: cfg });
      const headersObj = {};
      if (resp.headers && resp.headers.forEach) resp.headers.forEach((v, k) => {
        headersObj[String(k).toLowerCase()] = v;
      });
      if (headersObj["set-cookie"] !== void 0) headersObj["set-cookie"] = splitCookies(headersObj["set-cookie"]);
      let parsed = text;
      if (cfg.responseType !== "text" && typeof text === "string" && text.length) {
        const t = text.trimStart();
        if (t[0] === "{" || t[0] === "[" || /json/i.test(headersObj["content-type"] || "")) {
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = text;
          }
        }
      }
      const response = { data: parsed, status: resp.status, statusText: resp.statusText || "", headers: headersObj, config: cfg, request: {} };
      const valid = cfg.validateStatus === void 0 ? (s) => s >= 200 && s < 300 : cfg.validateStatus;
      if (valid && !valid(resp.status)) {
        throw axiosError(`Request failed with status code ${resp.status}`, resp.status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST", { response, config: cfg });
      }
      return response;
    }
    function create(defaults) {
      const d = Object.assign({ headers: {} }, defaults);
      const instance = (config) => request(d, config || {});
      instance.request = (config) => request(d, config || {});
      for (const m of ["get", "delete", "head"]) instance[m] = (url, config) => request(d, Object.assign({}, config, { url, method: m }));
      for (const m of ["post", "put", "patch"]) instance[m] = (url, data, config) => request(d, Object.assign({}, config, { url, data, method: m }));
      instance.defaults = d;
      instance.create = (more) => create(Object.assign({}, d, more, { headers: Object.assign({}, d.headers, more && more.headers) }));
      instance.isAxiosError = (e) => !!(e && e.isAxiosError);
      instance.isCancel = (e) => !!(e && e.code === "ERR_CANCELED");
      return instance;
    }
    var axios = create({});
    axios.default = axios;
    module2.exports = axios;
  }
});

// sktorrent/src/cache.js
var require_cache = __commonJS({
  "sktorrent/src/cache.js"(exports2, module2) {
    "use strict";
    init_timers();
    init_node_globals();
    var TTLCache = class {
      constructor({ ttl, max = 5e3 }) {
        this.ttl = ttl;
        this.max = max;
        this.map = /* @__PURE__ */ new Map();
      }
      get(k) {
        const e = this.map.get(k);
        if (!e) return void 0;
        if (Date.now() > e.exp) {
          this.map.delete(k);
          return void 0;
        }
        return e.v;
      }
      set(k, v, ttl = this.ttl) {
        if (this.map.has(k)) this.map.delete(k);
        this.map.set(k, { v, exp: Date.now() + ttl });
        if (this.map.size > this.max) {
          this.prune();
          while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
        }
        return v;
      }
      delete(k) {
        this.map.delete(k);
      }
      prune() {
        const n = Date.now();
        for (const [k, e] of this.map) if (n > e.exp) this.map.delete(k);
      }
      get size() {
        return this.map.size;
      }
    };
    function createCache(opts) {
      return new TTLCache(opts);
    }
    var inflight = /* @__PURE__ */ new Map();
    function once(key, fn) {
      if (inflight.has(key)) return inflight.get(key);
      const p = Promise.resolve().then(fn).finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    }
    var CAPS = { tmdb: 2e3, csfd: 2e3, sktdetail: 5e3 };
    var store = {
      read(name) {
        try {
          if (typeof NUVIO === "object" && NUVIO && NUVIO.files) return NUVIO.files.read(name);
          return typeof localStorage === "object" ? localStorage.getItem(name) : null;
        } catch (e) {
          return null;
        }
      },
      write(name, text) {
        if (typeof NUVIO === "object" && NUVIO && NUVIO.files) NUVIO.files.write(name, text);
        else if (typeof localStorage === "object") localStorage.setItem(name, text);
      }
    };
    var PersistentCache = class {
      constructor({ name, ttl, max = 5e4 }) {
        this.ttl = ttl;
        this.max = Math.min(max, CAPS[name] || 1e3);
        this.file = `cache-${name}.json`;
        this.map = null;
        this.dirty = false;
        this.timer = null;
      }
      load() {
        if (this.map) return this.map;
        this.map = /* @__PURE__ */ new Map();
        try {
          const now = Date.now();
          for (const [k, e] of Object.entries(JSON.parse(store.read(this.file) || "{}"))) if (e && e.exp > now) this.map.set(k, e);
        } catch (e) {
        }
        return this.map;
      }
      get(k) {
        const map = this.load();
        const e = map.get(k);
        if (!e) return void 0;
        if (Date.now() > e.exp) {
          map.delete(k);
          this.dirty = true;
          return void 0;
        }
        return e.v;
      }
      set(k, v, ttl = this.ttl) {
        const map = this.load();
        if (map.has(k)) map.delete(k);
        map.set(k, { v, exp: Date.now() + ttl });
        while (map.size > this.max) map.delete(map.keys().next().value);
        this.dirty = true;
        if (!this.timer) this.timer = _setTimeout(() => {
          this.timer = null;
          this.save();
        }, 15e3);
        return v;
      }
      get size() {
        return this.load().size;
      }
      save() {
        if (!this.dirty || !this.map) return;
        try {
          store.write(this.file, JSON.stringify(Object.fromEntries(this.map)));
          this.dirty = false;
        } catch (e) {
          this.map = new Map([...this.map].slice(Math.floor(this.map.size / 2)));
          try {
            store.write(this.file, JSON.stringify(Object.fromEntries(this.map)));
            this.dirty = false;
          } catch (e2) {
          }
        }
      }
    };
    function createPersistentCache(opts) {
      return new PersistentCache(opts);
    }
    module2.exports = { TTLCache, createCache, once, createPersistentCache };
  }
});

// shared/hash.js
var require_hash = __commonJS({
  "shared/hash.js"(exports2, module2) {
    "use strict";
    init_timers();
    init_node_globals();
    function utf8(str) {
      const out = [];
      for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c >= 55296 && c <= 56319 && i + 1 < str.length) {
          const d = str.charCodeAt(i + 1);
          if (d >= 56320 && d <= 57343) {
            c = 65536 + (c - 55296 << 10) + (d - 56320);
            i++;
          } else c = 65533;
        } else if (c >= 55296 && c <= 57343) c = 65533;
        if (c < 128) out.push(c);
        else if (c < 2048) out.push(192 | c >> 6, 128 | c & 63);
        else if (c < 65536) out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
        else out.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
      }
      return out;
    }
    var concat = (parts) => {
      const out = [];
      for (const p of parts) for (let i = 0; i < p.length; i++) out.push(p[i]);
      return out;
    };
    var S = [
      7,
      12,
      17,
      22,
      7,
      12,
      17,
      22,
      7,
      12,
      17,
      22,
      7,
      12,
      17,
      22,
      5,
      9,
      14,
      20,
      5,
      9,
      14,
      20,
      5,
      9,
      14,
      20,
      5,
      9,
      14,
      20,
      4,
      11,
      16,
      23,
      4,
      11,
      16,
      23,
      4,
      11,
      16,
      23,
      4,
      11,
      16,
      23,
      6,
      10,
      15,
      21,
      6,
      10,
      15,
      21,
      6,
      10,
      15,
      21,
      6,
      10,
      15,
      21
    ];
    var K = [];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    function md5(bytes) {
      const len = bytes.length;
      const total = (len + 8 >> 6) + 1 << 6;
      const m = new Uint8Array(total);
      for (let i = 0; i < len; i++) m[i] = bytes[i];
      m[len] = 128;
      const bits = len * 8;
      for (let i = 0; i < 8; i++) m[total - 8 + i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
      let a0 = 1732584193, b0 = 4023233417, c0 = 2562383102, d0 = 271733878;
      const w = new Array(16);
      for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) {
          const j = off + i * 4;
          w[i] = (m[j] | m[j + 1] << 8 | m[j + 2] << 16 | m[j + 3] << 24) >>> 0;
        }
        let a = a0, b = b0, c = c0, d = d0;
        for (let i = 0; i < 64; i++) {
          let f, g;
          if (i < 16) {
            f = b & c | ~b & d;
            g = i;
          } else if (i < 32) {
            f = d & b | ~d & c;
            g = (5 * i + 1) % 16;
          } else if (i < 48) {
            f = b ^ c ^ d;
            g = (3 * i + 5) % 16;
          } else {
            f = c ^ (b | ~d);
            g = 7 * i % 16;
          }
          const tmp = d;
          d = c;
          c = b;
          const x = a + f + K[i] + w[g] >>> 0;
          b = b + (x << S[i] | x >>> 32 - S[i]) >>> 0;
          a = tmp;
        }
        a0 = a0 + a >>> 0;
        b0 = b0 + b >>> 0;
        c0 = c0 + c >>> 0;
        d0 = d0 + d >>> 0;
      }
      const out = [];
      for (const v of [a0, b0, c0, d0]) out.push(v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255);
      return out;
    }
    function sha1(bytes) {
      const len = bytes.length;
      const total = (len + 8 >> 6) + 1 << 6;
      const m = new Uint8Array(total);
      for (let i = 0; i < len; i++) m[i] = bytes[i];
      m[len] = 128;
      const bits = len * 8;
      for (let i = 0; i < 8; i++) m[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
      let h0 = 1732584193, h1 = 4023233417, h2 = 2562383102, h3 = 271733878, h4 = 3285377520;
      const w = new Array(80);
      for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) {
          const j = off + i * 4;
          w[i] = (m[j] << 24 | m[j + 1] << 16 | m[j + 2] << 8 | m[j + 3]) >>> 0;
        }
        for (let i = 16; i < 80; i++) {
          const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
          w[i] = (x << 1 | x >>> 31) >>> 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let i = 0; i < 80; i++) {
          let f, k;
          if (i < 20) {
            f = b & c | ~b & d;
            k = 1518500249;
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = 1859775393;
          } else if (i < 60) {
            f = b & c | b & d | c & d;
            k = 2400959708;
          } else {
            f = b ^ c ^ d;
            k = 3395469782;
          }
          const t = (a << 5 | a >>> 27) + f + e + k + w[i] >>> 0;
          e = d;
          d = c;
          c = (b << 30 | b >>> 2) >>> 0;
          b = a;
          a = t;
        }
        h0 = h0 + a >>> 0;
        h1 = h1 + b >>> 0;
        h2 = h2 + c >>> 0;
        h3 = h3 + d >>> 0;
        h4 = h4 + e >>> 0;
      }
      const out = [];
      for (const v of [h0, h1, h2, h3, h4]) out.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
      return out;
    }
    var K256 = [
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ];
    function sha256(bytes) {
      const len = bytes.length;
      const total = (len + 8 >> 6) + 1 << 6;
      const m = new Uint8Array(total);
      for (let i = 0; i < len; i++) m[i] = bytes[i];
      m[len] = 128;
      const bits = len * 8;
      for (let i = 0; i < 8; i++) m[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
      const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
      const w = new Array(64);
      const rotr = (x, n) => x >>> n | x << 32 - n;
      for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) {
          const j = off + i * 4;
          w[i] = (m[j] << 24 | m[j + 1] << 16 | m[j + 2] << 8 | m[j + 3]) >>> 0;
        }
        for (let i = 16; i < 64; i++) {
          const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
          const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
          w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i++) {
          const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
          const ch = e & f ^ ~e & g;
          const t1 = hh + S1 + ch + K256[i] + w[i] >>> 0;
          const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
          const maj = a & b ^ a & c ^ b & c;
          const t2 = S0 + maj >>> 0;
          hh = g;
          g = f;
          f = e;
          e = d + t1 >>> 0;
          d = c;
          c = b;
          b = a;
          a = t1 + t2 >>> 0;
        }
        h[0] = h[0] + a >>> 0;
        h[1] = h[1] + b >>> 0;
        h[2] = h[2] + c >>> 0;
        h[3] = h[3] + d >>> 0;
        h[4] = h[4] + e >>> 0;
        h[5] = h[5] + f >>> 0;
        h[6] = h[6] + g >>> 0;
        h[7] = h[7] + hh >>> 0;
      }
      const out = [];
      for (const v of h) out.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
      return out;
    }
    var hex = (bytes) => bytes.map((b) => (b < 16 ? "0" : "") + b.toString(16)).join("");
    var sha256hex2 = (str) => hex(sha256(utf8(str)));
    var sha1hex = (str) => hex(sha1(utf8(str)));
    var md5hex = (str) => hex(md5(utf8(str)));
    function md5crypt(password, salt) {
      salt = salt.replace(/^\$1\$/, "").split("$")[0];
      const magic = "$1$";
      const pw = utf8(password), sl = utf8(salt);
      let final = md5(concat([pw, sl, pw]));
      const ctx = [pw, utf8(magic), sl];
      for (let pl = password.length; pl > 0; pl -= 16) ctx.push(final.slice(0, pl > 16 ? 16 : pl));
      for (let i = password.length; i > 0; i >>= 1) ctx.push(i & 1 ? [0] : utf8(password[0]));
      final = md5(concat(ctx));
      for (let i = 0; i < 1e3; i++) {
        const c = [i & 1 ? pw : final];
        if (i % 3) c.push(sl);
        if (i % 7) c.push(pw);
        c.push(i & 1 ? final : pw);
        final = md5(concat(c));
      }
      const itoa64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      const enc = (b0, b1, b2, n) => {
        let w = b0 << 16 | b1 << 8 | b2, out = "";
        for (let i = 0; i < n; i++) {
          out += itoa64[w & 63];
          w >>= 6;
        }
        return out;
      };
      return magic + salt + "$" + enc(final[0], final[6], final[12], 4) + enc(final[1], final[7], final[13], 4) + enc(final[2], final[8], final[14], 4) + enc(final[3], final[9], final[15], 4) + enc(final[4], final[10], final[5], 4) + enc(0, 0, final[11], 2);
    }
    module2.exports = { utf8, md5, sha1, sha256, sha1hex, sha256hex: sha256hex2, md5hex, md5crypt };
  }
});

// sktorrent/src/crypto.js
var require_crypto = __commonJS({
  "sktorrent/src/crypto.js"(exports2, module2) {
    "use strict";
    init_timers();
    init_node_globals();
    var H2 = require_hash();
    var DIGEST = { sha256: H2.sha256, sha1: H2.sha1, md5: H2.md5 };
    var hex = (bytes) => bytes.map((b) => (b < 16 ? "0" : "") + b.toString(16)).join("");
    function createHash(alg) {
      const fn = DIGEST[String(alg).toLowerCase()];
      if (!fn) throw new Error(`Nepodporovaný hash: ${alg}`);
      const parts = [];
      const api = {
        update(data) {
          parts.push(...typeof data === "string" ? H2.utf8(data) : Array.from(data));
          return api;
        },
        digest(enc) {
          const out = fn(parts);
          return enc === "hex" ? hex(out) : out;
        }
      };
      return api;
    }
    var randomBytes = (n) => {
      const a = new Uint8Array(n);
      crypto.getRandomValues(a);
      return Array.from(a);
    };
    module2.exports = { createHash, randomBytes };
  }
});

// ../sktorrent-realdebrid-docker/lib/util.js
var require_util = __commonJS({
  "../sktorrent-realdebrid-docker/lib/util.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var crypto2 = require_crypto();
    var langToFlag = { CZ: "🇨🇿", SK: "🇸🇰", EN: "🇬🇧", US: "🇺🇸", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", RU: "🇷🇺", PL: "🇵🇱", HU: "🇭🇺", JP: "🇯🇵" };
    var VIDEO_EXT = [".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".ts", ".m4v"];
    function removeDiacritics(s) {
      return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
    }
    function isVideo(p) {
      const f = String(p || "").toLowerCase();
      return VIDEO_EXT.some((e) => f.endsWith(e));
    }
    function isSample(p) {
      return /(^|[\/._\-\s\[(])sample([\/._\-\s\])]|$)/i.test(String(p || ""));
    }
    function basename(p) {
      return String(p || "").split(/[\\/]/).pop();
    }
    var delay = (ms) => new Promise((r) => _setTimeout(r, ms));
    var isHash = (h) => /^[a-f0-9]{40}$/i.test(String(h || ""));
    function keyId(s) {
      return s ? crypto2.createHash("sha256").update(String(s)).digest("hex").slice(0, 16) : "none";
    }
    function flagsFromName(name) {
      const flags = (String(name || "").match(/\b([A-Z]{2})\b/g) || []).map((c) => langToFlag[c]).filter(Boolean);
      return [...new Set(flags)].join("/");
    }
    function cleanTorrentName(t) {
      let c = String(t.name || "").replace(/^Stiahni si\s*/i, "").trim();
      if (t.cat && c.startsWith(t.cat)) c = c.slice(t.cat.length).trim();
      return c;
    }
    function formatBytes(b) {
      if (!b || b <= 0) return "";
      if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`;
      return `${Math.round(b / 1048576)} MB`;
    }
    function baseUrl(req) {
      if (_process.env.PUBLIC_URL) return _process.env.PUBLIC_URL.replace(/\/+$/, "");
      const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
      return `${req.protocol}://${host}`;
    }
    function normalizeQuery(q) {
      return String(q || "").normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    }
    function errMsg(e) {
      const d = e?.response?.data;
      if (d && typeof d === "object") return d.detail || d.error || d.message || e.message;
      return e?.message || String(e);
    }
    module2.exports = { langToFlag, VIDEO_EXT, removeDiacritics, isVideo, isSample, basename, delay, isHash, keyId, flagsFromName, cleanTorrentName, formatBytes, baseUrl, errMsg, normalizeQuery };
  }
});

// ../sktorrent-realdebrid-docker/lib/matching.js
var require_matching = __commonJS({
  "../sktorrent-realdebrid-docker/lib/matching.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var { removeDiacritics, isVideo, isSample, basename, normalizeQuery } = require_util();
    var pad = (n) => String(n).padStart(2, "0");
    var escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var KOMPLET_RE = /\b(?:komplet(?:n[iyae])?|complete)\b/i;
    var SEP = String.raw`\s*(?:[-–&+,]|\ba\b|\band\b|\bi\b)\s*`;
    var WORD = String.raw`(?:seasons?|seri[ea]|sezon[ay]?|rada|rady)`;
    var NOT_EPISODE = String.raw`(?!\s*\.?\s*(?:e\d|ep|dil|diel|cast|epizod))`;
    var RE_WORD_FIRST = new RegExp(String.raw`\b${WORD}\s*((?:\d{1,2})(?:${SEP}\d{1,2})+)(?!\d)${NOT_EPISODE}`, "g");
    var RE_NUM_FIRST = new RegExp(String.raw`(?<![\d.])((?:\d{1,2})\s*\.?(?:${SEP}\d{1,2}\s*\.?)+)\s*${WORD}\b`, "g");
    function addRange(set, a, b) {
      if (b >= a && b - a <= 40) for (let i = a; i <= b; i++) set.add(i);
      else {
        set.add(a);
        set.add(b);
      }
    }
    function parseList(txt) {
      const set = /* @__PURE__ */ new Set();
      const parts = txt.split(/\s*(?:[&+,]|\ba\b|\band\b|\bi\b)\s*/);
      for (const p of parts) {
        const m = p.match(/(\d{1,2})\s*\.?\s*(?:[-–]\s*(\d{1,2}))?/);
        if (!m) continue;
        if (m[2] !== void 0) addRange(set, +m[1], +m[2]);
        else set.add(+m[1]);
      }
      return set;
    }
    function seasonSet(name) {
      const n = removeDiacritics(String(name || "")).toLowerCase();
      const set = /* @__PURE__ */ new Set();
      for (const m of n.matchAll(/(?<![a-z0-9])s(\d{1,2})\s*[-–]\s*s(\d{1,2})(?![0-9]|\s?e\d)/g)) addRange(set, +m[1], +m[2]);
      for (const m of n.matchAll(RE_WORD_FIRST)) {
        if (/^\d{1,2}\s+[-–]\s+(?:0\d|\d{2})$/.test(m[1])) continue;
        for (const x of parseList(m[1])) set.add(x);
      }
      for (const m of n.matchAll(RE_NUM_FIRST)) for (const x of parseList(m[1])) set.add(x);
      return set.size >= 2 ? set : null;
    }
    function fmtSeasons(set) {
      const a = [...set].sort((x, y) => x - y);
      const contiguous = a.every((v, i) => i === 0 || v === a[i - 1] + 1);
      return contiguous ? `S${pad(a[0])}-S${pad(a[a.length - 1])}` : a.map((v) => `S${pad(v)}`).join(",");
    }
    var BARE_EP = /(?<![a-z0-9])E\d{2,3}(?![a-z0-9])/i;
    var BARE_EP_G = /(?<![a-z0-9])E(\d{2,3})(?![a-z0-9])/gi;
    var bareEpisodes = (name) => /E\d{2}\s*-\s*E?\d{2}/i.test(String(name || "")) ? [] : [...String(name || "").matchAll(BARE_EP_G)].map((m) => parseInt(m[1], 10));
    var ABS_RANGE = /(?<![a-z\d.])(\d{1,3})\s*[-–]\s*(\d{2,3})(?![\d.]|\s*\.?\s*(?:seri|season|sezon|rada|film|movie|dil|diel|cast|epizod|p\b))/gi;
    function absoluteRange(name) {
      const n = removeDiacritics(String(name || ""));
      if (seasonMarkers(n).size) return null;
      for (const m of n.matchAll(ABS_RANGE)) {
        const a = +m[1], b = +m[2];
        if (b > a) return { from: a, to: b, index: m.index };
      }
      return null;
    }
    function episodeFilters(season, episode) {
      const sn = String(season);
      const seTag = `S${pad(season)}`;
      const epTag = `S${pad(season)}E${pad(episode)}`;
      const exactRe = new RegExp(`(?<![a-z0-9])S0*${season}\\s?E0*${episode}(?!\\d)`, "i");
      const exactRangeRe = new RegExp(`(?<![a-z0-9])S0*${season}\\s?E0*${episode}\\s*-\\s*E?\\d`, "i");
      const dilRe = (n) => new RegExp(`(?<![\\d.])0*${n}\\s*\\.?\\s*(?:dil|diel|cast|epizoda)\\b`, "i");
      const anyDilRe = /(?<![\d.])\d{1,3}\s*\.?\s*(?:dil|diel|cast|epizoda)\b/i;
      const dilSeasonOk = (name) => {
        const ss = seasonMarkers(name);
        return ss.size === 0 ? season === 1 : ss.has(season) && ss.size === 1;
      };
      const matchesDil = (name) => {
        const n = removeDiacritics(name);
        if (!dilRe(episode).test(n) || !dilSeasonOk(name)) return false;
        const b = bareEpisodes(name);
        return !b.length || b.includes(episode);
      };
      const matchesBare = (name) => bareEpisodes(name).includes(episode) && dilSeasonOk(name);
      const matchesSE = (name) => exactRe.test(name) && !exactRangeRe.test(name);
      const matchesExactEpisode = (name) => matchesSE(name) || matchesDil(name) || matchesBare(name);
      const bareOnly = (name) => !matchesSE(name) && !matchesDil(name) && matchesBare(name);
      const hasAnyEpisode = (name) => {
        if (new RegExp(`(?<![a-z0-9])S0*${season}\\s?E\\d{1,3}`, "i").test(name)) return true;
        if (/(?<![\dx])\d{1,2}x\d{2,3}(?![\dp])/i.test(name)) return true;
        if (BARE_EP.test(name) && !/E\d{2}\s*-\s*E?\d{2}/i.test(name)) return true;
        if (anyDilRe.test(removeDiacritics(name))) return true;
        return false;
      };
      const episodeRange = (name) => {
        const m = name.match(/(?:(?<![a-z0-9])S(\d{1,2}))?[ ._\-]?E(\d{1,3})\s*-\s*E?(\d{1,3})(?!\d)/i);
        if (!m) return null;
        const s = m[1] !== void 0 ? parseInt(m[1]) : null;
        return { season: s, from: parseInt(m[2]), to: parseInt(m[3]) };
      };
      const isBatchSeason = (name) => {
        const r = episodeRange(name);
        if (r) {
          if (r.season !== null && r.season !== season) return false;
          return episode >= r.from && episode <= r.to;
        }
        const multi = seasonSet(name);
        if (multi) return multi.has(season) && !hasAnyEpisode(name);
        const up = name.toUpperCase();
        const norm = removeDiacritics(name).toLowerCase();
        const hasSe = new RegExp(`(?<![A-Z0-9])${seTag}(?!\\d)`).test(up) || new RegExp(`(^|\\W)${sn}\\s*\\.?\\s*s[eé]ri[ea]`, "i").test(name) || new RegExp(`s[eé]ri[ea][\\s._]*${sn}(\\W|$)`, "i").test(name) || new RegExp(`(^|\\W)${sn}\\s*\\.?\\s*serie`, "i").test(norm) || new RegExp(`(season|sezona)[\\s._]*0*${sn}(\\W|$)`, "i").test(norm);
        if (hasSe && !hasAnyEpisode(name)) return true;
        if (KOMPLET_RE.test(norm) && !hasAnyEpisode(name)) {
          const ss = seasonMarkers(name);
          if (ss.size === 0 || ss.size === 1 && ss.has(season)) return true;
        }
        return false;
      };
      const isNoSeasonCandidate = (name) => {
        if (matchesExactEpisode(name) || isBatchSeason(name)) return false;
        if (seasonSet(name)) return false;
        if (hasAnyEpisode(name)) return false;
        if (episodeRange(name)) return false;
        const marks = seasonMarkers(name);
        if (marks.size && !marks.has(season)) return false;
        const ab = absoluteRange(name);
        if (ab) return season === 1 && ab.from === 1 && episode <= ab.to;
        const up = name.toUpperCase();
        const norm = removeDiacritics(name).toLowerCase();
        const sMatch = up.match(/(?<![A-Z0-9])S(\d{2})(?!\d)/g);
        if (sMatch && !sMatch.some((s) => s === seTag)) return false;
        const czMatch = norm.match(/(\d+)\s*\.?\s*serie/i);
        if (czMatch && czMatch[1] !== sn) return false;
        const cleanForNum = norm.replace(/\b(19|20)\d{2}\b/g, "").replace(/\b\d{3,4}p\b/g, "").replace(/\b\d+\s*(gb|mb|kb)\b/gi, "");
        const numMatch = cleanForNum.match(/(?:^|\s|[/\-])0*(\d{1,2})(?:\s|$|[/\-\.])/g);
        if (numMatch) {
          const seasonNums = numMatch.map((n) => parseInt(n.trim().replace(/[^0-9]/g, ""))).filter((n) => n >= 1 && n <= 30);
          if (seasonNums.length > 0 && !seasonNums.includes(season)) return false;
        }
        return true;
      };
      const rejectReason = (name) => {
        const r = episodeRange(name);
        if (r) {
          if (r.season !== null && r.season !== season) return `jiná sezóna (S${pad(r.season)})`;
          return `balík bez naší epizody (E${pad(r.from)}-E${pad(r.to)})`;
        }
        const se = name.match(/(?<![a-z0-9])S(\d{1,2})\s?E(\d{1,3})(?!\d)/i);
        if (se) return +se[1] !== season ? `jiná sezóna (S${pad(+se[1])}E${pad(+se[2])})` : `jiný díl (S${pad(+se[1])}E${pad(+se[2])})`;
        const x = name.match(/(?<![\dx])(\d{1,2})x(\d{2,3})(?![\dp])/i);
        if (x) return `jiný díl (${x[1]}x${x[2]})`;
        const be = name.match(BARE_EP);
        if (be) return `jiný díl (${be[0].toUpperCase()})`;
        const ab = absoluteRange(name);
        if (ab) return `jiné díly (${ab.from}-${ab.to}, absolutní číslování)`;
        const multi0 = seasonSet(name);
        if (multi0 && !multi0.has(season)) return `jiné sezóny (${fmtSeasons(multi0)})`;
        const sTags = name.toUpperCase().match(/(?<![A-Z0-9])S(\d{2})(?!\d)/g) || [];
        if (sTags.length && !sTags.includes(seTag)) return `jiná sezóna (${[...new Set(sTags)].join(",")})`;
        const nn = removeDiacritics(name).toLowerCase();
        const cz = nn.match(/(\d+)\s*\.?\s*seri[ea]/);
        if (cz && cz[1] !== sn) return `jiná sezóna (${cz[1]}. série)`;
        const sw = nn.match(/\b(seri[ea]|season|sezona)[\s._]*(\d{1,2})(?!\d)/);
        if (sw && +sw[2] !== season) return `jiná sezóna (${sw[1]} ${sw[2]})`;
        const dl = removeDiacritics(name).match(anyDilRe);
        if (dl) return `jiný díl (${dl[0].replace(/\s+/g, " ").trim()})`;
        return "nesedí sezóna/epizoda";
      };
      const isSeasonPack = (name) => {
        if (!isBatchSeason(name)) return false;
        if (seasonSet(name)) return false;
        const norm = removeDiacritics(name).toLowerCase();
        if (/s\d{1,2}\s*-\s*s?\d{1,2}/i.test(name) || /\d+\s*\.?\s*[-–]\s*\d+\s*\.?\s*(seri|season|sezon)/.test(norm)) return false;
        return new RegExp(`(?<![A-Z0-9])${seTag}(?!\\d)`).test(name.toUpperCase()) || new RegExp(`(^|\\W)${sn}\\s*\\.?\\s*(seri|sezon)`).test(norm) || new RegExp(`(seri[ea]|season|sezona)[\\s._]*${sn}(\\W|$)`).test(norm);
      };
      return { seTag, epTag, matchesExactEpisode, bareOnly, hasAnyEpisode, isBatchSeason, isSeasonPack, isNoSeasonCandidate, rejectReason };
    }
    function titleWordsOf(name) {
      const clean = removeDiacritics(name).replace(/['’]/g, "").replace(/S\d{2}E?\d{0,2}/gi, "").replace(/\d+x\d+/g, "").trim();
      return clean.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2 || /^\d$/.test(w));
    }
    function makeTitleMatcher(searchName) {
      const titleWords = titleWordsOf(searchName);
      const titleSet = new Set(titleWords);
      const phrase = titleWords.join(" ");
      const wordRe = (w) => new RegExp(`(^|[^a-z0-9])${escRe(w)}([^a-z0-9]|$)`);
      const phraseRe = phrase ? wordRe(phrase) : null;
      return (tname) => {
        if (titleWords.length === 0) return true;
        let tn = removeDiacritics(tname).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s\/\-\.]/g, " ").replace(/\s+/g, " ");
        tn = tn.replace(/^stiahni si\s+\w+\s+/i, "");
        const epPos = tn.search(/s\d{2}e\d{2}/i);
        if (epPos >= 0) {
          const d = tn.indexOf(" - ", epPos);
          if (d >= 0) tn = tn.slice(0, d);
        }
        let cut = tn.length;
        const stop = tn.search(/[=(]|\bcsfd\b/);
        if (stop >= 0) cut = stop;
        for (const m of tn.matchAll(/\b(19|20)\d{2}\b/g)) {
          if (m.index >= cut) break;
          if (!titleSet.has(m[0])) {
            cut = m.index;
            break;
          }
        }
        const titlePart = tn.slice(0, cut).trim();
        const parts = titlePart.split(/\s*\/\s*/).map((p) => p.replace(/[.\-]/g, " ").replace(/\s+/g, " ").trim());
        if (phraseRe && parts.some((p) => phraseRe.test(p))) return true;
        if (titleWords.length >= 2) {
          return parts.some((p) => {
            if (!titleWords.every((w) => wordRe(w).test(p))) return false;
            const positions = titleWords.map((w) => p.search(wordRe(w)));
            return Math.max(...positions) - Math.min(...positions) < phrase.length + 15;
          });
        }
        return parts.some((p) => wordRe(titleWords[0]).test(p));
      };
    }
    var NON_LATIN = /[\u0370-\u03ff\u0400-\u04ff\u0590-\u06ff\u0e00-\u0e7f\u3000-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]/g;
    var NON_LATIN_CHAR = new RegExp(NON_LATIN.source);
    function latinName(s) {
      s = String(s || "");
      if (!NON_LATIN.test(s)) {
        NON_LATIN.lastIndex = 0;
        return s;
      }
      NON_LATIN.lastIndex = 0;
      const first = s.match(/[\p{L}\p{N}]/u)?.[0];
      if (!first || NON_LATIN_CHAR.test(first)) return "";
      const i = s.search(NON_LATIN_CHAR);
      if (i > 0 && /[\p{L}\p{N}]/u.test(s[i - 1])) return "";
      const rest = s.replace(NON_LATIN, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      return (rest.match(/[a-z]/gi) || []).length >= 3 ? rest : "";
    }
    var ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
    function normTitle(s) {
      return removeDiacritics(s).toLowerCase().replace(/&/g, " and ").replace(/['’`´]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").map((w) => ROMAN[w] || w).join(" ");
    }
    var TECH = new Set("cz sk en eng cze svk dabing dab titulky tit sub subs multi dual 480p 576p 720p 1080p 2160p 4k uhd hd fullhd sd hdr hdr10 hdr10plus dv dovi sdr web webrip webdl dl bluray blu ray bdrip brrip dvdrip dvd hdtv tvrip remux hevc avc x264 x265 h264 h265 aac ac3 eac3 dts atmos remastered extended uncut directors director cut edition special theatrical us uk proper repack internal".split(" "));
    var SLASHES = /[\u2044\u2215\uff0f]/g;
    function partNumbers(names) {
      const out = /* @__PURE__ */ new Set();
      for (const n of names || []) for (const m of removeDiacritics(String(n || "")).toLowerCase().matchAll(/(?<![\d.])(\d{1,3})\s*\.?\s*(?:dil|diel|cast)\b/g)) out.add(String(+m[1]));
      return out;
    }
    function titleSegment(tname, cat, keepYears, keepParts) {
      let s = String(tname || "").replace(/^\s*stiahni si\s+/i, "").replace(SLASHES, "/").trim();
      if (cat && s.toLowerCase().startsWith(String(cat).toLowerCase())) s = s.slice(cat.length);
      const n = removeDiacritics(s);
      const cuts = [
        n.search(/[\[(={]/),
        n.search(/\bcsfd\b/i),
        n.search(/(?<![a-z0-9])s\d{1,2}(?:\s?e\d{1,3})?(?![a-z0-9])/i),
        // S01E02 / S01 / S01-S03
        n.search(/(?<![\dx])\d{1,2}x\d{2,3}(?![\dp])/i),
        // 1x02
        n.search(/(?<![a-z0-9])e\d{2,3}(?![a-z0-9])/i),
        // E02
        n.search(/\b\d+\s*\.?\s*(?:seri[ea]|season|sezona|rada)\b/i),
        // 2. série
        (() => {
          for (const m of n.matchAll(/(?<![\d.])(\d{1,3})\s*\.?\s*(?:dil|diel|cast|epizoda)\b/gi)) if (!keepParts || !keepParts.has(String(+m[1]))) return m.index;
          return -1;
        })(),
        // 1.díl
        n.search(/\b(?:season|serie|seria)[\s._]*\d/i),
        n.search(KOMPLET_RE),
        n.search(/\b\d+\s*\.?\s*[-–]\s*\d+\s*\.?\s*(?:film|movie|dil|diel|cast|seri|season)/i),
        // 1-5. filmů, 1.-5 serie
        absoluteRange(n)?.index ?? -1
        // Bleach 1-109
      ];
      for (const m of n.matchAll(/\b(19|20)\d{2}\b/g)) if (!keepYears.has(m[0])) {
        cuts.push(m.index);
        break;
      }
      const cut = Math.min(...cuts.filter((i) => i >= 0), n.length);
      return s.slice(0, cut);
    }
    function makeStrictTitleMatcher(names, { colonNeedsYear = false, filmYear = null } = {}) {
      const list = [...new Set((names || []).map(latinName).filter(Boolean).map(normTitle).filter(Boolean))];
      const fy = /^(19|20)\d{2}$/.test(String(filmYear || "")) ? String(filmYear) : null;
      const longWords = fy ? list.map((n) => n.split(" ")).filter((w) => w.length >= 5) : [];
      const swapped = new Set(fy ? (names || []).map(latinName).filter((n) => n && n.includes(":")).map((n) => {
        const i = n.indexOf(":");
        return normTitle(`${n.slice(i + 1)} ${n.slice(0, i)}`);
      }).filter(Boolean) : []);
      const middleCut = (w) => {
        if (w.length < 3) return false;
        return longWords.some((W) => {
          if (w.length >= W.length) return false;
          for (let k = 1; k <= w.length - 2; k++) {
            const j = w.length - k;
            if (w.slice(0, k).join(" ") === W.slice(0, k).join(" ") && w.slice(k).join(" ") === W.slice(W.length - j).join(" ")) return true;
          }
          return false;
        });
      };
      const PART_WORD = /* @__PURE__ */ new Set(["part", "cast", "dil", "diel", "teil"]);
      const withoutPart = (w) => {
        const out = [];
        for (let i = 0; i < w.length; i++) {
          if (PART_WORD.has(w[i]) && /^\d{1,2}$/.test(w[i + 1] || "")) {
            i++;
            continue;
          }
          if (/^\d{1,2}$/.test(w[i]) && PART_WORD.has(w[i + 1] || "")) {
            i++;
            continue;
          }
          out.push(w[i]);
        }
        return out;
      };
      const listSet = new Set(list);
      const fitsFilmVariant = (seg) => {
        let w = normTitle(seg).split(" ").filter(Boolean);
        while (w.length && TECH.has(w[w.length - 1])) w.pop();
        if (!w.length) return false;
        if (swapped.has(w.join(" ")) || middleCut(w)) return true;
        const w2 = withoutPart(w);
        return w2.length < w.length && w2.length > 0 && listSet.has(w2.join(" "));
      };
      const keepYears = new Set(list.flatMap((n) => n.match(/\b(19|20)\d{2}\b/g) || []));
      const keepParts = partNumbers(names);
      const targets = new Set(list);
      for (const n of list) {
        const m = n.match(/^(the|a|an) (.+)$/);
        if (m) targets.add(m[2]);
      }
      const longTargets = new Set([...targets].filter((n) => n.split(" ").length >= 3));
      const fitsIn = (set) => (seg) => {
        let w = normTitle(seg).split(" ").filter(Boolean);
        if (!w.length) return false;
        if (set.has(w.join(" "))) return true;
        while (w.length && TECH.has(w[w.length - 1])) w.pop();
        return w.length > 0 && set.has(w.join(" "));
      };
      const fits = fitsIn(targets), fitsLong = fitsIn(longTargets);
      const subtitledElsewhere = (parts, cur) => parts.some((q) => {
        if (q === cur) return false;
        const m = q.match(/^(.*?)(?::|\s[-–—]\s)(.*)$/);
        if (!m || !fits(m[1]) || !/[a-z]{2}/.test(normTitle(m[2]))) return false;
        return !targets.has(normTitle(q)) && !fits(q.replace(/\s[-–—]\s/g, " "));
      });
      const subtitledHere = (part, parts) => {
        const pieces = part.split(/\s[-–—]\s/);
        if (pieces.length < 2 || !fits(pieces[0])) return false;
        const restRaw = pieces.slice(1).join(" ");
        if (fits(restRaw)) return false;
        const rest = normTitle(restRaw).split(" ").filter((w) => /[a-z]/.test(w) && !TECH.has(w));
        if (rest.length < 2 || targets.has(normTitle(part))) return false;
        return parts.some((q) => q !== part && /[a-z]{2}/i.test(removeDiacritics(q)) && !fits(q.replace(/\s[-–—]\s/g, " ")));
      };
      return (tname, cat, { whole = false } = {}) => {
        if (!targets.size) return true;
        const seg = titleSegment(tname, cat, keepYears, keepParts);
        const parts = seg.split(/(?<!\d)\/|\/(?!\d)|\|/);
        if (parts.some((part) => fits(part.replace(/\s[-–—]\s/g, " ")))) return true;
        if (fy && new RegExp(`\\b${fy}\\b`).test(tname) && parts.some(fitsFilmVariant)) return true;
        if (whole) return false;
        for (const part of parts) {
          if (part.split(/\s[-–—+]\s/).some(fits) && !subtitledElsewhere(parts, part) && !subtitledHere(part, parts)) return true;
          if (longTargets.size && part.includes(":") && (!colonNeedsYear || /\b(19|20)\d{2}\b/.test(tname)) && fitsLong(part.slice(part.indexOf(":") + 1).replace(/\s[-–—]\s/g, " "))) return true;
        }
        return false;
      };
    }
    function makeForeignTitleCheck(names) {
      const strict = makeStrictTitleMatcher(names);
      const ours = [...new Set((names || []).map(latinName).filter(Boolean).map(normTitle).filter(Boolean))];
      return (tname, cat) => {
        if (!ours.length || /\b(19|20)\d{2}\b/.test(tname)) return false;
        const seg = titleSegment(tname, cat, /* @__PURE__ */ new Set());
        const parts = seg.split(/(?<!\d)\/|\/(?!\d)|\|/).map((x) => x.trim()).filter((x) => /[a-z]/i.test(removeDiacritics(x)));
        if (parts.length < 2) return false;
        const others = parts.filter((p) => !strict(p, ""));
        if (others.length === parts.length || !others.length) return false;
        return others.every((p) => {
          const n = ` ${normTitle(p)} `;
          return !ours.some((o) => n.includes(` ${o} `));
        });
      };
    }
    function makeForeignPartCheck(names, strict) {
      const ours = [...new Set((names || []).map(latinName).filter(Boolean).map(normTitle).filter((n) => n.length >= 3))];
      const keepYears = new Set(ours.flatMap((n) => n.match(/\b(19|20)\d{2}\b/g) || []));
      const keepParts = partNumbers(names);
      const foreignParts = (tname, cat) => {
        if (!ours.length) return [];
        const seg = titleSegment(tname, cat, keepYears, keepParts);
        const parts = seg.split(/(?<!\d)\/|\/(?!\d)|\|/).map((x) => x.trim()).filter((x) => /[a-z]{2}/i.test(removeDiacritics(x)));
        if (parts.length < 2) return [];
        const mine = parts.filter((p) => strict(p, ""));
        if (!mine.length || mine.length === parts.length) return [];
        return parts.filter((p) => !mine.includes(p)).map((p) => normTitle(p).trim()).filter((n) => {
          const w = ` ${n} `;
          return !ours.some((o) => w.includes(` ${o} `));
        });
      };
      const check = (tname, cat) => foreignParts(tname, cat).length > 0;
      check.parts = foreignParts;
      return check;
    }
    function makeYearMatch(year) {
      const y = parseInt(year);
      if (!y) return () => false;
      return (tname) => {
        const n = String(tname || "");
        for (const m of n.matchAll(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/g)) if (y >= +m[1] - 1 && y <= +m[2] + 1) return true;
        return (n.match(/\b(19|20)\d{2}\b/g) || []).some((v) => Math.abs(+v - y) <= 1);
      };
    }
    function dashShortNames(names) {
      const out = [];
      for (const n of names || []) {
        const m = String(n || "").match(/^\s*([^\s:]+)\s+[-–]\s+(.+)$/u);
        if (!m) continue;
        const first = m[1], rest = normTitle(m[2]);
        if ((removeDiacritics(first).match(/[a-z]/gi) || []).length < 6) continue;
        if (normTitle(first).split(" ").length !== 1) continue;
        if (rest.split(" ").filter((w) => /[a-z]/.test(w)).length < 3) continue;
        if (!out.includes(first)) out.push(first);
      }
      return out;
    }
    function buildSearchNames(titles) {
      const seen = /* @__PURE__ */ new Set(), enNames = [], czNames = [], skNames = [];
      const add = (arr, s) => {
        s = normalizeQuery(latinName(s));
        if (!/[a-z]/i.test(s)) return;
        const k = removeDiacritics(s).toLowerCase();
        if (s.length >= 2 && !seen.has(k)) {
          seen.add(k);
          arr.push(s);
        }
      };
      const clean = (s) => String(s || "").replace(/\(.*?\)/g, "").replace(/TV (Mini )?Series/gi, "").trim();
      const en = clean(titles.en || titles.title);
      if (en) {
        add(enNames, en);
        if (en.includes(":")) add(enNames, en.split(":")[0]);
        if (/\s[-–]\s/.test(en)) add(enNames, en.split(/\s[-–]\s/)[0]);
      }
      const cz = clean(titles.cz);
      if (cz && /[a-zA-Z]/.test(cz)) {
        add(czNames, cz);
        if (cz.includes(":")) add(czNames, cz.split(":")[0]);
        if (/\s[-–]\s/.test(cz)) add(czNames, cz.split(/\s[-–]\s/)[0]);
      }
      const sk = clean(titles.sk);
      if (sk && /[a-zA-Z]/.test(sk)) add(skNames, sk);
      return { en: enNames, cz: czNames, sk: skNames };
    }
    function filterYear(list, year) {
      if (!year) return list;
      const y = parseInt(year);
      return list.filter((t) => {
        for (const m of t.name.matchAll(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/g)) {
          if (y >= parseInt(m[1]) - 1 && y <= parseInt(m[2]) + 1) return true;
        }
        const years = t.name.match(/\b(19|20)\d{2}\b/g);
        if (!years) return true;
        return years.some((v) => Math.abs(parseInt(v) - y) <= 1);
      });
    }
    function makeSeriesYearCheck(startYear, names) {
      const y = parseInt(startYear);
      if (!y) return () => null;
      const own = new Set((names || []).flatMap((n) => String(n || "").match(/\b(19|20)\d{2}\b/g) || []));
      return (tname) => {
        const n = String(tname || "");
        for (const m of n.matchAll(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/g)) if (parseInt(m[2]) >= y - 1) return null;
        const years = (n.match(/\b(19|20)\d{2}\b/g) || []).filter((v) => !own.has(v));
        if (!years.length) return null;
        if (years.some((v) => parseInt(v) >= y - 1)) return null;
        return `rok před začátkem seriálu (${[...new Set(years)].join(",")} < ${y})`;
      };
    }
    function makeSeasonYearCheck(seasonYear, season, names, { lastKnownYear, seriesYear } = {}) {
      const sy = parseInt(seriesYear);
      const oldSeries = sy > 0 && (/* @__PURE__ */ new Date()).getFullYear() - sy > 15;
      let y = parseInt(seasonYear);
      const guessed = !y && parseInt(lastKnownYear) > 0;
      if (guessed) y = parseInt(lastKnownYear) + 1;
      if (!y || !(season > 1)) return () => null;
      const own = new Set((names || []).flatMap((n) => String(n || "").match(/\b(19|20)\d{2}\b/g) || []));
      return (tname) => {
        const n = String(tname || "");
        for (const m of n.matchAll(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/g)) if (parseInt(m[2]) >= y) return null;
        const years = (n.match(/\b(19|20)\d{2}\b/g) || []).filter((v) => !own.has(v));
        if (!years.length || years.some((v) => parseInt(v) >= y)) return null;
        if (oldSeries && years.every((v) => parseInt(v) === sy) && !seasonMarkers(n).size) return null;
        return guessed ? `starší řada (roky do ${y - 1}, S${String(season).padStart(2, "0")} je novější)` : `jiná sezóna (rok ${[...new Set(years)].join(",")} < ${y})`;
      };
    }
    function makeNoSeasonYearCheck(seasonYear, seriesYear, names) {
      const sy = parseInt(seasonYear), py = parseInt(seriesYear);
      if (!sy || !py) return () => null;
      const own = new Set((names || []).flatMap((n) => String(n || "").match(/\b(19|20)\d{2}\b/g) || []));
      return (tname) => {
        const n = String(tname || "");
        if (/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b/.test(n)) return null;
        const years = [...new Set((n.match(/\b(19|20)\d{2}\b/g) || []).filter((v) => !own.has(v)))];
        if (years.length !== 1) return null;
        const y = parseInt(years[0]);
        return y === sy || y === py ? null : `bez sezóny, jiný rok (${y})`;
      };
    }
    function lastKnownSeasonYear(seasonYears, season) {
      if (!seasonYears || seasonYears[season]) return null;
      const lower = Object.keys(seasonYears).map(Number).filter((s) => s > 0 && s < season);
      if (!lower.length) return null;
      return parseInt(seasonYears[Math.max(...lower)]) || null;
    }
    var MAKING_OF = /\b(dokument o filmu|making of|o natacen[ii]|zakulisi|behind the scenes)\b/i;
    function isMakingOf(tname, ourNames) {
      if (!MAKING_OF.test(removeDiacritics(String(tname || "")))) return false;
      return !(ourNames || []).some((n) => MAKING_OF.test(removeDiacritics(String(n || ""))));
    }
    function isMoviePack(name) {
      const n = removeDiacritics(name).toLowerCase();
      if (/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/.test(n)) return true;
      if (/\b\d+\s*[-–]\s*\d+\s*\.?\s*(film|movie|dil|diel|cast)/.test(n)) return true;
      if (/\b(kolekce|kolekcia|collection|trilogie|trilogia|trilogy|quadrilogy|tetralogie|pentalogie|saga|anthology)\b/.test(n)) return true;
      if (/\b(i+|\d)\s*\+\s*(i+|\d)\b/.test(n)) return true;
      return false;
    }
    function seasonMarkers(path) {
      const s = /* @__PURE__ */ new Set();
      const n = removeDiacritics(path);
      for (const m of n.matchAll(/(?<![a-z0-9])s(\d{1,2})(?=e\d|[^a-z0-9]|$)/gi)) s.add(+m[1]);
      for (const m of n.matchAll(/season[ ._\-]*(\d{1,2})(?!\d)/gi)) s.add(+m[1]);
      for (const m of n.matchAll(/(?<!\d)(\d{1,2})[ ._]*\.?[ ._]*seri[ea]/gi)) s.add(+m[1]);
      for (const m of n.matchAll(/seri[ea][ ._\-]*(\d{1,2})(?!\d)/gi)) s.add(+m[1]);
      return s;
    }
    var largest = (arr) => arr.reduce((a, b) => (b.size || 0) > (a.size || 0) ? b : a);
    function pickEpisodeFile(files, season, episode) {
      let vids = (files || []).filter((f) => isVideo(f.name));
      if (!vids.length) return null;
      const noSample = vids.filter((f) => !isSample(f.name));
      if (noSample.length) vids = noSample;
      if (season === void 0 || episode === void 0 || vids.length === 1) return largest(vids);
      const S = season, e = `0*${episode}`;
      const strict = [
        new RegExp(`(?<![a-z0-9])s0*${S}[ ._\\-]*e${e}(?!\\d)`, "i"),
        new RegExp(`(?<![\\dx])${S}x${e}(?![\\dp])`, "i")
      ];
      for (const re of strict) {
        const hit2 = vids.filter((f) => re.test(removeDiacritics(basename(f.name))));
        if (hit2.length) return largest(hit2);
      }
      const cand = vids.filter((f) => {
        const ss = seasonMarkers(f.name);
        return ss.size === 0 || ss.has(S);
      });
      const stem = (f) => removeDiacritics(basename(f.name)).replace(/\.[a-z0-9]{2,4}$/i, "");
      const loose = [
        new RegExp(`(?<![a-z0-9])(?:e|ep|episode|dil|cast)[ ._\\-]*${e}(?:v\\d)?(?!\\d)`, "i"),
        new RegExp(`[ ._]-[ ._]*${e}(?:v\\d)?(?!\\d)`, "i"),
        new RegExp(`\\[${e}(?:v\\d)?\\]`, "i"),
        new RegExp(`(?<!\\d)${e}[ ._]*\\.?[ ._]*(?:dil|cast)`, "i"),
        new RegExp(`^${e}(?:v\\d)?(?!\\d)`, "i")
      ];
      for (const re of loose) {
        const hit2 = cand.filter((f) => re.test(stem(f)));
        if (hit2.length) return largest(hit2);
      }
      const bare = new RegExp(`(?<![a-z0-9.])${e}(?![0-9.]|p\\b|bit|ch\\b|k\\b)`, "i");
      const hit = cand.filter((f) => bare.test(stem(f)));
      if (hit.length === 1) return hit[0];
      return null;
    }
    function pickMovieFile(files, year, title) {
      let vids = (files || []).filter((f) => isVideo(f.name));
      if (!vids.length) return null;
      const noSample = vids.filter((f) => !isSample(f.name));
      if (noSample.length) vids = noSample;
      if (vids.length === 1) return vids[0];
      const norm = (s) => removeDiacritics(s).toLowerCase().replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[^a-z0-9]+/g, " ").trim();
      if (year) {
        const re = new RegExp(`(^| )${year}( |$)`);
        const hit = vids.filter((f) => re.test(norm(f.name)));
        if (hit.length) return largest(hit);
      }
      const words = title ? titleWordsOf(title).join(" ") : "";
      if (words) {
        const re = new RegExp(`(?:^| )${escRe(words)}(?= |$)(?: (\\S+))?`);
        const hit = vids.filter((f) => {
          const m = norm(basename(f.name)).match(re);
          return m && !/^(\d{1,2}|ii|iii|iv|v|vi)$/.test(m[1] || "");
        });
        if (hit.length) return largest(hit);
      }
      return null;
    }
    function pickBySel(files, sel = {}) {
      if (sel.fileId !== void 0) return (files || []).find((f) => String(f.id) === String(sel.fileId)) || null;
      if (sel.pack) return pickMovieFile(files, sel.year, sel.title);
      return pickEpisodeFile(files, sel.season, sel.episode);
    }
    function selKey(sel = {}) {
      if (sel.fileId !== void 0) return `f${sel.fileId}`;
      if (sel.pack) return `m${sel.year || 0}-${sel.title || ""}`;
      if (sel.season !== void 0) return `e${sel.season}-${sel.episode}`;
      return "main";
    }
    module2.exports = { bareEpisodes, makeNoSeasonYearCheck, makeForeignPartCheck, partNumbers, isMakingOf, lastKnownSeasonYear, dashShortNames, makeForeignTitleCheck, makeYearMatch, seasonSet, makeSeriesYearCheck, makeSeasonYearCheck, absoluteRange, episodeFilters, makeTitleMatcher, makeStrictTitleMatcher, normTitle, titleSegment, latinName, buildSearchNames, filterYear, isMoviePack, pickEpisodeFile, pickMovieFile, pickBySel, selKey, seasonMarkers, pad };
  }
});

// ../sktorrent-realdebrid-docker/lib/meta.js
var require_meta = __commonJS({
  "../sktorrent-realdebrid-docker/lib/meta.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var axios = require_axios();
    var { createPersistentCache } = require_cache();
    var { normTitle } = require_matching();
    var TMDB = "https://api.themoviedb.org/3";
    var OMDB_KEY = _process.env.OMDB_API_KEY || "91fa16b4";
    var titleCache = createPersistentCache({ name: "tmdb", ttl: 30 * 24 * 3600 * 1e3, max: 5e4 });
    function tmdbReq(key) {
      return key.length > 40 ? { headers: { Authorization: `Bearer ${key}` }, params: {} } : { headers: {}, params: { api_key: key } };
    }
    var ALT_COUNTRIES = /* @__PURE__ */ new Set(["CZ", "SK", "US", "GB"]);
    function altTitles(data, ours) {
      const list = data && (data.results || data.titles) || [];
      const base = [...new Set(ours.filter(Boolean).map(normTitle).filter((n) => n.length >= 2))];
      const out = [];
      for (const a of list) {
        if (!a || !a.title || !ALT_COUNTRIES.has(a.iso_3166_1)) continue;
        const n = normTitle(a.title);
        const ok = base.some((b) => n.startsWith(b + " ") && /[a-z]{2}/.test(n.slice(b.length)));
        if (ok && !base.includes(n) && !out.includes(a.title)) out.push(a.title);
      }
      return out.slice(0, 5);
    }
    async function getTitleTMDB(imdbId, tmdbKey, type) {
      try {
        const a = tmdbReq(tmdbKey);
        const find = await axios.get(`${TMDB}/find/${imdbId}`, { headers: a.headers, params: { ...a.params, external_source: "imdb_id" }, timeout: 5e3 });
        const d = find.data || {};
        const mv = d.movie_results?.[0], tv = d.tv_results?.[0];
        let item, isTV;
        if (type === "series") {
          item = tv || mv;
          isTV = !!tv;
        } else {
          item = mv || tv;
          isTV = !mv && !!tv;
        }
        if (!item) return null;
        const enTitle = isTV ? item.name || item.original_name : item.title || item.original_title;
        const origTitle = item.original_title || item.original_name || enTitle;
        const year = (isTV ? item.first_air_date || "" : item.release_date || "").slice(0, 4);
        const path = `${TMDB}/${isTV ? "tv" : "movie"}/${item.id}`;
        const [cz, sk] = await Promise.allSettled([
          axios.get(path, { headers: a.headers, params: { ...a.params, language: "cs-CZ", append_to_response: "alternative_titles" }, timeout: 5e3 }),
          axios.get(path, { headers: a.headers, params: { ...a.params, language: "sk-SK" }, timeout: 5e3 })
        ]);
        const pick = (r) => r.status === "fulfilled" ? (isTV ? r.value.data.name : r.value.data.title) || "" : "";
        const czTitle = pick(cz), skTitle = pick(sk);
        const alt = cz.status === "fulfilled" ? altTitles(cz.value.data.alternative_titles, [enTitle, origTitle, czTitle, skTitle]) : [];
        const seasonYears = {};
        if (isTV && cz.status === "fulfilled") for (const s of cz.value.data.seasons || []) {
          const y = String(s?.air_date || "").slice(0, 4);
          if (s && Number.isInteger(s.season_number) && s.season_number > 0 && /^\d{4}$/.test(y)) seasonYears[s.season_number] = y;
        }
        console.log(`[TMDB] EN:"${enTitle}" CZ:"${czTitle}" SK:"${skTitle}" (${year})${alt.length ? ` alt: ${alt.map((x) => `"${x}"`).join(", ")}` : ""}`);
        return {
          title: czTitle || enTitle,
          original: origTitle,
          en: enTitle,
          cz: czTitle,
          sk: skTitle,
          year,
          alt,
          seasonYears,
          all: [...new Set([enTitle, origTitle, czTitle, skTitle].filter(Boolean))]
        };
      } catch (e) {
        console.error("[TMDB]", e.response?.status || "", e.message);
        return null;
      }
    }
    async function getTitleOMDB(imdbId) {
      try {
        const r = await axios.get("https://www.omdbapi.com/", { params: { i: imdbId, apikey: OMDB_KEY }, timeout: 5e3 });
        if (r.data?.Title) {
          console.log(`[OMDb] "${r.data.Title}" (${r.data.Year})`);
          return { title: r.data.Title, original: r.data.Title, en: r.data.Title, cz: "", sk: "", year: r.data.Year || "", all: [r.data.Title] };
        }
      } catch (e) {
        console.error("[OMDb]", e.message);
      }
      return null;
    }
    async function getTitle(imdbId, tmdbKey, type) {
      const ck = `v3|${imdbId}|${type}|${tmdbKey ? "tmdb" : "omdb"}`;
      const c = titleCache.get(ck);
      if (c) return c;
      let t = null;
      if (tmdbKey) {
        t = await getTitleTMDB(imdbId, tmdbKey, type);
        if (!t) console.log("[TMDB] Fallback na OMDb");
      }
      if (!t) t = await getTitleOMDB(imdbId);
      if (t) titleCache.set(ck, t);
      return t;
    }
    function titleCacheSize() {
      return titleCache.size;
    }
    module2.exports = { getTitle, titleCacheSize };
  }
});

// ../sktorrent-realdebrid-docker/lib/csfd.js
var require_csfd = __commonJS({
  "../sktorrent-realdebrid-docker/lib/csfd.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var axios = require_axios();
    var { createPersistentCache } = require_cache();
    var { latinName } = require_matching();
    var INTERNAL = (_process.env.CSFD_URL || "").trim().replace(/\/+$/, "");
    var PUBLIC2 = (_process.env.CSFD_PUBLIC_URL ?? "https://csfd-rating.duckdns.org").trim().replace(/\/+$/, "");
    var csfdCache = createPersistentCache({ name: "csfd", ttl: 7 * 24 * 3600 * 1e3, max: 2e4 });
    var EN_COUNTRY = /^(USA|Spojené státy|Velká Británie|Spojené království|Kanada|Austrálie|Irsko|Nový Zéland)$/i;
    var CZ_COUNTRY = /^(Česko|Česká republika|Československo)$/i;
    var SK_COUNTRY = /^Slovensko$/i;
    function parseCsfdId(id) {
      const m = String(id || "").match(/^csfd:(\d{1,9})(?::(\d{1,4}):(\d{1,5}))?$/);
      if (!m) return null;
      return { csfdId: parseInt(m[1], 10), season: m[2] !== void 0 ? parseInt(m[2], 10) : void 0, episode: m[3] !== void 0 ? parseInt(m[3], 10) : void 0 };
    }
    function titlesFromMeta(meta, csfdId) {
      const cz = String(meta?.name || "").trim();
      const others = (Array.isArray(meta?.titlesOther) ? meta.titlesOther : []).map((t) => typeof t === "string" ? { country: null, title: t } : t).filter((t) => t && typeof t.title === "string" && t.title.trim()).map((t) => ({ country: t.country ? String(t.country).trim() : null, title: t.title.trim() }));
      const sk = others.find((t) => t.country && SK_COUNTRY.test(t.country))?.title || "";
      const en = others.find((t) => t.country && EN_COUNTRY.test(t.country))?.title || others.find((t) => t.country && !CZ_COUNTRY.test(t.country) && !SK_COUNTRY.test(t.country) && latinName(t.title))?.title || "";
      const year = String(meta?.year || meta?.releaseInfo || "").match(/\d{4}/)?.[0] || "";
      if (!cz && !en && !sk) return null;
      return {
        source: "csfd",
        csfdId,
        title: cz || en || sk,
        original: en || cz,
        en,
        cz,
        sk,
        year,
        // Všechny další názvy jdou do přísné kontroly názvu (hledá se jen CZ / SK / EN)
        alt: [...new Set(others.map((t) => t.title))].filter((t) => t !== cz && t !== sk && t !== en),
        all: [...new Set([cz, sk, en].filter(Boolean))]
      };
    }
    async function fetchMeta(base, type, csfdId, timeout) {
      const r = await axios.get(`${base}/meta/${type}/csfd:${csfdId}.json`, { timeout, headers: { "User-Agent": "sktorrent-addon" } });
      return r.data?.meta || null;
    }
    async function getCsfdTitle(type, csfdId) {
      const t = type === "series" ? "series" : "movie";
      const ck = `${t}|${csfdId}`;
      const c = csfdCache.get(ck);
      if (c) return c;
      const bases = [...new Set([INTERNAL, PUBLIC2].filter(Boolean))];
      if (!bases.length) {
        console.log("[ČSFD] Chybí CSFD_URL i CSFD_PUBLIC_URL — tituly csfd: nejde hledat");
        return null;
      }
      for (const [i, base] of bases.entries()) {
        try {
          const meta = await fetchMeta(base, t, csfdId, i === 0 && bases.length > 1 ? 3e3 : 8e3);
          const titles = meta ? titlesFromMeta(meta, csfdId) : null;
          if (!titles) {
            console.log(`[ČSFD] csfd:${csfdId} — metadata bez názvu`);
            return null;
          }
          console.log(`[ČSFD] CZ:"${titles.cz}" SK:"${titles.sk}" EN:"${titles.en}" (${titles.year || "?"})${titles.alt.length ? ` další: ${titles.alt.length}` : ""}${i ? " — přes veřejnou adresu" : ""}`);
          csfdCache.set(ck, titles);
          return titles;
        } catch (e) {
          const s = e.response?.status;
          console.error(`[ČSFD] ${base}: ${s || e.code || e.message}`);
          if (s === 404) return null;
        }
      }
      return null;
    }
    var imdbInflight = /* @__PURE__ */ new Map();
    async function fetchImdb(type, imdbId) {
      const bases = [...new Set([INTERNAL, PUBLIC2].filter(Boolean))];
      for (const [i, base] of bases.entries()) {
        try {
          const r = await axios.get(`${base}/rating/${imdbId}`, {
            params: { type },
            timeout: i === 0 && bases.length > 1 ? 5e3 : 1e4,
            headers: { "User-Agent": "sktorrent-addon" },
            validateStatus: (s) => s === 200 || s === 404
          });
          if (r.status === 404 || !r.data?.found || !r.data?.csfdId) return { none: true };
          return { csfdId: Number(r.data.csfdId), title: String(r.data.title || "").trim(), year: r.data.year || null };
        } catch (e) {
          console.error(`[ČSFD] ${base}/rating/${imdbId}: ${e.response?.status || e.code || e.message}`);
        }
      }
      return void 0;
    }
    async function getCsfdForImdb(imdbId, type, waitMs = 3e3) {
      if (!/^tt\d{5,10}$/.test(String(imdbId || ""))) return null;
      if (!INTERNAL && !PUBLIC2) return null;
      const t = type === "series" ? "series" : "movie";
      const ck = `imdb|${t}|${imdbId}`;
      const c = csfdCache.get(ck);
      if (c) return c.none ? null : c;
      let p = imdbInflight.get(ck);
      if (!p) {
        p = fetchImdb(t, imdbId).then((v) => {
          if (v) csfdCache.set(ck, v, v.none ? 24 * 3600 * 1e3 : void 0);
          if (v && !v.none) console.log(`[ČSFD] ${imdbId} → ČSFD ${v.csfdId} „${v.title}“`);
          return v && !v.none ? v : null;
        }).finally(() => imdbInflight.delete(ck));
        imdbInflight.set(ck, p);
      }
      return Promise.race([p, new Promise((r) => _setTimeout(() => r(null), waitMs).unref())]);
    }
    module2.exports = { parseCsfdId, titlesFromMeta, getCsfdTitle, getCsfdForImdb };
  }
});

// sktorrent/src/https.js
var require_https = __commonJS({
  "sktorrent/src/https.js"(exports2, module2) {
    "use strict";
    init_timers();
    init_node_globals();
    var Agent = class {
      constructor(opts) {
        this.options = opts || {};
      }
      addRequest() {
      }
    };
    module2.exports = { Agent };
  }
});

// ../sktorrent-realdebrid-docker/lib/skt.js
var require_skt = __commonJS({
  "../sktorrent-realdebrid-docker/lib/skt.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var https = require_https();
    var axios = require_axios();
    var cheerio = require("cheerio");
    var { createCache, createPersistentCache, once } = require_cache();
    var { keyId, normalizeQuery, removeDiacritics } = require_util();
    var BASE_URL = "https://sktorrent.eu";
    var SEARCH_URL = `${BASE_URL}/torrent/torrents_v2.php`;
    var UA = "Mozilla/5.0";
    var excludedCats = /xXx|Knihy|Časopis|Ostatní|Game hall|Audio.*video|Soft.*app|Externe|Hry na|VR Hry|Hudba|Hudební|Mluven|Soundtrack|Programy|Mobil|Neschválen/i;
    var queryCache = createCache({ ttl: 6 * 3600 * 1e3, max: 5e3 });
    var FULL_PAGE = 20;
    var TimedAgent = class extends https.Agent {
      addRequest(req, opts) {
        const t0 = Date.now();
        req.once("socket", () => {
          req.sktWait = Date.now() - t0;
        });
        return super.addRequest(req, opts);
      }
    };
    var RESPONSE_TIMEOUT_MS = +_process.env.SKT_TIMEOUT_MS || 2e4;
    var http = axios.create({ httpsAgent: new TimedAgent({ keepAlive: true, maxSockets: 6 }), timeout: RESPONSE_TIMEOUT_MS, headers: { "User-Agent": UA } });
    var HARD_LIMIT_MS = +_process.env.SKT_HARD_LIMIT_MS || 22e3;
    var BREAKER = { fails: 0, openUntil: 0, probing: false, probeDone: null, probeResolve: null };
    var BREAKER_FAILS = 3;
    var BREAKER_OPEN_MS = 45e3;
    var inflight = /* @__PURE__ */ new Set();
    function breakerOpen() {
      return BREAKER.openUntil > Date.now();
    }
    function endProbe(ok) {
      const r = BREAKER.probeResolve;
      BREAKER.probing = false;
      BREAKER.probeDone = null;
      BREAKER.probeResolve = null;
      if (r) r(ok);
    }
    async function breakerGate() {
      if (breakerOpen()) return false;
      if (!BREAKER.openUntil) return true;
      if (BREAKER.probing) {
        return Promise.race([BREAKER.probeDone, new Promise((r) => _setTimeout(() => r(false), HARD_LIMIT_MS + 1e3).unref())]);
      }
      BREAKER.probing = true;
      BREAKER.probeDone = new Promise((r) => {
        BREAKER.probeResolve = r;
      });
      return true;
    }
    function breakerOk() {
      if (BREAKER.openUntil) console.log("[SKT] ✅ SKT zase odpovídá — jistič zavřen");
      BREAKER.fails = 0;
      BREAKER.openUntil = 0;
      endProbe(true);
    }
    function breakerFail() {
      BREAKER.fails++;
      if (BREAKER.probing || !BREAKER.openUntil && BREAKER.fails >= BREAKER_FAILS) {
        BREAKER.openUntil = Date.now() + BREAKER_OPEN_MS;
        console.error(`[SKT] ⚡ SKT neodpovídá (${BREAKER.fails}× po sobě) — dotazy pozastaveny na ${BREAKER_OPEN_MS / 1e3} s`);
        endProbe(false);
        for (const c of inflight) c.abort("jistič");
      }
    }
    function errKind(e) {
      const st2 = e?.response?.status;
      if (st2 === 403) return "403";
      if (st2) return `http ${st2}`;
      if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT" || /timeout/i.test(String(e?.message || ""))) return "timeout";
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return "timeout";
      if (/^E[A-Z]+$/.test(String(e?.code || ""))) return "síť";
      return "chyba";
    }
    var isOutage = (err) => err === "timeout" || err === "síť" || /^http 5\d\d$/.test(err);
    var errMsgShort = (e) => String(e?.message || "").replace(/\s+/g, " ").slice(0, 80);
    function retryAfterMs(e) {
      const v = e?.response?.headers?.["retry-after"];
      if (v === void 0 || v === null || v === "") return 1e4;
      const n = Number(v);
      const ms = Number.isFinite(n) ? n * 1e3 : Date.parse(String(v)) - Date.now();
      return Math.min(12e4, Math.max(1e3, Number.isFinite(ms) ? ms : 1e4));
    }
    var envInt = (k, d) => {
      const v = parseInt(_process.env[k], 10);
      return Number.isFinite(v) ? v : d;
    };
    var RATE_PER_MIN = Math.max(1, envInt("SKT_RATE_PER_MIN", 15));
    var RATE_WAIT_MS = Math.max(0, envInt("SKT_RATE_WAIT_MS", 3e3));
    var RATE_WINDOW_MS = 6e4;
    var RATE_RESERVE = 3;
    var RATE_SLOW_MS = 6e4;
    var rateLog = [];
    var rateSlowUntil = 0;
    var rateCap = () => Date.now() < rateSlowUntil ? Math.max(1, Math.floor(RATE_PER_MIN / 2)) : RATE_PER_MIN;
    function ratePrune(now) {
      while (rateLog.length && rateLog[0] <= now - RATE_WINDOW_MS) rateLog.shift();
    }
    async function rateSlot(low) {
      const t0 = Date.now();
      for (; ; ) {
        const now = Date.now();
        ratePrune(now);
        const cap = Math.max(low ? 0 : 1, rateCap() - (low ? RATE_RESERVE : 0));
        if (rateLog.length < cap) {
          rateLog.push(now);
          return { wait: now - t0, ts: now };
        }
        const freeAt = cap > 0 ? rateLog[rateLog.length - cap] + RATE_WINDOW_MS : Infinity;
        if (freeAt - t0 > RATE_WAIT_MS) return { wait: now - t0, ts: 0 };
        await new Promise((r) => _setTimeout(r, Math.max(5, freeAt - now + 5)));
      }
    }
    function rateUnslot(ts) {
      const i = rateLog.indexOf(ts);
      if (i >= 0) rateLog.splice(i, 1);
    }
    function rateNote() {
      ratePrune(Date.now());
      rateLog.push(Date.now());
    }
    function rateSlowAfter(pauseMs) {
      rateSlowUntil = Math.max(rateSlowUntil, Date.now() + pauseMs + RATE_SLOW_MS);
    }
    var torrentCache = createCache({ ttl: 12 * 3600 * 1e3, max: 2e4 });
    var pausedUntil = /* @__PURE__ */ new Map();
    var pauseReason = /* @__PURE__ */ new Map();
    var pauseKind = (uid, pass) => pauseReason.get(accountKey(uid, pass)) || "pauza 403";
    var accountKey = (uid, pass) => uid && pass ? `u:${keyId(uid + ":" + pass)}` : "anon";
    function isPaused(uid, pass) {
      return (pausedUntil.get(accountKey(uid, pass)) || 0) > Date.now();
    }
    function parseResults(html) {
      const $ = cheerio.load(html);
      const results = [];
      const seen = /* @__PURE__ */ new Set();
      $('a[href*="details.php"] img').each((i, img) => {
        const el = $(img).closest("a");
        const m = (el.attr("href") || "").match(/id=([a-fA-F0-9]{40})/);
        if (!m) return;
        const hash = m[1].toLowerCase();
        if (seen.has(hash)) return;
        const name = el.attr("title") || "";
        if (!name || name.length < 3) return;
        const td = el.closest("td");
        const block = td.text().replace(/\s+/g, " ").trim();
        const szM = block.match(/Velkost\s([^|]+)/i);
        if (!szM) return;
        const cat = td.find("b").first().text().trim();
        const sdM = block.match(/Odosielaju\s*:\s*(\d+)/i);
        let poster = $(img).attr("data-original") || $(img).attr("data-src") || $(img).attr("src") || "";
        td.find("img").each((j, timg) => {
          const s = $(timg).attr("data-original") || $(timg).attr("data-src") || $(timg).attr("src") || "";
          if (s && s.length > poster.length) poster = s;
        });
        if (poster && !poster.startsWith("http")) poster = `${BASE_URL}/${poster.replace(/^\//, "")}`;
        seen.add(hash);
        results.push({ name, hash, size: szM[1].trim(), seeds: sdM ? parseInt(sdM[1]) : 0, cat, poster });
      });
      if (results.length === 0) {
        $("table.lista tr").each((i, row) => {
          const cells = $(row).find("td.lista");
          if (cells.length < 2) return;
          const link2 = cells.eq(1).find("a[href*='details.php']");
          const m = (link2.attr("href") || "").match(/id=([a-fA-F0-9]{40})/);
          if (!m) return;
          const hash = m[1].toLowerCase();
          if (seen.has(hash)) return;
          seen.add(hash);
          results.push({ name: link2.text().trim(), hash, size: cells.eq(5).text().trim() || "?", seeds: parseInt(cells.eq(6).text().trim()) || 0, cat: cells.eq(0).text().trim() || "", poster: "" });
        });
      }
      const items = results.filter((t) => !excludedCats.test(t.cat));
      items.raw = results.length;
      return items;
    }
    function maxPage(html) {
      let max = 0;
      for (const m of String(html).matchAll(/[?&](?:amp;)?page=(\d+)/g)) max = Math.max(max, parseInt(m[1]));
      return max;
    }
    async function searchSKTPage(query, uid, pass, page = 0, opts = {}) {
      query = normalizeQuery(query);
      const empty = { items: [], hasMore: false };
      if (!query) return empty;
      const acct = accountKey(uid, pass);
      const ck = `${acct}|${query.toLowerCase()}|${page}`;
      const label = `"${query}"${page ? ` str. ${page + 1}` : ""}`;
      const cached = queryCache.get(ck);
      if (cached) {
        console.log(`[SKT] 💾 ${label} (${cached.items.length})`);
        return { items: cached.items, hasMore: cached.hasMore, cached: true };
      }
      if (isPaused(uid, pass)) {
        console.log(`[SKT] ⏸️ Pauza po 403/429, přeskakuji ${label}`);
        return { ...empty, err: pauseKind(uid, pass), skipped: true };
      }
      if (breakerOpen()) {
        console.log(`[SKT] ⚡ Jistič — přeskakuji ${label}`);
        return { ...empty, err: "jistič", skipped: true };
      }
      return once(`skt:${ck}`, () => fetchPage(query, uid, pass, page, ck, label, acct, false, !!opts.low));
    }
    async function fetchPage(query, uid, pass, page, ck, label, acct, retry = false, low = false) {
      const empty = { items: [], hasMore: false };
      if (retry && isPaused(uid, pass)) return { ...empty, err: pauseKind(uid, pass), skipped: true };
      {
        const slot = await rateSlot(low);
        const rlw = slot.wait >= 50 ? { rl: slot.wait } : {};
        if (!slot.ts) {
          console.log(`[SKT] 🚦 Limit ${rateCap()} požadavků/min — přeskakuji ${label}${low ? " (méně důležitý)" : ""}`);
          return { ...empty, err: "limit addonu", skipped: true, ...rlw };
        }
        if (isPaused(uid, pass)) {
          rateUnslot(slot.ts);
          return { ...empty, err: pauseKind(uid, pass), skipped: true, ...rlw };
        }
        const waitedProbe = BREAKER.probing;
        const g0 = Date.now();
        const gate = await breakerGate();
        const probeWait = waitedProbe ? Date.now() - g0 : 0;
        const pw = { ...probeWait >= 50 ? { probeWait } : {}, ...rlw };
        if (!gate) {
          rateUnslot(slot.ts);
          console.log(`[SKT] ⚡ Jistič — přeskakuji ${label}${probeWait ? ` (po ${probeWait} ms čekání na zkušební dotaz)` : ""}`);
          return { ...empty, err: "jistič", skipped: true, ...pw };
        }
        if (waitedProbe && isPaused(uid, pass)) {
          rateUnslot(slot.ts);
          return { ...empty, err: pauseKind(uid, pass), skipped: true, ...pw };
        }
        console.log(`[SKT] 🔎 ${label}${BREAKER.probing ? " (zkušební dotaz)" : ""}`);
        const ctrl = new AbortController();
        inflight.add(ctrl);
        const t0 = Date.now();
        try {
          const headers = {};
          if (uid && pass) headers.Cookie = `uid=${uid}; pass=${pass}`;
          const params = { search: query, category: 0, active: 0 };
          if (page > 0) params.page = page;
          const r = await http.get(SEARCH_URL, { params, headers, signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(HARD_LIMIT_MS)]) });
          const items = parseResults(r.data);
          const res = { items: [...items], hasMore: items.raw >= FULL_PAGE && maxPage(r.data) > page, ms: Date.now() - t0, ...pw };
          const wait = r.request?.sktWait;
          if (Number.isFinite(wait) && wait >= 50) res.wait = wait;
          items.forEach((t) => torrentCache.set(t.hash, t));
          queryCache.set(ck, { items: res.items, hasMore: res.hasMore });
          breakerOk();
          console.log(`[SKT] Nalezeno: ${items.length} (${res.ms} ms${res.wait ? `, z toho ${res.wait} ms čekání na spojení` : ""})${res.hasMore ? " — další stránky existují" : ""}`);
          return res;
        } catch (e) {
          const ms = Date.now() - t0;
          if (ctrl.signal.aborted && ctrl.signal.reason === "jistič") return { ...empty, err: "jistič", ms, ...pw };
          const err = errKind(e);
          const msg = errMsgShort(e);
          let pause = null;
          if (err === "403" || err === "http 429") {
            const pauseMs = err === "403" ? 6e4 : retryAfterMs(e);
            pause = Math.round(pauseMs / 1e3);
            console.error(`[SKT] ⛔ ${err} — pauza ${Math.round(pauseMs / 1e3)} s (${acct === "anon" ? "anonymní" : "účet"})`);
            pausedUntil.set(acct, Date.now() + pauseMs);
            pauseReason.set(acct, err === "403" ? "pauza 403" : "pauza 429");
            if (err === "http 429") rateSlowAfter(pauseMs);
            if (BREAKER.probing) breakerOk();
          } else if (isOutage(err)) {
            console.error(`[SKT] ❌ ${label}: ${err} po ${ms} ms (${e.message})`);
            breakerFail();
          } else {
            if (BREAKER.probing) breakerOk();
            if (!retry) {
              console.error(`[SKT] ⚠️ ${label}: ${err} po ${ms} ms (${msg}) — zkusím znovu za 1 s`);
              inflight.delete(ctrl);
              await new Promise((r) => _setTimeout(r, 1e3));
              const again = await fetchPage(query, uid, pass, page, ck, label, acct, true, low);
              return { ...again, firstErr: err, ...again.err ? {} : { retried: true } };
            }
            console.error(`[SKT] ⚠️ ${label}: ${err} po ${ms} ms (${msg}) — ani napodruhé`);
          }
          return { ...empty, err, ms, ...msg ? { msg } : {}, ...pause ? { pause } : {}, ...pw };
        } finally {
          inflight.delete(ctrl);
        }
      }
    }
    var detailCache = createPersistentCache({ name: "sktdetail", ttl: 365 * 24 * 3600 * 1e3, max: 1e5 });
    var DETAIL_URL = `${BASE_URL}/torrent/details.php`;
    function csfdFromDetail(html) {
      const m = String(html || "").match(/csfd\.(?:cz|sk)\/film\/(\d+)/i);
      return m ? parseInt(m[1], 10) : null;
    }
    async function getTorrentCsfd(hash, uid, pass) {
      hash = String(hash || "").toLowerCase();
      if (!/^[a-f0-9]{40}$/.test(hash)) return void 0;
      const c = detailCache.get(hash);
      if (c !== void 0) return c.csfd;
      if (isPaused(uid, pass) || breakerOpen()) return void 0;
      return once(`sktdetail:${hash}`, async () => {
        const slot = await rateSlot(true);
        if (!slot.ts) {
          console.log(`[SKT] 🚦 Limit ${rateCap()} požadavků/min — detail ${hash.slice(0, 8)} přeskočen`);
          return void 0;
        }
        if (isPaused(uid, pass)) {
          rateUnslot(slot.ts);
          return void 0;
        }
        if (!await breakerGate()) {
          rateUnslot(slot.ts);
          return void 0;
        }
        const ctrl = new AbortController();
        inflight.add(ctrl);
        const t0 = Date.now();
        try {
          const headers = {};
          if (uid && pass) headers.Cookie = `uid=${uid}; pass=${pass}`;
          const r = await http.get(DETAIL_URL, { params: { id: hash }, headers, signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(HARD_LIMIT_MS)]) });
          breakerOk();
          const html = String(r.data || "");
          if (!html.toLowerCase().includes(hash)) {
            console.log(`[SKT] 🎬 detail ${hash.slice(0, 8)}: neplatná stránka (${Date.now() - t0} ms)`);
            return void 0;
          }
          const csfd = csfdFromDetail(html);
          detailCache.set(hash, { csfd });
          console.log(`[SKT] 🎬 detail ${hash.slice(0, 8)}: ${csfd ? `ČSFD ${csfd}` : "bez ČSFD odkazu"} (${Date.now() - t0} ms)`);
          return csfd;
        } catch (e) {
          if (ctrl.signal.aborted && ctrl.signal.reason === "jistič") return void 0;
          const err = errKind(e);
          if (err === "403" || err === "http 429") {
            const pauseMs = err === "403" ? 6e4 : retryAfterMs(e);
            pausedUntil.set(accountKey(uid, pass), Date.now() + pauseMs);
            pauseReason.set(accountKey(uid, pass), err === "403" ? "pauza 403" : "pauza 429");
            if (err === "http 429") rateSlowAfter(pauseMs);
            if (BREAKER.probing) breakerOk();
          } else if (isOutage(err)) breakerFail();
          else if (BREAKER.probing) breakerOk();
          console.error(`[SKT] 🎬 detail ${hash.slice(0, 8)}: ${err} (${e.message})`);
          return void 0;
        } finally {
          inflight.delete(ctrl);
        }
      });
    }
    function hasDetail(hash) {
      return detailCache.get(String(hash || "").toLowerCase()) !== void 0;
    }
    function cachedCsfd(hash) {
      const c = detailCache.get(String(hash || "").toLowerCase());
      return c === void 0 ? void 0 : c.csfd;
    }
    var fold = (s) => removeDiacritics(String(s || "")).toLowerCase();
    function searchedText(t) {
      let n = String(t.name || "").replace(/^\s*stiahni si\s+/i, "");
      if (t.cat && n.toLowerCase().startsWith(String(t.cat).toLowerCase())) n = n.slice(t.cat.length);
      return fold(n.replace(/\s*=\s*csfd\s*\d+\s*%\s*$/i, ""));
    }
    function filterLikeSKT(items, extra) {
      const words = fold(normalizeQuery(extra)).split(" ").filter((w) => w.length >= 2);
      return (items || []).filter((t) => {
        const n = searchedText(t);
        return words.every((w) => n.includes(w));
      });
    }
    function _resetBreaker() {
      BREAKER.fails = 0;
      BREAKER.openUntil = 0;
      endProbe(false);
      pausedUntil.clear();
      pauseReason.clear();
      queryCache.map.clear();
      detailCache.map.clear();
      rateLog.length = 0;
      rateSlowUntil = 0;
    }
    function _rate() {
      return { log: rateLog, cap: rateCap(), perMin: RATE_PER_MIN, slowUntil: rateSlowUntil };
    }
    function _breaker() {
      return BREAKER;
    }
    async function searchSKT(query, uid, pass) {
      return (await searchSKTPage(query, uid, pass, 0)).items;
    }
    function getCachedTorrent(hash) {
      return torrentCache.get(hash);
    }
    async function sktLogin2(username, password) {
      rateNote();
      const r = await http.post(
        `${BASE_URL}/torrent/login.php`,
        `uid=${encodeURIComponent(username)}&pwd=${encodeURIComponent(password)}`,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, "Referer": `${BASE_URL}/torrent/login.php` },
          maxRedirects: 0,
          validateStatus: () => true,
          timeout: 1e4
        }
      );
      let uid = "", pass = "";
      for (const c of r.headers["set-cookie"] || []) {
        const um = c.match(/^uid=([^;]+)/);
        if (um) uid = um[1];
        const pm = c.match(/^pass=([^;]+)/);
        if (pm) pass = pm[1];
      }
      return uid && pass && uid !== "deleted" && pass !== "deleted" ? { uid, pass } : null;
    }
    module2.exports = { BASE_URL, searchSKT, searchSKTPage, normalizeQuery, isPaused, pauseKind, breakerOpen, getCachedTorrent, sktLogin: sktLogin2, getTorrentCsfd, csfdFromDetail, hasDetail, cachedCsfd, filterLikeSKT, _resetBreaker, _breaker, _rate, HARD_LIMIT_MS };
  }
});

// ../sktorrent-realdebrid-docker/lib/search.js
var require_search = __commonJS({
  "../sktorrent-realdebrid-docker/lib/search.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var { searchSKTPage, isPaused, pauseKind, breakerOpen, getTorrentCsfd, hasDetail, cachedCsfd, filterLikeSKT } = require_skt();
    var { episodeFilters, makeStrictTitleMatcher, makeSeriesYearCheck, dashShortNames, makeSeasonYearCheck, makeNoSeasonYearCheck, makeForeignPartCheck, lastKnownSeasonYear, buildSearchNames, filterYear, isMoviePack, latinName, normTitle, titleSegment, partNumbers, isMakingOf } = require_matching();
    var { delay } = require_util();
    var SEARCH_BUDGET_MS = +_process.env.SKT_SEARCH_BUDGET_MS || 25e3;
    var ROUND_MIN_MS = Math.round(SEARCH_BUDGET_MS * 0.32);
    var MAX_PAGES = 3;
    var MAX_CONCURRENT = 4;
    var MAX_DETAILS = 8;
    var MAX_RESCUE = 4;
    var MAX_VETO = 3;
    var DETAIL_CONCURRENCY = 2;
    var active = 0;
    var waiters = [];
    function acquire(maxWaitMs, background) {
      if (active < MAX_CONCURRENT) {
        active++;
        return Promise.resolve(true);
      }
      if (background || maxWaitMs <= 0) return Promise.resolve(false);
      return new Promise((res) => {
        const w = { res };
        w.timer = _setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) waiters.splice(i, 1);
          res(false);
        }, maxWaitMs);
        waiters.push(w);
      });
    }
    function release() {
      const w = waiters.shift();
      if (w) {
        _clearTimeout(w.timer);
        w.res(true);
      } else active--;
    }
    var timeLeft = (started) => SEARCH_BUDGET_MS - (Date.now() - started);
    var raceDeadline = (promise, ms, fallback) => new Promise((res) => {
      const t = _setTimeout(() => res(fallback), Math.max(0, ms));
      promise.then((v) => {
        _clearTimeout(t);
        res(v);
      }, () => {
        _clearTimeout(t);
        res(fallback);
      });
    });
    var ALLOWED = {
      movie: /film|dokument/i,
      // Filmy CZ/SK dabing, Filmy s titulkami, HD/Blu-ray/UHD/3D Filmy, Filmy Kreslené…, Dokument
      series: /seri[aá]l|po[rř]ad|dokument|kreslen/i
      // Seriál, TV Pořad, Dokument, Filmy Kreslené (animované seriály)
    };
    async function findTorrents(opts) {
      const started = Date.now();
      const got = await acquire(SEARCH_BUDGET_MS - ROUND_MIN_MS - 1e3, !!opts.background);
      if (!got) {
        if (opts.background) return null;
        console.log(`[SKT] ⏳ Příliš mnoho souběžných hledání — vzdávám po ${Date.now() - started} ms`);
        return {
          torrents: [],
          batchTorrents: [],
          epTag: "",
          names: [],
          seasonYear: null,
          ms: Date.now() - started,
          sktDown: true,
          audit: { queries: [{ q: "", p: 0, n: 0, err: "fronta hledání", ms: Date.now() - started }], torrents: [] }
        };
      }
      const queued = Date.now() - started;
      if (queued >= 100) console.log(`[SKT] ⏳ Hledání čekalo ${queued} ms na volné místo`);
      try {
        return await findTorrentsInner(opts, started, queued);
      } finally {
        release();
      }
    }
    async function findTorrentsInner({ type, season, episode, titles, sktUid, sktPass, background }, started, queuedMs) {
      const overBudget = () => timeLeft(started) <= 0;
      let failedInRow = 0;
      const sktFailing = () => failedInRow >= 2;
      const stop = () => sktFailing() || overBudget();
      const canStartRound = () => !stop() && timeLeft(started) >= ROUND_MIN_MS;
      const allowed = ALLOWED[type === "series" ? "series" : "movie"];
      const audit = /* @__PURE__ */ new Map(), queries = [];
      const mark = (t, ok, reason) => {
        const prev = audit.get(t.hash);
        if (prev && prev.ok && !ok) return;
        audit.set(t.hash, { t, ok, reason });
      };
      const page = async (q, p = 0, low = false) => {
        const t0 = Date.now();
        const r = await raceDeadline(searchSKTPage(q, sktUid, sktPass, p, { low: !!(low || p > 0 || background) }), timeLeft(started), { items: [], hasMore: false, err: "limit hledání" });
        const rec = { q, p, n: r.items.length, more: r.hasMore, ms: r.cached ? "cache" : r.ms ?? Date.now() - t0 };
        if (r.wait) rec.wait = r.wait;
        if (r.rl) rec.rl = r.rl;
        if (r.probeWait) rec.probeWait = r.probeWait;
        if (r.firstErr) rec.retry = r.firstErr;
        if (r.pause) rec.pause = r.pause;
        if (r.err) {
          rec.err = r.err;
          if (r.msg) rec.msg = r.msg;
          if (!r.skipped || r.firstErr) failedInRow++;
          else rec.skip = true;
        } else failedInRow = 0;
        queries.push(rec);
        const items = r.items.filter((t) => !t.cat || allowed.test(t.cat));
        const dropped = r.items.filter((t) => t.cat && !allowed.test(t.cat));
        dropped.forEach((t) => mark(t, false, `kategorie mimo (${t.cat})`));
        if (dropped.length) console.log(`[SKT]   ⏭️ kategorie mimo ${type}: ${[...new Set(dropped.map((t) => t.cat))].join(", ")} (${dropped.length})`);
        await verifyCsfd(items);
        return { items, raw: r.items, hasMore: r.hasMore, err: r.err };
      };
      const localPage = (q, from, extra) => {
        if (from.err) return { items: [], raw: [], hasMore: false };
        const raw = filterLikeSKT(from.raw, extra);
        queries.push({ q, p: 0, n: raw.length, more: false, ms: "lokálně" });
        return { items: raw.filter((t) => !t.cat || allowed.test(t.cat)), raw, hasMore: false };
      };
      let torrents = [], batchTorrents = [], noSeasonTorrents = [];
      const isSeries = type === "series" && season !== void 0 && episode !== void 0;
      const f = isSeries ? episodeFilters(season, episode) : null;
      const movieYear = type === "movie" && titles.year ? String(titles.year).replace(/[–-].*$/, "").trim() : "";
      const addBatch = (list) => {
        for (const t of list) if (!batchTorrents.some((b) => b.hash === t.hash) && !torrents.some((e) => e.hash === t.hash)) batchTorrents.push(t);
      };
      const { en, cz, sk } = buildSearchNames(titles);
      const allNames0 = [titles.en, titles.title, titles.original, titles.cz, titles.sk, ...titles.all || [], ...titles.alt || []];
      const allNames = [...allNames0, ...dashShortNames([titles.en, titles.cz]), ...titles.csfdTitle ? [titles.csfdTitle] : []];
      const strictRaw = makeStrictTitleMatcher(allNames, { colonNeedsYear: type !== "series", filmYear: movieYear || null });
      const csfdOnly = titles.source === "csfd";
      const ourCsfd = titles.csfdId ? Number(titles.csfdId) : null;
      const ourNorm = [...new Set(allNames.map(latinName).filter(Boolean).map(normTitle).filter((n) => n.length >= 3))];
      const ourParts = partNumbers(allNames);
      const startsWithOurName = (t) => titleSegment(t.name, t.cat, /* @__PURE__ */ new Set(), ourParts).split(/(?<!\d)\/|\/(?!\d)|\|/).some((p) => {
        const n = normTitle(p);
        return ourNorm.some((o) => n.startsWith(o + " "));
      });
      const csfdOf = /* @__PURE__ */ new Map();
      const csfdByName = /* @__PURE__ */ new Map();
      const csfdState = (name) => {
        if (!ourCsfd || !csfdByName.has(name)) return null;
        const c = csfdByName.get(name);
        return c === null ? null : c === ourCsfd ? "match" : "other";
      };
      const foreignPart = makeForeignPartCheck(allNames, strictRaw);
      const partCsfd = /* @__PURE__ */ new Map();
      const learnPart = (t, c) => {
        if (c === null || c === void 0) return;
        for (const p of foreignPart.parts(t.name, t.cat)) {
          if (!partCsfd.has(p)) partCsfd.set(p, /* @__PURE__ */ new Set());
          partCsfd.get(p).add(c);
        }
      };
      const partVeto = (name, cat) => {
        if (!partCsfd.size) return null;
        for (const p of foreignPart.parts(name, cat)) {
          const ids = partCsfd.get(p);
          if (ids && !ids.has(ourCsfd)) return { id: [...ids][0], part: p };
        }
        return null;
      };
      const vetoed = (name, cat) => {
        const st2 = csfdState(name);
        if (st2 === "other") return csfdOnly || foreignPart(name, cat);
        return st2 !== "match" && !!partVeto(name, cat);
      };
      const strict = (name, cat, opts) => {
        const st2 = csfdState(name);
        if (st2 === "match") return true;
        if (vetoed(name, cat)) return false;
        return strictRaw(name, cat, opts);
      };
      const nameReason = (t) => {
        if (!vetoed(t.name, t.cat)) return "název nesedí";
        if (csfdState(t.name) === "other") return `jiné ČSFD (${csfdByName.get(t.name)})`;
        const pv = partVeto(t.name, t.cat);
        return `jiné ČSFD (${pv.id}, podle „${pv.part}“)`;
      };
      const wouldPass = (t) => isSeries ? f.matchesExactEpisode(t.name) || f.isBatchSeason(t.name) || f.isNoSeasonCandidate(t.name) : filterYear([t], movieYear).length > 0;
      let detailsLeft = csfdOnly ? MAX_DETAILS : MAX_RESCUE, vetoLeft = MAX_VETO, dActive = 0, detailsSent = 0;
      const dWait = [];
      const dAcquire = () => dActive < DETAIL_CONCURRENCY ? (dActive++, Promise.resolve()) : new Promise((r) => dWait.push(r));
      const dRelease = () => {
        const w = dWait.shift();
        if (w) w();
        else dActive--;
      };
      async function verifyCsfd(items) {
        if (!ourCsfd) return;
        const cand = [];
        for (const t of items) {
          if (csfdOf.has(t.hash) || t.cat && !allowed.test(t.cat)) continue;
          const c = cachedCsfd(t.hash);
          if (c !== void 0) {
            csfdOf.set(t.hash, c);
            csfdByName.set(t.name, c);
            learnPart(t, c);
          }
        }
        for (const t of items) {
          if (csfdOf.has(t.hash) || t.cat && !allowed.test(t.cat)) continue;
          const pass = strictRaw(t.name, t.cat);
          const kind = csfdOnly ? "csfd" : !pass ? startsWithOurName(t) ? "rescue" : null : wouldPass(t) && foreignPart(t.name, t.cat) ? "veto" : null;
          if (kind) cand.push({ t, pass, kind });
        }
        cand.sort((a, b) => (b.pass ? 1 : 0) - (a.pass ? 1 : 0));
        const seenParts = /* @__PURE__ */ new Set(), dup = [];
        const order2 = cand.filter((c) => {
          if (c.kind !== "veto") return true;
          const ps = foreignPart.parts(c.t.name, c.t.cat);
          if (ps.some((p) => !seenParts.has(p))) {
            ps.forEach((p) => seenParts.add(p));
            return true;
          }
          dup.push(c);
          return false;
        }).concat(dup);
        const offline = breakerOpen() || isPaused(sktUid, sktPass);
        const jobs = [];
        for (const { t, kind } of order2) {
          if (csfdOf.has(t.hash)) continue;
          if (stop()) break;
          if (!hasDetail(t.hash)) {
            if (offline) continue;
            if (kind === "veto") {
              if (partVeto(t.name, t.cat) || vetoLeft <= 0) continue;
              vetoLeft--;
            } else {
              if (detailsLeft <= 0) continue;
              detailsLeft--;
            }
            detailsSent++;
          }
          csfdOf.set(t.hash, void 0);
          jobs.push(dAcquire().then(async () => {
            const c = stop() ? void 0 : await raceDeadline(getTorrentCsfd(t.hash, sktUid, sktPass), timeLeft(started), void 0);
            if (c === void 0) csfdOf.delete(t.hash);
            else {
              csfdOf.set(t.hash, c);
              csfdByName.set(t.name, c);
              learnPart(t, c);
            }
          }).finally(dRelease));
        }
        await Promise.all(jobs);
      }
      const strictBase = makeStrictTitleMatcher(allNames.filter(Boolean).map((n) => n.replace(/(^|\s)\d{1,2}(?=\s|$)/g, " ").trim()));
      const names = [];
      const primary = new Set([cz[0], en[0], sk[0]].filter(Boolean));
      const usable = (n) => primary.has(n) || strict(n, "") || type !== "series" && strictBase(n, "");
      const csfdQ = !csfdOnly && titles.csfdTitle ? buildSearchNames({ cz: titles.csfdTitle }).cz[0] : null;
      const order = csfdOnly ? [cz[0] || en[0], sk[0], en[0], ...cz.slice(1), ...en.slice(1)] : [cz[0], en[0], csfdQ, ...cz.slice(1), ...en.slice(1), ...sk];
      const seenNorm = /* @__PURE__ */ new Set();
      for (const n of order) {
        if (!n || names.includes(n) || !usable(n) || csfdOnly && names.length >= 3) continue;
        const k = normTitle(n);
        if (seenNorm.has(k)) continue;
        seenNorm.add(k);
        names.push(n);
      }
      const mainNames = new Set(names.slice(0, 2));
      const matchesMovie = (t) => !isMakingOf(t.name, allNames) && (strict(t.name, t.cat) || isMoviePack(t.name) && strictBase(t.name, t.cat));
      function judgeMovie(q, p, r) {
        const byYear = r.items.filter((t) => csfdState(t.name) === "match" || filterYear([t], movieYear).length);
        const byTitle = byYear.filter((t) => matchesMovie(t));
        r.items.forEach((t) => {
          if (!byYear.includes(t)) mark(t, false, `rok nesedí (${(t.name.match(/\b(19|20)\d{2}\b/g) || []).join(",")})`);
          else if (!byTitle.includes(t)) mark(t, false, isMakingOf(t.name, allNames) ? "dokument o filmu" : nameReason(t));
          else mark(t, true, isMoviePack(t.name) ? "kolekce" : "film");
        });
        console.log(`[SKT] 🎞️ "${q}"${p ? ` str. ${p + 1}` : ""}: ${r.items.length} → rok ${byYear.length} → název ${byTitle.length}`);
        r.items.filter((t) => !byYear.includes(t)).slice(0, 3).forEach((t) => console.log(`[SKT]   ⏭️ rok: "${t.name.slice(0, 90)}"`));
        byYear.filter((t) => !byTitle.includes(t)).slice(0, 3).forEach((t) => console.log(`[SKT]   ⏭️ název: "${t.name.slice(0, 90)}"`));
        for (const t of byTitle) if (!torrents.some((x) => x.hash === t.hash)) torrents.push(t);
      }
      async function movieQuery(name, q, maxPages) {
        for (let p = 0; p < maxPages && (p === 0 ? canStartRound() : !stop()); p++) {
          const r = await page(q, p, true);
          judgeMovie(q, p, r);
          if (torrents.length || !r.hasMore) break;
          await delay(300);
        }
      }
      if (!isSeries && names.length && canStartRound()) {
        const qs = names.slice(0, 3);
        const rs = await Promise.all(qs.map((q, i) => page(q, 0, i >= 2)));
        if (movieYear) {
          const ys = await Promise.all(qs.map((n, i) => {
            const q = `${n} ${movieYear}`;
            return rs[i].hasMore && canStartRound() ? page(q, 0, i >= 2) : localPage(q, rs[i], movieYear);
          }));
          ys.forEach((r, i) => judgeMovie(`${qs[i]} ${movieYear}`, 0, r));
          for (const name of names.slice(3)) {
            if (torrents.length || !canStartRound()) break;
            await movieQuery(name, `${name} ${movieYear}`, 1);
          }
        }
        if (!torrents.length) {
          const recent = movieYear && parseInt(movieYear) >= (/* @__PURE__ */ new Date()).getFullYear() - 1;
          const maxPages = recent ? 1 : MAX_PAGES;
          rs.forEach((r, i) => judgeMovie(qs[i], 0, r));
          const more = rs.findIndex((r) => r.hasMore);
          if (!torrents.length && more >= 0) {
            for (let p = 1; p < maxPages && !torrents.length && canStartRound(); p++) {
              await delay(300);
              const r = await page(qs[more], p);
              judgeMovie(qs[more], p, r);
              if (!r.hasMore) break;
            }
          }
          for (const name of names.slice(3)) {
            if (torrents.length || !canStartRound()) break;
            await movieQuery(name, name, maxPages);
          }
        }
      }
      let titleSeen = 0;
      const tooOld = isSeries ? makeSeriesYearCheck(titles.year, allNames) : () => null;
      const seasonYear = isSeries ? (titles.seasonYears || {})[season] : null;
      const seasonAfter = isSeries ? lastKnownSeasonYear(titles.seasonYears, season) : null;
      const newSeasonYear = parseInt(seasonYear) || (seasonAfter ? seasonAfter + 1 : 0);
      const newSeason = isSeries && newSeasonYear >= (/* @__PURE__ */ new Date()).getFullYear() - 1;
      const beforeSeason0 = isSeries ? makeSeasonYearCheck(seasonYear, season, allNames, { lastKnownYear: seasonAfter, seriesYear: titles.year }) : () => null;
      const otherYear = isSeries ? makeNoSeasonYearCheck(seasonYear, titles.year, allNames) : () => null;
      const beforeSeason = (n) => beforeSeason0(n) || otherYear(n);
      const noSeasonOk = (t) => f.isNoSeasonCandidate(t.name) && strict(t.name, t.cat, { whole: true }) && !beforeSeason(t.name);
      const bareYearCheck = isSeries ? makeNoSeasonYearCheck(seasonYear || titles.year, titles.year, allNames) : () => null;
      const bareYear = (n) => isSeries && f.bareOnly(n) ? bareYearCheck(n) : null;
      const isEpisode = (n) => f.matchesExactEpisode(n) && !bareYear(n);
      const judgeSeries = (items, matchesTitle, withNoSeason) => items.forEach((t) => {
        if (!strict(t.name, t.cat)) return mark(t, false, nameReason(t));
        const old = csfdState(t.name) === "match" ? null : tooOld(t.name);
        if (old) return mark(t, false, old);
        titleSeen++;
        if (f.matchesExactEpisode(t.name)) {
          const by = bareYear(t.name);
          return by ? mark(t, false, by.replace("bez sezóny", "holý díl")) : mark(t, true, "epizoda");
        }
        if (f.isBatchSeason(t.name)) return mark(t, true, "balík");
        if (withNoSeason && f.isNoSeasonCandidate(t.name)) {
          if (!strict(t.name, t.cat, { whole: true })) return mark(t, false, "bez sezóny, název jen částečně");
          const before = beforeSeason(t.name);
          return before ? mark(t, false, before) : mark(t, true, "balík (bez sezóny v názvu)");
        }
        mark(t, false, f.rejectReason(t.name));
      });
      async function seriesWithName(name) {
        if (!canStartRound()) return;
        const matchesTitle = (t) => strict(t.name, t.cat) && (csfdState(t.name) === "match" || !tooOld(t.name));
        const fit = (items) => items.filter((t) => matchesTitle(t));
        const addEps = (list) => {
          for (const t of list) if (!torrents.some((x) => x.hash === t.hash)) torrents.push(t);
        };
        const take = (r) => {
          const found = fit(r.items);
          addEps(found.filter((t) => isEpisode(t.name)));
          addBatch(found.filter((t) => f.isBatchSeason(t.name)));
        };
        const low = !mainNames.has(name);
        const haveSeasonPack = () => batchTorrents.some((t) => f.isSeasonPack(t.name));
        const qSeri = `${name} seri`;
        const bare = await page(name, 0, low);
        const [ep, se, seri] = bare.hasMore && canStartRound() ? await Promise.all([page(`${name} ${f.epTag}`, 0, low), page(`${name} ${f.seTag}`, 0, low), page(qSeri, 0, low)]) : [localPage(`${name} ${f.epTag}`, bare, f.epTag), localPage(`${name} ${f.seTag}`, bare, f.seTag), localPage(qSeri, bare, "seri")];
        for (const r of [ep, se, bare, seri]) take(r);
        judgeSeries(ep.items, matchesTitle, false);
        judgeSeries(se.items, matchesTitle, false);
        const morePages = async (q, first, withNoSeason) => {
          let r = first, p = 0;
          if (newSeason && !first.items.some((t) => strict(t.name, t.cat))) {
            if (first.hasMore) console.log(`[SKT]   ⏭️ nová sezóna — „${q}“ bez našeho titulu na 1. stránce, další stránky se nečtou`);
            if (withNoSeason) {
              judgeSeries(r.items, matchesTitle, true);
              for (const t of fit(r.items).filter(noSeasonOk)) if (!noSeasonTorrents.some((x) => x.hash === t.hash)) noSeasonTorrents.push(t);
            }
            return;
          }
          while (true) {
            if (withNoSeason) {
              judgeSeries(r.items, matchesTitle, true);
              for (const t of fit(r.items).filter(noSeasonOk))
                if (!noSeasonTorrents.some((x) => x.hash === t.hash)) {
                  noSeasonTorrents.push(t);
                  console.log(`[SKT] 📦 +bez sezóny: "${t.name.slice(0, 80)}"`);
                }
            } else if (p > 0) judgeSeries(r.items, matchesTitle, false);
            if (p > 0) take(r);
            if (haveSeasonPack() || !r.hasMore || ++p >= MAX_PAGES || !canStartRound()) break;
            await delay(300);
            r = await page(q, p);
          }
        };
        await Promise.all([morePages(name, bare, true), morePages(qSeri, seri, true)]);
      }
      if (isSeries) {
        for (const name of names) {
          await seriesWithName(name);
          if (torrents.length || batchTorrents.length || noSeasonTorrents.length || titleSeen || stop()) break;
        }
      }
      if (partCsfd.size) {
        const late = (list) => list.filter((t) => {
          if (!vetoed(t.name, t.cat)) return true;
          audit.set(t.hash, { t, ok: false, reason: nameReason(t) });
          return false;
        });
        torrents = late(torrents);
        batchTorrents = late(batchTorrents);
        noSeasonTorrents = late(noSeasonTorrents);
      }
      for (const t of noSeasonTorrents) addBatch([t]);
      batchTorrents = batchTorrents.filter((b) => !torrents.some((t) => t.hash === b.hash));
      if (!queries.length && (breakerOpen() || isPaused(sktUid, sktPass))) queries.push({ q: "", p: 0, n: 0, ms: 0, err: breakerOpen() ? "jistič" : pauseKind(sktUid, sktPass) });
      const sktDown = !torrents.length && !batchTorrents.length && queries.some((q) => q.err);
      console.log(`[SKT] Výsledek: ${torrents.length} ${isSeries ? "epizod" : "filmů"}, ${batchTorrents.length} balíků (${Date.now() - started} ms)${sktDown ? " — ⚠️ SKT neodpovídá" : ""}`);
      return {
        torrents,
        batchTorrents,
        epTag: f?.epTag || "",
        names,
        seasonYear: seasonYear || null,
        ...seasonAfter ? { seasonAfter } : {},
        ms: Date.now() - started,
        ...sktDown ? { sktDown: true } : {},
        ...queuedMs >= 100 ? { queuedMs } : {},
        ...detailsSent ? { details: detailsSent } : {},
        ...ourCsfd ? { csfdOf: new Map([...csfdOf].filter(([, v]) => v !== void 0)) } : {},
        audit: { queries, torrents: [...audit.values()] }
      };
    }
    module2.exports = { findTorrents, ALLOWED, SEARCH_BUDGET_MS, MAX_CONCURRENT };
  }
});

// ../sktorrent-realdebrid-docker/lib/rd.js
var require_rd = __commonJS({
  "../sktorrent-realdebrid-docker/lib/rd.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var axios = require_axios();
    var { createCache, once } = require_cache();
    var { isVideo, isSample, delay, keyId, errMsg } = require_util();
    var { pickBySel, selKey } = require_matching();
    var RD_API = "https://api.real-debrid.com/rest/1.0";
    var BAD = /* @__PURE__ */ new Set(["magnet_error", "error", "virus", "dead"]);
    var TRACKERS = ["udp://tracker.opentrackr.org:1337/announce", "udp://ipv4announce.sktorrent.eu:6969/announce", "udp://open.stealth.si:80/announce"];
    var listCache = createCache({ ttl: 30 * 1e3, max: 1e3 });
    var linkCache = createCache({ ttl: 50 * 60 * 1e3, max: 1e4 });
    var auth = (t) => ({ Authorization: `Bearer ${t}` });
    var form = (t) => ({ ...auth(t), "Content-Type": "application/x-www-form-urlencoded" });
    async function rdVerify2(token) {
      try {
        return (await axios.get(`${RD_API}/user`, { headers: auth(token), timeout: 5e3 })).data;
      } catch (e) {
        return null;
      }
    }
    async function rdList(token) {
      const k = keyId(token);
      const c = listCache.get(k);
      if (c) return c;
      return once(`rdlist:${k}`, async () => {
        const r = await axios.get(`${RD_API}/torrents`, { headers: auth(token), params: { limit: 2500 }, timeout: 1e4 });
        const list = Array.isArray(r.data) ? r.data : [];
        listCache.set(k, list);
        return list;
      });
    }
    async function rdInfo(token, id) {
      try {
        return (await axios.get(`${RD_API}/torrents/info/${id}`, { headers: auth(token), timeout: 1e4 })).data;
      } catch (e) {
        console.error("[RD] info:", errMsg(e));
        return null;
      }
    }
    async function rdAdd(token, hash) {
      const magnet = `magnet:?xt=urn:btih:${hash}${TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("")}`;
      const r = await axios.post(`${RD_API}/torrents/addMagnet`, `magnet=${encodeURIComponent(magnet)}`, { headers: form(token), timeout: 15e3 });
      listCache.delete(keyId(token));
      console.log(`[RD] ➕ Magnet přidán: ${r.data.id}`);
      return r.data.id;
    }
    async function rdSelect(token, id, files) {
      await axios.post(`${RD_API}/torrents/selectFiles/${id}`, `files=${files}`, { headers: form(token), timeout: 1e4 });
      listCache.delete(keyId(token));
    }
    async function rdDelete(token, id) {
      try {
        await axios.delete(`${RD_API}/torrents/delete/${id}`, { headers: auth(token), timeout: 5e3 });
        listCache.delete(keyId(token));
      } catch (e) {
      }
    }
    async function rdUnrestrict(token, link2) {
      const r = await axios.post(`${RD_API}/unrestrict/link`, `link=${encodeURIComponent(link2)}`, { headers: form(token), timeout: 1e4 });
      return r.data.download;
    }
    function videoIds(info) {
      const v = (info.files || []).filter((f) => isVideo(f.path));
      const ns = v.filter((f) => !isSample(f.path));
      return (ns.length ? ns : v).map((f) => f.id);
    }
    async function pollInfo(token, id, done, tries = 5) {
      let info = null;
      for (let i = 0; i < tries; i++) {
        info = await rdInfo(token, id);
        if (!info) return null;
        if (done(info) || BAD.has(info.status)) return info;
        if (i < tries - 1) await delay(1e3);
      }
      return info;
    }
    var isReady = (i) => i && i.status === "downloaded" && i.links?.length > 0;
    var downloading = (i) => ({ status: "downloading", progress: i?.progress || 0, state: i?.status || null, since: i?.added || null, seeds: i?.seeders ?? null });
    async function accountStatus(token, hashes) {
      const want = new Set(hashes.map((h) => h.toLowerCase()));
      const out = /* @__PURE__ */ new Map();
      for (const t of await rdList(token)) {
        const h = (t.hash || "").toLowerCase();
        if (!want.has(h) || out.has(h) && out.get(h).ready) continue;
        out.set(h, { ready: t.status === "downloaded", failed: BAD.has(t.status), state: t.status || null, progress: t.progress || 0, since: t.added || null });
      }
      return out;
    }
    var fail = (reason) => ({ status: "error", reason });
    async function selectAndWait(token, id, info) {
      info = info || await rdInfo(token, id);
      if (!info) return fail("RD neodpovídá");
      const ids = videoIds(info);
      if (!ids.length) {
        await rdDelete(token, id);
        return fail("Torrent neobsahuje video");
      }
      await rdSelect(token, id, ids.join(","));
      console.log(`[RD] ✔️ Vybráno ${ids.length} video souborů`);
      info = await pollInfo(token, id, isReady);
      if (!info) return fail("RD neodpovídá");
      if (BAD.has(info.status)) {
        await rdDelete(token, id);
        return fail(`RD: ${info.status}`);
      }
      if (isReady(info)) return { status: "ready", info };
      return downloading(info);
    }
    function getTorrent(token, hash, { forceNew = false } = {}) {
      return once(`rd:${keyId(token)}:${hash}:${forceNew ? 1 : 0}`, async () => {
        try {
          const mine = (await rdList(token)).filter((t) => (t.hash || "").toLowerCase() === hash && !BAD.has(t.status));
          if (!forceNew) {
            const done = mine.filter((t) => t.status === "downloaded").sort((a, b) => (b.links?.length || 0) - (a.links?.length || 0))[0];
            if (done) {
              const info2 = await rdInfo(token, done.id);
              if (isReady(info2)) return { status: "ready", info: info2, reused: true };
            }
          }
          const waiting = mine.find((t) => t.status === "waiting_files_selection");
          if (waiting) return await selectAndWait(token, waiting.id);
          const prog = mine.find((t) => t.status !== "downloaded");
          if (prog) {
            console.log(`[RD] 🕐 V účtu: ${prog.status} ${prog.progress || 0}%`);
            return downloading(prog);
          }
          const id = await rdAdd(token, hash);
          const info = await pollInfo(token, id, (i) => i.status === "waiting_files_selection" || isReady(i));
          if (!info) return fail("RD neodpovídá");
          if (BAD.has(info.status)) {
            await rdDelete(token, id);
            return fail(`RD: ${info.status}`);
          }
          if (isReady(info)) return { status: "ready", info };
          if (info.status === "waiting_files_selection") return await selectAndWait(token, id, info);
          return downloading(info);
        } catch (e) {
          console.error("[RD]", errMsg(e));
          return fail(`RD: ${errMsg(e)}`);
        }
      });
    }
    function mapLinks(info) {
      const sel = (info.files || []).filter((f) => f.selected === 1).sort((a, b) => a.id - b.id);
      if (sel.length !== (info.links || []).length) return null;
      return sel.map((f, i) => ({ id: f.id, name: f.path, size: f.bytes, link: info.links[i] }));
    }
    function pickFromInfo(info, sel) {
      const all = (info.files || []).map((f) => ({ id: f.id, name: f.path, size: f.bytes, selected: f.selected === 1 }));
      const target = pickBySel(all, sel);
      if (!target) return {
        file: null,
        unselected: false,
        reason: "Hledaný díl/film v torrentu nenalezen",
        videos: all.filter((f) => isVideo(f.name)).map((f) => ({ n: f.name, s: f.size }))
      };
      if (!target.selected) return { file: null, unselected: true, reason: "Soubor není v RD vybraný" };
      const mapped = mapLinks(info);
      if (!mapped) return { file: null, unselected: false, reason: "RD vrátil archiv místo jednotlivých souborů" };
      const file = mapped.find((f) => f.id === target.id) || null;
      return { file, unselected: false, reason: file ? null : "Soubor nenalezen mezi linky" };
    }
    async function resolve(token, hash, sel = {}) {
      const lk = `${keyId(token)}:${hash}:${selKey(sel)}`;
      const c = linkCache.get(lk);
      if (c) {
        console.log("[RD] 💾 Link z cache");
        return { status: "ready", url: c.url, file: c.file, fromCache: true };
      }
      return once(`rdres:${lk}`, async () => {
        let t = await getTorrent(token, hash);
        if (t.status !== "ready") return t;
        let p = pickFromInfo(t.info, sel);
        if (!p.file && p.unselected && t.reused) {
          console.log("[RD] Starý záznam nemá vybraný potřebný soubor → přidávám znovu se všemi videi");
          t = await getTorrent(token, hash, { forceNew: true });
          if (t.status !== "ready") return t;
          p = pickFromInfo(t.info, sel);
        }
        if (!p.file) return { ...fail(p.reason), videos: p.videos };
        try {
          const url = await rdUnrestrict(token, p.file.link);
          if (!url) return fail("RD nevrátil odkaz");
          linkCache.set(lk, { url, file: p.file.name });
          console.log(`[RD] ✅ ${p.file.name.split("/").pop()}`);
          return { status: "ready", url, file: p.file.name };
        } catch (e) {
          return fail(`RD unrestrict: ${errMsg(e)}`);
        }
      });
    }
    async function listFiles(token, hash) {
      let t = await getTorrent(token, hash);
      if (t.status !== "ready") return t;
      if (t.reused && (t.info.files || []).some((f) => isVideo(f.path) && f.selected !== 1)) {
        t = await getTorrent(token, hash, { forceNew: true });
        if (t.status !== "ready") return t;
      }
      const mapped = mapLinks(t.info);
      if (!mapped) return fail("RD vrátil archiv");
      const vids = mapped.filter((f) => isVideo(f.name)).map((f) => ({ id: f.id, name: f.name.split("/").pop(), size: f.size }));
      vids.sort((a, b) => a.name.localeCompare(b.name, void 0, { numeric: true }));
      return { status: "ready", files: vids };
    }
    module2.exports = { rdVerify: rdVerify2, resolve, listFiles, accountStatus };
  }
});

// ../sktorrent-realdebrid-docker/lib/streams.js
var require_streams = __commonJS({
  "../sktorrent-realdebrid-docker/lib/streams.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var isDead = (t, cached) => Number(t?.seeds) === 0 && cached !== true;
    function orderPicked(picked, cachedSet, { uncertain, yearOk } = {}) {
      const cached = (x) => cachedSet ? cachedSet.has(x.t.hash) : null;
      const rank = (x) => (isDead(x.t, cached(x)) ? 16 : 0) + (x.isBatch ? 8 : 0) + (uncertain && uncertain(x.t.name, x.t.cat) ? 4 : 0) + (cachedSet && !cachedSet.has(x.t.hash) ? 2 : 0) + (yearOk && !yearOk(x.t.name) ? 1 : 0);
      return picked.map((x, i) => ({ ...x, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i).map(({ i, ...x }) => x);
    }
    function ageText(since, now = Date.now()) {
      const t = Date.parse(since || "");
      if (!Number.isFinite(t) || t > now) return "";
      const h = (now - t) / 36e5;
      return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dní`;
    }
    var STALL_MS = 3 * 3600 * 1e3;
    function isStalled(st2, now = Date.now()) {
      if (!st2 || st2.ready || st2.failed) return false;
      if (/stalled|no seeds|dead/i.test(String(st2.state || ""))) return true;
      const t = Date.parse(st2.since || "");
      return Number.isFinite(t) && now - t >= STALL_MS && (st2.progress || 0) <= 5;
    }
    var LONG_QUEUE_MS = 48 * 3600 * 1e3;
    function queuedSince(since, now = Date.now()) {
      const t = Date.parse(since || "");
      if (!Number.isFinite(t) || now - t < LONG_QUEUE_MS) return "";
      const d = new Date(t);
      const p = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric" }).formatToParts(d);
      const g = (k) => p.find((x) => x.type === k)?.value;
      return `${g("day")}. ${g("month")}.`;
    }
    function accountNote(st2, label, now = Date.now()) {
      if (!st2 || st2.ready) return "";
      if (st2.failed) return `❌ V účtu ${label}: ${st2.state || "chyba"}`;
      if (st2.queued) {
        const od = queuedSince(st2.since, now);
        return od ? `⏳ Ve frontě ${label} od ${od} — zkontrolujte aktivní stahování v účtu` : `⏳ Ve frontě ${label} (plné sloty stahování)`;
      }
      const age = ageText(st2.since, now);
      const base = `🕐 V účtu ${label}: ${st2.state || "stahuje se"} ${st2.progress || 0} %${age ? ` (${age})` : ""}`;
      return isStalled(st2, now) ? `⚠️ Stahování stojí — ${base.slice(2).trim()}` : base;
    }
    module2.exports = { isDead, orderPicked, ageText, isStalled, accountNote, queuedSince };
  }
});

// ../sktorrent-realdebrid-docker/lib/tb.js
var require_tb = __commonJS({
  "../sktorrent-realdebrid-docker/lib/tb.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var axios = require_axios();
    var { createCache, once } = require_cache();
    var { isVideo, basename, delay, keyId, errMsg } = require_util();
    var { pickBySel, selKey } = require_matching();
    var { queuedSince } = require_streams();
    var TB_API = "https://api.torbox.app/v1/api";
    var TRACKERS = ["udp://tracker.opentrackr.org:1337/announce", "udp://ipv4announce.sktorrent.eu:6969/announce", "udp://open.stealth.si:80/announce"];
    var listCache = createCache({ ttl: 30 * 1e3, max: 1e3 });
    var queueCache = createCache({ ttl: 30 * 1e3, max: 1e3 });
    var LIMIT_PAUSE_MS = 10 * 60 * 1e3;
    var createPausedUntil = /* @__PURE__ */ new Map();
    var linkCache = createCache({ ttl: 2 * 3600 * 1e3, max: 1e4 });
    var auth = (k) => ({ Authorization: `Bearer ${k}` });
    var fail = (reason) => ({ status: "error", reason });
    var queued = (reason = "TorBox: torrent ve frontě (plné sloty stahování)") => ({ status: "queued", reason });
    var limited = (reason) => ({ status: "limit", reason });
    var isQueuedMsg = (m) => /queued/i.test(String(m || ""));
    var isLimitMsg = (m) => /per\s*1\s*hour|rate.?limit|too many|\b429\b/i.test(String(m || ""));
    var isPlanMsg = (m) => /not available on your plan|upgrade to a paid plan/i.test(String(m || ""));
    var PLAN_CREATE = "TorBox: váš plán nedovoluje přidávat torrenty přes API, přehrát jdou jen ⚡ cachované";
    var planApi = (call) => `TorBox: váš plán nedovoluje použití API (${call || "?"}) — zkontrolujte předplatné TorBoxu`;
    var tagCall = (e, call) => {
      if (e && typeof e === "object" && !e.tbCall) e.tbCall = call;
      return e;
    };
    async function tbVerify2(key) {
      try {
        const r = await axios.get(`${TB_API}/user/me`, { headers: auth(key), timeout: 8e3 });
        return r.data?.success ? r.data.data : null;
      } catch (e) {
        return null;
      }
    }
    async function checkCached(key, hashes) {
      const want = [...new Set(hashes.map((h) => h.toLowerCase()))];
      const result = /* @__PURE__ */ new Set();
      try {
        for (let i = 0; i < want.length; i += 100) {
          const chunk = want.slice(i, i + 100);
          const r = await axios.get(`${TB_API}/torrents/checkcached`, { headers: auth(key), params: { hash: chunk.join(","), format: "object", list_files: false }, timeout: 1e4 });
          const data = r.data?.data || {};
          for (const h of Object.keys(data)) if (want.includes(h.toLowerCase())) result.add(h.toLowerCase());
        }
      } catch (e) {
        console.error("[TB] checkcached:", errMsg(e));
        return null;
      }
      console.log(`[TB] checkcached: ${result.size}/${want.length} v cache`);
      return result;
    }
    async function tbList(key) {
      const k = keyId(key);
      const c = listCache.get(k);
      if (c) return c;
      return once(`tblist:${k}`, async () => {
        const r = await axios.get(`${TB_API}/torrents/mylist`, { headers: auth(key), params: { bypass_cache: true }, timeout: 15e3 }).catch((e) => {
          throw tagCall(e, "mylist");
        });
        const list = Array.isArray(r.data?.data) ? r.data.data : [];
        listCache.set(k, list);
        return list;
      });
    }
    async function tbQueued(key) {
      const k = keyId(key);
      const c = queueCache.get(k);
      if (c) return c;
      return once(`tbqueue:${k}`, async () => {
        try {
          const r = await axios.get(`${TB_API}/torrents/getqueued`, { headers: auth(key), params: { bypass_cache: true }, timeout: 1e4 });
          const list = Array.isArray(r.data?.data) ? r.data.data : [];
          queueCache.set(k, list);
          return list;
        } catch (e) {
          console.error("[TB] getqueued:", errMsg(e));
          return [];
        }
      });
    }
    var inQueue = (list, hash) => list.find((q) => String(q.hash || "").toLowerCase() === hash || String(q.magnet || "").toLowerCase().includes(`btih:${hash}`));
    function createPaused(key) {
      const p = createPausedUntil.get(keyId(key));
      return p && p.until > Date.now() ? p : null;
    }
    function pauseCreate(key, why, plan = false) {
      createPausedUntil.set(keyId(key), { until: Date.now() + LIMIT_PAUSE_MS, plan });
      console.log(`[TB] ⏸️ ${why} — přidávání pozastaveno na ${LIMIT_PAUSE_MS / 6e4} min`);
    }
    async function tbGet(key, id) {
      const r = await axios.get(`${TB_API}/torrents/mylist`, { headers: auth(key), params: { id, bypass_cache: true }, timeout: 1e4 }).catch((e) => {
        throw tagCall(e, "mylist id");
      });
      return r.data?.data || null;
    }
    async function tbCreate(key, hash) {
      const magnet = `magnet:?xt=urn:btih:${hash}${TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("")}`;
      const fd = new import_formdata.default();
      fd.append("magnet", magnet);
      fd.append("seed", "3");
      fd.append("allow_zip", "false");
      let d;
      try {
        const r = await axios.post(`${TB_API}/torrents/createtorrent`, fd, { headers: auth(key), timeout: 2e4 });
        d = r.data || {};
      } catch (e) {
        const msg2 = errMsg(e);
        if (e.response?.status === 429 || isLimitMsg(msg2)) return { limit: true, detail: msg2 };
        if (isQueuedMsg(msg2)) return { queued: true, detail: msg2 };
        throw tagCall(e, "createtorrent");
      } finally {
        listCache.delete(keyId(key));
        queueCache.delete(keyId(key));
      }
      const msg = d.detail || d.error || "";
      if (d.success && d.data?.torrent_id) {
        console.log(`[TB] ➕ ${msg || "Přidáno"} (id ${d.data.torrent_id})`);
        return { id: d.data.torrent_id };
      }
      if (d.success && (d.data?.queued_id || isQueuedMsg(msg)) || isQueuedMsg(msg)) {
        console.log(`[TB] ⏳ ${msg || "Ve frontě"}`);
        return { queued: true, detail: msg };
      }
      if (isLimitMsg(msg)) return { limit: true, detail: msg };
      throw tagCall(new Error(msg || "createtorrent selhal"), "createtorrent");
    }
    async function tbRequestDl(key, torrentId, fileId) {
      const r = await axios.get(`${TB_API}/torrents/requestdl`, { params: { token: key, torrent_id: torrentId, file_id: fileId, zip_link: false }, timeout: 15e3 });
      if (!r.data?.success || !r.data?.data) throw new Error(r.data?.detail || r.data?.error || "requestdl selhal");
      return r.data.data;
    }
    var isReady = (t) => !!(t && (t.download_present || t.download_finished) && Array.isArray(t.files) && t.files.length);
    var isFailed = (t) => /error|fail/i.test(String(t?.download_state || ""));
    var progressOf = (t) => Math.round((t?.progress || 0) * 100);
    var downloading = (t) => ({ status: "downloading", progress: progressOf(t), state: t?.download_state || null, since: t?.created_at || null, seeds: t?.seeds ?? null });
    async function accountStatus(key, hashes) {
      const want = new Set(hashes.map((h) => h.toLowerCase()));
      const out = /* @__PURE__ */ new Map();
      const [list, queue] = await Promise.all([tbList(key), tbQueued(key)]);
      for (const t of list) {
        const h = (t.hash || "").toLowerCase();
        if (!want.has(h) || out.has(h) && out.get(h).ready) continue;
        out.set(h, { ready: isReady(t), failed: isFailed(t), state: t.download_state || null, progress: progressOf(t), since: t.created_at || null });
      }
      for (const q of queue) {
        const h = String(q.hash || "").toLowerCase();
        if (want.has(h) && !out.has(h)) out.set(h, { ready: false, queued: true, state: "ve frontě", progress: 0, since: q.created_at || null });
      }
      return out;
    }
    function getTorrent(key, hash, { allowCreate = true } = {}) {
      return once(`tb:${keyId(key)}:${hash}:${allowCreate ? 1 : 0}`, async () => {
        try {
          const mine = (await tbList(key)).filter((t2) => (t2.hash || "").toLowerCase() === hash);
          const ready = mine.find(isReady);
          if (ready) return { status: "ready", torrent: ready };
          const prog = mine.find((t2) => !isFailed(t2));
          if (prog) {
            console.log(`[TB] 🕐 V účtu: ${prog.download_state} ${progressOf(prog)}%`);
            return downloading(prog);
          }
          if (mine.length) return fail(`TorBox: ${mine[0].download_state}`);
          const q = inQueue(await tbQueued(key), hash);
          if (q) {
            const od = queuedSince(q.created_at);
            console.log(`[TB] ⏳ Ve frontě TorBoxu${od ? ` od ${od}` : ""} (plné sloty stahování)`);
            return { ...queued(od ? `TorBox: torrent ve frontě od ${od} (plné sloty stahování)` : void 0), ...q.created_at ? { since: q.created_at } : {} };
          }
          if (!allowCreate) return { status: "notadded" };
          const paused = createPaused(key);
          if (paused) return paused.plan ? { ...limited(PLAN_CREATE), plan: true } : limited(`TorBox: limit přidání — znovu za ${Math.ceil((paused.until - Date.now()) / 6e4)} min`);
          const c = await tbCreate(key, hash);
          if (c.limit) {
            pauseCreate(key, `limit TorBoxu (${c.detail || "429"})`);
            return limited(`TorBox: ${c.detail || "limit přidání"}`);
          }
          if (c.queued) return queued(`TorBox: ${c.detail || "ve frontě"}`);
          const id = c.id;
          let t = null;
          for (let i = 0; i < 5; i++) {
            t = await tbGet(key, id);
            if (isReady(t)) return { status: "ready", torrent: t };
            if (isFailed(t)) return fail(`TorBox: ${t.download_state}`);
            if (i < 4) await delay(1e3);
          }
          return downloading(t);
        } catch (e) {
          const msg = errMsg(e);
          const call = e?.tbCall || null;
          console.error(`[TB]${call ? ` ${call}:` : ""}`, msg);
          const c = call ? { call } : {};
          if (isPlanMsg(msg)) {
            if (call === "createtorrent") {
              pauseCreate(key, "plán TorBoxu nedovoluje přidávání přes API", true);
              return { ...limited(PLAN_CREATE), plan: true, ...c };
            }
            return { ...limited(planApi(call)), plan: true, ...c };
          }
          if (e.response?.status === 429 || isLimitMsg(msg)) {
            pauseCreate(key, `limit TorBoxu (${msg})`);
            return { ...limited(`TorBox: ${msg}`), ...c };
          }
          if (isQueuedMsg(msg)) return { ...queued(`TorBox: ${msg}`), ...c };
          return { ...fail(`TorBox: ${msg}`), ...c };
        }
      });
    }
    function tbFiles(t) {
      return (t.files || []).map((f) => ({ id: f.id, name: f.name || f.short_name || "", short: f.short_name || basename(f.name), size: f.size || 0, mime: f.mimetype || "" }));
    }
    async function resolve(key, hash, sel = {}) {
      const lk = `${keyId(key)}:${hash}:${selKey(sel)}`;
      const c = linkCache.get(lk);
      if (c) {
        console.log("[TB] 💾 Link z cache");
        return { status: "ready", url: c.url, file: c.file, fromCache: true };
      }
      return once(`tbres:${lk}`, async () => {
        const t = await getTorrent(key, hash);
        if (t.status !== "ready") return t;
        const files = tbFiles(t.torrent);
        if (!files.some((f) => isVideo(f.name))) {
          if (files.some((f) => /\.zip$/i.test(f.name) || /zip/i.test(f.mime))) return fail("TorBox má torrent jen jako ZIP");
          return fail("Torrent neobsahuje video");
        }
        const file = pickBySel(files, sel);
        if (!file) return { ...fail("Hledaný díl/film v torrentu nenalezen"), videos: files.filter((f) => isVideo(f.name)).map((f) => ({ n: f.name, s: f.size })) };
        try {
          const url = await tbRequestDl(key, t.torrent.id, file.id);
          linkCache.set(lk, { url, file: file.name });
          console.log(`[TB] ✅ ${file.short}`);
          return { status: "ready", url, file: file.name };
        } catch (e) {
          return fail(`TorBox requestdl: ${errMsg(e)}`);
        }
      });
    }
    async function listFiles(key, hash, { cached } = {}) {
      const t = await getTorrent(key, hash, { allowCreate: !!cached });
      if (t.status !== "ready") return t;
      const vids = tbFiles(t.torrent).filter((f) => isVideo(f.name)).map((f) => ({ id: f.id, name: f.short, size: f.size }));
      vids.sort((a, b) => a.name.localeCompare(b.name, void 0, { numeric: true }));
      if (!vids.length) return fail("Bez video souborů (ZIP?)");
      return { status: "ready", files: vids };
    }
    function _reset() {
      createPausedUntil.clear();
      listCache.map.clear();
      queueCache.map.clear();
      linkCache.map.clear();
    }
    module2.exports = { tbVerify: tbVerify2, checkCached, resolve, listFiles, accountStatus, _reset };
  }
});

// ../sktorrent-realdebrid-docker/lib/debrid.js
var require_debrid = __commonJS({
  "../sktorrent-realdebrid-docker/lib/debrid.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var rd = require_rd();
    var tb = require_tb();
    var PROVIDERS = {
      rd: { id: "rd", short: "RD", label: "Real-Debrid", key: (cfg) => cfg.rdToken, resolve: rd.resolve, listFiles: (k, h) => rd.listFiles(k, h), accountStatus: rd.accountStatus },
      tb: { id: "tb", short: "TB", label: "TorBox", key: (cfg) => cfg.tbKey, resolve: tb.resolve, listFiles: (k, h, o) => tb.listFiles(k, h, o), accountStatus: tb.accountStatus }
    };
    function activeProviders2(cfg) {
      return Object.values(PROVIDERS).filter((p) => p.key(cfg));
    }
    module2.exports = { PROVIDERS, activeProviders: activeProviders2, checkCachedTB: tb.checkCached, rdVerify: rd.rdVerify, tbVerify: tb.tbVerify };
  }
});

// sktorrent/src/archive.js
var require_archive = __commonJS({
  "sktorrent/src/archive.js"(exports2, module2) {
    "use strict";
    init_timers();
    init_node_globals();
    var state = { on: false, url: "", version: "" };
    function write(rec) {
      if (!state.on || !state.url) return;
      const record = { v: state.version, ...rec };
      fetch(state.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record }) }).catch(() => {
      });
    }
    var configure = ({ on, url, version }) => {
      state.on = !!on;
      state.url = url || "";
      state.version = version || "";
    };
    module2.exports = { write, configure, registerRoutes() {
    }, status: () => state.on ? "zapnutý" : "vypnutý", listFiles: () => [], adminOk: () => false, ARCHIVE_DIR: "" };
  }
});

// ../sktorrent-realdebrid-docker/lib/handlers.js
var require_handlers = __commonJS({
  "../sktorrent-realdebrid-docker/lib/handlers.js"(exports2, module2) {
    init_timers();
    init_node_globals();
    var { getTitle } = require_meta();
    var { parseCsfdId, getCsfdTitle, getCsfdForImdb } = require_csfd();
    var { searchSKT, getCachedTorrent } = require_skt();
    var { findTorrents } = require_search();
    var { PROVIDERS, activeProviders: activeProviders2, checkCachedTB } = require_debrid();
    var archive2 = require_archive();
    var { isHash, flagsFromName, cleanTorrentName, formatBytes, removeDiacritics, keyId } = require_util();
    var { isMoviePack, selKey, makeForeignTitleCheck, makeYearMatch } = require_matching();
    var { orderPicked, isDead, accountNote } = require_streams();
    var { createCache } = require_cache();
    var withTimeout = (promise, ms) => Promise.race([promise, new Promise((r) => _setTimeout(() => r(null), ms).unref?.())]);
    var defer = typeof _setImmediate === "function" ? _setImmediate : (fn) => _setTimeout(fn, 0);
    var MAX_EP_TORRENTS = 12;
    var MAX_ALL_TORRENTS = 15;
    async function catalogFor(query, cfg, link2) {
      const { sktUid, sktPass } = cfg;
      query = String(query || "").trim();
      if (!query) return { metas: [] };
      console.log(`
🔍 Catalog search: "${query}"`);
      const results = await searchSKT(query, sktUid, sktPass);
      const metas = results.map((t) => {
        const flags = flagsFromName(t.name);
        return {
          id: `skt${t.hash}`,
          type: "movie",
          name: cleanTorrentName(t),
          poster: t.poster || void 0,
          posterShape: "regular",
          background: t.poster || link2.fileUrl("logo.png"),
          description: `📁 ${t.cat || "SKT"}  📀 ${t.size}  👤 ${t.seeds}${flags ? " " + flags : ""}`
        };
      });
      console.log(`🔍 Catalog: ${metas.length} výsledků`);
      archive2.write({
        kind: "catalog",
        q: query,
        count: results.length,
        torrents: results.map((t) => ({ n: t.name, cat: t.cat, s: t.size, seeds: t.seeds, h: t.hash }))
      });
      return { metas };
    }
    function metaFor(id) {
      const hash = id.replace(/^skt/, "").toLowerCase();
      if (!id.startsWith("skt") || !isHash(hash)) return { meta: null };
      const t = getCachedTorrent(hash);
      if (!t) return { meta: { id, type: "movie", name: hash, description: "Torrent z SKTorrent" } };
      const flags = flagsFromName(t.name);
      return { meta: {
        id,
        type: "movie",
        name: cleanTorrentName(t),
        poster: t.poster || void 0,
        posterShape: "regular",
        background: t.poster || void 0,
        logo: t.poster || void 0,
        description: `📁 Kategorie: ${t.cat || "SKT"}
📀 Velikost: ${t.size}
👤 Seeds: ${t.seeds}${flags ? " " + flags : ""}

${t.name}`
      } };
    }
    async function tbCachedSet(cfg, hashes) {
      if (!cfg.tbKey || !hashes.length) return null;
      return await checkCachedTB(cfg.tbKey, hashes);
    }
    function providerLine(p, cached) {
      if (p.id === "tb") return cached === true ? "⚡ TorBox" : cached === false ? "⏳ TorBox" : "TorBox";
      return "Real-Debrid";
    }
    function streamName(p, cat, cached) {
      return `SKT+${p.short}${p.id === "tb" && cached === true ? " ⚡" : ""}
${cat}`;
    }
    async function sktDirectStreams(link2, cfg, hash) {
      const t = getCachedTorrent(hash);
      const cat = t?.cat || "SKT";
      const thumb = t?.poster || void 0;
      const provs = activeProviders2(cfg);
      const cachedSet = await tbCachedSet(cfg, [hash]);
      const perProv = await Promise.all(provs.map(async (p) => {
        const cached = p.id === "tb" ? cachedSet ? cachedSet.has(hash) : null : void 0;
        let r;
        try {
          r = await p.listFiles(p.key(cfg), hash, { cached: cached === true });
        } catch (e) {
          r = { status: "error", reason: e.message };
        }
        const out = [];
        if (r.status === "ready") {
          r.files.forEach((f, i) => out.push({
            name: r.files.length > 1 ? `SKT+${p.short}
📁 ${i + 1}/${r.files.length}` : streamName(p, cat, cached),
            description: `${f.name}
📀 ${formatBytes(f.size)}
${providerLine(p, cached)}`,
            ...link2.play(p.id, hash, { fileId: f.id }),
            behaviorHints: { notWebReady: true, bingeGroup: `skt-${p.id}-${hash.slice(0, 8)}` },
            thumbnail: thumb
          }));
        } else if (r.status === "downloading" || r.status === "notadded" || r.status === "queued" || r.status === "limit") {
          const txt = r.status === "notadded" ? "⏳ Není v cache — po kliknutí se začne stahovat" : r.status === "queued" ? "⏳ Ve frontě TorBoxu (plné sloty stahování)\nZkuste za chvíli znovu." : r.status === "limit" ? `⏸️ ${r.reason}
Zkuste za chvíli znovu.` : `🕐 Torrent se stahuje${r.progress ? ` (${r.progress} %)` : ""}…
Zkuste za chvíli znovu.`;
          out.push({ name: streamName(p, cat, cached), description: `${txt}
${providerLine(p, cached)}`, ...link2.play(p.id, hash, {}), behaviorHints: { notWebReady: true }, thumbnail: thumb });
        } else {
          console.log(`[SKT ${p.short}] ❌ ${r.reason}`);
        }
        return out;
      }));
      return perProv.flat();
    }
    async function streamsFor(type, id, cfg, link2) {
      const provs = activeProviders2(cfg);
      if (!provs.length) return { streams: [] };
      try {
        if (id.startsWith("skt")) {
          const hash = id.slice(3).toLowerCase();
          if (!isHash(hash)) return { streams: [] };
          console.log(`
🎬 SKT stream: ${hash}`);
          return { streams: await sktDirectStreams(link2, cfg, hash) };
        }
        let imdbId, season, episode, csfd = null;
        if (id.startsWith("csfd:")) {
          csfd = parseCsfdId(id);
          if (!csfd) return { streams: [] };
          imdbId = `csfd:${csfd.csfdId}`;
          season = csfd.season;
          episode = csfd.episode;
        } else {
          const [iid, sRaw, eRaw] = id.split(":");
          if (!/^tt\d+$/.test(iid)) return { streams: [] };
          imdbId = iid;
          season = sRaw !== void 0 ? parseInt(sRaw) : void 0;
          episode = eRaw !== void 0 ? parseInt(eRaw) : void 0;
        }
        const isSeries = type === "series" && Number.isInteger(season) && Number.isInteger(episode);
        console.log(`
🎬 ${type} ${imdbId} S${season ?? "-"}E${episode ?? "-"}`);
        let titles;
        if (csfd) titles = await getCsfdTitle(type, csfd.csfdId);
        else {
          const [tm, cs] = await Promise.all([getTitle(imdbId, cfg.tmdbKey, type), getCsfdForImdb(imdbId, type)]);
          titles = tm && cs ? { ...tm, csfdId: cs.csfdId, csfdTitle: cs.title } : tm;
        }
        if (!titles) {
          archive2.write({ kind: "stream", type, id, note: csfd ? "bez názvu z csfd-ratings" : "bez názvu z TMDB/OMDb" });
          return { streams: [] };
        }
        const found = await findTorrents({
          type,
          season: isSeries ? season : void 0,
          episode: isSeries ? episode : void 0,
          titles,
          sktUid: cfg.sktUid,
          sktPass: cfg.sktPass
        });
        const { torrents, batchTorrents, epTag } = found;
        const archiveStream = (sentMap, cachedSet2) => archive2.write({
          kind: "stream",
          type,
          id,
          year: titles.year || null,
          ...found.seasonYear ? { seasonYear: found.seasonYear } : {},
          ...found.seasonAfter ? { seasonAfter: found.seasonAfter } : {},
          titles: {
            en: titles.en || titles.title || "",
            cz: titles.cz || "",
            sk: titles.sk || "",
            ...titles.alt?.length ? { alt: titles.alt } : {},
            ...titles.csfdTitle ? { csfdTitle: titles.csfdTitle } : {},
            ...!csfd && titles.csfdId ? { csfdId: titles.csfdId } : {}
          },
          names: found.names,
          queries: found.audit.queries,
          ms: found.ms,
          ...found.sktDown ? { sktDown: true } : {},
          ...found.queuedMs ? { queuedMs: found.queuedMs } : {},
          ...found.details ? { details: found.details } : {},
          providers: provs.map((p) => p.id),
          logged: !!(cfg.sktUid && cfg.sktPass),
          streams: sentMap ? sentMap.size : 0,
          torrents: found.audit.torrents.map(({ t, ok, reason }) => {
            const rec = { n: t.name, cat: t.cat, s: t.size, seeds: t.seeds, h: t.hash, ok, r: reason };
            if (found.csfdOf?.has(t.hash)) rec.csfd = found.csfdOf.get(t.hash);
            if (sentMap?.has(t.hash)) rec.sent = sentMap.get(t.hash);
            if (!isSeries && ok && isMoviePack(t.name)) rec.pack = true;
            if (cachedSet2) rec.tb = cachedSet2.has(t.hash);
            return rec;
          })
        });
        if (!torrents.length && !batchTorrents.length) {
          archiveStream(null, null);
          if (found.sktDown) return { streams: [{
            name: "SKTorrent\n⚠️ nedostupný",
            description: "⚠️ SKTorrent teď neodpovídá — výsledky nejde načíst.\nZkuste to znovu za chvíli.",
            ...link2.file("skt-nedostupne.mp4"),
            behaviorHints: { notWebReady: true, bingeGroup: "skt-nedostupne" }
          }], cacheMaxAge: 0 };
          return { streams: [] };
        }
        let picked = [
          ...torrents.slice(0, MAX_EP_TORRENTS).map((t) => ({ t, isBatch: false })),
          ...batchTorrents.map((t) => ({ t, isBatch: true }))
        ].slice(0, MAX_ALL_TORRENTS);
        const hashes = picked.map((x) => x.t.hash);
        const [cachedSet, accounts] = await Promise.all([
          tbCachedSet(cfg, hashes),
          Promise.all(provs.map((p) => withTimeout(p.accountStatus(p.key(cfg), hashes), 2500).catch(() => null)))
        ]);
        const ourNames = [titles.en, titles.title, titles.original, titles.cz, titles.sk, ...titles.all || [], ...titles.alt || []];
        picked = orderPicked(picked, cachedSet, isSeries ? { uncertain: makeForeignTitleCheck(ourNames), yearOk: makeYearMatch(found.seasonYear || titles.year) } : {});
        const movieYear = String(titles.year || "").slice(0, 4).replace(/\D/g, "");
        const slug = removeDiacritics(titles.en || titles.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "x";
        const streams = [];
        for (const { t, isBatch } of picked) {
          const flags = flagsFromName(t.name);
          const cat = t.cat || "SKT";
          const isPack = !isSeries && isMoviePack(t.name);
          const sel = isSeries ? { season, episode } : isPack ? { pack: true, year: movieYear, title: slug } : {};
          const label = `${cleanTorrentName(t)}${isBatch ? ` 📦 ${epTag} z balíku` : ""}${isPack ? " 📦 kolekce" : ""}`;
          for (const [pi, p] of provs.entries()) {
            const cached = p.id === "tb" ? cachedSet ? cachedSet.has(t.hash) : null : void 0;
            const note = accountNote(accounts[pi]?.get(t.hash), p.label);
            const dead = !note && isDead(t, cached) ? "\n⚠️ 0 seedů a není v cache — stažení je nepravděpodobné" : "";
            streams.push({
              name: streamName(p, cat, cached),
              description: `${label}
👤 ${t.seeds}  📀 ${t.size}${flags ? "  " + flags : ""}
${providerLine(p, cached)}${note ? "\n" + note : ""}${dead}`,
              ...link2.play(p.id, t.hash, sel),
              behaviorHints: { bingeGroup: `skt-${p.id}-${t.hash.slice(0, 8)}`, notWebReady: true }
            });
          }
        }
        console.log(`✅ ${streams.length} streamů (${picked.length} torrentů × ${provs.length} služby)`);
        archiveStream(new Map(picked.map((x, i) => [x.t.hash, i + 1])), cachedSet);
        if (isSeries) prefetchNext(imdbId, type, season, episode, titles, cfg);
        return { streams };
      } catch (e) {
        console.error("[STREAM] Error:", e.message);
        return { streams: [] };
      }
    }
    var prefetched = createCache({ ttl: 6 * 3600 * 1e3, max: 5e3 });
    function prefetchNext(imdbId, type, season, episode, titles, cfg) {
      const key = `${cfg.sktUid || "anon"}|${imdbId}:${season}:${episode + 1}`;
      if (prefetched.get(key)) return;
      prefetched.set(key, true);
      defer(() => {
        console.log(`🔮 Předhledání ${imdbId} S${season}E${episode + 1}`);
        findTorrents({ type, season, episode: episode + 1, titles, sktUid: cfg.sktUid, sktPass: cfg.sktPass, background: true }).then((r) => {
          if (!r) {
            prefetched.delete(key);
            console.log(`🔮 Předhledání ${imdbId} S${season}E${episode + 1} vynecháno (moc souběžných hledání)`);
          }
        }).catch((e) => console.error("[Předhledání]", e.message));
      });
    }
    var playMemo = createCache({ ttl: 90 * 1e3, max: 5e3 });
    var PLAY_MEMO = /* @__PURE__ */ new Set(["error", "queued", "limit"]);
    var PLAY_MEMO_DOWNLOADING_MS = 25 * 1e3;
    async function playFor(cfg, provId, hash, sel, { archiveIt = true } = {}) {
      const p = PROVIDERS[provId];
      const key = p?.key(cfg);
      if (!key) return { error: `Chybí klíč pro ${p?.label || provId}`, status: 400 };
      hash = hash.toLowerCase();
      const what = sel.fileId !== void 0 ? `file ${sel.fileId}` : sel.pack ? `kolekce → ${sel.title} (${sel.year || "?"})` : `S${sel.season ?? "-"}E${sel.episode ?? "-"}`;
      console.log(`
▶️ Play ${p.short}: ${hash} ${what}`);
      const mk = `${p.id}:${keyId(key)}:${hash}:${selKey(sel)}`;
      let r = playMemo.get(mk);
      if (r) {
        r = { ...r, fromCache: true, memo: true };
        console.log(`[Play] 💾 ${r.status} z paměti (${r.reason || ""})`);
      } else {
        try {
          r = await p.resolve(key, hash, sel);
        } catch (e) {
          r = { status: "error", reason: e.message };
        }
        if (PLAY_MEMO.has(r.status)) playMemo.set(mk, { status: r.status, reason: r.reason, videos: r.videos, ...r.plan ? { plan: true } : {} });
        else if (r.status === "downloading") playMemo.set(mk, { status: r.status, progress: r.progress, state: r.state }, PLAY_MEMO_DOWNLOADING_MS);
      }
      if (archiveIt && !r.fromCache) {
        const t = getCachedTorrent(hash);
        const rec = { kind: "play", prov: p.id, h: hash, n: t?.name || null, sel, status: r.status };
        if (r.file) rec.file = r.file;
        if (r.reason) rec.r = r.reason;
        if (r.call) rec.call = r.call;
        if (r.plan) rec.plan = true;
        if (r.status === "downloading") {
          rec.progress = r.progress || 0;
          if (r.state) rec.state = r.state;
          if (r.since) rec.since = r.since;
        }
        if (r.videos) rec.videos = r.videos;
        archive2.write(rec);
      }
      if (r.status === "ready") return { url: r.url };
      if (r.status === "downloading" || r.status === "notadded") {
        if (!r.memo) console.log(`[Play] 🕐 Stahuje se → info video`);
        return { file: "downloading.mp4" };
      }
      if (r.status === "queued" || r.status === "limit") {
        if (!r.memo) console.log(`[Play] ⏳ ${r.reason} → info video`);
        return { file: r.plan ? "torbox-plan.mp4" : "fronta.mp4" };
      }
      if (!r.memo) console.log(`[Play] ❌ ${r.reason}`);
      return { error: `Chyba: ${r.reason}`, status: 502 };
    }
    module2.exports = { catalogFor, metaFor, streamsFor, playFor, sktDirectStreams, MAX_EP_TORRENTS, MAX_ALL_TORRENTS };
  }
});

// sktorrent/src/plugin.js
init_timers();
init_node_globals();
var H = require_handlers();
var { activeProviders, rdVerify, tbVerify } = require_debrid();
var { sktLogin } = require_skt();
var archive = require_archive();
var { sha256hex } = require_hash();
var VERSION = "1.0.1";
var ADDON_VERSION = true ? "3.10.1" : "dev";
var ARCHIVE_URL = true ? "" : "";
var PUBLIC = "https://raw.githubusercontent.com/david325345/sktorrent-realdebrid-docker/main/public/";
function onSettings() {
  const form = [
    {
      type: "info",
      label: `SKTorrent ${VERSION}`,
      description: "CZ/SK filmy a seriály ze sktorrent.eu, přehrávání přes Real-Debrid a/nebo TorBox. Hledání a parser jsou stejné jako v addonu SKTorrent. Zadej aspoň jeden klíč."
    },
    { type: "text", key: "rd_token", label: "Real-Debrid API token", isPassword: true, placeholder: "real-debrid.com/apitoken" },
    { type: "text", key: "tb_key", label: "TorBox API klíč", isPassword: true, placeholder: "torbox.app → Settings → API" },
    { type: "text", key: "skt_user", label: "SKTorrent – uživatelské jméno", placeholder: "nepovinné – s účtem je vidět víc" },
    { type: "text", key: "skt_pass", label: "SKTorrent – heslo", isPassword: true },
    { type: "toggle", key: "skt_search", label: "Katalog „SKTorrent“ ve vyhledávání", defaultValue: true },
    { type: "text", key: "tmdb_key", label: "Vlastní TMDB API klíč", placeholder: "nepovinné – jinak se použije klíč z Nuvia" }
  ];
  if (ARCHIVE_URL) {
    form.push(
      { type: "toggle", key: "archive", label: "Pomoct vylepšit hledání (anonymně)", defaultValue: false },
      {
        type: "info",
        label: "Co se při zapnutí odesílá",
        description: "Po každém hledání se na server addonu SKTorrent pošle anonymní záznam: co se hledalo (titul, ID, díl) a názvy nalezených torrentů s tím, jestli prošly. Bez klíčů, přihlášení a jakýchkoli údajů o tobě. Z těchto záznamů se opravuje parser, takže to pomůže vylepšit hledání pro všechny."
      }
    );
  }
  return form;
}
function readSettings(raw) {
  const s = raw || typeof SCRAPER_SETTINGS === "object" && SCRAPER_SETTINGS || {};
  const text = (k) => s[k] == null ? "" : String(s[k]).trim();
  const bool = (k, def) => typeof s[k] === "boolean" ? s[k] : s[k] === "true" ? true : s[k] === "false" ? false : def;
  const nuvioTmdb = typeof TMDB_API_KEY === "string" ? TMDB_API_KEY.trim() : "";
  return {
    rdToken: text("rd_token"),
    tbKey: text("tb_key"),
    sktUser: text("skt_user"),
    sktPassword: s.skt_pass == null ? "" : String(s.skt_pass),
    sktSearch: bool("skt_search", true),
    tmdbKey: text("tmdb_key") || nuvioTmdb,
    archive: bool("archive", false)
  };
}
var LOGIN_KEY = "skt-login";
var loginMem = null;
var loginId = (s) => sha256hex(`${s.sktUser}
${s.sktPassword}`).slice(0, 16);
function storedLogin(s) {
  if (loginMem && loginMem.id === loginId(s)) return loginMem;
  try {
    const v = JSON.parse(localStorage.getItem(LOGIN_KEY) || "null");
    if (v && v.id === loginId(s) && v.exp > Date.now()) return loginMem = v;
  } catch (e) {
  }
  return null;
}
async function sktCookies(s, fresh = false) {
  if (!s.sktUser || !s.sktPassword) return { uid: "", pass: "" };
  const have = !fresh && storedLogin(s);
  if (have) return have;
  let r = null;
  try {
    r = await sktLogin(s.sktUser, s.sktPassword);
  } catch (e) {
    console.warn(`SKT přihlášení selhalo: ${e.message}`);
  }
  if (!r) return { uid: "", pass: "" };
  loginMem = { id: loginId(s), uid: r.uid, pass: r.pass, exp: Date.now() + 30 * 24 * 3600 * 1e3 };
  try {
    localStorage.setItem(LOGIN_KEY, JSON.stringify(loginMem));
  } catch (e) {
  }
  return loginMem;
}
async function toCfg(s) {
  const c = await sktCookies(s);
  archive.configure({ on: s.archive, url: ARCHIVE_URL, version: `${ADDON_VERSION}+nuvio-${VERSION}` });
  return { rdToken: s.rdToken, tmdbKey: s.tmdbKey, sktUid: c.uid, sktPass: c.pass, sktSearch: s.sktSearch, tbKey: s.tbKey };
}
function link() {
  const n = Date.now().toString(36);
  return {
    play: (prov, hash, sel) => ({ resolve: { p: prov, h: hash, s: sel || {}, n } }),
    file: (name) => ({ url: PUBLIC + name }),
    fileUrl: (name) => PUBLIC + name
  };
}
function addonId(type, season, episode, ctx) {
  const vid = String(ctx && ctx.videoId || "");
  if (/^skt[a-f0-9]{40}$/i.test(vid) || /^csfd:\d+/.test(vid)) return vid;
  const imdb = ctx && ctx.imdbId || (/^tt\d+/.test(vid) ? vid.split(":")[0] : null);
  if (!imdb) return null;
  if (type === "series") {
    const s = season != null ? season : ctx && ctx.season, e = episode != null ? episode : ctx && ctx.episode;
    return s && e ? `${imdb}:${s}:${e}` : null;
  }
  return imdb;
}
async function getStreams(tmdbId, mediaType, season, episode, ctx) {
  const s = readSettings();
  if (!s.rdToken && !s.tbKey) return [];
  const type = mediaType === "movie" ? "movie" : "series";
  const id = addonId(type, season, episode, ctx);
  if (!id) return [];
  const cfg = await toCfg(s);
  const r = await H.streamsFor(type, id, cfg, link());
  return r.streams || [];
}
async function resolveStream(payload) {
  const s = readSettings();
  const cfg = await toCfg(s);
  if (!payload || !payload.p || !payload.h) throw new Error("Neznámý stream.");
  const r = await H.playFor(cfg, payload.p, payload.h, payload.s || {}, { archiveIt: true });
  if (r.url) return r.url;
  if (r.file) return PUBLIC + r.file;
  throw new Error(r.error || "Přehrání se nepodařilo.");
}
async function getCatalog(type, id, extra) {
  const s = readSettings();
  if (id !== "skt-search" || !s.sktSearch) return { metas: [] };
  const cfg = await toCfg(s);
  return H.catalogFor(extra && extra.search || "", cfg, link());
}
async function getMeta(type, id) {
  return H.metaFor(id);
}
var TB_PLANS = { 0: "Free", 1: "Essential", 2: "Pro", 3: "Standard" };
async function onVerify(raw) {
  const s = readSettings(raw);
  const parts = [];
  let ok = true;
  if (!s.rdToken && !s.tbKey) {
    ok = false;
    parts.push("Zadej Real-Debrid token nebo TorBox klíč.");
  }
  const [u, t] = await Promise.all([s.rdToken ? rdVerify(s.rdToken) : null, s.tbKey ? tbVerify(s.tbKey) : null]);
  if (s.rdToken) {
    if (u) parts.push(`Real-Debrid: ${u.username}, ${u.type}${u.expiration ? ` do ${new Date(u.expiration).toLocaleDateString("cs-CZ")}` : ""}.`);
    else {
      ok = false;
      parts.push("Real-Debrid: neplatný token.");
    }
  }
  if (s.tbKey) {
    if (t) parts.push(`TorBox: ${TB_PLANS[t.plan] ?? `plán ${t.plan}`}${t.premium_expires_at ? ` do ${new Date(t.premium_expires_at).toLocaleDateString("cs-CZ")}` : ""}.`);
    else {
      ok = false;
      parts.push("TorBox: neplatný klíč.");
    }
  }
  if (s.sktUser || s.sktPassword) {
    const c = await sktCookies(s, true);
    if (c.uid) parts.push("SKTorrent: přihlášení v pořádku.");
    else {
      ok = false;
      parts.push("SKTorrent: přihlášení se nepovedlo (jméno, heslo, nebo SKT neodpovídá).");
    }
  } else parts.push("SKTorrent: bez účtu.");
  return { ok, message: parts.join(" ") };
}
module.exports = { getStreams, resolveStream, getCatalog, getMeta, onSettings, onVerify, _test: { addonId, readSettings, activeProviders } };
