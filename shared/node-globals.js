// Globální věci, které kód addonů čeká jako v Node (vkládá je esbuild místo globálů, build.mjs → inject):
// process.env (adresy služeb z buildu), FormData a setImmediate.
import FormDataShim from './formdata.js';

const env = typeof __PLUGIN_ENV__ === 'string' ? JSON.parse(__PLUGIN_ENV__) : {};
const _process = { env, on() { return _process; }, once() { return _process; }, exit() {}, platform: 'tvos', versions: {} };
const _setImmediate = (fn, ...args) => setTimeout(() => fn(...args), 0);

export { _process as process, FormDataShim as FormData, _setImmediate as setImmediate };
