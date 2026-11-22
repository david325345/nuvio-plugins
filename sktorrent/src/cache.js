'use strict';
// Náhrada lib/cache.js addonu SKTorrent pro plugin: stejné rozhraní (TTLCache, createCache, once,
// createPersistentCache), trvalá cache v NUVIO.files místo souborů na disku serveru.
class TTLCache {
    constructor({ ttl, max = 5000 }) { this.ttl = ttl; this.max = max; this.map = new Map(); }
    get(k) {
        const e = this.map.get(k);
        if (!e) return undefined;
        if (Date.now() > e.exp) { this.map.delete(k); return undefined; }
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
    delete(k) { this.map.delete(k); }
    prune() { const n = Date.now(); for (const [k, e] of this.map) if (n > e.exp) this.map.delete(k); }
    get size() { return this.map.size; }
}
function createCache(opts) { return new TTLCache(opts); }

const inflight = new Map();
function once(key, fn) {
    if (inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve().then(fn).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
}

// Trvalá cache v NUVIO.files (jinak localStorage); menší strop než na serveru, ukládá se nejdřív po 15 s
const CAPS = { tmdb: 2000, csfd: 2000, sktdetail: 5000 };
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
    constructor({ name, ttl, max = 50000 }) {
        this.ttl = ttl; this.max = Math.min(max, CAPS[name] || 1000);
        this.file = `cache-${name}.json`; this.map = null; this.dirty = false; this.timer = null;
    }
    load() {
        if (this.map) return this.map;
        this.map = new Map();
        try {
            const now = Date.now();
            for (const [k, e] of Object.entries(JSON.parse(store.read(this.file) || '{}'))) if (e && e.exp > now) this.map.set(k, e);
        } catch (e) { /* poškozený soubor – začínáme prázdní */ }
        return this.map;
    }
    get(k) {
        const map = this.load();
        const e = map.get(k);
        if (!e) return undefined;
        if (Date.now() > e.exp) { map.delete(k); this.dirty = true; return undefined; }
        return e.v;
    }
    set(k, v, ttl = this.ttl) {
        const map = this.load();
        if (map.has(k)) map.delete(k);
        map.set(k, { v, exp: Date.now() + ttl });
        while (map.size > this.max) map.delete(map.keys().next().value);
        this.dirty = true;
        if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.save(); }, 15000);
        return v;
    }
    get size() { return this.load().size; }
    save() {
        if (!this.dirty || !this.map) return;
        try { store.write(this.file, JSON.stringify(Object.fromEntries(this.map))); this.dirty = false; }
        catch (e) {
            this.map = new Map([...this.map].slice(Math.floor(this.map.size / 2)));
            try { store.write(this.file, JSON.stringify(Object.fromEntries(this.map))); this.dirty = false; } catch (e2) { /* jen v paměti */ }
        }
    }
}
function createPersistentCache(opts) { return new PersistentCache(opts); }

module.exports = { TTLCache, createCache, once, createPersistentCache };
