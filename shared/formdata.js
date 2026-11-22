'use strict';
// FormData pro pluginy (Nuvio ho v pluginech nemá): jen textová pole, odeslání jako multipart/form-data
// přes shared/axios.js. V buildu se vkládá místo globálního FormData (shared/globals.js).
class FormData {
    constructor() { this._fields = []; }
    append(name, value) { this._fields.push([String(name), String(value)]); }
    set(name, value) { this._fields = this._fields.filter(([n]) => n !== String(name)); this.append(name, value); }
    get(name) { const f = this._fields.find(([n]) => n === String(name)); return f ? f[1] : null; }
    has(name) { return this._fields.some(([n]) => n === String(name)); }
    entries() { return this._fields.slice()[Symbol.iterator](); }
    multipart() {
        const boundary = '----NuvioFormBoundary' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const body = this._fields.map(([n, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${n.replace(/"/g, '%22')}"\r\n\r\n${v}\r\n`).join('') + `--${boundary}--\r\n`;
        return { body, contentType: `multipart/form-data; boundary=${boundary}` };
    }
}
module.exports = FormData;
