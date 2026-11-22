'use strict';
// Náhrada knihovny needle pro plugin: stejné volání jako v jádře addonu (lib/engine.js),
// pod tím fetch z Nuvia. Odpověď { statusCode, headers, body }: JSON a XML se rozparsují
// jako v needle (XML na strom { name, value, attributes, children }).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#') {
            const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : m;
        }
        return ENTITIES[e.toLowerCase()] !== undefined ? ENTITIES[e.toLowerCase()] : m;
    });
}

// Malý XML parser (odpovědi Webshare API): elementy, text, CDATA, komentáře, <?xml?>
function parseXml(xml) {
    const root = { name: '#root', value: '', attributes: {}, children: [] };
    const stack = [root];
    const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/\s*([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(xml))) {
        const top = stack[stack.length - 1];
        if (m[1] !== undefined) top.value += m[1];
        else if (m[2] !== undefined) { if (stack.length > 1) stack.pop(); }
        else if (m[3] !== undefined) {
            const attributes = {};
            const attrRe = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
            let a;
            while ((a = attrRe.exec(m[4] || ''))) attributes[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? '');
            const el = { name: m[3], value: '', attributes, children: [] };
            top.children.push(el);
            if (!m[5]) stack.push(el);
        } else if (m[6] !== undefined) top.value += decode(m[6]);
    }
    const trim = el => { if (el.children.length) el.value = el.value.trim() ? el.value : ''; el.children.forEach(trim); };
    trim(root);
    const first = root.children[0];
    return first || null;
}

function formEncode(obj) {
    return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

async function needle(method, url, data, opts) {
    if (/^(get|head)$/i.test(method) && opts === undefined) { opts = data; data = undefined; }
    opts = opts || {};
    const headers = Object.assign({}, opts.headers);
    let body;
    if (data !== undefined && data !== null) {
        if (typeof data === 'string') body = data;
        else if (opts.json) { body = JSON.stringify(data); headers['Content-Type'] = headers['Content-Type'] || 'application/json'; }
        else { body = formEncode(data); headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded'; }
    }
    const timeout = opts.read_timeout || opts.response_timeout || opts.open_timeout || 15000;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
    let resp;
    try {
        resp = await fetch(url, { method: String(method).toUpperCase(), headers, body, signal: ctrl ? ctrl.signal : undefined });
    } catch (e) {
        throw new Error(e && e.name === 'AbortError' ? `timeout ${timeout} ms` : String((e && e.message) || e));
    } finally {
        if (timer) clearTimeout(timer);
    }
    // Nuvio: síťová chyba = status 0 (needle by ji vyhodil jako výjimku)
    if (!resp.status) throw new Error(resp.statusText || 'síťová chyba');
    const text = await resp.text();
    const type = String((resp.headers && resp.headers.get && resp.headers.get('content-type')) || '').toLowerCase();
    let parsed = text;
    if (opts.parse !== false && opts.parse_response !== false) {
        const t = text.trimStart();
        if (/json/.test(type) || (opts.parse === true && (t[0] === '{' || t[0] === '['))) {
            try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
        } else if (/xml/.test(type) || t.startsWith('<?xml')) {
            parsed = parseXml(text) || text;
        }
    }
    const headersObj = {};
    if (resp.headers && resp.headers.forEach) resp.headers.forEach((v, k) => { headersObj[k] = v; });
    return { statusCode: resp.status, headers: headersObj, body: parsed, raw: text };
}

needle.parseXml = parseXml;
module.exports = needle;
