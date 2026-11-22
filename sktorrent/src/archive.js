'use strict';
// Náhrada lib/archive.js addonu SKTorrent pro plugin: záznam hledání se zapíše jen se zapnutou volbou
// „Pomoct vylepšit hledání“ – pošle se na server addonu (POST /api/archive), který z něj uloží jen známá pole.
const state = { on: false, url: '', version: '' };

function write(rec) {
    if (!state.on || !state.url) return;
    const record = { v: state.version, ...rec };
    // na pozadí, nic na to nečeká
    fetch(state.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record }) }).catch(() => {});
}
const configure = ({ on, url, version }) => { state.on = !!on; state.url = url || ''; state.version = version || ''; };

module.exports = { write, configure, registerRoutes() {}, status: () => (state.on ? 'zapnutý' : 'vypnutý'), listFiles: () => [], adminOk: () => false, ARCHIVE_DIR: '' };
