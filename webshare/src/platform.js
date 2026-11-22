'use strict';
// Platforma jádra addonu Webshare (lib/engine.js) v pluginu pro Nuvio na Apple TV:
// veřejné adresy služeb, mezipaměť v NUVIO.files (jinak localStorage), MD5-crypt v čistém JS
// a Hellspy napřímo z televize (česká IP, proxy není potřeba).
const { md5crypt, sha1hex } = require('../../shared/hash');

const settings = () => (typeof SCRAPER_SETTINGS === 'object' && SCRAPER_SETTINGS) || {};
const nuvioTmdbKey = () => (typeof TMDB_API_KEY === 'string' ? TMDB_API_KEY.trim() : '');

const config = {
    INDEXER_URL: 'https://indexer.ddnsfree.com',      // NimeToDex indexer (resolve-ids pro anime)
    INDEXER_FALLBACK_URL: '',
    CSFD_ON: true,
    CSFD_URL: 'https://csfd-rating.duckdns.org',      // csfd-ratings (české názvy, tituly jen na ČSFD)
    CSFD_FALLBACK_URL: '',
    TMDB_API_KEY: nuvioTmdbKey(),                     // klíč z Nuvia; vlastní klíč z nastavení má přednost
    DEBUG: false,
    HELLSPY_PROXY: 'direct',
    HELLSPY_ON: true,
    HELLSPY_API: 'https://api.hellspy.to/gw',
    HTTP: { open_timeout: 4000, response_timeout: 8000, read_timeout: 12000 }
};

const log = (...a) => console.log(...a);
const dbg = () => {};

// ---- trvalá mezipaměť: soubor v NUVIO.files (až 50 MB), jinak localStorage ----
const H = 3600 * 1000;
const STALE_MS = 60 * 24 * H;
const CAPS = { tmdb: 2000, resolve: 2000, files: 8000 };
const store = {
    read(name) {
        try {
            if (typeof NUVIO === 'object' && NUVIO && NUVIO.files) return NUVIO.files.read(name);
            return typeof localStorage === 'object' ? localStorage.getItem(name) : null;
        } catch (e) { return null; }
    },
    write(name, text) {
        if (typeof NUVIO === 'object' && NUVIO && NUVIO.files) NUVIO.files.write(name, text);
        else if (typeof localStorage === 'object') localStorage.setItem(name, text);
    }
};

class PersistentCache {
    constructor(name, max = 50000) {
        this.name = `cache-${name}.json`;
        this.max = Math.min(max, CAPS[name] || 1000);
        this.map = null; this.dirty = false; this.timer = null;
    }
    load() {
        if (this.map) return this.map;
        this.map = new Map();
        try {
            const raw = JSON.parse(store.read(this.name) || '{}');
            const now = Date.now();
            for (const [k, e] of Object.entries(raw)) if (e && e.e + STALE_MS > now) this.map.set(k, e);
        } catch (e) { /* poškozený soubor – začínáme prázdní */ }
        return this.map;
    }
    get(key) { const e = this.load().get(key); return e && e.e > Date.now() ? e.v : undefined; }
    getStale(key) { const e = this.load().get(key); return e ? e.v : undefined; }
    set(key, val, ttlMs) {
        const map = this.load();
        if (map.size >= this.max) map.delete(map.keys().next().value);
        map.delete(key);
        map.set(key, { v: val, e: Date.now() + ttlMs });
        this.dirty = true;
        // uložit nejdřív po 15 s (víc zápisů z jednoho hledání = jedno uložení)
        if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.save(); }, 15000);
    }
    save() {
        if (!this.dirty || !this.map) return;
        try {
            store.write(this.name, JSON.stringify(Object.fromEntries(this.map)));
            this.dirty = false;
        } catch (e) {
            // plné úložiště → zahodit starší polovinu a zkusit znovu
            this.map = new Map([...this.map].slice(Math.floor(this.map.size / 2)));
            try { store.write(this.name, JSON.stringify(Object.fromEntries(this.map))); this.dirty = false; } catch (e2) { /* jen v paměti */ }
        }
    }
}

// Hellspy API pouští jen české a slovenské IP – z televize doma to jde napřímo
async function hsRequest(url, headers) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const resp = await fetch(url, { headers, signal: ctrl.signal });
        if (!resp.status) throw new Error(resp.statusText || 'Hellspy neodpovídá');
        return { status: resp.status, text: await resp.text() };
    } catch (e) {
        throw new Error(e && e.name === 'AbortError' ? 'Hellspy neodpovídá' : String((e && e.message) || e));
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { config, log, dbg, PersistentCache, md5crypt, sha1hex, hsRequest, settings, CACHE_DIR: 'NUVIO.files' };
