'use strict';
// MD5, SHA-1 a SHA-256 nad bajty (bez CryptoJS a Node crypto) + MD5-crypt ($1$), kterým Webshare solí heslo.
// Výsledky jsou bajt po bajtu stejné jako u Node (crypto.createHash) – ověřuje test/webshare.test.js.

// UTF-8 jako Node: osamocená polovina náhradního páru → U+FFFD
function utf8(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
            const d = str.charCodeAt(i + 1);
            if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
            else c = 0xfffd;
        } else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

const concat = parts => {
    const out = [];
    for (const p of parts) for (let i = 0; i < p.length; i++) out.push(p[i]);
    return out;
};

// ---- MD5 (RFC 1321) ----
const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = [];
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

function md5(bytes) {
    const len = bytes.length;
    const total = (((len + 8) >> 6) + 1) << 6;
    const m = new Uint8Array(total);
    for (let i = 0; i < len; i++) m[i] = bytes[i];
    m[len] = 0x80;
    const bits = len * 8;
    for (let i = 0; i < 8; i++) m[total - 8 + i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const w = new Array(16);
    for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) {
            const j = off + i * 4;
            w[i] = (m[j] | (m[j + 1] << 8) | (m[j + 2] << 16) | (m[j + 3] << 24)) >>> 0;
        }
        let a = a0, b = b0, c = c0, d = d0;
        for (let i = 0; i < 64; i++) {
            let f, g;
            if (i < 16) { f = (b & c) | (~b & d); g = i; }
            else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
            else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
            else { f = c ^ (b | ~d); g = (7 * i) % 16; }
            const tmp = d;
            d = c; c = b;
            const x = (a + f + K[i] + w[g]) >>> 0;
            b = (b + ((x << S[i]) | (x >>> (32 - S[i])))) >>> 0;
            a = tmp;
        }
        a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
    }
    const out = [];
    for (const v of [a0, b0, c0, d0]) out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
    return out;
}

// ---- SHA-1 (FIPS 180-4) ----
function sha1(bytes) {
    const len = bytes.length;
    const total = (((len + 8) >> 6) + 1) << 6;
    const m = new Uint8Array(total);
    for (let i = 0; i < len; i++) m[i] = bytes[i];
    m[len] = 0x80;
    const bits = len * 8;
    for (let i = 0; i < 8; i++) m[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Array(80);
    for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) {
            const j = off + i * 4;
            w[i] = ((m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3]) >>> 0;
        }
        for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = ((x << 1) | (x >>> 31)) >>> 0; }
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let i = 0; i < 80; i++) {
            let f, k;
            if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
            else { f = b ^ c ^ d; k = 0xca62c1d6; }
            const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
            e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = t;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    const out = [];
    for (const v of [h0, h1, h2, h3, h4]) out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    return out;
}

// ---- SHA-256 (FIPS 180-4) ----
const K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
function sha256(bytes) {
    const len = bytes.length;
    const total = (((len + 8) >> 6) + 1) << 6;
    const m = new Uint8Array(total);
    for (let i = 0; i < len; i++) m[i] = bytes[i];
    m[len] = 0x80;
    const bits = len * 8;
    for (let i = 0; i < 8; i++) m[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) {
            const j = off + i * 4;
            w[i] = ((m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3]) >>> 0;
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    const out = [];
    for (const v of h) out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    return out;
}

const hex = bytes => bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('');
const sha256hex = str => hex(sha256(utf8(str)));
const sha1hex = str => hex(sha1(utf8(str)));
const md5hex = str => hex(md5(utf8(str)));

// MD5-crypt (PHP crypt $1$) – stejný postup jako v addonu (lib/platform.js)
function md5crypt(password, salt) {
    salt = salt.replace(/^\$1\$/, '').split('$')[0];
    const magic = '$1$';
    const pw = utf8(password), sl = utf8(salt);
    let final = md5(concat([pw, sl, pw]));
    const ctx = [pw, utf8(magic), sl];
    for (let pl = password.length; pl > 0; pl -= 16) ctx.push(final.slice(0, pl > 16 ? 16 : pl));
    for (let i = password.length; i > 0; i >>= 1) ctx.push(i & 1 ? [0] : utf8(password[0]));
    final = md5(concat(ctx));
    for (let i = 0; i < 1000; i++) {
        const c = [i & 1 ? pw : final];
        if (i % 3) c.push(sl);
        if (i % 7) c.push(pw);
        c.push(i & 1 ? final : pw);
        final = md5(concat(c));
    }
    const itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const enc = (b0, b1, b2, n) => {
        let w = (b0 << 16) | (b1 << 8) | b2, out = '';
        for (let i = 0; i < n; i++) { out += itoa64[w & 0x3f]; w >>= 6; }
        return out;
    };
    return magic + salt + '$' +
        enc(final[0], final[6], final[12], 4) + enc(final[1], final[7], final[13], 4) +
        enc(final[2], final[8], final[14], 4) + enc(final[3], final[9], final[15], 4) +
        enc(final[4], final[10], final[5], 4) + enc(0, 0, final[11], 2);
}

module.exports = { utf8, md5, sha1, sha256, sha1hex, sha256hex, md5hex, md5crypt };
