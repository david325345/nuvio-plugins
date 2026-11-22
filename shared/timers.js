// Časovače jako v Node (s .unref()) – jádro addonu je volá tak; v Nuviu vracejí jen číslo.
// esbuild je vkládá místo globálních setTimeout/setInterval v celém balíku (build.mjs, inject).
const st = globalThis.setTimeout, ct = globalThis.clearTimeout;
const si = globalThis.setInterval, ci = globalThis.clearInterval;
const wrap = id => ({ id, unref() { return this; }, ref() { return this; }, hasRef() { return true; } });
const unwrap = t => (t && typeof t === 'object' ? t.id : t);
function _setTimeout(fn, ms, ...args) { return wrap(st(fn, ms, ...args)); }
function _clearTimeout(t) { ct(unwrap(t)); }
function _setInterval(fn, ms, ...args) { return wrap(si(fn, ms, ...args)); }
function _clearInterval(t) { ci(unwrap(t)); }
export { _setTimeout as setTimeout, _clearTimeout as clearTimeout, _setInterval as setInterval, _clearInterval as clearInterval };
