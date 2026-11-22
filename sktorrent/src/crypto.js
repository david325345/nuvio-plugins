'use strict';
// Náhrada Node crypto pro kód addonu SKTorrent (lib/util.js: keyId = SHA-256 z klíče, jen pro paměť).
const H = require('../../shared/hash');
const DIGEST = { sha256: H.sha256, sha1: H.sha1, md5: H.md5 };
const hex = bytes => bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('');

function createHash(alg) {
    const fn = DIGEST[String(alg).toLowerCase()];
    if (!fn) throw new Error(`Nepodporovaný hash: ${alg}`);
    const parts = [];
    const api = {
        update(data) { parts.push(...(typeof data === 'string' ? H.utf8(data) : Array.from(data))); return api; },
        digest(enc) { const out = fn(parts); return enc === 'hex' ? hex(out) : out; }
    };
    return api;
}
const randomBytes = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a); };
module.exports = { createHash, randomBytes };
