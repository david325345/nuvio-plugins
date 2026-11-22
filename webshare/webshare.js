// Webshare 1.0.2 – plugin pro Nuvio na Apple TV. SESTAVENO, needitovat ručně.
// Zdroj: github.com/david325345/nuvio-plugins/tree/main/webshare/src + jádro addonu github.com/david325345/webshare-stremio-docker 8.12.0 (5ff1887, parser d68353723c61).
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// shared/timers.js
function _setTimeout(fn, ms, ...args) {
  return wrap(st(fn, ms, ...args));
}
function _clearTimeout(t) {
  ct(unwrap(t));
}
function _setInterval(fn, ms, ...args) {
  return wrap(si(fn, ms, ...args));
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

// webshare/src/needle.js
var require_needle = __commonJS({
  "webshare/src/needle.js"(exports2, module2) {
    "use strict";
    init_timers();
    var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    function decode(text) {
      return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
        if (e[0] === "#") {
          const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          return Number.isFinite(code) ? String.fromCodePoint(code) : m;
        }
        return ENTITIES[e.toLowerCase()] !== void 0 ? ENTITIES[e.toLowerCase()] : m;
      });
    }
    function parseXml(xml) {
      const root = { name: "#root", value: "", attributes: {}, children: [] };
      const stack = [root];
      const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/\s*([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
      let m;
      while (m = re.exec(xml)) {
        const top = stack[stack.length - 1];
        if (m[1] !== void 0) top.value += m[1];
        else if (m[2] !== void 0) {
          if (stack.length > 1) stack.pop();
        } else if (m[3] !== void 0) {
          const attributes = {};
          const attrRe = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
          let a;
          while (a = attrRe.exec(m[4] || "")) attributes[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? "");
          const el = { name: m[3], value: "", attributes, children: [] };
          top.children.push(el);
          if (!m[5]) stack.push(el);
        } else if (m[6] !== void 0) top.value += decode(m[6]);
      }
      const trim = (el) => {
        if (el.children.length) el.value = el.value.trim() ? el.value : "";
        el.children.forEach(trim);
      };
      trim(root);
      const first = root.children[0];
      return first || null;
    }
    function formEncode(obj) {
      return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    }
    async function needle(method, url, data, opts) {
      if (/^(get|head)$/i.test(method) && opts === void 0) {
        opts = data;
        data = void 0;
      }
      opts = opts || {};
      const headers = Object.assign({}, opts.headers);
      let body;
      if (data !== void 0 && data !== null) {
        if (typeof data === "string") body = data;
        else if (opts.json) {
          body = JSON.stringify(data);
          headers["Content-Type"] = headers["Content-Type"] || "application/json";
        } else {
          body = formEncode(data);
          headers["Content-Type"] = headers["Content-Type"] || "application/x-www-form-urlencoded";
        }
      }
      const timeout = opts.read_timeout || opts.response_timeout || opts.open_timeout || 15e3;
      const ctrl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctrl ? _setTimeout(() => ctrl.abort(), timeout) : null;
      let resp;
      try {
        resp = await fetch(url, { method: String(method).toUpperCase(), headers, body, signal: ctrl ? ctrl.signal : void 0 });
      } catch (e) {
        throw new Error(e && e.name === "AbortError" ? `timeout ${timeout} ms` : String(e && e.message || e));
      } finally {
        if (timer) _clearTimeout(timer);
      }
      if (!resp.status) throw new Error(resp.statusText || "síťová chyba");
      const text = await resp.text();
      const type = String(resp.headers && resp.headers.get && resp.headers.get("content-type") || "").toLowerCase();
      let parsed = text;
      if (opts.parse !== false && opts.parse_response !== false) {
        const t = text.trimStart();
        if (/json/.test(type) || opts.parse === true && (t[0] === "{" || t[0] === "[")) {
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = text;
          }
        } else if (/xml/.test(type) || t.startsWith("<?xml")) {
          parsed = parseXml(text) || text;
        }
      }
      const headersObj = {};
      if (resp.headers && resp.headers.forEach) resp.headers.forEach((v, k) => {
        headersObj[k] = v;
      });
      return { statusCode: resp.status, headers: headersObj, body: parsed, raw: text };
    }
    needle.parseXml = parseXml;
    module2.exports = needle;
  }
});

// ../webshare-stremio-docker/matcher.js
var require_matcher = __commonJS({
  "../webshare-stremio-docker/matcher.js"(exports2, module2) {
    init_timers();
    var STOPWORDS = /* @__PURE__ */ new Set(["the", "a", "an", "of", "and", "und", "le", "la", "les", "der", "die", "das"]);
    var FOLD = {
      "ł": "l",
      "Ł": "L",
      "ø": "o",
      "Ø": "O",
      "ß": "ss",
      "ẞ": "SS",
      "đ": "d",
      "Đ": "D",
      "ð": "d",
      "Ð": "D",
      "æ": "ae",
      "Æ": "AE",
      "œ": "oe",
      "Œ": "OE",
      "þ": "th",
      "Þ": "Th",
      "ı": "i",
      "ħ": "h",
      "Ħ": "H"
    };
    function fold(str) {
      return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[łŁøØßẞđĐðÐæÆœŒþÞıħĦ]/g, (c) => FOLD[c]);
    }
    function normalize(str) {
      return fold(str).toLowerCase().replace(/&/g, " and ").replace(/['’`´]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    }
    var ORDINALS = {
      prvni: "1",
      druha: "2",
      druhy: "2",
      druhe: "2",
      treti: "3",
      ctvrta: "4",
      ctvrty: "4",
      ii: "2",
      iii: "3",
      vs: "v",
      versus: "v",
      doktor: "dr",
      doctor: "dr"
    };
    function tokens(str) {
      const n = normalize(str);
      return n ? fiveO(n.split(" ").map((t) => ORDINALS[t] || t)) : [];
    }
    function fiveO(t) {
      for (let i = 0; i + 1 < t.length; i++) {
        if ((t[i] === "5" || t[i] === "five") && (t[i + 1] === "o" || t[i + 1] === "0")) {
          t[i] = "5";
          t[i + 1] = "0";
        }
      }
      return t;
    }
    function rawTokens(str) {
      const n = fold(str).replace(/&/g, " and ").replace(/['’`´]/g, "").replace(/[^A-Za-z0-9]+/g, " ").trim();
      return n ? n.split(" ") : [];
    }
    function stripLeadingGroups(fileName) {
      let s = String(fileName || "");
      const re = /^\s*\[([^\]]*)\]\s*[-_.]*\s*/;
      let m;
      while (m = s.match(re)) {
        const rest = s.slice(m[0].length);
        if (/[a-z]{2}/i.test(m[1]) && /^\[\s*\d{1,4}(?:v\d)?(?:\s*end)?\s*\]/i.test(rest)) return `${m[1].trim()} ${rest}`;
        s = rest;
      }
      return s;
    }
    function fileTokens(fileName) {
      return tokens(stripLeadingGroups(fileName));
    }
    function nameTokens(name) {
      const all = tokens(name);
      const sig = all.filter((t) => !STOPWORDS.has(t));
      return sig.length ? sig : all;
    }
    function queryText(str) {
      return fold(str).replace(/[:!?*\/\\"„“’‘´`]/g, " ").replace(/\s+/g, " ").trim();
    }
    function isLatin(str) {
      return /^[\x00-\x7FÀ-ɏḀ-ỿ\s'’–—-]+$/.test(String(str || ""));
    }
    function shortTitle(str) {
      const s = String(str || "");
      const m = s.split(/\s*[:]\s+|\s+[-–—]\s+/)[0].trim();
      return m && m.length >= 3 && m !== s ? m : null;
    }
    function titleMatches(fileName, name, others, year) {
      const ft = fileTokens(fileName);
      const nt = nameTokens(name);
      if (!nt.length || !ft.length) return false;
      const set = new Set(ft);
      if (!nt.every((t) => set.has(t))) return false;
      if (nt.length === 1) {
        const sig = ft.filter((t) => !STOPWORDS.has(t));
        const idx = sig.indexOf(nt[0]);
        if (idx === 0) return true;
        const next = sig[idx + 1];
        if (idx > 0 && PREFIX_BAD.has(sig[idx - 1])) return false;
        if (idx > 0 && sig.slice(0, idx).every((t) => PREFIX_OK.test(t)) && looksLikeEpisode(fileName)) return true;
        if (idx === 1 && year && sig[0] === String(year)) return true;
        return !!next && /^(19|20)\d{2}$/.test(next);
      }
      const hit = afterName(fileName, name);
      if (!hit) return false;
      if (hit.start === 0) return true;
      const prefix = ft.filter((t) => !STOPWORDS.has(t)).slice(0, hit.start);
      const words = prefix.filter((t) => !PREFIX_OK.test(t) && !ROMAN_ANY.test(t) && !PREFIX_NOISE.has(t));
      if (!words.length) return true;
      if (words.length === 1 && !PREFIX_BAD.has(words[0]) && !PREPOSITIONS.has(nt[0])) return true;
      const raw = stripLeadingGroups(fileName);
      const re = /\s+[-–—]+\s+|-{2,}|_-_|\s+\|\s+/g;
      let m;
      while (m = re.exec(raw)) {
        const h = afterName(raw.slice(m.index + m[0].length), name);
        if (h && h.start === 0) return true;
      }
      const pre = prefix.join(" ");
      return (others || []).some((o) => {
        if (!o || o === name) return false;
        const h = afterName(pre, o);
        return !!h && h.start === 0;
      });
    }
    var PREPOSITIONS = new Set("na v ve z ze za do po o u ke s se od pro pod nad pred".split(" "));
    var PREFIX_NOISE = /* @__PURE__ */ new Set(["novinka", "novinky", "fv", "mkv", "avi", "mp4"]);
    var PREFIX_OK = /^(\d{1,4}|s\d{1,2}(e\d{1,4})?|e\d{1,4}|ep\d{0,4}|\d{1,2}x\d{1,4})$/;
    var ROMAN_ANY = /^(i{1,3}|iv|v|vi{1,3}|ix|x)$/;
    var PREFIX_BAD = new Set("inside behind making becoming beyond lego untold secret secrets return revisiting remembering uncovering unmasking reliving decoding history story truth road after before ultimate complete official unofficial tribute parody honest pitch skutecna skutecny skutecne real true".split(" "));
    function fileYears(fileName, { noRanges = false } = {}) {
      const out = [];
      const re = /(?:^|[^0-9x])((?:19|20)\d{2})(?![0-9]|p\b|x\d)/gi;
      let m;
      let s = String(fileName).replace(/\[[0-9A-F]{8}\]/gi, " ");
      if (noRanges) s = s.replace(/(?<![0-9])[12]\d{3}\s*[-–]\s*[12]\d{3}(?![0-9])/g, " ");
      while (m = re.exec(s)) {
        const y = parseInt(m[1], 10);
        if (y >= 1920 && y <= 2035) out.push(y);
      }
      return out;
    }
    function stripTech(n) {
      return n.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\b\d{3,4}\s*[pi]\b/g, " ").replace(/\b(4k|8k|uhd|fhd|hd|sd)\b/g, " ").replace(/\b[xh]\s*26[45]\b/g, " ").replace(/\b(hevc|avc|av1|xvid|divx)\b/g, " ").replace(/\b\d{1,2}\s*bit\b/g, " ").replace(/\b[1-9]\s+[01]\b/g, " ").replace(/\b(ddp?|dts|ac3|eac3|aac|flac|mp3|opus|truehd|atmos)\s*\d?\b/g, " ").replace(/\b\d{3,4}\s*x\s*\d{3,4}\b/g, " ").replace(/\b[0-9a-f]{8}\b/g, " ").replace(/\s+/g, " ").trim();
    }
    var AIR_DATE = /\b(?:19|20)\d{2} (?:0[1-9]|1[0-2]) (?:0[1-9]|[12]\d|3[01])\b/g;
    function episodeRange(fileName) {
      const raw = String(fileName || "").toLowerCase();
      const res = [
        /s0*(\d{1,2})[ ._]?e0*(\d{1,4})[ ._]?[-+&]?[ ._]?e0*(\d{1,4})(?![\da-z]|\.\d)/,
        /s0*(\d{1,2})[ ._]?e0*(\d{1,4})[ ._]?[-+&][ ._]?0*(\d{1,4})(?![\da-z]|\.\d)/,
        /(?:^|[^\da-z])(\d{1,2})x0*(\d{1,4})[ ._]?[-+&][ ._]?(?:\d{1,2}x)?0*(\d{1,4})(?![\da-z]|\.\d)/
      ];
      for (const re of res) {
        const m = raw.match(re);
        if (!m) continue;
        const season = +m[1], from = +m[2], to = +m[3];
        if (to > from && to - from <= 4) return { season, from, to };
      }
      return null;
    }
    function parseEpisode(fileName, excludeTokens, restTokens) {
      const n0 = normalize(fileName);
      let n = n0.replace(AIR_DATE, " ");
      const hasDate = n !== n0;
      let season = null, episode = null, explicit = false;
      let m = n.match(/\bs\s?(\d{1,2})\s?e\s?(\d{1,4})\b/);
      if (m) return { season: +m[1], episode: +m[2], explicit: true };
      m = n.match(/s(\d{1,2})e(\d{1,4})(?![0-9])/);
      if (m) return { season: +m[1], episode: +m[2], explicit: true };
      m = String(fileName).match(/[\[(]\s*(\d{1,2})\.(\d{2,3})\s*[\])]/);
      if (m) return { season: +m[1], episode: +m[2], explicit: true };
      m = n.match(/\b(\d{1,2})x(\d{1,4})\b/);
      if (m) return { season: +m[1], episode: +m[2], explicit: true };
      m = n.match(/\b(\d{2})e(\d{2,3})\b/);
      if (m && +m[1] > 0) return { season: +m[1], episode: +m[2], explicit: true };
      if (hasDate) return { season: null, episode: null, explicit: false };
      m = n.match(/\b(\d{1,2})(?:st|nd|rd|th)\s?season\b/) || n.match(/\bseason\s?(\d{1,2})\b/) || n.match(/\b(\d{1,2})\s?season\b/) || n.match(/\bs(\d{1,2})\b/) || n.match(/\b(\d{1,2})\s(?:serie|series|rada|sezona|seria)\b/) || n.match(/\b(?:serie|rada|sezona|seria)\s(\d{1,2})\b/);
      if (m) season = +m[1];
      m = n.match(/\b(?:ep|episode|epizoda|e)\s?(\d{1,4})\b/) || n.match(/\b(\d{1,4})\s(?:dil|cast)\b/) || n.match(/\b(?:dil|cast)\s(\d{1,4})\b/);
      if (m && !/^(19|20)\d{2}$/.test(m[1])) return { season, episode: +m[1], explicit: false };
      if (Array.isArray(restTokens)) {
        const restNums = stripTech(restTokens.join(" ")).split(" ").filter((t) => /^\d{1,4}$/.test(t));
        if (season !== null) {
          const i = restNums.findIndex((t) => +t === season);
          if (i !== -1 && restNums.length > 1) restNums.splice(i, 1);
        }
        if (restNums.length) return { season, episode: +restNums[0], explicit: false };
        m = restTokens.join(" ").match(/\b(\d{1,4})v\d\b/);
        return { season, episode: m ? +m[1] : null, explicit: false };
      }
      const raw = fold(fileName).toLowerCase();
      const dash = raw.match(/\s[-–]\s(\d{1,4})(?:v\d)?(?=[\s\[\(._]|$)/);
      const excl = new Set((excludeTokens || []).map(String));
      if (dash && !excl.has(String(+dash[1])) && !excl.has(dash[1])) {
        return { season, episode: +dash[1], explicit: false };
      }
      const nums = stripTech(n).split(" ").filter((t) => /^\d{1,4}$/.test(t) && !excl.has(t) && !excl.has(String(+t)));
      if (season !== null) {
        const i = nums.findIndex((t) => +t === season);
        if (i !== -1) nums.splice(i, 1);
      }
      if (nums.length >= 1) return { season, episode: +nums[0], explicit: false };
      m = n.match(/\b(\d{1,4})v\d\b/);
      if (m && !excl.has(String(+m[1]))) return { season, episode: +m[1], explicit: false };
      return { season, episode, explicit };
    }
    function looksLikeEpisode(fileName, noParts) {
      const n = normalize(fileName);
      return /\bs\s?\d{1,3}\s?e\s?\d{1,4}\b/.test(n) || /s\d{1,3}e\d{1,4}/.test(n) || /\b\d{1,2}x\d{1,3}\b/.test(n) || /\b(?:ep|episode|epizoda)\s?\d{1,4}\b/.test(n) || /\be\d{2,3}\b/.test(n) || !noParts && (/\b\d{1,3}\s(?:dil|cast)\b/.test(n) || /\b(?:dil|cast)\s\d{1,3}\b/.test(n));
    }
    function detectLang(fileName) {
      const n = " " + normalize(fileName).replace(/(cz|sk|en)(tit|dab|sub)/g, "$1 $2") + " ";
      const has = (re) => re.test(n);
      const cz = has(/\s(cz|cze|czech|cesky|cestina|cs)\s/);
      const sk = has(/\s(sk|svk|slovak|slovensky|slovencina)\s/);
      const en = has(/\s(en|eng|english)\s/);
      const multi = has(/\s(multi|dual)\s/);
      const dub = has(/\s(dab|dabing|dabbing|dabovane|dabovany|dub|dubbed|rychlodabing)\s/);
      const sub = has(/\s(tit|titulky|titulkami|sub|subs|subtitles|forced)\s/);
      return { cz, sk, en, multi, dub, sub };
    }
    function langScore(l) {
      if (l.cz) return l.dub ? 50 : l.sub ? 30 : 40;
      if (l.sk) return l.dub ? 35 : l.sub ? 20 : 25;
      if (l.multi) return 5;
      return 0;
    }
    function detectQuality(fileName) {
      const n = " " + normalize(fileName) + " ";
      let resolution = null, score = 0;
      if (/\s(2160p|4k|uhd)\s/.test(n)) {
        resolution = "4K";
        score = 4;
      } else if (/\s1080[pi]\s/.test(n) || /\sfhd\s/.test(n)) {
        resolution = "1080p";
        score = 3;
      } else if (/\s720p\s/.test(n) || /\shd\s/.test(n)) {
        resolution = "720p";
        score = 2;
      } else if (/\s(576p|480p|360p|sd|dvdrip|xvid)\s/.test(n)) {
        resolution = "SD";
        score = 1;
      }
      const cam = /\s(cam|camrip|hdcam|ts|telesync|tc|hdts|hdtc|telecine|tsrip)\s/.test(n);
      if (cam) score = -1;
      const codec = /\s(hevc|x265|h265)\s/.test(n) ? "HEVC" : /\s(x264|h264|avc)\s/.test(n) ? "H.264" : /\sav1\s/.test(n) ? "AV1" : null;
      const audio = /\s(truehd|atmos)\s/.test(n) ? "TrueHD" : /\sdts\s/.test(n) ? "DTS" : /\s(eac3|ddp)\s/.test(n) ? "DD+" : /\s(ac3|dd)\s/.test(n) ? "AC3" : /\saac\s/.test(n) ? "AAC" : null;
      const hdr = /\s(hdr|hdr10|dv|dolby vision)\s/.test(n);
      const source = /\sremux\s/.test(n) ? "REMUX" : /\s(bluray|bdrip|brrip|bd)\s/.test(n) ? "BluRay" : /\s(web dl|webdl|webrip|web)\s/.test(n) ? "WEB" : /\s(dvdrip|dvd)\s/.test(n) ? "DVD" : /\shdtv\s/.test(n) ? "HDTV" : null;
      return { resolution, score, codec, audio, hdr, source, cam };
    }
    var TECH_WORDS = new Set("cz cze czech cesky sk svk slovak en eng english jap jpn japanese cc multi dual dab dabing dabbing dub dubbed tit titulky sub subs forced hd fhd uhd sd bluray bdrip brrip bd remux webrip web dl webdl hdtv dvdrip dvd rip xvid divx hevc avc aac ac3 dts ddp truehd atmos hdr dv extended edition directors cut uncut unrated remastered complete kompletni serie series season sezona rada episode ep epizoda dil cast part mp4 mkv avi vostfr tv ova movie film proper repack internal limited anime capitulo episodio folge odcinek bolum aflevering kvalita dobra pekna prodlouzena rozsirena mpg mpeg wmv ts mov flv m4v webm ddd yeff cam hdcam sbs 3d".split(" "));
    function afterName(fileName, name) {
      const all = fileTokens(fileName);
      const pos2all = [];
      all.forEach((t, i) => {
        if (!STOPWORDS.has(t)) pos2all.push(i);
      });
      const ft = pos2all.map((i) => all[i]);
      const nt = nameTokens(name);
      if (!nt.length) return null;
      const nAll = tokens(name);
      const gaps = [];
      if (nt.length < nAll.length && nAll.some((t) => !STOPWORDS.has(t))) {
        let j = -1, cur = [];
        for (const t of nAll) {
          if (STOPWORDS.has(t)) {
            cur.push(t);
            continue;
          }
          if (j >= 0) gaps[j + 1] = cur;
          j++;
          cur = [];
        }
      }
      const checkStops = nAll.some((t) => !STOPWORDS.has(t));
      const nStops = new Set(nAll.filter((t) => STOPWORDS.has(t)));
      for (let i = 0; i < ft.length; i++) {
        if (ft[i] !== nt[0]) continue;
        let pos = i, ok = true;
        for (let j = 1; j < nt.length; j++) {
          const k = ft.indexOf(nt[j], pos + 1);
          if (k === -1 || k - pos > 3) {
            ok = false;
            break;
          }
          if (checkStops) {
            const allowed = gaps[j] || [];
            const extra = all.slice(pos2all[pos] + 1, pos2all[k]).filter((t) => STOPWORDS.has(t));
            if (extra.some((t) => !allowed.includes(t) && nStops.has(t))) {
              ok = false;
              break;
            }
          }
          pos = k;
        }
        if (ok) return { start: i, rest: ft.slice(pos + 1), endAll: pos2all[pos] };
      }
      return null;
    }
    function subTitle(str) {
      const parts = String(str || "").split(/\s*:\s+|\s+[-–—]\s+/);
      if (parts.length < 2) return null;
      const sub = parts.slice(1).join(" ").trim();
      const nt = nameTokens(sub);
      if (nt.length < 2 || !nt.some((t) => t.length >= 4)) return null;
      if (/^(season|part|serie|series|rada|cast|the movie|movie|film)\b/i.test(normalize(sub))) return null;
      return sub;
    }
    var ROMAN = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
    function sequelSeason(rest) {
      const a = rest && rest[0], b = rest && rest[1];
      if (!a) return null;
      if (ROMAN[a]) return ROMAN[a];
      let m = a.match(/^s(\d)$/) || a.match(/^(\d)(?:st|nd|rd|th)$/) || a.match(/^[a-z]{2,}([2-9])$/);
      if (m) return +m[1];
      if (/^[2-9]$/.test(a) && b && /^\d{1,4}$/.test(b)) return +a;
      return null;
    }
    function shortNameIsNoise(fileName, shortName, fullName) {
      const hit = afterName(fileName, shortName);
      if (!hit || hit.start > 1) return true;
      const full = new Set(nameTokens(fullName));
      if (hit.start === 1) {
        const prev = fileTokens(fileName).filter((t) => !STOPWORDS.has(t))[0];
        if (!prevWordOk(prev, full, tokens(fullName || ""))) return true;
      }
      const next = hit.rest.find((t) => !(t.length < 2 && /^[a-z]$/.test(t)));
      if (!next) return false;
      if (!/^[a-z]+$/.test(next)) return false;
      if (full.has(next) || TECH_WORDS.has(next) || ROMAN[next]) return false;
      return true;
    }
    function prevWordOk(w, full, fullAll) {
      if (!w) return true;
      if (PREFIX_OK.test(w) || PREFIX_NOISE.has(w) || full.has(w) || ROMAN_ANY.test(w)) return true;
      if (TECH_WORDS.has(w) || DESC_WORDS.has(w) || /^\d{3,4}p$/.test(w)) return true;
      for (let i = 0; i < fullAll.length; i++) {
        let acc = "";
        for (let j = i; j < Math.min(fullAll.length, i + 6); j++) {
          acc += fullAll[j];
          if (j > i && acc === w) return true;
          if (acc.length >= w.length) break;
        }
      }
      return false;
    }
    var NON_VIDEO = /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|iso|img|r\d{2}|\d{3}|srt|ass|ssa|sub|idx|vtt|sup|smi|nfo|txt|doc|docx|pdf|jpg|jpeg|png|gif|webp|bmp|exe|apk|msi|torrent|mp3|flac|m4a|m4b|mka|aax|aac|ogg|opus|wav|wma)$/i;
    function isNonVideo(fileName) {
      return NON_VIDEO.test(String(fileName || "").trim());
    }
    var DESC_WORDS = new Set("akcni akcia akcny krimi drama thriller scifi sci fi fantasy horor horror komedie komedia rodinny animovany animak dobrodruzny valecny western dokument dokumentarni romanticky mysteriozni zivotopisny sportovni hudebni historicky psychologicky erotic novinky novinka novinkа kino kinorip kinoverze csfd imdb hodnoceni by from upload uploaded rip tvrip hdrip dvdscr screener dvbt dvb koukatelne verze verzia rezie usa uk cr sr".split(" "));
    function subtitleNoise(fileName, name, allow, mode) {
      const cleaned = stripLeadingGroups(fileName).replace(/[([{]/g, " qqstopqq ");
      const hit = afterName(cleaned, name);
      if (!hit) return false;
      const series = mode === "series";
      if (series && hit.start === 1 && nameTokens(name).length >= 2) {
        const first = fileTokens(cleaned).filter((t) => !STOPWORDS.has(t))[0];
        if (/^s\d{1,2}e\d{1,4}$/.test(first || "")) return false;
      }
      const rest6 = hit.rest.slice(0, 6);
      for (let i = 0; i < rest6.length; i++) {
        const t = rest6[i];
        if (t === "qqstopqq" || /^(19|20)\d{2}$/.test(t)) return false;
        if (t === "full" && /^(hd|fhd|uhd|bd|hdrip|\d{3,4}p)$/.test(rest6[i + 1] || "")) return false;
        if (TECH_WORDS.has(t) || DESC_WORDS.has(t) || /^\d{3,4}[pi]$/.test(t) || /^[xh]26[45]$/.test(t)) return false;
        if (/^(cz|cze|sk|en|eng)+(dab|dabing|tit|titulky|sub|subs|audio)?$/.test(t)) return false;
        if (/^s\d{1,2}(e\d{1,4})?$/.test(t) || /^e\d{1,4}$/.test(t) || /^\d{1,2}x\d{1,4}$/.test(t) || /^ep\d*$/.test(t)) return false;
        if (/^\d+$/.test(t)) {
          if (series) return false;
          continue;
        }
        if (t === "aka") continue;
        if (t === "vice" && (rest6[i + 1] === "qqstopqq" || /^(19|20)\d{2}$/.test(rest6[i + 1] || ""))) continue;
        if (t.length < 2 || series && t.length <= 2) continue;
        if (ROMAN[t] || allow && allow.has(t)) continue;
        if (!/^[a-z]+$/.test(t)) return false;
        return true;
      }
      return false;
    }
    var SPINOFF_ABBR = /* @__PURE__ */ new Set(["la", "ny", "nola", "svu", "ci", "dc", "miami", "cyber", "vegas"]);
    function spinoffAbbrev(fileName, name, allow) {
      const clean = stripLeadingGroups(fileName);
      const hit = afterName(clean, name);
      if (!hit) return false;
      const raw = rawTokens(clean);
      const t = raw[hit.endAll + 1];
      if (!t) return false;
      const l = t.toLowerCase();
      if (!SPINOFF_ABBR.has(l) || allow && allow.has(l)) return false;
      return l.length > 2 ? true : /^[A-Z]+$/.test(t);
    }
    var PART_ROMAN = { iv: 4, vi: 6, vii: 7, viii: 8, ix: 9 };
    var PART_WORDS = /* @__PURE__ */ new Set(["part", "cast", "dil", "chapter", "kapitola"]);
    var PART_WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    function partNumber(fileName, name) {
      const r = partNumberInfo(fileName, name);
      return r ? r.n : null;
    }
    function partNumberInfo(fileName, name) {
      const hit = afterName(fileName, name);
      if (!hit) return null;
      const raw = stripLeadingGroups(fileName);
      const num = (t, nxt) => {
        if (!t) return null;
        if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 20) {
          if (nxt && /^\d$/.test(nxt) && new RegExp(`(?:^|[^0-9])${t}[.,]${nxt}(?![0-9])`).test(raw)) return null;
          return +t;
        }
        return PART_ROMAN[t] || null;
      };
      let after = num(hit.rest[0], hit.rest[1]);
      if (after === null && PART_WORDS.has(hit.rest[0])) after = num(hit.rest[1], hit.rest[2]) || PART_WORD_NUM[hit.rest[1]] || null;
      if (after !== null) return { n: after, before: false };
      if (hit.start > 0) {
        const all = fileTokens(fileName).filter((t) => !STOPWORDS.has(t));
        const before = all[hit.start - 1];
        if (hit.start === 1 && /^\d{1,2}$/.test(before) && +before >= 1 && +before <= 20) return { n: +before, before: true };
      }
      return null;
    }
    function nameNumbers(name) {
      return tokens(name).map((t) => /^\d{1,2}$/.test(t) && +t >= 1 && +t <= 20 ? +t : PART_ROMAN[t] || null).filter((x) => x !== null);
    }
    function hasPartNumber(name) {
      return tokens(name).some((t) => /^\d{1,2}$/.test(t) || PART_ROMAN[t]);
    }
    function episodeTitleYears(fileName, nameWords) {
      const ft = normalize(stripLeadingGroups(fileName)).split(" ").filter(Boolean);
      const mk = ft.findIndex((t) => /^s\d{1,2}e\d{1,4}$/.test(t) || /^\d{1,2}x\d{1,4}$/.test(t));
      if (mk < 0) return [];
      const out = [];
      for (let i = mk + 2; i < ft.length; i++) {
        if (/^(19|20)\d{2}$/.test(ft[i]) && nameWords.has(ft[i - 1])) out.push(+ft[i]);
      }
      return out;
    }
    function levOne(a, b) {
      if (a === b) return true;
      if (Math.abs(a.length - b.length) > 1) return false;
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
      return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
    }
    function repairName(fileName, names, season, episode, { anime = false, alEpisode = null } = {}) {
      const raw = stripLeadingGroups(fileName);
      const ft = normalize(raw).split(" ").filter(Boolean);
      let mk = -1, mkLen = 1;
      for (let i = 0; i < ft.length && mk < 0; i++) {
        let m = ft[i].match(/^s(\d{1,2})e(\d{1,3})$/) || ft[i].match(/^(\d{1,2})x(\d{1,3})$/);
        let len = 1;
        if (!m && /^s\d{1,2}$/.test(ft[i]) && /^e\d{1,3}$/.test(ft[i + 1] || "")) {
          m = [null, ft[i].slice(1), ft[i + 1].slice(1)];
          len = 2;
        }
        if (m && +m[1] === season && +m[2] === episode) {
          mk = i;
          mkLen = len;
        }
      }
      if (mk < 0 && anime) return repairAbsolute(raw, names, [episode, alEpisode]);
      if (mk < 1 || mk > (anime ? 14 : 8)) return null;
      const head = ft.slice(0, mk);
      const years = [];
      while (head.length > 1 && /^(19|20)\d{2}$/.test(head[head.length - 1])) years.unshift(head.pop());
      const g = head[0].match(/^0*(\d{1,3})([a-z].*)$/);
      if (g && +g[1] === episode) head[0] = g[2];
      const compact = head.join("");
      const digits = (s) => s.replace(/[^0-9]/g, "");
      for (const name of names) {
        const nc = tokens(name).join("");
        if (nc.length < 4) continue;
        const same = compact === nc;
        const near = !same && nc.length >= 9 && compact.slice(0, 3) === nc.slice(0, 3) && digits(compact) === digits(nc) && levOne(compact, nc);
        const ck = (t) => t.replace(/c/g, "k").replace(/w/g, "v");
        const swap = !same && !near && nc.length >= 5 && compact.length === nc.length && compact !== nc && ck(compact) === ck(nc) && levOne(compact, nc);
        const lv = (t) => t.replace(/ou/g, "o").replace(/uu/g, "u").replace(/oo/g, "o");
        const romaji = !same && !near && !swap && anime && nc.length >= 15 && lv(compact) === lv(nc);
        if (!same && !near && !swap && !romaji) continue;
        const text = [name, ...years, ...ft.slice(mk)].join(" ");
        return { name, text, how: same ? "spojený" : romaji ? "přepis" : "překlep" };
      }
      return null;
    }
    function repairAbsolute(raw, names, eps) {
      const re = /\s[-–]\s*0*(\d{1,4})(?:v\d)?(?=[\s\[\(._]|$)/g;
      let m;
      while (m = re.exec(raw)) {
        const ep = +m[1];
        if (!eps.includes(ep)) continue;
        const compact = tokens(raw.slice(0, m.index)).join("");
        for (const name of names) {
          const nc = tokens(name).join("");
          if (nc.length < 15 || compact !== nc) continue;
          return { name, text: `${name} - ${m[1]}${raw.slice(m.index + m[0].length)}`, how: "spojený" };
        }
      }
      return null;
    }
    module2.exports = {
      repairName,
      episodeTitleYears,
      partNumber,
      partNumberInfo,
      nameNumbers,
      hasPartNumber,
      spinoffAbbrev,
      rawTokens,
      stripLeadingGroups,
      subtitleNoise,
      isNonVideo,
      afterName,
      sequelSeason,
      shortNameIsNoise,
      subTitle,
      normalize,
      tokens,
      nameTokens,
      queryText,
      isLatin,
      shortTitle,
      titleMatches,
      fileYears,
      parseEpisode,
      episodeRange,
      looksLikeEpisode,
      detectLang,
      langScore,
      detectQuality
    };
  }
});

// shared/hash.js
var require_hash = __commonJS({
  "shared/hash.js"(exports2, module2) {
    "use strict";
    init_timers();
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
    var sha256hex = (str) => hex(sha256(utf8(str)));
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
    module2.exports = { utf8, md5, sha1, sha256, sha1hex, sha256hex, md5hex, md5crypt };
  }
});

// webshare/src/platform.js
var require_platform = __commonJS({
  "webshare/src/platform.js"(exports2, module2) {
    "use strict";
    init_timers();
    var { md5crypt, sha1hex } = require_hash();
    var settings = () => typeof SCRAPER_SETTINGS === "object" && SCRAPER_SETTINGS || {};
    var nuvioTmdbKey = () => typeof TMDB_API_KEY === "string" ? TMDB_API_KEY.trim() : "";
    var config = {
      INDEXER_URL: "https://indexer.ddnsfree.com",
      // NimeToDex indexer (resolve-ids pro anime)
      INDEXER_FALLBACK_URL: "",
      CSFD_ON: true,
      CSFD_URL: "https://csfd-rating.duckdns.org",
      // csfd-ratings (české názvy, tituly jen na ČSFD)
      CSFD_FALLBACK_URL: "",
      TMDB_API_KEY: nuvioTmdbKey(),
      // klíč z Nuvia; vlastní klíč z nastavení má přednost
      DEBUG: false,
      HELLSPY_PROXY: "direct",
      HELLSPY_ON: true,
      HELLSPY_API: "https://api.hellspy.to/gw",
      HTTP: { open_timeout: 4e3, response_timeout: 8e3, read_timeout: 12e3 }
    };
    var log = (...a) => console.log(...a);
    var dbg = () => {
    };
    var H = 3600 * 1e3;
    var STALE_MS = 60 * 24 * H;
    var CAPS = { tmdb: 2e3, resolve: 2e3, files: 8e3 };
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
      constructor(name, max = 5e4) {
        this.name = `cache-${name}.json`;
        this.max = Math.min(max, CAPS[name] || 1e3);
        this.map = null;
        this.dirty = false;
        this.timer = null;
      }
      load() {
        if (this.map) return this.map;
        this.map = /* @__PURE__ */ new Map();
        try {
          const raw = JSON.parse(store.read(this.name) || "{}");
          const now = Date.now();
          for (const [k, e] of Object.entries(raw)) if (e && e.e + STALE_MS > now) this.map.set(k, e);
        } catch (e) {
        }
        return this.map;
      }
      get(key) {
        const e = this.load().get(key);
        return e && e.e > Date.now() ? e.v : void 0;
      }
      getStale(key) {
        const e = this.load().get(key);
        return e ? e.v : void 0;
      }
      set(key, val, ttlMs) {
        const map = this.load();
        if (map.size >= this.max) map.delete(map.keys().next().value);
        map.delete(key);
        map.set(key, { v: val, e: Date.now() + ttlMs });
        this.dirty = true;
        if (!this.timer) this.timer = _setTimeout(() => {
          this.timer = null;
          this.save();
        }, 15e3);
      }
      save() {
        if (!this.dirty || !this.map) return;
        try {
          store.write(this.name, JSON.stringify(Object.fromEntries(this.map)));
          this.dirty = false;
        } catch (e) {
          this.map = new Map([...this.map].slice(Math.floor(this.map.size / 2)));
          try {
            store.write(this.name, JSON.stringify(Object.fromEntries(this.map)));
            this.dirty = false;
          } catch (e2) {
          }
        }
      }
    };
    async function hsRequest(url, headers, { label = "Hellspy" } = {}) {
      const ctrl = new AbortController();
      const timer = _setTimeout(() => ctrl.abort(), 8e3);
      try {
        const resp = await fetch(url, { headers, signal: ctrl.signal });
        if (!resp.status) throw new Error(resp.statusText || `${label} neodpovídá`);
        return { status: resp.status, text: await resp.text() };
      } catch (e) {
        throw new Error(e && e.name === "AbortError" ? `${label} neodpovídá` : String(e && e.message || e));
      } finally {
        _clearTimeout(timer);
      }
    }
    var fsRequest = (url, headers) => hsRequest(url, headers, { label: "Fastshare" });
    module2.exports = { config, log, dbg, PersistentCache, md5crypt, sha1hex, hsRequest, fsRequest, settings, CACHE_DIR: "NUVIO.files" };
  }
});

// ../webshare-stremio-docker/lib/engine.js
var require_engine = __commonJS({
  "../webshare-stremio-docker/lib/engine.js"(exports2, module2) {
    "use strict";
    init_timers();
    var needle = require_needle();
    var M = require_matcher();
    var P = require_platform();
    var { INDEXER_URL, INDEXER_FALLBACK_URL, CSFD_ON, CSFD_URL, CSFD_FALLBACK_URL, TMDB_API_KEY: TMDB_API_KEY2, HELLSPY_ON, HELLSPY_API, HTTP } = P.config;
    var log = P.log;
    var dbg = P.dbg;
    var { PersistentCache, md5crypt } = P;
    var hooks = { version: "dev", archiveOn: () => false, archive: () => {
    } };
    var archiveWrite = (rec) => {
      if (hooks.archiveOn()) hooks.archive(rec);
    };
    var TTLCache = class {
      constructor(max = 2e3) {
        this.max = max;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const e = this.map.get(key);
        if (!e) return void 0;
        if (e.exp < Date.now()) {
          this.map.delete(key);
          return void 0;
        }
        return e.val;
      }
      set(key, val, ttlMs) {
        if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
        this.map.set(key, { val, exp: Date.now() + ttlMs });
      }
      delete(key) {
        this.map.delete(key);
      }
    };
    var H = 3600 * 1e3;
    var tokenCache = new TTLCache(500);
    var linkCache = new TTLCache(2e3);
    var tmdbCache = new PersistentCache("tmdb");
    var resolveCache = new PersistentCache("resolve");
    var saveCaches = () => {
      tmdbCache.save();
      resolveCache.save();
      fileCache.save();
    };
    var resultCache = new TTLCache(3e3);
    var lastFull = new TTLCache(1e3);
    var inflight = /* @__PURE__ */ new Map();
    function once(key, fn) {
      if (inflight.has(key)) return inflight.get(key);
      const p = Promise.resolve().then(fn).finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    }
    var hasWs = (cfg) => !!(cfg && cfg.username && cfg.password);
    var hsOn = (cfg) => HELLSPY_ON && !!cfg && cfg.hellspy !== false;
    var hasFs = (cfg) => !!(cfg && cfg.fs_username && cfg.fs_password);
    var who = (cfg) => cfg && cfg.username || (cfg && cfg.fs_username ? `fs:${cfg.fs_username}` : "hellspy");
    var isWs = (f) => !f.hs && !f.fs;
    var lenFromSearch = (f) => !!(f.hs || f.fs);
    var srcLetter = (f) => f.hs ? "h" : f.fs ? "f" : "w";
    var srcRank = (f) => f.hs ? 2 : f.fs ? 1 : 0;
    function userKey(cfg) {
      return P.sha1hex(`${cfg.username}
${cfg.password}`);
    }
    var WS_HEADERS = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "text/xml; charset=UTF-8"
    };
    async function wsPost(endpoint, params) {
      const body = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      const resp = await needle("post", `https://webshare.cz/api/${endpoint}/`, body, { headers: WS_HEADERS, ...HTTP });
      const ch = resp.body && resp.body.children;
      if (!Array.isArray(ch)) throw new Error(`Webshare ${endpoint}: neplatná odpověď (HTTP ${resp.statusCode})`);
      const get = (name) => {
        const el = ch.find((e) => e.name === name);
        return el ? el.value : void 0;
      };
      return { ch, get, status: get("status") };
    }
    var WsError = class extends Error {
    };
    async function wsLogin(username, password) {
      const s = await wsPost("salt", { username_or_email: username });
      if (s.status !== "OK" || !s.get("salt")) throw new WsError("Neznámé uživatelské jméno");
      const hashed = P.sha1hex(md5crypt(password, s.get("salt")));
      const l = await wsPost("login", { username_or_email: username, password: hashed, keep_logged_in: 1 });
      if (l.status !== "OK" || !l.get("token")) throw new WsError("Špatné jméno nebo heslo");
      return l.get("token");
    }
    async function getToken(cfg, fresh = false) {
      const key = userKey(cfg);
      if (!fresh) {
        const t = tokenCache.get(key);
        if (t) return { token: t, cached: true };
      }
      const token = await once(`login:${key}`, () => wsLogin(cfg.username, cfg.password));
      tokenCache.set(key, token, 6 * H);
      return { token, cached: false };
    }
    async function withToken(cfg, fn) {
      const { token, cached } = await getToken(cfg);
      const r = await fn(token);
      if (r && r.authFailed && cached) {
        tokenCache.delete(userKey(cfg));
        const again = await getToken(cfg, true);
        return fn(again.token);
      }
      return r;
    }
    var lockedIdents = /* @__PURE__ */ new Set();
    function parseFiles(ch) {
      lockedIdents.clear();
      ch.filter((el) => el.name === "file").forEach((el) => {
        const pw = (el.children || []).find((k) => k.name === "password");
        if (pw && pw.value === "1") lockedIdents.add((el.children.find((k) => k.name === "ident") || {}).value);
      });
      return ch.filter((el) => el.name === "file").map((el) => {
        const c = (name) => {
          const x = (el.children || []).find((k) => k.name === name);
          return x ? x.value : void 0;
        };
        return {
          ident: c("ident"),
          name: c("name") || "",
          size: parseInt(c("size") || "0", 10) || 0,
          img: c("img") || null,
          pos: parseInt(c("positive_votes") || "0", 10) || 0,
          neg: parseInt(c("negative_votes") || "0", 10) || 0
        };
      }).filter((f) => f.ident && f.name && !lockedIdents.has(f.ident));
    }
    async function wsSearch(token, query, limit = 50) {
      const r = await wsPost("search", { what: query, category: "video", limit, offset: 0, wst: token });
      if (r.status !== "OK") return { authFailed: r.status === "FATAL", files: [] };
      return { files: parseFiles(r.ch) };
    }
    async function wsFileLink(token, ident) {
      const r = await wsPost("file_link", { ident, download_type: "video_stream", force_https: 1, wst: token });
      if (r.status === "OK" && r.get("link")) return { link: r.get("link") };
      return { authFailed: r.status === "FATAL", link: null, message: r.get("message") || r.get("code") };
    }
    var IMAGE_FORMATS = /* @__PURE__ */ new Set(["MJPEG", "PNG", "JPEG", "JPG", "GIF", "BMP", "WEBP"]);
    function parseStreams(ch, tag) {
      const block = ch.find((e) => e.name === tag);
      return (block && block.children || []).filter((e) => e.name === "stream").map((st2) => {
        const v = (n) => {
          const x = (st2.children || []).find((k) => k.name === n);
          return x && x.value != null ? String(x.value) : "";
        };
        return {
          format: v("format").toUpperCase(),
          width: +v("width") || 0,
          height: +v("height") || 0,
          channels: +v("channels") || 0,
          lang: v("language").toUpperCase()
        };
      });
    }
    async function wsFileInfo(token, ident) {
      const r = await wsPost("file_info", { ident, wst: token });
      if (r.status !== "OK") {
        const code = r.get("code") || "";
        if (/FILE_INFO_FATAL/.test(code)) return { info: null, missing: true };
        return { authFailed: r.status === "FATAL", info: null };
      }
      const video = parseStreams(r.ch, "video").filter((v) => !IMAGE_FORMATS.has(v.format))[0] || null;
      const audio = parseStreams(r.ch, "audio").map((a) => ({ f: a.format, ch: a.channels, lang: a.lang }));
      return {
        info: {
          ident,
          name: r.get("name") || "",
          size: parseInt(r.get("size") || "0", 10) || 0,
          img: r.get("img") || null,
          description: r.get("description") || "",
          pos: parseInt(r.get("positive_votes") || "0", 10) || 0,
          neg: parseInt(r.get("negative_votes") || "0", 10) || 0,
          ok: r.get("available") !== "0" && r.get("removed") !== "1" && r.get("password") !== "1",
          len: parseInt(r.get("length") || "0", 10) || 0,
          w: video ? video.width : parseInt(r.get("width") || "0", 10) || 0,
          h: video ? video.height : parseInt(r.get("height") || "0", 10) || 0,
          vf: video ? video.format : String(r.get("format") || "").toUpperCase(),
          au: audio
        }
      };
    }
    async function wsUserData(token) {
      const r = await wsPost("user_data", { wst: token });
      if (r.status !== "OK") return null;
      return { vip: r.get("vip") === "1", vipDays: parseInt(r.get("vip_days") || "0", 10) || 0 };
    }
    var HS_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Origin": "https://hellspy.to",
      "Referer": "https://hellspy.to/"
    };
    var hsDownUntil = 0;
    var hsFailStreak = 0;
    async function hsGet(pathq) {
      if (Date.now() < hsDownUntil) throw new Error("Hellspy dočasně vypnutý (předchozí chyba)");
      try {
        const resp = await P.hsRequest(HELLSPY_API + pathq, HS_HEADERS);
        let result;
        if (resp.status === 404) result = null;
        else if (resp.status !== 200) throw Object.assign(new Error(`Hellspy HTTP ${resp.status}`), { status: resp.status });
        else {
          try {
            result = JSON.parse(resp.text);
          } catch (e) {
            throw new Error("Hellspy: neplatná odpověď");
          }
        }
        hsFailStreak = 0;
        return result;
      } catch (e) {
        if (!e.status || e.status === 429 || e.status === 403 || e.status >= 500) {
          hsFailStreak++;
          if (hsFailStreak >= 3) {
            if (Date.now() >= hsDownUntil) log(`⚠️ Hellspy vynechán na 1 min (3 chyby za sebou): ${e.message}`);
            hsDownUntil = Date.now() + 60 * 1e3;
            hsFailStreak = 0;
          }
        }
        throw e;
      }
    }
    var hsDown = () => Date.now() < hsDownUntil;
    async function hsSearch(query, limit = 50) {
      const j = await hsGet(`/search?query=${encodeURIComponent(query)}&offset=0&limit=${Math.min(limit, 64)}`);
      return (j && j.items || []).filter((it) => it && it.id && it.fileHash && it.title).map((it) => ({
        hs: true,
        ident: `hs:${it.id}`,
        id: it.id,
        hash: String(it.fileHash),
        name: String(it.title),
        size: +it.size || 0,
        len: +it.duration || 0,
        img: Array.isArray(it.thumbs) && typeof it.thumbs[0] === "string" ? it.thumbs[0].replace(/([^:])\/\/+/g, "$1/") : null
      }));
    }
    var hsDetailCache = new TTLCache(3e3);
    async function hsDetail(id, hash) {
      const key = `${id}:${hash}`;
      const hit = hsDetailCache.get(key);
      if (hit !== void 0) return hit;
      return once(`hsd:${key}`, async () => {
        const j = await hsGet(`/video/${encodeURIComponent(id)}/${encodeURIComponent(hash)}`);
        const conv = j && j.conversions && typeof j.conversions === "object" ? j.conversions : {};
        const d = j ? {
          title: String(j.title || j.filename || ""),
          size: +j.size || 0,
          duration: +j.duration || 0,
          thumb: Array.isArray(j.thumbs) && typeof j.thumbs[0] === "string" ? j.thumbs[0].replace(/([^:])\/\/+/g, "$1/") : null,
          filename: j.filename || j.title || "",
          conv: Object.fromEntries(Object.entries(conv).filter(([, v]) => typeof v === "string" && /^https?:/.test(v))),
          subs: (Array.isArray(j.subtitles) ? j.subtitles : []).filter((x) => x && x.url).map((x) => ({ lang: String(x.language || x.title || "").toLowerCase().replace(/\d+$/, ""), url: x.url }))
        } : null;
        hsDetailCache.set(key, d, (d ? 6 : 1) * H);
        return d;
      });
    }
    var convHeight = (k) => k === "0" ? 9999 : parseInt(k, 10) || 0;
    function hsMeta(d) {
      if (!d) return { ok: false };
      const conv = Object.keys(d.conv).sort((a, b) => convHeight(b) - convHeight(a));
      return { ok: conv.length > 0, conv, subs: [...new Set(d.subs.map((s) => s.lang).filter(Boolean))], fn: d.filename };
    }
    var FS_API = "https://fastshare.cz/api/api_kodi.php";
    var FS_HEADERS = { "User-Agent": "Kodi/20", Accept: "application/json" };
    var fsSessions = new TTLCache(500);
    var fsFiles = new TTLCache(5e3);
    var FsError = class extends Error {
    };
    var fsDownUntil = 0;
    var fsFailStreak = 0;
    var fsKey = (cfg) => P.sha1hex(`fastshare
${cfg.fs_username}
${cfg.fs_password}`);
    async function fsGet(params, hash) {
      if (Date.now() < fsDownUntil) throw new Error("Fastshare dočasně vypnutý (předchozí chyba)");
      const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      try {
        const resp = await P.fsRequest(`${FS_API}?${qs}`, hash ? { ...FS_HEADERS, Cookie: `FASTSHARE=${hash}` } : FS_HEADERS);
        if (resp.status !== 200) throw Object.assign(new Error(`Fastshare HTTP ${resp.status}`), { status: resp.status });
        let j;
        try {
          j = JSON.parse(resp.text);
        } catch (e) {
          throw new Error("Fastshare: neplatná odpověď");
        }
        fsFailStreak = 0;
        return j;
      } catch (e) {
        if (++fsFailStreak >= 3) {
          if (Date.now() >= fsDownUntil) log(`⚠️ Fastshare vynechán na 1 min (3 chyby za sebou): ${e.message}`);
          fsDownUntil = Date.now() + 60 * 1e3;
          fsFailStreak = 0;
        }
        throw e;
      }
    }
    async function fsLogin(name, password) {
      const j = await fsGet({ process: "login", login: name, password });
      const u = j && j.user;
      if (!u || typeof u.hash !== "string" || !/^[0-9a-f]{16,64}$/i.test(u.hash)) {
        const msg = j && (j.error || j.message || u && u.error);
        throw new FsError(typeof msg === "string" && msg.length < 200 ? `Fastshare: ${msg}` : "Přihlášení k Fastshare se nepovedlo – zkontroluj jméno a heslo.");
      }
      const d = u.data || {};
      const mul = { B: 1 / 1048576, KB: 1 / 1024, MB: 1, GB: 1024, TB: 1048576 }[String(d.unit || "MB").toUpperCase()] ?? 1;
      return { hash: u.hash, unlimited: u.unlimited === true || u.unlimited === 1 || u.unlimited === "1", creditMB: Math.round((parseFloat(d.value) || 0) * mul) };
    }
    async function fsSession(cfg, fresh = false) {
      const key = fsKey(cfg);
      const hit = fsSessions.get(key);
      if (hit && hit.bad) throw new FsError(hit.bad);
      if (hit && !fresh) return hit;
      return once(`fsl:${key}`, async () => {
        let r;
        try {
          r = await fsLogin(cfg.fs_username, cfg.fs_password);
        } catch (e) {
          if (e instanceof FsError) fsSessions.set(key, { bad: e.message }, 10 * 60 * 1e3);
          throw e;
        }
        const s = { hash: r.hash, t: Date.now() };
        fsSessions.set(key, s, 55 * 60 * 1e3);
        return s;
      });
    }
    var FS_RES_SCORE = { "4K": 4, "1080p": 3, "720p": 2, SD: 1 };
    function fsResolution(r) {
      const s = String(r || "").toLowerCase().trim();
      let w = 0, h = 0, m;
      if (m = s.match(/^(\d{3,4})\s*[x×]\s*(\d{3,4})$/)) {
        w = +m[1];
        h = +m[2];
      } else if (m = s.match(/^(\d{3,4})[pi]$/)) h = +m[1];
      else if (/^(4k|uhd)$/.test(s)) h = 2160;
      else return null;
      return w >= 3200 || h >= 2e3 ? "4K" : w >= 1800 || h >= 1e3 ? "1080p" : w >= 1200 || h >= 700 ? "720p" : "SD";
    }
    function fsUnits(v, table) {
      if (!v || typeof v !== "object") return +v || 0;
      return Math.round((parseFloat(v.value) || 0) * (table[String(v.unit || "").toUpperCase()] ?? 1));
    }
    var FS_SIZE = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824 };
    var FS_TIME = { S: 1, MIN: 60, M: 60, H: 3600 };
    function fsFile(it) {
      if (!it || !it.id || !it.filename) return null;
      const id = String(it.id);
      if (!/^\d+$/.test(id)) return null;
      const f = {
        fs: true,
        ident: `fs:${id}`,
        id,
        name: String(it.filename),
        size: fsUnits(it.data, FS_SIZE),
        len: fsUnits(it.duration, FS_TIME),
        res: fsResolution(it.resolution),
        resRaw: it.resolution ? String(it.resolution) : void 0,
        img: typeof it.thumbnail === "string" && /^https?:/.test(it.thumbnail) ? it.thumbnail : null,
        dl: typeof it.download_url === "string" && /^https:\/\/[\w.-]+\.fastshare\.(cloud|cz)\//.test(it.download_url) ? it.download_url : null
      };
      fsFiles.set(id, f, 24 * H);
      return f;
    }
    async function fsSearch(cfg, query, limit = 200) {
      const run = async (hash) => {
        const j = await fsGet({ process: "search", pagination: Math.min(limit, 200), term: query, adult: 0 }, hash);
        const list2 = j && j.search && j.search.file;
        return Array.isArray(list2) ? list2 : list2 && typeof list2 === "object" ? [list2] : [];
      };
      let s = await fsSession(cfg);
      let list = null, err = null;
      try {
        list = await run(s.hash);
      } catch (e) {
        err = e;
      }
      if ((err ? err.status === 401 || err.status === 403 : !list.length) && Date.now() - s.t > 2 * 60 * 1e3) {
        s = await fsSession(cfg, true);
        list = await run(s.hash);
      } else if (err) throw err;
      return list.map(fsFile).filter(Boolean);
    }
    async function fsPlayLink(cfg, id, filename) {
      const f = fsFiles.get(String(id));
      const dl = f && f.dl || `https://data.fastshare.cloud/download.php?id=${encodeURIComponent(id)}`;
      const s = await fsSession(cfg);
      return `${dl}${dl.includes("?") ? "&" : "?"}stream=1&session=${s.hash}&filename=${encodeURIComponent(filename || f && f.name || "video")}`;
    }
    var fsDown = () => Date.now() < fsDownUntil;
    var indexerDownUntil = /* @__PURE__ */ new Map();
    async function resolveIds(params) {
      const qs = Object.entries(params).filter(([, v]) => v !== void 0 && v !== null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      const key = `rs:${qs}`;
      const hit = resolveCache.get(key);
      if (hit !== void 0) return hit;
      return once(key, async () => {
        const bases = [...new Set([INDEXER_URL, INDEXER_FALLBACK_URL].filter(Boolean))].filter((b) => !(indexerDownUntil.get(b) > Date.now()));
        for (const base of bases) {
          try {
            const resp = await needle("get", `${base}/api/resolve-ids?${qs}`, {
              open_timeout: 2e3,
              response_timeout: 3e3,
              read_timeout: 4e3,
              parse: true
            });
            const b = resp.body;
            if (resp.statusCode === 200 && b && b.anilist_id) {
              resolveCache.set(key, b, 30 * 24 * H);
              return b;
            }
            if (resp.statusCode >= 500) throw new Error(`HTTP ${resp.statusCode}`);
            resolveCache.set(key, null, 2 * 24 * H);
            return null;
          } catch (e) {
            if (!indexerDownUntil.get(base)) log(`⚠️ indexer ${base} nedostupný (${e.message}) – 5 min použiju zálohu`);
            indexerDownUntil.set(base, Date.now() + 5 * 60 * 1e3);
          }
        }
        const stale = resolveCache.getStale(key);
        return stale !== void 0 ? stale : null;
      });
    }
    var csfdDownUntil = /* @__PURE__ */ new Map();
    var EN_COUNTRY = /^(USA|Velká Británie|Spojené království|Kanada|Austrálie|Irsko|Nový Zéland|angl)/i;
    function csfdToInfo(m, type, csfdId) {
      const others = (m.titlesOther || []).map((t) => typeof t === "string" ? { country: null, title: t } : t).filter((t) => t && t.title);
      const pick = (re) => {
        const t = others.find((o) => o.country && re.test(o.country));
        return t ? t.title.trim() : null;
      };
      const sk = pick(/^Slovensk/i), en = pick(EN_COUNTRY);
      const alt = others.map((o) => o.title.trim()).filter((t) => t && t !== sk && t !== en && t !== m.name && M.isLatin(t)).slice(0, 3);
      const year = parseInt(String(m.releaseInfo || m.year || "").slice(0, 4), 10) || null;
      const runtime = type === "movie" ? parseInt(String(m.runtime || ""), 10) || null : null;
      return {
        cz: m.name || null,
        sk,
        en,
        original: null,
        originalLanguage: null,
        alt,
        altEn: [],
        year,
        runtime,
        media: type === "movie" ? "movie" : "tv",
        csfdId,
        source: "csfd"
      };
    }
    async function csfdInfo(type, csfdId) {
      const key = `csfd:${type}:${csfdId}`;
      const hit = tmdbCache.get(key);
      if (hit !== void 0) return hit;
      return once(key, async () => {
        const bases = [...new Set([CSFD_URL, CSFD_FALLBACK_URL].filter(Boolean))].filter((b) => !(csfdDownUntil.get(b) > Date.now()));
        for (const base of bases) {
          try {
            const resp = await needle("get", `${base}/meta/${type}/csfd:${csfdId}.json`, {
              open_timeout: 2e3,
              response_timeout: 4e3,
              read_timeout: 6e3,
              parse: true
            });
            const m = resp.body && resp.body.meta;
            if (resp.statusCode === 200 && m && m.name) {
              const info = csfdToInfo(m, type, csfdId);
              tmdbCache.set(key, info, 7 * 24 * H);
              return info;
            }
            if (resp.statusCode === 404) {
              tmdbCache.set(key, null, 24 * H);
              return null;
            }
            throw new Error(`HTTP ${resp.statusCode}`);
          } catch (e) {
            if (!csfdDownUntil.get(base)) log(`⚠️ csfd-ratings ${base} nedostupný (${e.message}) – 5 min použiju zálohu`);
            csfdDownUntil.set(base, Date.now() + 5 * 60 * 1e3);
          }
        }
        const stale = tmdbCache.getStale(key);
        return stale !== void 0 ? stale : null;
      });
    }
    async function csfdIdForImdb(type, imdbId) {
      const key = `csfdid:${type}:${imdbId}`;
      const hit = tmdbCache.get(key);
      if (hit !== void 0) return hit;
      const get = (base, p) => needle("get", `${base}${p}`, {
        open_timeout: 2e3,
        response_timeout: 6e3,
        read_timeout: 8e3,
        parse: true
      });
      return once(key, async () => {
        const bases = [...new Set([CSFD_URL, CSFD_FALLBACK_URL].filter(Boolean))].filter((b) => !(csfdDownUntil.get(b) > Date.now()));
        for (const base of bases) {
          try {
            let id;
            const resp = await get(base, `/csfd-id/${type}/${imdbId}.json`);
            if (resp.statusCode === 200) {
              id = resp.body && Number.isFinite(resp.body.csfdId) ? resp.body.csfdId : null;
            } else if (resp.statusCode === 404) {
              const old = await get(base, `/ratings/${type}/${imdbId}.json`);
              if (old.statusCode !== 200) throw new Error(`HTTP ${old.statusCode}`);
              const r = (old.body && old.body.ratings || []).find((x) => x && /csfd\.cz\/film\/\d+/.test(x.url || ""));
              id = r ? parseInt(r.url.match(/\/film\/(\d+)/)[1], 10) : null;
            } else {
              throw new Error(`HTTP ${resp.statusCode}`);
            }
            tmdbCache.set(key, id, id ? 30 * 24 * H : 6 * H);
            return id;
          } catch (e) {
            if (!/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH/.test(String(e.code || e.message))) continue;
            if (!csfdDownUntil.get(base)) log(`⚠️ csfd-ratings ${base} nedostupný (${e.message}) – 5 min použiju zálohu`);
            csfdDownUntil.set(base, Date.now() + 5 * 60 * 1e3);
          }
        }
        return null;
      });
    }
    function needsCzName(info) {
      if (!info || info.source === "csfd" || info.originalLanguage === "cs") return false;
      if (!info.cz) return true;
      const t = (x) => M.tokens(x || "").join(" ");
      return t(info.cz) === t(info.original) || !info.original && t(info.cz) === t(info.en);
    }
    async function withCsfdCzName(info, type, imdbId, budgetMs = 1200) {
      if (!CSFD_ON || !imdbId || !needsCzName(info)) return info;
      const p = csfdIdForImdb(type, imdbId).then((id) => id ? csfdInfo(type, id) : null).catch(() => null);
      const cs = await Promise.race([p, new Promise((r) => _setTimeout(() => r(null), budgetMs).unref())]);
      if (!cs || !cs.cz) return info;
      if (info.year && cs.year && Math.abs(info.year - cs.year) > 1) return info;
      const t = (x) => M.tokens(x || "").join(" ");
      if ([info.cz, info.en, info.original].some((x) => x && t(x) === t(cs.cz))) return info;
      dbg(`  ČSFD název k ${imdbId}: ${cs.cz}`);
      return { ...info, cz: cs.cz, sk: info.sk || cs.sk || null, czFrom: "csfd" };
    }
    async function tmdbGet(pathq, key) {
      const bearer = key.length > 40;
      const url = `https://api.themoviedb.org/3${pathq}${bearer ? "" : (pathq.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(key)}`;
      const resp = await needle("get", url, { ...HTTP, headers: bearer ? { Authorization: `Bearer ${key}` } : {} });
      if (resp.statusCode === 401) throw Object.assign(new Error("TMDB klíč je neplatný"), { auth: true });
      if (resp.statusCode !== 200) throw new Error(`TMDB HTTP ${resp.statusCode}`);
      return resp.body;
    }
    async function tmdbInfoWithKey(imdbId, type, key) {
      const found = await tmdbGet(`/find/${imdbId}?external_source=imdb_id&language=cs-CZ`, key);
      const movie = (found.movie_results || [])[0];
      const tv = (found.tv_results || [])[0];
      const pick = type === "series" ? tv ? ["tv", tv] : movie ? ["movie", movie] : null : movie ? ["movie", movie] : tv ? ["tv", tv] : null;
      if (!pick) return null;
      const [media, item] = pick;
      const d = await tmdbGet(`/${media}/${item.id}?language=cs-CZ&append_to_response=translations,alternative_titles`, key);
      const trs = d.translations && d.translations.translations || [];
      const tr = (lang, country) => {
        const t = trs.find((x) => x.iso_639_1 === lang && (!country || x.iso_3166_1 === country));
        const v = t && t.data && (t.data.title || t.data.name);
        return v && v.trim() ? v.trim() : null;
      };
      const original = d.original_title || d.original_name || null;
      const origLang = d.original_language || null;
      const altList = d.alternative_titles && (d.alternative_titles.titles || d.alternative_titles.results) || [];
      return {
        cz: tr("cs") || (origLang === "cs" ? original : null),
        sk: tr("sk") || (origLang === "sk" ? original : null),
        en: tr("en", "US") || tr("en") || (origLang === "en" ? original : null),
        original,
        originalLanguage: origLang,
        alt: altList.filter((a) => a.iso_3166_1 === "CZ" || a.iso_3166_1 === "SK").map((a) => a.title).filter(Boolean),
        altEn: altList.filter((a) => a.iso_3166_1 === "US" || a.iso_3166_1 === "GB").map((a) => a.title).filter(Boolean).slice(0, 10),
        year: parseInt(String(d.release_date || d.first_air_date || "").slice(0, 4), 10) || null,
        runtime: d.runtime || null,
        // délka filmu v minutách (u seriálů null)
        tmdbId: item.id,
        media,
        // pro délku dílů (/tv/{id}/season/{n})
        collection: media === "movie" ? d.belongs_to_collection && d.belongs_to_collection.id || null : void 0,
        source: "tmdb"
      };
    }
    async function cinemetaInfo(imdbId, type) {
      try {
        const resp = await needle("get", `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`, HTTP);
        const m = resp.body && resp.body.meta;
        if (!m || !m.name) return null;
        const year = parseInt(String(m.year || m.releaseInfo || m.released || "").slice(0, 4), 10) || null;
        return { cz: null, sk: null, en: m.name, original: null, originalLanguage: null, alt: [], year, source: "cinemeta" };
      } catch (e) {
        return null;
      }
    }
    async function titleInfo(imdbId, type, userTmdbKey) {
      const key = `tm:${imdbId}:${type}`;
      const hit = tmdbCache.get(key);
      const old = hit && hit.source === "tmdb" && (type === "movie" && (hit.runtime === void 0 || hit.collection === void 0) || type === "series" && hit.tmdbId === void 0);
      if (hit !== void 0 && !old) return hit;
      return once(key, async () => {
        const keys = [...new Set([String(userTmdbKey || "").trim(), TMDB_API_KEY2].filter(Boolean))];
        let failed = false;
        for (const k of keys) {
          try {
            const info = await tmdbInfoWithKey(imdbId, type, k);
            if (info) {
              tmdbCache.set(key, info, 30 * 24 * H);
              return info;
            }
            failed = false;
            break;
          } catch (e) {
            dbg(`TMDB ${imdbId}: ${e.message}`);
            failed = true;
            if (!e.auth) break;
          }
        }
        const stale = tmdbCache.getStale(key);
        if (failed && stale) return stale;
        const cm = await cinemetaInfo(imdbId, type);
        if (cm) tmdbCache.set(key, cm, failed ? H : 7 * 24 * H);
        return cm || stale || null;
      });
    }
    async function seasonRuntimes(tvId, season, userTmdbKey, episode) {
      const key = `ep:${tvId}:${season}`;
      const hit = tmdbCache.get(key);
      if (hit !== void 0) {
        if (hit === null) return null;
        const map = hit.map || hit;
        if (!episode || map[episode] || hit.t && Date.now() - hit.t < 24 * H) return map;
      }
      return once(key, async () => {
        const keys = [...new Set([String(userTmdbKey || "").trim(), TMDB_API_KEY2].filter(Boolean))];
        for (const k of keys) {
          try {
            const d = await tmdbGet(`/tv/${tvId}/season/${season}?language=cs-CZ`, k);
            const eps = d && d.episodes || [];
            const map = {};
            for (const e of eps) if (e.episode_number && e.runtime) map[e.episode_number] = e.runtime;
            const complete = eps.length > 0 && Object.keys(map).length === eps.length;
            tmdbCache.set(key, { map, t: Date.now() }, (complete ? 365 : 1) * 24 * H);
            return map;
          } catch (e) {
            dbg(`TMDB sezóna ${tvId}/${season}: ${e.message}`);
            if (!e.auth) break;
          }
        }
        tmdbCache.set(key, null, 24 * H);
        return null;
      });
    }
    var countryCode = (c) => {
      c = String(c || "").toLowerCase();
      return c === "gb" ? "uk" : c;
    };
    async function sameNameShows(info, userTmdbKey) {
      if (!info || info.media !== "tv" || !info.tmdbId || !info.year) return null;
      const key = `sn3:${info.tmdbId}`;
      const hit = tmdbCache.get(key);
      if (hit !== void 0) return hit;
      const ours = new Set([info.en, info.original, info.cz].filter(Boolean).map((t) => M.tokens(t).join(" ")).filter(Boolean));
      const query = info.en || (M.isLatin(info.original) ? info.original : null);
      if (!query || !ours.size) return null;
      return once(key, async () => {
        const keys = [...new Set([String(userTmdbKey || "").trim(), TMDB_API_KEY2].filter(Boolean))];
        for (const k of keys) {
          try {
            const d = await tmdbGet(`/search/tv?query=${encodeURIComponent(query)}&language=en-US`, k);
            let dcs = null;
            try {
              dcs = await tmdbGet(`/search/tv?query=${encodeURIComponent(query)}&language=cs-CZ`, k);
            } catch (e) {
            }
            const csName = dcs ? new Map((dcs && dcs.results || []).map((r) => [r.id, r.name])) : null;
            const out = [];
            let me = null;
            for (const r of d && d.results || []) {
              const c = countryCode((r.origin_country || [])[0]);
              if (r.id === info.tmdbId) {
                me = { ours: true, v: r.vote_count || 0, c };
                continue;
              }
              if ((r.vote_count || 0) < 10) continue;
              const y = parseInt(String(r.first_air_date || "").slice(0, 4), 10);
              if (!y || Math.abs(y - info.year) <= 1) continue;
              const same = [r.name, r.original_name].filter(Boolean).some((t) => ours.has(M.tokens(t).join(" ")));
              if (!same) continue;
              const n = csName ? [r.name, r.original_name, csName.get(r.id)].filter(Boolean).map((t) => M.tokens(t).join(" ")).filter(Boolean) : null;
              const prev = out.find((o) => o.y === y);
              if (prev) {
                if (prev.n && n) prev.n = [.../* @__PURE__ */ new Set([...prev.n, ...n])];
                continue;
              }
              out.push(n ? { y, v: r.vote_count || 0, c, n: [...new Set(n)] } : { y, v: r.vote_count || 0, c });
            }
            out.sort((a, b) => a.y - b.y);
            const res = out.length ? [...out, me || { ours: true, v: null, c: "" }] : [];
            tmdbCache.set(key, res, 30 * 24 * H);
            return res;
          } catch (e) {
            dbg(`TMDB stejný název ${info.tmdbId}: ${e.message}`);
            if (!e.auth) break;
          }
        }
        tmdbCache.set(key, null, 24 * H);
        return null;
      });
    }
    async function collectionParts(collId, userTmdbKey) {
      if (!collId) return null;
      const key = `col2:${collId}`;
      const hit = tmdbCache.get(key);
      if (hit !== void 0) return hit;
      return once(key, async () => {
        const keys = [...new Set([String(userTmdbKey || "").trim(), TMDB_API_KEY2].filter(Boolean))];
        for (const k of keys) {
          try {
            const d = await tmdbGet(`/collection/${collId}?language=en-US`, k);
            let cs = null;
            try {
              cs = await tmdbGet(`/collection/${collId}?language=cs-CZ`, k);
            } catch (e) {
            }
            const csTitle = new Map((cs && cs.parts || []).map((p) => [p.id, p.title]));
            const words = (p) => [...new Set(M.nameTokens([p.title, p.original_title, csTitle.get(p.id)].filter(Boolean).join(" ")))];
            const parts = (d && d.parts || []).filter((p) => p.release_date).map((p) => ({ id: p.id, d: p.release_date, y: parseInt(p.release_date.slice(0, 4), 10) || null, w: words(p) })).sort((a, b) => a.d.localeCompare(b.d)).map((p) => ({ id: p.id, y: p.y, w: p.w }));
            tmdbCache.set(key, parts, 30 * 24 * H);
            return parts;
          } catch (e) {
            dbg(`TMDB série ${collId}: ${e.message}`);
            if (!e.auth) break;
          }
        }
        tmdbCache.set(key, null, 24 * H);
        return null;
      });
    }
    function seasonBase(text) {
      const m = String(text || "").match(/^(.*?)[\s:\-–]+(?:(II|III|IV|V|VI)|(\d{1,2})(?:st|nd|rd|th)\s+season|season\s*(\d{1,2})|s(\d{1,2}))\s*$/i);
      if (!m) return null;
      const roman = { II: 2, III: 3, IV: 4, V: 5, VI: 6 };
      const n = m[2] ? roman[m[2].toUpperCase()] : +(m[3] || m[4] || m[5]);
      const base = m[1].trim();
      if (!(n >= 2) || M.nameTokens(base).join("").length < 5) return null;
      return { base, season: n };
    }
    function longCut(text) {
      if (!text || M.tokens(text).length <= 10) return null;
      const m = String(text).match(/^(.*?\S)\s*[.,!?]+(?:\s|$)/);
      if (!m) return null;
      return M.nameTokens(m[1]).length >= 4 ? m[1].trim() : null;
    }
    function uniqNames(list, max) {
      const seen = /* @__PURE__ */ new Set(), out = [];
      for (const n of list) {
        if (!n || !n.text) continue;
        const nt = M.nameTokens(n.text);
        const k = nt.join(" ");
        if (!k || !nt.some((t) => t.length >= 3) || seen.has(k)) continue;
        seen.add(k);
        out.push(n);
        if (out.length >= max) break;
      }
      return out;
    }
    async function buildPlan(type, id, cfg) {
      const parts = id.split(":");
      let imdb = null, season = null, episode = null, rs = null, info = null;
      if (parts[0].startsWith("tt")) {
        imdb = parts[0];
        if (type === "series") {
          season = parseInt(parts[1], 10) || null;
          episode = parseInt(parts[2], 10) || null;
        }
        const rsParams = type === "series" && season && episode ? { imdb, season, episode } : { imdb };
        [info, rs] = await Promise.all([titleInfo(imdb, type, cfg.tmdb_api_key), resolveIds(rsParams)]);
      } else if (parts[0] === "kitsu" || parts[0] === "anilist") {
        const key = parts[0], animeId = parts[1];
        episode = parseInt(parts[2], 10) || null;
        rs = await resolveIds(episode ? { [key]: animeId, episode } : { [key]: animeId });
        if (rs && rs.imdb_id) info = await titleInfo(rs.imdb_id, type, cfg.tmdb_api_key);
        season = rs && rs.season || 1;
        if (rs && rs.episode && !episode) episode = rs.episode;
      } else if (parts[0] === "csfd" && CSFD_ON) {
        const csfdId = parseInt(parts[1], 10);
        if (!csfdId) return null;
        if (type === "series") {
          season = parseInt(parts[2], 10) || 1;
          episode = parseInt(parts[3], 10) || null;
        }
        info = await csfdInfo(type, csfdId);
      } else {
        return null;
      }
      if (info && info.source !== "csfd") info = await withCsfdCzName(info, type, imdb || rs && rs.imdb_id);
      if (rs && type === "movie" && rs.type && !/movie/i.test(rs.type) && imdb) {
        rs = null;
      }
      const isAnime = !!rs;
      let epRuntimeP = null;
      if (type === "series" && season && episode && info && info.media === "tv" && info.tmdbId) {
        epRuntimeP = seasonRuntimes(info.tmdbId, season, cfg.tmdb_api_key, episode).then((m) => m && m[episode] || null).catch(() => null);
      }
      const collP = type === "movie" && info && info.media === "movie" && info.collection ? collectionParts(info.collection, cfg.tmdb_api_key).then((parts2) => {
        const i = (parts2 || []).findIndex((p) => p.id === info.tmdbId);
        if (i < 0 || parts2.length < 2) return null;
        const w = [...new Set(parts2.filter((p, j) => j !== i).flatMap((p) => p.w || []))].slice(0, 80);
        return { i: i + 1, n: parts2.length, w };
      }).catch(() => null) : null;
      const sameNameP = type === "series" && info && info.media === "tv" ? sameNameShows(info, cfg.tmdb_api_key).catch(() => null) : null;
      const latin = (s) => s && M.isLatin(s) ? s : null;
      const full = (text) => text ? { text } : null;
      const short = (text) => {
        const s = M.shortTitle(text);
        return s ? { text: s, short: true, full: text } : null;
      };
      const sub = (text) => {
        const s = M.subTitle(text);
        return s ? { text: s, short: M.nameTokens(s).length < 3, full: text } : null;
      };
      const fr = [];
      if (info) {
        const baseEn = [info.en, latin(info.original)].filter(Boolean).map((t) => M.nameTokens(t).join(" "));
        const longEn = [...info.altEn || [], latin(info.original)].filter(Boolean).find((a) => {
          const k = M.nameTokens(a).join(" ");
          return baseEn.some((b) => b && k !== b && (k.startsWith(b + " ") || k.endsWith(" " + b)));
        });
        if (info.source === "csfd") {
          const clean = (t) => t ? t.replace(/[●○■□◆◇★☆♦♥?？]+/g, " ").replace(/\s+([:,.])/g, "$1").replace(/\s+/g, " ").trim() : t;
          fr.push(full(clean(info.cz)), full(clean(info.sk)), full(clean(info.en)));
          (info.alt || []).slice(0, 3).forEach((a) => fr.push(full(clean(a))));
        } else {
          fr.push(full(info.cz), full(info.sk), full(info.en), full(latin(info.original)), full(longEn));
          fr.push(short(info.cz), sub(info.cz), short(info.en), sub(info.en));
          (info.alt || []).slice(0, 3).forEach((a) => fr.push(full(a)));
        }
      }
      const an = [];
      if (rs) {
        an.push(full(rs.title), full(rs.title_en), full(longCut(rs.title)), full(longCut(rs.title_en)), short(rs.title), short(rs.title_en));
        const core = new Set([...M.nameTokens(rs.title || ""), ...M.nameTokens(rs.title_en || "")].filter((t) => t.length >= 3 && !/^\d+$/.test(t) && t !== "vs" && t !== "versus"));
        const ownWords = /* @__PURE__ */ new Set([...core, ...fr.filter(Boolean).flatMap((n) => M.nameTokens(n.text))]);
        (rs.titles || []).filter((t) => M.isLatin(t) && t.length <= 60).filter((t) => {
          const nt = M.nameTokens(t);
          if (nt.length === 1) return nt[0].length >= 5 && !ownWords.has(nt[0]);
          return nt.some((x) => core.has(x));
        }).slice(0, 6).forEach((t) => an.push(full(t)));
      }
      const names = uniqNames([
        ...fr.filter(Boolean).map((n) => ({ ...n, kind: "franchise" })),
        ...an.filter(Boolean).map((n) => ({ ...n, kind: "anime" }))
      ], 9);
      if (!names.length) return null;
      if (rs && type === "series") {
        const have = new Set(names.map((n) => M.nameTokens(n.text).join(" ")));
        let added = 0;
        for (const n of names.filter((x) => x.kind === "anime" && !x.short)) {
          if (added >= 2) break;
          const sb = seasonBase(n.text);
          if (!sb || sb.season !== (rs.season || season)) continue;
          const k = M.nameTokens(sb.base).join(" ");
          if (have.has(k)) continue;
          have.add(k);
          names.push({ text: sb.base, kind: "anime", seasonOnly: sb.season });
          added++;
        }
      }
      const allow = new Set(names.flatMap((n) => M.nameTokens(n.full || n.text)));
      return {
        type,
        id,
        isAnime,
        names,
        allow,
        runtime: info && info.runtime || null,
        epRuntime: null,
        epRuntimeP,
        sameName: null,
        sameNameP,
        coll: null,
        collP,
        hasColl: !!collP,
        year: info && info.year || null,
        season,
        episode,
        alEpisode: rs ? rs.episode || episode : null,
        alSeason: rs ? rs.season || season : null,
        source: info ? info.source : "indexer",
        anilistId: rs ? rs.anilist_id : null,
        // originální název u titulu v jiném jazyce než CZ/SK/EN (polský, španělský …) – dotaz hned v první vlně
        origName: info && info.source === "tmdb" && info.originalLanguage && !["cs", "sk", "en"].includes(info.originalLanguage) && names.some((n) => n.text === latin(info.original)) ? info.original : null
      };
    }
    var pad = (n) => String(n).padStart(2, "0");
    var ORD_Q = { prvni: "1", druha: "2", druhy: "2", druhe: "2", treti: "3", ctvrta: "4", ctvrty: "4" };
    function digitVariant(q) {
      const v = q.split(" ").map((w) => ORD_Q[w.toLowerCase()] || w).join(" ");
      return v !== q ? v : null;
    }
    function fiveOVariant(q) {
      const v = q.replace(/\b(5|five)[-. ]?0\b/i, "5-O");
      return v !== q ? v : null;
    }
    function buildQueries(plan) {
      const fr = plan.names.filter((n) => n.kind === "franchise").map((n) => M.queryText(n.text));
      const an = plan.names.filter((n) => n.kind === "anime" && !n.seasonOnly).map((n) => M.queryText(n.text));
      const variants = [...fr.map(digitVariant), ...fr.map(fiveOVariant)].filter(Boolean);
      const w1 = [], w2 = [];
      if (plan.type === "movie") {
        const all = [...fr, ...an];
        all.slice(0, 3).forEach((q) => w1.push(q));
        if (plan.year) all.slice(0, 2).forEach((q) => w1.push(`${q} ${plan.year}`));
        all.slice(3).forEach((q) => w2.push(q));
        variants.forEach((q) => w2.push(q));
      } else if (plan.season && plan.episode) {
        const se = `S${pad(plan.season)}E${pad(plan.episode)}`;
        const shortName = fr.length && plan.year && M.nameTokens(fr[0]).length === 1 && M.nameTokens(fr[0])[0].length < 6;
        if (shortName) w1.push(`${fr[0]} ${plan.year} ${se}`);
        fr.slice(0, 3).forEach((q) => w1.push(`${q} ${se}`));
        if (plan.origName) w1.push(`${M.queryText(plan.origName)} ${se}`);
        if (plan.isAnime && plan.alEpisode) an.slice(0, 2).forEach((q) => w1.push(`${q} ${pad(plan.alEpisode)}`));
        fr.slice(0, 3).forEach((q) => w2.push(`${q} ${plan.season}x${pad(plan.episode)}`));
        if (plan.season === 1) fr.slice(0, 2).forEach((q) => w2.push(`${q} ${pad(plan.episode)}`));
        fr.slice(3).forEach((q) => w2.push(`${q} ${se}`));
        variants.forEach((q) => w2.push(`${q} ${se}`));
        if (plan.isAnime && plan.alEpisode) {
          if (plan.alEpisode < 10) an.slice(0, 1).forEach((q) => w2.push(`${q} ${plan.alEpisode}`));
          an.slice(0, 2).forEach((q) => w2.push(`${q} E${pad(plan.alEpisode)}`));
          an.slice(2).forEach((q) => w2.push(`${q} ${pad(plan.alEpisode)}`));
        }
        if (shortName) w2.push({ q: `${fr[0]} ${plan.year}`, limit: 100 });
        [fr[0], ...variants.slice(0, 1), ...plan.names.filter((n) => n.short && n.kind === "franchise" && M.subTitle(n.full) === n.text).map((n) => M.queryText(n.text)).slice(0, 1)].filter(Boolean).forEach((q) => w2.push({ q, limit: 100 }));
      } else {
        [...fr, ...an].slice(0, 3).forEach((q) => w1.push(q));
      }
      const dedupe = (arr, skip = /* @__PURE__ */ new Set()) => {
        const out = [];
        for (const item of arr) {
          const it = typeof item === "string" ? { q: item, limit: 50 } : item;
          const k = it.q.toLowerCase().trim();
          if (!k || skip.has(k)) continue;
          skip.add(k);
          out.push(it);
        }
        return out;
      };
      const seen = /* @__PURE__ */ new Set();
      return [dedupe(w1, seen).slice(0, 8), dedupe(w2, seen).slice(0, 10)];
    }
    async function runQueries(cfg, queries, { ws = true, hs = true, fs = true, budgetMs = 4e3 } = {}) {
      const out = /* @__PURE__ */ new Map();
      const deadline = Date.now() + budgetMs;
      let degraded = false, done = false;
      const finished = { WS: false, HS: false, FS: false }, okCount = { WS: 0, HS: 0, FS: 0 }, errCount = { WS: 0, HS: 0, FS: 0 }, lastErr = { WS: "", HS: "", FS: "" };
      const muted = { WS: () => false, HS: () => Date.now() < hsDownUntil, FS: () => Date.now() < fsDownUntil };
      const pool = async (n, search, label) => {
        let i = 0;
        const worker = async () => {
          while (i < queries.length && Date.now() < deadline && !done) {
            const { q, limit } = queries[i++];
            try {
              const files = await search(q, limit);
              if (done) return;
              okCount[label]++;
              for (const f of files) if (!out.has(f.ident)) out.set(f.ident, f);
              dbg(`  🔎 ${label} "${q}" → ${files.length}`);
            } catch (e) {
              degraded = true;
              errCount[label]++;
              lastErr[label] = String(e.message || e).slice(0, 80);
              const quiet = e instanceof FsError && errCount[label] > 1;
              if (!quiet && !muted[label]()) log(`  ⚠️ ${label} hledání "${q}" selhalo: ${e.message}`);
            }
          }
          if (i < queries.length) degraded = true;
        };
        await Promise.all(Array.from({ length: Math.min(n, queries.length) }, worker));
        finished[label] = true;
      };
      const all = Promise.all([
        ws && hasWs(cfg) ? pool(4, async (q, limit) => (await withToken(cfg, (t) => wsSearch(t, q, limit))).files, "WS") : null,
        hs && hsOn(cfg) ? pool(3, (q, limit) => hsSearch(q, limit), "HS") : null,
        fs && hasFs(cfg) ? pool(3, (q) => fsSearch(cfg, q, 200), "FS") : null
      ]);
      const timedOut = await Promise.race([all.then(() => false), new Promise((r) => _setTimeout(() => r(true), budgetMs).unref())]);
      if (timedOut) {
        done = true;
        degraded = true;
        log(`  ⏱ hledání přerušeno po ${budgetMs} ms – vracím, co je hotové`);
      }
      const dead = { ws: !finished.WS || !okCount.WS, hs: !finished.HS || !okCount.HS, fs: !finished.FS || !okCount.FS };
      const deg = {};
      for (const [label, on] of [["WS", ws && hasWs(cfg)], ["HS", hs && hsOn(cfg)], ["FS", fs && hasFs(cfg)]]) {
        if (!on || finished[label] && !errCount[label]) continue;
        deg[label.toLowerCase()] = { err: errCount[label], ok: okCount[label], ...finished[label] ? {} : { timeout: true }, ...lastErr[label] ? { msg: lastErr[label] } : {} };
      }
      return {
        files: new Map(out),
        degraded,
        dead,
        deg,
        wsFailed: !!(ws && hasWs(cfg) && errCount.WS && !okCount.WS),
        // vypršel čas a neprošel ani jeden dotaz (poskytovatel "visí" – typicky v celou hodinu)
        wsTimedOut: !!(ws && hasWs(cfg) && !finished.WS && !okCount.WS),
        hsTimedOut: !!(hs && hsOn(cfg) && !finished.HS && !okCount.HS && Date.now() >= hsDownUntil),
        fsFailed: !!(fs && hasFs(cfg) && errCount.FS && !okCount.FS && Date.now() >= fsDownUntil),
        fsTimedOut: !!(fs && hasFs(cfg) && !finished.FS && !okCount.FS && Date.now() >= fsDownUntil)
      };
    }
    function nameOk(fileName, n, plan) {
      if (!M.titleMatches(fileName, n.text, plan && plan.names.map((x) => x.text), plan && plan.year)) return false;
      if (n.short && M.shortNameIsNoise(fileName, n.text, n.full)) return false;
      if (plan && M.subtitleNoise(fileName, n.text, plan.allow, plan.type === "movie" ? "movie" : "series") && !originalTitleWord(fileName, n, plan)) return false;
      if (plan && M.spinoffAbbrev(fileName, n.text, plan.allow)) return false;
      return true;
    }
    function originalTitleWord(fileName, n, plan) {
      if (plan.type === "movie" || !plan.year || M.nameTokens(n.text).length < 3) return false;
      const hit = M.afterName(M.stripLeadingGroups(fileName), n.text);
      if (!hit || !/^[a-z]{3,}$/.test(hit.rest[0] || "") || !/^(s\d{1,2}e\d{1,4}|\d{1,2}x\d{1,4})$/.test(hit.rest[1] || "")) return false;
      return M.fileYears(fileName).includes(plan.year);
    }
    function animeSeasonOk(pe, n, plan) {
      if (pe.season === null) return true;
      if (pe.season === plan.season || pe.season === plan.alSeason) return true;
      return pe.season === 1 && seasonInName(n);
    }
    function seasonInName(n) {
      return M.nameTokens(n.text).some((t) => /^[2-9]$/.test(t) || t === "season" || t === "part" || /^\d(st|nd|rd|th)$/.test(t));
    }
    function hasPartMarker(n) {
      const t = M.nameTokens(n.text);
      return t.some((w, i) => /^[2-9](nd|rd|th)$/.test(w) || (w === "part" || w === "cour") && /^([2-4]|ii|iii|iv)$/.test(t[i + 1] || ""));
    }
    function sameNameOf(plan) {
      const list = (plan.sameName || []).map((o) => typeof o === "number" ? { y: o, v: null, c: "" } : o);
      return { others: list.filter((o) => !o.ours), me: list.find((o) => o.ours) || null };
    }
    var COUNTRY_MARK = /* @__PURE__ */ new Set(["us", "usa", "uk", "au", "aus", "nz", "ca", "ie"]);
    var markCountry = (t) => t === "usa" ? "us" : t === "aus" ? "au" : t;
    var SIGNED = "podpis uploadera za názvem";
    var SEP = "[\\s._\\-–—\\[\\]()]";
    var SIGNED_RE = new RegExp(`^(.*[^\\s._\\-–—\\[\\]()])${SEP}+([^\\s._\\-–—\\[\\]()]+)${SEP}*$`);
    function signedName(fileName, plan) {
      const ext = (String(fileName).match(/\.[a-z0-9]{2,4}$/i) || [""])[0];
      const base = ext ? fileName.slice(0, -ext.length) : fileName;
      const m = base.match(SIGNED_RE);
      if (!m) return null;
      const word = M.normalize(m[2]);
      if (!/^[a-z]{2,}$/.test(word)) return null;
      if (plan.coll || plan.hasColl) {
        if (!plan.coll || !Array.isArray(plan.coll.w) || plan.coll.w.includes(word)) return null;
      }
      return { name: m[1] + ext, word };
    }
    function judgeFile(f, plan) {
      if (M.isNonVideo(f.name)) return { ok: false, reason: "nepřehratelný soubor" };
      const texts = plan.names.map((n) => n.text);
      const anyTitle = plan.names.some((n) => M.titleMatches(f.name, n.text, texts, plan.year));
      if (plan.type === "movie") {
        const inColl = !!(plan.coll && plan.coll.i);
        if (M.looksLikeEpisode(f.name, inColl) && !plan.names.some((n) => /\b\d{1,2}x\d{1,3}\b/.test(M.normalize(n.text)))) {
          return { ok: false, reason: "vypadá jako díl seriálu" };
        }
        const byFull = plan.names.some((n) => !n.short && nameOk(f.name, n, plan));
        const byShort = !byFull && plan.names.some((n) => n.short && nameOk(f.name, n, plan));
        if (!byFull && !byShort) {
          const sig = anyTitle && !f._sig && signedName(f.name, plan);
          if (sig) {
            const j = judgeFile({ ...f, name: sig.name, _sig: true }, plan);
            if (j.ok) return { ...j, exact: false, reason: SIGNED, sig: sig.word };
          }
          return { ok: false, reason: anyTitle ? "jiný podtitul" : "název nesedí" };
        }
        if (inColl) {
          const allowed = /* @__PURE__ */ new Set([plan.coll.i, ...plan.names.flatMap((n) => M.nameNumbers(n.text))]);
          const exactYear = plan.year && M.fileYears(f.name).includes(plan.year);
          const infos = plan.names.filter((n) => nameOk(f.name, n, plan)).map((n) => M.partNumberInfo(f.name, n.text)).filter((x) => x && !(x.before && exactYear));
          const nums = infos.map((x) => x.n);
          if (nums.length && !nums.some((n) => allowed.has(n))) return { ok: false, reason: `jiný díl série (${nums[0]})` };
          if (byShort) {
            const own = new Set(plan.names.flatMap((n) => M.nameTokens(n.text)));
            const four = plan.names.filter((n) => n.short && nameOk(f.name, n, plan)).map((n) => {
              const h = M.afterName(f.name, n.text);
              return h && h.rest[0];
            }).find((t) => /^(1\d{3}|20\d\d)$/.test(t || ""));
            if (four && !own.has(four) && !(plan.year && Math.abs(+four - plan.year) <= 1)) {
              return { ok: false, reason: `jiný díl série (${four})` };
            }
          }
        }
        const years = M.fileYears(f.name);
        const yearOk = plan.year && years.some((y) => Math.abs(y - plan.year) <= 1);
        if (plan.year && years.length && !yearOk) return { ok: false, reason: `rok nesedí (${years.join(",")})` };
        if (byShort && !yearOk) return { ok: false, reason: "zkrácený název bez roku" };
        return { ok: true, exact: years.length > 0, reason: byShort ? "zkrácený název + rok" : "název" };
      }
      if (!plan.season || !plan.episode) {
        return plan.names.some((n) => nameOk(f.name, n, plan)) ? { ok: true, exact: false, reason: "název" } : { ok: false, reason: anyTitle ? "jiný podtitul" : "název nesedí" };
      }
      if (plan.year && anyTitle) {
        const ys = M.fileYears(f.name, { noRanges: true });
        const titleYs = M.episodeTitleYears(f.name, new Set(plan.names.flatMap((n) => M.nameTokens(n.text))));
        for (const y of titleYs) {
          const i = ys.indexOf(y);
          if (i !== -1) ys.splice(i, 1);
        }
        if (ys.length && ys.every((y) => y < plan.year - 1)) return { ok: false, reason: `rok nesedí (${ys.join(",")})` };
        const sn = plan.isAnime || f._own ? { others: [] } : sameNameOf(plan);
        const snv = sn.others.length ? sameNameVerdict(f, plan, sn, ys) : null;
        if (snv) {
          if (!ownNameMatch(f, plan, sn)) return snv;
          const j = judgeFile({ ...f, _own: true }, plan);
          return j.ok ? { ...j, exact: false, reason: OWN_NAME } : j;
        }
      }
      return judgeNames(f, plan, anyTitle);
    }
    function sameNameVerdict(f, plan, sn, ys) {
      {
        {
          const hit = plan.names.map((n) => M.afterName(f.name, n.text)).find(Boolean);
          const mark = hit && hit.rest.slice(0, 3).map(markCountry).find((t) => COUNTRY_MARK.has(t));
          const myC = sn.me && sn.me.c;
          if (mark && myC && mark === myC) {
          } else if (mark && myC && sn.others.some((o) => o.c === mark)) {
            return { ok: false, reason: `jiný seriál (${mark.toUpperCase()})` };
          } else {
            const myV = sn.me && sn.me.v;
            const older = sn.others.filter((o) => o.y < plan.year - 1 && (myV === null || myV === void 0 || o.v === null || o.v === void 0 || o.v > myV));
            const newer = sn.others.filter((o) => o.y > plan.year + 1).map((o) => o.y);
            if (older.length && !ys.some((y) => y >= plan.year - 1)) {
              return { ok: false, reason: `bez roku (starší seriál ${older[older.length - 1].y})` };
            }
            if (newer.length) {
              const ours = ys.some((y) => y >= plan.year - 1 && y < newer[0] - 1);
              if (!ours && ys.some((y) => y >= newer[0] - 1)) return { ok: false, reason: `rok nesedí (novější seriál ${newer[0]})` };
            }
          }
        }
      }
      return null;
    }
    var OWN_NAME = "náš název, jiný seriál ho nemá";
    function ownNameMatch(f, plan, sn) {
      if (!sn.others.every((o) => Array.isArray(o.n) && o.n.length)) return false;
      const shared = new Set(sn.others.flatMap((o) => o.n));
      return plan.names.some((n) => !n.short && !shared.has(M.tokens(n.text).join(" ")) && nameOk(f.name, n, plan));
    }
    function judgeNames(f, plan, anyTitle) {
      let reason = anyTitle ? "jiný podtitul" : "název nesedí", seen = null;
      const split = plan.alEpisode && plan.alEpisode < plan.episode;
      for (const n of plan.names) {
        if (!nameOk(f.name, n, plan)) continue;
        const hit = M.afterName(f.name, n.text);
        const seq = hit ? M.sequelSeason(hit.rest) : null;
        const rest = hit ? seq ? hit.rest.slice(1) : hit.rest : void 0;
        const pe = M.parseEpisode(f.name, M.nameTokens(n.text), rest);
        if (pe.episode === null && pe.season === null && hit && hit.start > 0 && (plan.season === 1 || plan.isAnime)) {
          const lead = M.stripLeadingGroups(f.name).match(/^\s*0*(\d{1,3})\s*[.)\-_]/);
          if (lead && +lead[1] > 0) {
            pe.episode = +lead[1];
            pe.explicit = false;
          }
        }
        if (pe.episode === null) {
          reason = "bez čísla dílu";
          continue;
        }
        const y0 = hit && hit.rest[0] && /^(19|20)\d{2}$/.test(hit.rest[0]) ? +hit.rest[0] : null;
        if (y0 && plan.year && (y0 < plan.year - 1 || y0 > plan.year + (plan.season || 1) + 2)) {
          reason = `rok nesedí (${y0})`;
          continue;
        }
        if (pe.season === null && seq) pe.season = seq;
        if (n.seasonOnly && pe.season !== n.seasonOnly) {
          if (!seen) reason = pe.season === null ? "bez značky sezóny" : `jiná sezóna (S${pe.season})`;
          continue;
        }
        seen = pe;
        if (n.kind === "franchise") {
          if (pe.episode === plan.episode && (pe.season === plan.season || pe.season === null && plan.season === 1)) {
            return { ok: true, exact: pe.explicit, reason: `název (${n.kind})`, s: pe.season, e: pe.episode };
          }
          if (plan.isAnime && pe.season === null && plan.alEpisode && plan.alEpisode !== plan.episode && pe.episode === plan.alEpisode && (!split || hasPartMarker(n))) {
            return { ok: true, exact: false, reason: "absolutní číslo dílu", s: null, e: pe.episode };
          }
        } else if (plan.alEpisode) {
          let epOk;
          if (split && pe.explicit && pe.season === plan.season && !(pe.season === 1 && seasonInName(n))) {
            epOk = pe.episode === plan.episode;
          } else if (split && pe.season === null) {
            epOk = pe.episode === plan.alEpisode && hasPartMarker(n);
          } else {
            epOk = pe.episode === plan.alEpisode && animeSeasonOk(pe, n, plan);
          }
          if (epOk) return { ok: true, exact: pe.explicit, reason: `název (${n.kind})`, s: pe.season, e: pe.episode };
        }
        reason = pe.season !== null && pe.season !== plan.season && pe.episode === plan.episode ? `jiná sezóna (S${pe.season})` : `jiný díl (${pe.season !== null ? "S" + pe.season : ""}E${pe.episode})`;
      }
      if (reason === "název nesedí" && !f._fixed) {
        const fx = M.repairName(
          f.name,
          plan.names.map((n) => n.text),
          plan.season,
          plan.episode,
          { anime: plan.isAnime, alEpisode: plan.alEpisode }
        );
        if (fx) {
          const j = judgeFile({ ...f, name: fx.text, _fixed: true }, plan);
          if (j.ok) return { ...j, exact: false, reason: `zkomolený název (${fx.how})` };
          return { ...j, reason: `${j.reason} [zkomolený]` };
        }
      }
      return { ok: false, reason, s: seen ? seen.season : void 0, e: seen ? seen.episode : void 0 };
    }
    function filterFiles(files, plan) {
      const out = [];
      const older = /* @__PURE__ */ new Map();
      out.rejected = [];
      for (const f of files) {
        const j = judgeFile(f, plan);
        if (j.ok) out.push({ f, exact: !!j.exact, why: j.reason });
        else {
          countOlderNamesake(older, j.reason, plan);
          if (/^(bez roku \(starší seriál|rok nesedí)/.test(j.reason)) out.rejected.push({ f, why: j.reason });
        }
      }
      plan.olderSame = olderSameOf(older);
      return out;
    }
    function countOlderNamesake(map, reason, plan) {
      if (plan.type !== "movie" || !plan.year) return;
      const m = /^rok nesedí \((\d{4})/.exec(reason || "");
      if (m && +m[1] < plan.year - 1) map.set(+m[1], (map.get(+m[1]) || 0) + 1);
    }
    function olderSameOf(map) {
      return map.size ? Math.max(...map.values()) : 0;
    }
    function olderSameFromReasons(reasons, plan) {
      const m = /* @__PURE__ */ new Map();
      for (const r of reasons) countOlderNamesake(m, r, plan);
      return olderSameOf(m);
    }
    var CZ_CODES = /* @__PURE__ */ new Set(["CZE", "CES", "CZ", "CS"]);
    var SK_CODES = /* @__PURE__ */ new Set(["SLO", "SLK", "SK"]);
    var CONV_SCORE = { 2160: 4, 1440: 3.5, 1080: 3, 720: 2, 576: 1.5, 480: 1, 360: 0.5 };
    function describe(f, info, conv) {
      const lang = M.detectLang(f.name);
      const q = M.detectQuality(f.name);
      if (f.hs) {
        const subs = info && info.subs || [];
        if (subs.includes("cze") && !lang.cz) {
          lang.cz = true;
          if (!lang.dub) lang.sub = true;
        } else if (subs.includes("slo") && !lang.cz && !lang.sk) {
          lang.sk = true;
          if (!lang.dub) lang.sub = true;
        }
        if (conv && conv !== "0" && !q.cam) {
          const h = parseInt(conv, 10);
          q.resolution = h >= 2e3 ? "4K" : `${h}p`;
          q.score = CONV_SCORE[h] ?? (h >= 1e3 ? 3 : h >= 700 ? 2 : 1);
        }
        q.codec = null;
        q.audio = null;
        q.hdr = false;
        const langs2 = info && info.au ? [...new Set(info.au.map((a) => a.lang).filter((l) => l && l !== "UND"))] : [];
        let ls2 = M.langScore(lang);
        if (langs2.length) {
          const aCz = langs2.some((l) => CZ_CODES.has(l)), aSk = langs2.some((l) => SK_CODES.has(l));
          ls2 = aCz ? 50 : aSk ? 35 : lang.cz ? 30 : lang.sk ? 20 : lang.multi ? 5 : 0;
        }
        return { lang, q, ls: ls2, audioLangs: langs2, subLangs: subs };
      }
      const langs = info && info.au ? [...new Set(info.au.map((a) => a.lang).filter((l) => l && l !== "UND"))] : [];
      let ls;
      if (langs.length) {
        const aCz = langs.some((l) => CZ_CODES.has(l)), aSk = langs.some((l) => SK_CODES.has(l));
        ls = aCz ? 50 : aSk ? 35 : lang.cz ? 30 : lang.sk ? 20 : lang.multi ? 5 : 0;
      } else {
        ls = M.langScore(lang);
      }
      if (f.fs && f.res && !q.cam) {
        q.resolution = f.res;
        q.score = FS_RES_SCORE[f.res];
      }
      if (info && info.w) {
        const w = info.w, h = info.h;
        const res = w >= 3200 || h >= 2e3 ? ["4K", 4] : w >= 1800 || h >= 1e3 ? ["1080p", 3] : w >= 1200 || h >= 700 ? ["720p", 2] : ["SD", 1];
        if (!q.cam) {
          q.resolution = res[0];
          q.score = res[1];
        }
      }
      if (info && info.vf) {
        const vf = info.vf;
        q.codec = /HEVC|H265|X265/.test(vf) ? "HEVC" : /H264|AVC|X264/.test(vf) ? "H.264" : /AV1/.test(vf) ? "AV1" : q.codec;
      }
      if (info && info.au && info.au.length) {
        const a = info.au[0];
        const fmt = /TRUEHD/.test(a.f) ? "TrueHD" : /DTS/.test(a.f) ? "DTS" : /EAC3|E-AC-3/.test(a.f) ? "DD+" : /AC3|AC-3/.test(a.f) ? "AC3" : /AAC/.test(a.f) ? "AAC" : /OPUS/.test(a.f) ? "Opus" : /MP3|MPEG/.test(a.f) ? "MP3" : null;
        if (fmt) q.audio = fmt + (a.ch >= 6 ? ` ${a.ch === 8 ? "7.1" : "5.1"}` : a.ch === 2 ? " 2.0" : "");
      }
      return { lang, q, ls, audioLangs: langs };
    }
    function rankFiles(items) {
      return items.map((it) => ({ ...it, ...describe(it.f, it.info, it.conv) })).sort(
        (a, b) => (a.q.cam ? 1 : 0) - (b.q.cam ? 1 : 0) || b.ls - a.ls || b.q.score - a.q.score || srcRank(a.f) - srcRank(b.f) || // při stejné kvalitě Webshare (originál, ověřený zvuk)
        (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || b.f.size - a.f.size
      );
    }
    function durationMismatch(plan, it) {
      if (plan.type === "series") {
        if (!plan.epRuntime || !it.info || !it.info.len) return null;
        const min2 = it.info.len / 60, rt2 = plan.epRuntime;
        if (min2 >= rt2 * 0.6 && min2 <= rt2 * 1.2 || min2 >= rt2 * 1.8 && min2 <= rt2 * 2.2) return null;
        return `délka nesedí (${Math.round(min2)} min, díl ${rt2} min)`;
      }
      if (plan.type !== "movie" || !plan.runtime || !it.info || !it.info.len) return null;
      const min = it.info.len / 60, rt = plan.runtime;
      const extended = /extended|director|uncut|unrated|prodlou|rozsir|special.?edition/i.test(M.normalize(it.f.name));
      const lo = rt * 0.8, hi = rt * (extended ? 1.45 : 1.15);
      if (min >= lo && min <= hi) return null;
      return `délka nesedí (${Math.round(min)} min, film ${rt} min)`;
    }
    var NAMESAKE_MIN = 3;
    var PAL = [25 / 23.976, 23.976 / 25];
    var median = (a) => {
      const s = [...a].sort((x, y) => x - y);
      const i = s.length >> 1;
      return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
    };
    var near = (a, b, tol) => Math.abs(a - b) <= b * tol;
    function numberAfterName(name, plan) {
      for (const n of plan.names) {
        const hit = M.afterName(name, n.text);
        if (hit && /^\d{1,3}$/.test(hit.rest[0] || "")) return +hit.rest[0];
      }
      return null;
    }
    function durationFilter(plan, items, now = /* @__PURE__ */ new Date()) {
      const bad = /* @__PURE__ */ new Map();
      const lenOf = (it) => it.info && it.info.len || null;
      const why = (it) => it.why !== void 0 ? it.why : judgeFile(it.f, plan).reason;
      const live = () => items.filter((it) => !bad.has(it.f.ident));
      for (const it of items) {
        const r = durationMismatch(plan, it);
        if (r) bad.set(it.f.ident, r);
      }
      if (plan.type === "series" && plan.epRuntime && bad.size) {
        const withLen = items.filter(lenOf);
        if (withLen.length && withLen.every((it) => bad.has(it.f.ident))) {
          const lens = withLen.map((it) => lenOf(it) / 60);
          const med = median(lens);
          const close = lens.filter((l) => Math.abs(l - med) <= med * 0.03).length;
          if (close >= 3 && med <= plan.epRuntime * 2 && med >= plan.epRuntime / 2) bad.clear();
        }
      }
      if (plan.type === "movie") {
        if (plan.year && plan.year >= now.getUTCFullYear() - 1 && (plan.olderSame || 0) >= NAMESAKE_MIN) {
          const ours = live().filter((it) => lenOf(it) && M.fileYears(it.f.name).includes(plan.year)).map(lenOf);
          const ref2 = ours.length >= 2 ? median(ours) : plan.runtime ? plan.runtime * 60 : null;
          for (const it of live()) {
            const ys = M.fileYears(it.f.name), len = lenOf(it);
            if (!ys.length) {
              const sameAsOurs = len && ours.length >= 2 && ours.some((l) => near(len, l, 0.01));
              if (!sameAsOurs && (!ref2 || !len || !near(len, ref2, 0.02))) {
                bad.set(it.f.ident, `bez roku (starší film stejného jména${len ? `, ${Math.round(len / 60)} min` : ""})`);
              }
            } else if (!ys.includes(plan.year) && ref2 && len) {
              if (!near(len, ref2, 0.03) && !PAL.some((q) => near(len / ref2, q, 0.01))) {
                bad.set(it.f.ident, `rok ±1, jiná délka (starší film stejného jména, ${Math.round(len / 60)} min)`);
              }
            }
          }
        }
        const ref = plan.runtime ? plan.runtime * 60 : null;
        for (const it of live()) {
          if (why(it) !== SIGNED) continue;
          const len = lenOf(it);
          if (!ref || !len || !(near(len, ref, 0.03) || PAL.some((q) => near(len / ref, q, 0.01)))) {
            bad.set(it.f.ident, `podpis uploadera, délka nesedí${len ? ` (${Math.round(len / 60)} min)` : " (bez délky)"}`);
          }
        }
        const nums = new Map(live().map((it) => [it.f.ident, numberAfterName(it.f.name, plan)]).filter((x) => x[1] !== null));
        if (new Set(nums.values()).size >= 3) for (const id of nums.keys()) bad.set(id, "vypadá jako díl seriálu");
        if ((plan.olderSame || 0) > 0 && !plan.coll && !plan.hasColl) {
          const allowed = new Set(plan.names.flatMap((n) => M.nameNumbers(n.text)));
          for (const it of live()) {
            if (M.fileYears(it.f.name).length) continue;
            const x = plan.names.map((n) => M.partNumberInfo(it.f.name, n.text)).find((v) => v && !v.before);
            if (x && x.n >= 1 && x.n <= 9 && !allowed.has(x.n)) bad.set(it.f.ident, `bez roku s číslem za názvem (${x.n})`);
          }
        }
      }
      if (plan.type === "series") {
        for (const it of live()) {
          if (why(it) !== OWN_NAME) continue;
          const len = lenOf(it), r = M.episodeRange(it.f.name);
          const ref = plan.epRuntime ? plan.epRuntime * 60 * (r ? r.to - r.from + 1 : 1) : null;
          if (!ref || !len || !near(len, ref, 0.15)) {
            bad.set(it.f.ident, `náš název, délka nesedí${len ? ` (${Math.round(len / 60)} min, díl ${plan.epRuntime || "?"} min)` : " (bez délky)"}`);
          }
        }
        const typo = live().filter((it) => lenOf(it) && why(it) === "zkomolený název (překlep)");
        if (typo.length) {
          const exact = live().filter((it) => lenOf(it) && !/^zkomolen/.test(why(it))).map(lenOf);
          const ref = exact.length ? median(exact) : plan.epRuntime ? plan.epRuntime * 60 : null;
          for (const it of typo) {
            if (ref && !near(lenOf(it), ref, 0.15)) bad.set(it.f.ident, `zkomolený název, délka nesedí (${Math.round(lenOf(it) / 60)} min)`);
          }
        }
        if (plan.year && !plan.isAnime && sameNameOf(plan).others.length) {
          const ours = live().filter((it) => lenOf(it) && M.fileYears(it.f.name).includes(plan.year)).map(lenOf);
          if (ours.length >= 2) {
            for (const it of live()) {
              const ys = M.fileYears(it.f.name), len = lenOf(it);
              if (!len || ys.includes(plan.year) || !ys.some((y) => Math.abs(y - plan.year) === 1)) continue;
              if (!ours.some((l) => near(len, l, 0.03))) bad.set(it.f.ident, `rok ±1, jiná délka (jiný seriál stejného jména, ${Math.round(len / 60)} min)`);
            }
          }
          const withLen = live().filter(lenOf);
          if (withLen.length >= 5) {
            const isOurs = (it) => M.fileYears(it.f.name).includes(plan.year);
            const oursLen = withLen.filter(isOurs).map(lenOf);
            const anchored = oursLen.length >= 2;
            const ref = median(anchored ? oursLen : withLen.map(lenOf));
            const odd = withLen.filter((it) => !isOurs(it) && !near(lenOf(it), ref, 0.15) && !M.episodeRange(it.f.name));
            if (anchored || odd.length <= withLen.length / 3) {
              for (const it of odd) {
                bad.set(it.f.ident, `délka nesedí na náš seriál (${Math.round(lenOf(it) / 60)} min, díl ${Math.round(ref / 60)} min)`);
              }
            }
          }
        }
      }
      return bad;
    }
    function rescueOlderSeries(plan, items, rejected) {
      if (plan.type !== "series" || !plan.year || !plan.season || !plan.episode || plan.isAnime) return [];
      const lenOf = (it) => it.info && it.info.len || null;
      const older = new Set(sameNameOf(plan).others.filter((o) => o.y < plan.year - 1).map((o) => o.y));
      if (!older.size) return [];
      const ep = new RegExp(`\\bs0*${plan.season} ?e0*${plan.episode}\\b|\\b0*${plan.season}x0*${plan.episode}\\b`);
      const sameEp = (it) => ep.test(M.normalize(it.f.name));
      const ownOk = (it) => it.why === OWN_NAME && plan.epRuntime && near(lenOf(it), plan.epRuntime * 60, 0.15);
      const ours = items.filter((it) => lenOf(it) && (M.fileYears(it.f.name).includes(plan.year) || ownOk(it))).map(lenOf);
      if (!ours.length) return [];
      const plain = { ...plan, sameName: null };
      const cand = rejected.filter((it) => /^bez roku \(starší seriál/.test(it.why || "") && lenOf(it));
      const clean = new Map(cand.map((it) => [it, judgeFile(it.f, plain).ok]));
      let refs = [...items, ...rejected].filter((it) => lenOf(it) && M.fileYears(it.f.name).some((y) => older.has(y)) && sameEp(it)).map(lenOf);
      let tol = 0.02;
      if (!refs.length) {
        refs = cand.filter((it) => clean.get(it) && sameEp(it) && ours.every((l) => !near(lenOf(it), l, 0.1))).map(lenOf);
        tol = 0.01;
      }
      if (!refs.length) return [];
      return cand.filter((it) => clean.get(it) && ours.some((l) => near(lenOf(it), l, tol)) && !refs.some((l) => near(lenOf(it), l, 0.02))).map((it) => ({ ...it, exact: false, why: RESCUED }));
    }
    var RESCUED = "bez roku, délka sedí na náš seriál";
    var fileCache = new PersistentCache("files", 2e5);
    _setInterval(() => fileCache.save(), 2 * 60 * 1e3).unref();
    async function fetchFileInfo(cfg, ident) {
      const r = await withToken(cfg, (t) => wsFileInfo(t, ident));
      if (r.info) {
        const i = r.info;
        const rec = { ok: i.ok, len: i.len, w: i.w, h: i.h, vf: i.vf, au: i.au };
        fileCache.set(ident, rec, (i.ok ? 7 : 30) * 24 * H);
        return rec;
      }
      if (r.missing) {
        const rec = { ok: false };
        fileCache.set(ident, rec, 30 * 24 * H);
        return rec;
      }
      return null;
    }
    async function enrichFiles(cfg, items, deadlineMs = 1500) {
      if (!hasWs(cfg)) return true;
      const todo = items.filter((it) => isWs(it.f)).map((it) => it.f.ident).filter((id) => fileCache.get(id) === void 0);
      if (!todo.length) return true;
      let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          const id = todo[i++];
          try {
            await once(`fi:${id}`, () => fetchFileInfo(cfg, id));
          } catch (e) {
            dbg(`file_info ${id}: ${e.message}`);
          }
        }
      };
      const all = Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker));
      const timedOut = await Promise.race([all.then(() => false), new Promise((r) => _setTimeout(() => r(true), deadlineMs).unref())]);
      return !timedOut;
    }
    async function fetchHsMeta(f) {
      const d = await hsDetail(f.id, f.hash);
      const rec = hsMeta(d);
      fileCache.set(f.ident, rec, (rec.ok ? 3 : 7) * 24 * H);
      return rec;
    }
    async function enrichHellspy(items, deadlineMs = 1500) {
      const todo = items.filter((it) => it.f.hs && fileCache.get(it.f.ident) === void 0).map((it) => it.f);
      if (!todo.length) return true;
      let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          const f = todo[i++];
          try {
            await fetchHsMeta(f);
          } catch (e) {
            dbg(`hellspy detail ${f.id}: ${e.message}`);
          }
        }
      };
      const all = Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));
      const timedOut = await Promise.race([all.then(() => false), new Promise((r) => _setTimeout(() => r(true), deadlineMs).unref())]);
      return !timedOut;
    }
    function expandHellspy(items) {
      const out = [];
      for (const it of items) {
        if (!it.f.hs) {
          out.push(it);
          continue;
        }
        const conv = it.info && it.info.conv;
        if (conv && conv.length) conv.forEach((c) => out.push({ ...it, conv: c }));
        else out.push({ ...it, conv: null });
      }
      return out;
    }
    var sizeKey = (f) => f.size ? `${srcLetter(f)}:${f.size}` : null;
    function dedupeBySize(items, onlySearchLen, dropped) {
      const seen = /* @__PURE__ */ new Map();
      return items.filter((it) => {
        if (onlySearchLen && !lenFromSearch(it.f)) return true;
        const k = sizeKey(it.f);
        if (!k) return true;
        if (seen.has(k)) {
          if (dropped) dropped.set(it.f.ident, seen.get(k));
          return false;
        }
        seen.set(k, it.f.ident);
        return true;
      });
    }
    function enrichTargets(ranked, n) {
      const per = /* @__PURE__ */ new Map(), out = [];
      let uniq = 0;
      for (const it of ranked) {
        const k = sizeKey(it.f) || it.f.ident;
        const c = per.get(k) || 0;
        if (c >= 2) continue;
        if (c === 0) {
          if (uniq >= n) continue;
          uniq++;
        }
        per.set(k, c + 1);
        out.push(it);
      }
      return out;
    }
    function langProfile(name) {
      const l = M.detectLang(name);
      return `${l.cz ? "cz" : ""}${l.sk ? "sk" : ""}${l.dub ? "D" : l.sub ? "T" : ""}`;
    }
    function dedupeHellspyCopies(items, dropped) {
      const seen = /* @__PURE__ */ new Map();
      return items.filter((it) => {
        if (!it.f.hs || !it.f.len) return true;
        const k = `${it.f.len}|${langProfile(it.f.name)}`;
        if (seen.has(k)) {
          if (dropped) dropped.set(it.f.ident, seen.get(k));
          return false;
        }
        seen.set(k, it.f.ident);
        return true;
      });
    }
    var HS_MAX_FILES = 6;
    function capHellspy(items, max) {
      let n = 0;
      return items.filter((it) => !it.f.hs || ++n <= max);
    }
    function wsAudioBySize(items) {
      const m = /* @__PURE__ */ new Map();
      for (const it of items) {
        if (!isWs(it.f) || !it.f.size) continue;
        const fi = fileCache.get(it.f.ident);
        if (fi && fi.au && fi.au.length && !m.has(it.f.size)) m.set(it.f.size, fi.au);
      }
      return m;
    }
    async function findFiles(type, id, cfg) {
      const src = `${hasWs(cfg) ? "w" : ""}${hsOn(cfg) ? "h" : ""}${hasFs(cfg) ? "f" : ""}`;
      if (!src) return { plan: null, items: [], queries: 0, ms: 0 };
      const key = `res:${type}:${id}:${src}`;
      const hit = resultCache.get(key);
      if (hit) return { ...hit, cached: true };
      return once(key, async () => {
        const t0 = Date.now();
        const plan = await buildPlan(type, id, cfg);
        if (!plan) {
          archiveWrite({ t: (/* @__PURE__ */ new Date()).toISOString(), kind: "stream", type, id, names: [], note: "bez názvů" });
          return { plan: null, items: [], queries: 0, ms: Date.now() - t0 };
        }
        const [w1, w2] = buildQueries(plan);
        const r1 = await runQueries(cfg, w1, { budgetMs: 4e3 });
        const deg = { ...r1.deg };
        const wsAgain = r1.wsFailed || r1.wsTimedOut, hsAgain = r1.hsTimedOut, fsAgain = r1.fsFailed || r1.fsTimedOut;
        if (wsAgain || hsAgain || fsAgain) {
          const failed = r1.wsFailed || r1.fsFailed, slow = r1.wsTimedOut || r1.hsTimedOut || r1.fsTimedOut;
          log(`  🔁 ${[wsAgain && "Webshare", hsAgain && "Hellspy", fsAgain && "Fastshare"].filter(Boolean).join(" + ")}: první vlna ${failed ? "selhala" : "nestihla"} – opakuji`);
          await new Promise((r) => _setTimeout(r, failed && !slow ? 300 : 1e3).unref());
          const rr = await runQueries(cfg, w1, { ws: wsAgain, hs: hsAgain, fs: fsAgain, budgetMs: 2500 });
          for (const [k, v] of rr.files) if (!r1.files.has(k)) r1.files.set(k, v);
          if (wsAgain) {
            deg.wsRetry = rr.wsFailed || rr.wsTimedOut ? "selhalo" : "ok";
            if (!rr.dead.ws) r1.dead.ws = false;
          }
          if (hsAgain) {
            deg.hsRetry = rr.hsTimedOut || rr.dead.hs ? "selhalo" : "ok";
            if (!rr.dead.hs) r1.dead.hs = false;
          }
          if (fsAgain) {
            deg.fsRetry = rr.fsFailed || rr.fsTimedOut || rr.dead.fs ? "selhalo" : "ok";
            if (!rr.dead.fs) r1.dead.fs = false;
          }
        }
        if (plan.sameNameP) {
          plan.sameName = await Promise.race([plan.sameNameP, new Promise((r) => _setTimeout(() => r(null), 1500).unref())]);
          plan.sameNameP = null;
        }
        if (plan.collP) {
          plan.coll = await Promise.race([plan.collP, new Promise((r) => _setTimeout(() => r(null), 1500).unref())]);
          plan.collP = null;
        }
        const files = r1.files;
        let degraded = r1.degraded;
        let items = filterFiles([...files.values()], plan);
        let queries = w1.length;
        const wsFew = hasWs(cfg) && !r1.dead.ws && items.filter((it) => isWs(it.f)).length < 5;
        const hsFew = hsOn(cfg) && !r1.dead.hs && items.filter((it) => it.f.hs).length < 5;
        const fsFew = hasFs(cfg) && !r1.dead.fs && items.filter((it) => it.f.fs).length < 5;
        if ((wsFew || hsFew || fsFew) && w2.length) {
          const r2 = await runQueries(cfg, w2, { ws: wsFew, hs: hsFew, fs: fsFew, budgetMs: 3e3 });
          for (const [k, v] of r2.files) if (!files.has(k)) files.set(k, v);
          for (const [k, v] of Object.entries(r2.deg)) deg[`${k}2`] = v;
          degraded = degraded || r2.degraded;
          items = filterFiles([...files.values()], plan);
          queries += w2.length;
        }
        const dupes = /* @__PURE__ */ new Map();
        let ranked = dedupeHellspyCopies(dedupeBySize(rankFiles(items.map((it) => lenFromSearch(it.f) ? { ...it, info: { len: it.f.len } } : it)), true, dupes), dupes);
        const max = plan.type === "movie" ? 30 : 25;
        const top = enrichTargets(ranked.filter((it) => !it.f.fs), max + 10);
        const [completeWs, completeHs] = await Promise.all([
          enrichFiles(cfg, top),
          hsOn(cfg) ? enrichHellspy(top.filter((it) => it.f.hs).slice(0, 15)) : true
        ]);
        const complete = completeWs && completeHs;
        if (plan.epRuntimeP) {
          plan.epRuntime = await Promise.race([plan.epRuntimeP, new Promise((r) => _setTimeout(() => r(null), 300).unref())]);
          plan.epRuntimeP = null;
        }
        const wsAu = wsAudioBySize(ranked);
        const playable = ranked.map((it) => {
          const fi = fileCache.get(it.f.ident);
          if (lenFromSearch(it.f)) return { ...it, info: { ...fi || {}, len: it.f.len, au: wsAu.get(it.f.size) || void 0 } };
          return { ...it, info: fi || it.info };
        }).filter((it) => !it.info || it.info.ok !== false);
        const rejected = (items.rejected || []).map((it) => {
          const fi = lenFromSearch(it.f) ? null : fileCache.get(it.f.ident);
          return { ...it, info: lenFromSearch(it.f) ? { len: it.f.len } : fi || null };
        }).filter((it) => it.info && it.info.len && it.info.ok !== false);
        const rescued = rescueOlderSeries(plan, playable, rejected);
        if (rescued.length) playable.push(...rescued);
        const durationBad = durationFilter(plan, playable);
        ranked = rankFiles(expandHellspy(capHellspy(dedupeBySize(rankFiles(playable.filter((it) => !durationBad.has(it.f.ident))), false, dupes), HS_MAX_FILES)));
        const sendMax = plan.type === "movie" ? 30 : 25;
        if (!degraded && ranked.length) lastFull.set(key, ranked.slice(0, sendMax + 10), 24 * H);
        else if (degraded) {
          const prev = lastFull.get(key);
          if (prev && Math.min(ranked.length, sendMax) < Math.min(prev.length, sendMax) / 3) {
            const k = (it) => `${sizeKey(it.f) || it.f.ident}|${it.conv || ""}`;
            const have = new Set(ranked.map(k));
            const add = prev.filter((it) => !have.has(k(it)));
            if (add.length) {
              ranked = rankFiles([...ranked, ...add]);
              deg.fill = add.length;
              log(`  ♻️ výpadek zdroje – doplněno ${add.length} položek z posledního úplného výsledku`);
            }
          }
        }
        const res = { plan, items: ranked, queries, total: files.size, ms: Date.now() - t0 };
        if (ranked.length) resultCache.set(key, res, (degraded ? 1 : complete ? 30 : 3) * 60 * 1e3);
        archiveSearch(
          plan,
          [...w1, ...queries > w1.length ? w2 : []],
          files,
          ranked,
          res.ms,
          durationBad,
          src,
          dupes,
          deg,
          new Set(rescued.map((it) => it.f.ident))
        );
        return res;
      });
    }
    function archiveSearch(plan, queries, files, ranked, ms, durationBad, src, dupes, deg, rescued) {
      if (!hooks.archiveOn()) return;
      const sent = /* @__PURE__ */ new Map();
      ranked.slice(0, plan.type === "movie" ? 30 : 25).forEach((it, i) => {
        if (!sent.has(it.f.ident)) sent.set(it.f.ident, i + 1);
      });
      archiveWrite({
        t: (/* @__PURE__ */ new Date()).toISOString(),
        kind: "stream",
        v: hooks.version,
        src,
        type: plan.type,
        id: plan.id,
        anime: plan.anilistId || null,
        source: plan.source,
        year: plan.year,
        runtime: plan.runtime,
        epRuntime: plan.epRuntime || void 0,
        sameName: plan.sameName && plan.sameName.length ? plan.sameName : void 0,
        coll: plan.coll || void 0,
        olderSame: plan.olderSame || void 0,
        deg: deg && Object.keys(deg).length ? deg : void 0,
        season: plan.season,
        episode: plan.episode,
        alEpisode: plan.alEpisode,
        alSeason: plan.alSeason,
        names: plan.names.map((n) => ({ text: n.text, kind: n.kind, short: !!n.short, ...n.seasonOnly ? { seasonOnly: n.seasonOnly } : {} })),
        queries: queries.map((q) => q.q),
        ms,
        files: [...files.values()].map((f) => {
          let j = judgeFile(f, plan);
          if (!j.ok && rescued && rescued.has(f.ident)) j = { ok: true, reason: RESCUED };
          const rec = { n: f.name, s: f.size, ok: j.ok, r: j.reason };
          if (!isWs(f)) rec.src = f.hs ? "hs" : "fs";
          if (dupes && dupes.has(f.ident)) rec.dup = 1;
          if (j.ok && durationBad) {
            let id = f.ident;
            for (let i = 0; i < 4 && !durationBad.has(id) && dupes && dupes.has(id); i++) id = dupes.get(id);
            if (durationBad.has(id)) {
              rec.ok = false;
              rec.r = durationBad.get(id);
            }
          }
          const fi = fileCache.get(f.ident);
          if (lenFromSearch(f)) {
            if (f.len) rec.len = f.len;
            if (f.fs && f.resRaw) rec.res = f.resRaw;
            if (fi) {
              rec.av = fi.ok;
              if (fi.conv) rec.conv = fi.conv;
              if (fi.subs && fi.subs.length) rec.subs = fi.subs;
            }
          } else if (fi) {
            rec.av = fi.ok;
            if (fi.au && fi.au.length) rec.au = fi.au.map((x) => x.lang || "?");
            if (fi.len) rec.len = fi.len;
            if (fi.w) rec.res = `${fi.w}x${fi.h}`;
          }
          if (j.e !== void 0 && j.e !== null) rec.se = [j.s ?? null, j.e];
          if (sent.has(f.ident)) rec.sent = sent.get(f.ident);
          return rec;
        })
      });
    }
    function formatSize(bytes) {
      if (!bytes) return "?";
      const u = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
      return `${(bytes / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 0)} ${u[i]}`;
    }
    function langLabel(l) {
      const parts = [];
      if (l.cz) parts.push("🇨🇿 CZ");
      if (l.sk) parts.push("🇸🇰 SK");
      if (l.en) parts.push("🇬🇧 EN");
      if (!parts.length && l.multi) parts.push("🌍 MULTI");
      let s = parts.join(" + ");
      if (s && l.dub) s += " dabing";
      else if (s && l.sub) s += " titulky";
      else if (!s && l.sub) s = "💬 titulky";
      return s;
    }
    function playUrl(base, cfgB64, f) {
      const safe = f.name.replace(/[\/\\?#%]+/g, " ").trim() || "video";
      return `${base}/${cfgB64}/play/${encodeURIComponent(f.ident)}/${encodeURIComponent(safe)}`;
    }
    var FLAGS = {
      CZE: "🇨🇿 CZ",
      CES: "🇨🇿 CZ",
      CZ: "🇨🇿 CZ",
      CS: "🇨🇿 CZ",
      SLO: "🇸🇰 SK",
      SLK: "🇸🇰 SK",
      SK: "🇸🇰 SK",
      ENG: "🇬🇧 EN",
      EN: "🇬🇧 EN",
      GER: "🇩🇪 DE",
      DEU: "🇩🇪 DE",
      FRE: "🇫🇷 FR",
      FRA: "🇫🇷 FR",
      ITA: "🇮🇹 IT",
      SPA: "🇪🇸 ES",
      POL: "🇵🇱 PL",
      HUN: "🇭🇺 HU",
      RUS: "🇷🇺 RU",
      UKR: "🇺🇦 UA",
      JPN: "🇯🇵 JP",
      JAP: "🇯🇵 JP",
      KOR: "🇰🇷 KO",
      CHI: "🇨🇳 ZH",
      ZHO: "🇨🇳 ZH",
      POR: "🇵🇹 PT"
    };
    function audioSubsLabel(item) {
      const { lang, audioLangs } = item;
      const parts = [];
      if (audioLangs && audioLangs.length) {
        parts.push("🔊 " + [...new Set(audioLangs.map((l) => FLAGS[l] || l))].slice(0, 4).join(" · "));
        if (lang.sub) {
          const subs = [
            lang.cz && !audioLangs.some((l) => CZ_CODES.has(l)) ? "CZ" : null,
            lang.sk && !audioLangs.some((l) => SK_CODES.has(l)) ? "SK" : null
          ].filter(Boolean);
          parts.push("💬 " + (subs.length ? subs.join(" · ") : "titulky"));
        } else if (lang.cz && !audioLangs.some((l) => CZ_CODES.has(l))) {
          parts.push("💬 CZ");
        } else if (lang.sk && !audioLangs.some((l) => SK_CODES.has(l))) {
          parts.push("💬 SK");
        }
        return parts.join("  ");
      }
      return langLabel(lang);
    }
    function formatLength(sec) {
      if (!sec) return null;
      const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60);
      return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
    }
    var safeName = (n) => String(n || "").replace(/[\/\\?#%]+/g, " ").trim() || "video";
    function hsToStream(item, base, cfgB64) {
      const { f, lang, q, info, conv } = item;
      const subs = info && info.subs || [];
      const langs = item.audioLangs && item.audioLangs.length ? "🔊 " + [...new Set(item.audioLangs.map((l) => FLAGS[l] || l))].slice(0, 4).join(" · ") : langLabel(M.detectLang(f.name));
      const subLbl = subs.length ? `💬 ${subs.map((l) => ({ cze: "CZ", ces: "CZ", slo: "SK", slk: "SK", eng: "EN" })[l] || l.toUpperCase()).join(" · ")}` : null;
      const meta = [
        info && info.len ? `⏱ ${formatLength(info.len)}` : null,
        conv && conv !== "0" ? "MP4 převod" : null,
        f.size ? `originál ${formatSize(f.size)}` : null
      ].filter(Boolean).join("  ·  ");
      const res = q.cam ? "CAM" : conv ? q.resolution || "SD" : "auto";
      const fname = info && info.fn || `${safeName(f.name)}.mp4`;
      const stream = {
        name: `Hellspy
${res}`,
        title: [f.name, [langs, subLbl].filter(Boolean).join("  "), meta].filter(Boolean).join("\n"),
        url: `${base}/${cfgB64}/hs/play/${encodeURIComponent(f.id)}/${encodeURIComponent(f.hash)}/${conv || "best"}/${encodeURIComponent(safeName(f.name))}.mp4`,
        behaviorHints: { bingeGroup: `hellspy-${res}`, filename: fname }
      };
      if (subs.length) {
        stream.subtitles = subs.map((l, i) => ({
          id: `hs-${f.id}-${i}`,
          lang: l || "und",
          url: `${base}/${cfgB64}/hs/sub/${encodeURIComponent(f.id)}/${encodeURIComponent(f.hash)}/${i}.vtt`
        }));
      }
      return stream;
    }
    function fsPlayUrl(base, cfgB64, f) {
      return `${base}/${cfgB64}/fs/play/${encodeURIComponent(f.id)}/${encodeURIComponent(safeName(f.name))}`;
    }
    function fsToStream(item, base, cfgB64) {
      const { f, lang, q, info } = item;
      const tech = [q.source, q.codec, q.audio, q.hdr ? "HDR" : null].filter(Boolean).join(" · ");
      const meta = [f.size ? `💾 ${formatSize(f.size)}` : null, info && info.len ? `⏱ ${formatLength(info.len)}` : null, tech].filter(Boolean).join("  ·  ");
      return {
        name: `Fastshare
${q.cam ? "CAM" : q.resolution || "SD"}`,
        title: [f.name, audioSubsLabel(item), meta].filter(Boolean).join("\n"),
        url: fsPlayUrl(base, cfgB64, f),
        behaviorHints: {
          bingeGroup: `fastshare-${q.resolution || "sd"}-${lang.cz ? "cz" : lang.sk ? "sk" : "x"}${lang.dub ? "-dub" : ""}`,
          filename: f.name,
          videoSize: f.size || void 0
        }
      };
    }
    function toStream(item, base, cfgB64) {
      if (item.f.hs) return hsToStream(item, base, cfgB64);
      if (item.f.fs) return fsToStream(item, base, cfgB64);
      const { f, lang, q, info } = item;
      const lbl = audioSubsLabel(item);
      const tech = [q.source, q.codec, q.audio, q.hdr ? "HDR" : null].filter(Boolean).join(" · ");
      const star = f.pos >= 3 && f.pos > f.neg * 3 ? " ⭐" : "";
      const meta = [`💾 ${formatSize(f.size)}`, info && info.len ? `⏱ ${formatLength(info.len)}` : null, tech].filter(Boolean).join("  ·  ");
      const lines = [f.name, lbl, meta + star].filter(Boolean);
      return {
        name: `Webshare
${q.cam ? "CAM" : q.resolution || "SD"}`,
        // jen "title" – stremio-core bere title jako alias description; obě pole naráz = odpověď zahozena
        title: lines.join("\n"),
        url: playUrl(base, cfgB64, f),
        behaviorHints: {
          bingeGroup: `webshare-${q.resolution || "sd"}-${lang.cz ? "cz" : lang.sk ? "sk" : "x"}${lang.dub ? "-dub" : ""}`,
          filename: f.name,
          videoSize: f.size || void 0
        }
      };
    }
    async function handleStream(type, id, cfg, base, cfgB64) {
      if (id.startsWith("webshare-")) {
        if (!hasWs(cfg)) return [];
        const ident = id.slice(9);
        const r = await withToken(cfg, (t) => wsFileInfo(t, ident));
        if (!r.info) return [];
        if (r.info.ok === false) return [];
        const item = rankFiles([{ f: r.info, exact: true, info: r.info }])[0];
        return [toStream(item, base, cfgB64)];
      }
      if (id.startsWith("hellspy-")) {
        if (!hsOn(cfg)) return [];
        const hf = await hsFileFromId(id);
        if (!hf) return [];
        return rankFiles(expandHellspy([{ f: hf.f, exact: true, info: hf.info }])).map((it) => toStream(it, base, cfgB64));
      }
      if (id.startsWith("fastshare-")) {
        if (!hasFs(cfg)) return [];
        const f = fsFileFromId(id);
        if (!f) return [];
        return [toStream(rankFiles([{ f, exact: true, info: { len: f.len } }])[0], base, cfgB64)];
      }
      const res = await findFiles(type, id, cfg);
      const max = type === "movie" ? 30 : 25;
      const streams = res.items.slice(0, max).map((it) => toStream(it, base, cfgB64));
      const p = res.plan;
      const nHs = res.items.slice(0, max).filter((it) => it.f.hs).length, nFs = res.items.slice(0, max).filter((it) => it.f.fs).length;
      log(`🎬 ${type} ${id} [${who(cfg)}] ${p ? p.isAnime ? `anime AL${p.anilistId}` : p.source : "bez názvů"}${p ? ` | názvy: ${p.names.map((n) => n.text).join(" / ")}` : ""} | dotazů ${res.queries || 0}, souborů ${res.total || 0}, streamů ${streams.length}${nHs || nFs ? ` (${[nHs && `Hellspy ${nHs}`, nFs && `Fastshare ${nFs}`].filter(Boolean).join(", ")})` : ""}${res.cached ? " (cache)" : ` | ${res.ms} ms`}${res.items.length ? ` | 1.: ${res.items[0].f.name}` : ""}`);
      return streams;
    }
    async function handleCatalog(type, extra, cfg, base) {
      if (cfg.enable_direct_search === false || !hasWs(cfg)) return [];
      const query = (extra.search || "").trim();
      if (!query) return [];
      const r = await withToken(cfg, (t) => wsSearch(t, query, 100));
      r.files = r.files.filter((f) => !M.isNonVideo(f.name));
      const backdrop = `${base}/webshare-backdrop.jpg`;
      log(`🔍 hledat "${query}" [${who(cfg)}] → ${r.files.length}`);
      archiveWrite({
        t: (/* @__PURE__ */ new Date()).toISOString(),
        kind: "catalog",
        q: query,
        count: r.files.length,
        files: r.files.slice(0, 100).map((f) => ({ n: f.name, s: f.size }))
      });
      return r.files.slice(0, 100).map((f) => {
        const q = M.detectQuality(f.name);
        const lbl = langLabel(M.detectLang(f.name));
        return {
          id: `webshare-${f.ident}`,
          type,
          name: f.name,
          poster: f.img || backdrop,
          posterShape: "landscape",
          background: backdrop,
          description: [lbl, q.resolution, formatSize(f.size)].filter(Boolean).join(" · "),
          releaseInfo: [q.resolution, formatSize(f.size)].filter(Boolean).join(" · ")
        };
      });
    }
    async function hsFileFromId(id) {
      const m = String(id).match(/^hellspy-(\d+)-([A-Za-z0-9]+)$/);
      if (!m) return null;
      const d = await hsDetail(m[1], m[2]);
      if (!d) return null;
      const meta = hsMeta(d);
      fileCache.set(`hs:${m[1]}`, meta, (meta.ok ? 3 : 7) * 24 * H);
      if (!meta.ok) return null;
      const f = { hs: true, ident: `hs:${m[1]}`, id: m[1], hash: m[2], name: d.title, size: d.size, len: d.duration, img: d.thumb };
      return { f, d, info: { ...meta, len: d.duration } };
    }
    async function handleCatalogHs(type, extra, cfg, base) {
      if (!hsOn(cfg) || cfg.hellspy_search === false) return [];
      const query = (extra.search || "").trim();
      if (!query) return [];
      let files = (await hsSearch(query, 64)).filter((f) => !M.isNonVideo(f.name));
      const seen = /* @__PURE__ */ new Set();
      files = files.filter((f) => {
        if (!f.size) return true;
        if (seen.has(f.size)) return false;
        seen.add(f.size);
        return true;
      });
      const backdrop = `${base}/webshare-backdrop.jpg`;
      log(`🔍 hellspy hledat "${query}" [${who(cfg)}] → ${files.length}`);
      archiveWrite({
        t: (/* @__PURE__ */ new Date()).toISOString(),
        kind: "catalog",
        src: "hs",
        q: query,
        count: files.length,
        files: files.map((f) => ({ n: f.name, s: f.size, len: f.len }))
      });
      return files.map((f) => {
        const q = M.detectQuality(f.name);
        const lbl = langLabel(M.detectLang(f.name));
        return {
          id: `hellspy-${f.id}-${f.hash}`,
          type,
          name: f.name,
          poster: f.img || backdrop,
          posterShape: "landscape",
          background: f.img || backdrop,
          description: [lbl, q.resolution, f.len ? formatLength(f.len) : null, formatSize(f.size)].filter(Boolean).join(" · "),
          releaseInfo: [f.len ? formatLength(f.len) : null, formatSize(f.size)].filter(Boolean).join(" · ")
        };
      });
    }
    async function handleMetaHs(type, id, cfg, base) {
      if (!hsOn(cfg)) return null;
      const hf = await hsFileFromId(id);
      if (!hf) return null;
      const { f, d, info } = hf;
      const q = M.detectQuality(f.name);
      const lbl = langLabel(M.detectLang(f.name));
      const subNames = { cze: "CZ", ces: "CZ", slo: "SK", slk: "SK", eng: "EN" };
      const backdrop = `${base}/webshare-backdrop.jpg`;
      const desc = [
        `📄 ${d.filename || f.name}`,
        "",
        lbl ? `🗣️ ${lbl}` : null,
        info.conv.length ? `📺 převody MP4: ${info.conv.map((c) => c === "0" ? "originál" : `${c}p`).join(", ")}` : null,
        q.resolution ? `🎞️ originál: ${q.resolution}` : null,
        info.subs.length ? `💬 titulky: ${[...new Set(info.subs.map((l) => subNames[l] || l.toUpperCase()))].join(", ")}` : null,
        f.len ? `⏱ ${formatLength(f.len)}` : null,
        `💾 ${formatSize(f.size)}`
      ].filter((x) => x !== null).join("\n");
      return {
        id,
        type,
        name: f.name,
        poster: f.img || backdrop,
        posterShape: "landscape",
        background: f.img || backdrop,
        description: desc
      };
    }
    function fsFileFromId(id) {
      const m = String(id).match(/^fastshare-(\d+)$/);
      if (!m) return null;
      return fsFiles.get(m[1]) || { fs: true, ident: `fs:${m[1]}`, id: m[1], name: `Fastshare ${m[1]}`, size: 0, len: 0, res: null, img: null, dl: null };
    }
    async function handleCatalogFs(type, extra, cfg, base) {
      if (!hasFs(cfg) || cfg.fastshare_search === false) return [];
      const query = (extra.search || "").trim();
      if (!query) return [];
      let files = (await fsSearch(cfg, query, 200)).filter((f) => !M.isNonVideo(f.name));
      const seen = /* @__PURE__ */ new Set();
      files = files.filter((f) => {
        if (!f.size) return true;
        if (seen.has(f.size)) return false;
        seen.add(f.size);
        return true;
      }).slice(0, 100);
      const backdrop = `${base}/webshare-backdrop.jpg`;
      log(`🔍 fastshare hledat "${query}" [${who(cfg)}] → ${files.length}`);
      archiveWrite({
        t: (/* @__PURE__ */ new Date()).toISOString(),
        kind: "catalog",
        src: "fs",
        q: query,
        count: files.length,
        files: files.map((f) => ({ n: f.name, s: f.size, len: f.len, res: f.resRaw }))
      });
      return files.map((f) => {
        const q = M.detectQuality(f.name);
        const res = f.res || q.resolution;
        const lbl = langLabel(M.detectLang(f.name));
        return {
          id: `fastshare-${f.id}`,
          type,
          name: f.name,
          poster: f.img || backdrop,
          posterShape: "landscape",
          background: f.img || backdrop,
          description: [lbl, res, f.len ? formatLength(f.len) : null, formatSize(f.size)].filter(Boolean).join(" · "),
          releaseInfo: [res, f.len ? formatLength(f.len) : null, formatSize(f.size)].filter(Boolean).join(" · ")
        };
      });
    }
    function handleMetaFs(type, id, cfg, base) {
      if (!hasFs(cfg)) return null;
      const f = fsFileFromId(id);
      if (!f) return null;
      const q = M.detectQuality(f.name);
      const lbl = langLabel(M.detectLang(f.name));
      const backdrop = `${base}/webshare-backdrop.jpg`;
      const desc = [
        `📄 ${f.name}`,
        "",
        lbl ? `🗣️ ${lbl}` : null,
        f.res || q.resolution ? `📺 ${f.res || q.resolution}` : null,
        [q.source, q.codec, q.audio].filter(Boolean).length ? `🎬 ${[q.source, q.codec, q.audio].filter(Boolean).join(" · ")}` : null,
        f.len ? `⏱ ${formatLength(f.len)}` : null,
        f.size ? `💾 ${formatSize(f.size)}` : null
      ].filter((x) => x !== null).join("\n");
      return { id, type, name: f.name, poster: f.img || backdrop, posterShape: "landscape", background: f.img || backdrop, description: desc };
    }
    async function handleMeta(type, id, cfg, base) {
      if (id.startsWith("hellspy-")) return handleMetaHs(type, id, cfg, base);
      if (id.startsWith("fastshare-")) return handleMetaFs(type, id, cfg, base);
      if (!id.startsWith("webshare-") || !hasWs(cfg)) return null;
      const ident = id.slice(9);
      const r = await withToken(cfg, (t) => wsFileInfo(t, ident));
      if (!r.info) return null;
      const f = r.info;
      const q = M.detectQuality(f.name);
      const lbl = langLabel(M.detectLang(f.name));
      const backdrop = `${base}/webshare-backdrop.jpg`;
      const desc = [
        `📄 ${f.name}`,
        "",
        lbl ? `🗣️ ${lbl}` : null,
        q.resolution ? `📺 ${q.resolution}` : null,
        [q.source, q.codec, q.audio].filter(Boolean).length ? `🎬 ${[q.source, q.codec, q.audio].filter(Boolean).join(" · ")}` : null,
        `💾 ${formatSize(f.size)}`,
        `👍 ${f.pos}  👎 ${f.neg}`,
        f.description ? `
📝 ${f.description}` : null
      ].filter((x) => x !== null).join("\n");
      return {
        id,
        type,
        name: f.name,
        poster: f.img || backdrop,
        posterShape: "landscape",
        background: f.img || backdrop,
        description: desc,
        website: `https://webshare.cz/#/file/${ident}`
      };
    }
    module2.exports = {
      dbg,
      log,
      hooks,
      archiveWrite,
      TTLCache,
      H,
      tokenCache,
      linkCache,
      tmdbCache,
      resolveCache,
      saveCaches,
      resultCache,
      lastFull,
      inflight,
      once,
      hasWs,
      hsOn,
      hasFs,
      isWs,
      lenFromSearch,
      srcLetter,
      srcRank,
      FS_API,
      FS_HEADERS,
      fsSessions,
      fsFiles,
      FsError,
      fsGet,
      fsLogin,
      fsSession,
      fsResolution,
      fsFile,
      fsSearch,
      fsPlayLink,
      fsDown,
      fsPlayUrl,
      fsToStream,
      fsFileFromId,
      handleCatalogFs,
      handleMetaFs,
      who,
      userKey,
      WS_HEADERS,
      wsPost,
      WsError,
      wsLogin,
      getToken,
      withToken,
      lockedIdents,
      parseFiles,
      wsSearch,
      wsFileLink,
      IMAGE_FORMATS,
      parseStreams,
      wsFileInfo,
      wsUserData,
      HS_HEADERS,
      hsGet,
      hsDown,
      hsSearch,
      hsDetailCache,
      hsDetail,
      convHeight,
      hsMeta,
      indexerDownUntil,
      resolveIds,
      csfdDownUntil,
      EN_COUNTRY,
      csfdToInfo,
      csfdInfo,
      csfdIdForImdb,
      needsCzName,
      withCsfdCzName,
      tmdbGet,
      tmdbInfoWithKey,
      cinemetaInfo,
      titleInfo,
      seasonRuntimes,
      countryCode,
      sameNameShows,
      collectionParts,
      seasonBase,
      longCut,
      uniqNames,
      buildPlan,
      pad,
      ORD_Q,
      digitVariant,
      fiveOVariant,
      buildQueries,
      runQueries,
      nameOk,
      originalTitleWord,
      animeSeasonOk,
      seasonInName,
      hasPartMarker,
      sameNameOf,
      COUNTRY_MARK,
      markCountry,
      SIGNED,
      SEP,
      SIGNED_RE,
      signedName,
      judgeFile,
      sameNameVerdict,
      OWN_NAME,
      ownNameMatch,
      judgeNames,
      filterFiles,
      countOlderNamesake,
      olderSameOf,
      olderSameFromReasons,
      CZ_CODES,
      SK_CODES,
      CONV_SCORE,
      describe,
      rankFiles,
      durationMismatch,
      NAMESAKE_MIN,
      PAL,
      median,
      near,
      numberAfterName,
      durationFilter,
      rescueOlderSeries,
      RESCUED,
      fileCache,
      fetchFileInfo,
      enrichFiles,
      fetchHsMeta,
      enrichHellspy,
      expandHellspy,
      sizeKey,
      dedupeBySize,
      enrichTargets,
      langProfile,
      dedupeHellspyCopies,
      HS_MAX_FILES,
      capHellspy,
      wsAudioBySize,
      findFiles,
      archiveSearch,
      formatSize,
      langLabel,
      playUrl,
      FLAGS,
      audioSubsLabel,
      formatLength,
      safeName,
      hsToStream,
      toStream,
      handleStream,
      handleCatalog,
      hsFileFromId,
      handleCatalogHs,
      handleMetaHs,
      handleMeta,
      md5crypt,
      PersistentCache,
      M
    };
  }
});

// webshare/src/plugin.js
init_timers();
var E = require_engine();
var VERSION = "1.0.2";
var ENGINE_VERSION = true ? "8.12.0" : "dev";
var ASSETS = "https://raw.githubusercontent.com/david325345/webshare-stremio-docker/main/public";
var ARCHIVE_URL = "https://webshare-stremio.freeddns.org/api/archive";
function onSettings() {
  return [
    {
      type: "info",
      label: `Webshare ${VERSION}`,
      description: "Filmy, seriály a anime z Webshare.cz a Hellspy – české a slovenské názvy, CZ/SK dabing a titulky na prvním místě. Webshare potřebuje účet (přehrávání s VIP), Hellspy je zdarma bez účtu. Hledání a parser jsou stejné jako v addonu Webshare."
    },
    { type: "text", key: "username", label: "Webshare – uživatelské jméno", placeholder: "bez účtu jen Hellspy" },
    { type: "text", key: "password", label: "Webshare – heslo", isPassword: true },
    { type: "toggle", key: "hellspy", label: "Hellspy", defaultValue: true },
    { type: "toggle", key: "ws_search", label: "Katalog „Webshare Hledat“ ve vyhledávání", defaultValue: true },
    { type: "toggle", key: "hs_search", label: "Katalog „Hellspy Hledat“ ve vyhledávání", defaultValue: true },
    { type: "text", key: "tmdb_key", label: "Vlastní TMDB API klíč", placeholder: "nepovinné – jinak se použije klíč z Nuvia" },
    { type: "toggle", key: "archive", label: "Pomoct vylepšit hledání (anonymně)", defaultValue: false },
    {
      type: "info",
      label: "Co se při zapnutí odesílá",
      description: "Po každém hledání se na server addonu Webshare pošle anonymní záznam: co se hledalo (titul, ID, díl) a názvy nalezených souborů s tím, jestli prošly. Bez jména, hesla a jakýchkoli údajů o tobě. Z těchto záznamů se opravuje parser, takže to pomůže vylepšit hledání pro všechny."
    }
  ];
}
function readSettings(raw) {
  const s = raw || typeof SCRAPER_SETTINGS === "object" && SCRAPER_SETTINGS || {};
  const text = (k) => s[k] == null ? "" : String(s[k]).trim();
  const bool = (k, def) => typeof s[k] === "boolean" ? s[k] : s[k] === "true" ? true : s[k] === "false" ? false : def;
  const cfg = {};
  if (text("username") && s.password) {
    cfg.username = text("username");
    cfg.password = String(s.password);
  }
  cfg.hellspy = bool("hellspy", true);
  cfg.enable_direct_search = bool("ws_search", true);
  cfg.hellspy_search = bool("hs_search", true);
  if (text("tmdb_key")) cfg.tmdb_api_key = text("tmdb_key");
  return { cfg, archive: bool("archive", false) };
}
var archiveOn = false;
E.hooks.version = `${ENGINE_VERSION}+nuvio-${VERSION}`;
E.hooks.archiveOn = () => archiveOn;
E.hooks.archive = (rec) => {
  fetch(ARCHIVE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: rec }) }).catch(() => {
  });
};
var OWN_ID = /^(webshare-|hellspy-)/;
var ANIME_ID = /^(kitsu|anilist):\d+/;
function addonId(type, season, episode, ctx) {
  const vid = String(ctx && ctx.videoId || "");
  if (OWN_ID.test(vid) || ANIME_ID.test(vid) || /^csfd:\d+/.test(vid)) return vid;
  let imdb = ctx && ctx.imdbId || (/^tt\d+/.test(vid) ? vid.split(":")[0] : null);
  if (!imdb) return null;
  if (type === "series") {
    const s = season != null ? season : ctx && ctx.season, e = episode != null ? episode : ctx && ctx.episode;
    return s && e ? `${imdb}:${s}:${e}` : null;
  }
  return imdb;
}
function toPluginStream(item, subs) {
  const st2 = E.toStream(item, "", "");
  delete st2.url;
  delete st2.subtitles;
  const f = item.f;
  if (f.hs) {
    st2.resolve = { h: String(f.id), x: String(f.hash), q: item.conv || "best" };
    if (subs && subs.length) {
      st2.subtitles = subs.map((x, i) => ({ id: `hs-${f.id}-${i}`, lang: x.lang || "und", url: x.url }));
    }
  } else {
    st2.resolve = { w: String(f.ident) };
  }
  return st2;
}
async function hellspySubs(items) {
  const out = /* @__PURE__ */ new Map();
  await Promise.all(items.filter((it) => it.f.hs && it.info && it.info.subs && it.info.subs.length).map(async (it) => {
    if (out.has(it.f.id)) return;
    try {
      const d = await E.hsDetail(it.f.id, it.f.hash);
      out.set(it.f.id, d ? d.subs : []);
    } catch (e) {
      out.set(it.f.id, []);
    }
  }));
  return out;
}
async function streamsFor(type, id, cfg) {
  let items;
  if (id.startsWith("webshare-")) {
    if (!E.hasWs(cfg)) return [];
    const r = await E.withToken(cfg, (t) => E.wsFileInfo(t, id.slice(9)));
    if (!r.info || r.info.ok === false) return [];
    items = E.rankFiles([{ f: r.info, exact: true, info: r.info }]);
  } else if (id.startsWith("hellspy-")) {
    if (!E.hsOn(cfg)) return [];
    const hf = await E.hsFileFromId(id);
    if (!hf) return [];
    items = E.rankFiles(E.expandHellspy([{ f: hf.f, exact: true, info: hf.info }]));
  } else {
    const res = await E.findFiles(type, id, cfg);
    items = res.items.slice(0, type === "movie" ? 30 : 25);
    const p = res.plan;
    const nHs = items.filter((it) => it.f.hs).length;
    console.log(`${type} ${id} ${p ? p.isAnime ? `anime AL${p.anilistId}` : p.source : "bez názvů"}${p ? ` | názvy: ${p.names.map((n) => n.text).join(" / ")}` : ""} | dotazů ${res.queries || 0}, souborů ${res.total || 0}, streamů ${items.length}${nHs ? ` (Hellspy ${nHs})` : ""}${res.cached ? " (cache)" : ` | ${res.ms} ms`}`);
  }
  const subs = await hellspySubs(items);
  return items.map((it) => toPluginStream(it, it.f.hs ? subs.get(it.f.id) : null));
}
async function getStreams(tmdbId, mediaType, season, episode, ctx) {
  const { cfg, archive } = readSettings();
  archiveOn = archive;
  if (!E.hasWs(cfg) && !E.hsOn(cfg)) return [];
  const type = mediaType === "movie" ? "movie" : "series";
  const id = addonId(type, season, episode, ctx);
  if (!id) return [];
  return streamsFor(type, id, cfg);
}
async function resolveStream(payload) {
  const { cfg } = readSettings();
  if (payload && payload.w) {
    if (!E.hasWs(cfg)) throw new Error("V nastavení pluginu chybí účet Webshare.");
    const r = await E.withToken(cfg, (t) => E.wsFileLink(t, payload.w));
    if (!r.link) throw new Error("Soubor není dostupný (smazaný, nebo účet bez VIP).");
    return r.link;
  }
  if (payload && payload.h) {
    const d = await E.hsDetail(payload.h, payload.x);
    const keys = d ? Object.keys(d.conv).sort((a, b) => E.convHeight(b) - E.convHeight(a)) : [];
    const link = d && (d.conv[payload.q] || (keys.length ? d.conv[keys[0]] : null));
    if (!link) throw new Error("Soubor na Hellspy není dostupný.");
    return link;
  }
  throw new Error("Neznámý stream.");
}
async function getCatalog(type, id, extra) {
  const { cfg, archive } = readSettings();
  archiveOn = archive;
  const ex = extra || {};
  if (id === "webshare_search") return { metas: await E.handleCatalog(type, ex, cfg, ASSETS) };
  if (id === "hellspy_search") return { metas: await E.handleCatalogHs(type, ex, cfg, ASSETS) };
  return { metas: [] };
}
async function getMeta(type, id) {
  const { cfg } = readSettings();
  return { meta: await E.handleMeta(type, id, cfg, ASSETS) };
}
async function onVerify(raw) {
  const { cfg } = readSettings(raw);
  const parts = [];
  let ok = true;
  if (E.hasWs(cfg)) {
    try {
      const token = await E.wsLogin(cfg.username, cfg.password);
      const ud = await E.wsUserData(token).catch(() => null);
      if (!ud) parts.push("Webshare: přihlášení v pořádku.");
      else if (ud.vip) parts.push(`Webshare: přihlášení v pořádku, VIP ještě ${ud.vipDays} dní.`);
      else parts.push("Webshare: přihlášení v pořádku, ale účet nemá VIP – soubory z Webshare nepůjde přehrát.");
    } catch (e) {
      ok = false;
      parts.push(`Webshare: ${e instanceof E.WsError ? e.message : "neodpovídá, zkus to znovu."}`);
    }
  } else if (cfg.username || cfg.password) {
    ok = false;
    parts.push("Webshare: vyplň jméno i heslo.");
  } else {
    parts.push("Webshare: bez účtu (jen Hellspy).");
  }
  if (E.hsOn(cfg)) {
    try {
      await E.hsSearch("matrix", 1);
      parts.push("Hellspy odpovídá.");
    } catch (e) {
      ok = false;
      parts.push(`Hellspy neodpovídá (${e.message}).`);
    }
  }
  if (!E.hasWs(cfg) && !E.hsOn(cfg)) {
    ok = false;
    parts.push("Zapni Hellspy nebo vyplň účet Webshare.");
  }
  return { ok, message: parts.join(" ") };
}
module.exports = { getStreams, resolveStream, getCatalog, getMeta, onSettings, onVerify, _test: { addonId, readSettings, E } };
