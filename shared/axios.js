'use strict';
// Náhrada knihovny axios pro pluginy sestavené z kódu addonů: stejné volání (get/post/put/delete,
// create, params, headers, timeout, signal, maxRedirects, validateStatus), pod tím fetch z Nuvia.
// Chyby jako v axios: e.response { status, data, headers }, e.code ECONNABORTED (časový limit)
// a ERR_CANCELED / CanceledError (zrušeno přes signal).
const FormDataShim = require('./formdata');

function axiosError(message, code, extra) {
    const e = new Error(message);
    e.isAxiosError = true;
    e.code = code;
    return Object.assign(e, extra);
}

function buildUrl(url, params) {
    if (!params) return url;
    const pairs = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    if (!pairs.length) return url;
    return url + (url.includes('?') ? '&' : '?') + pairs.join('&');
}

// Set-Cookie spojené čárkou (Apple TV) → pole; čárka v "expires=Wed, 21 Oct…" se nedělí
const splitCookies = v => (Array.isArray(v) ? v : String(v || '').split(/,(?=\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=)/)).map(s => s.trim()).filter(Boolean);

async function request(defaults, config) {
    const cfg = Object.assign({}, defaults, config);
    cfg.headers = Object.assign({}, defaults.headers, config.headers);
    const method = String(cfg.method || 'get').toUpperCase();
    const url = buildUrl(cfg.url, cfg.params);
    const headers = {};
    for (const [k, v] of Object.entries(cfg.headers)) if (v !== undefined && v !== null) headers[k] = String(v);
    const has = name => Object.keys(headers).some(k => k.toLowerCase() === name);
    let body;
    const data = cfg.data;
    if (data !== undefined && data !== null && method !== 'GET' && method !== 'HEAD') {
        if (typeof data === 'string') {
            body = data;
            if (!has('content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else if (data instanceof FormDataShim || (data && typeof data.multipart === 'function')) {
            const mp = data.multipart();
            body = mp.body;
            headers['Content-Type'] = mp.contentType;
        } else if (typeof URLSearchParams === 'function' && data instanceof URLSearchParams) {
            body = data.toString();
            if (!has('content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else {
            body = JSON.stringify(data);
            if (!has('content-type')) headers['Content-Type'] = 'application/json';
        }
    }
    const ctrl = new AbortController();
    let timedOut = false, canceled = false;
    const timer = cfg.timeout ? setTimeout(() => { timedOut = true; ctrl.abort(); }, cfg.timeout) : null;
    const outer = cfg.signal;
    const onAbort = () => { canceled = true; ctrl.abort(); };
    if (outer) { if (outer.aborted) onAbort(); else if (outer.addEventListener) outer.addEventListener('abort', onAbort); }
    let resp, text;
    try {
        resp = await fetch(url, { method, headers, body, signal: ctrl.signal, redirect: cfg.maxRedirects === 0 ? 'manual' : 'follow' });
        text = await resp.text();
    } catch (e) {
        if (timedOut) throw axiosError(`timeout of ${cfg.timeout}ms exceeded`, 'ECONNABORTED', { config: cfg });
        if (canceled) throw axiosError('canceled', 'ERR_CANCELED', { name: 'CanceledError', config: cfg });
        throw axiosError(String((e && e.message) || e), 'ERR_NETWORK', { config: cfg });
    } finally {
        if (timer) clearTimeout(timer);
        if (outer && outer.removeEventListener) outer.removeEventListener('abort', onAbort);
    }
    // Nuvio: síťová chyba = status 0
    if (!resp.status) throw axiosError(resp.statusText || 'Network Error', 'ERR_NETWORK', { config: cfg });
    const headersObj = {};
    if (resp.headers && resp.headers.forEach) resp.headers.forEach((v, k) => { headersObj[String(k).toLowerCase()] = v; });
    if (headersObj['set-cookie'] !== undefined) headersObj['set-cookie'] = splitCookies(headersObj['set-cookie']);
    let parsed = text;
    if (cfg.responseType !== 'text' && typeof text === 'string' && text.length) {
        const t = text.trimStart();
        if (t[0] === '{' || t[0] === '[' || /json/i.test(headersObj['content-type'] || '')) {
            try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
        }
    }
    const response = { data: parsed, status: resp.status, statusText: resp.statusText || '', headers: headersObj, config: cfg, request: {} };
    const valid = cfg.validateStatus === undefined ? (s => s >= 200 && s < 300) : cfg.validateStatus;
    if (valid && !valid(resp.status)) {
        throw axiosError(`Request failed with status code ${resp.status}`, resp.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', { response, config: cfg });
    }
    return response;
}

function create(defaults) {
    const d = Object.assign({ headers: {} }, defaults);
    const instance = config => request(d, config || {});
    instance.request = config => request(d, config || {});
    for (const m of ['get', 'delete', 'head']) instance[m] = (url, config) => request(d, Object.assign({}, config, { url, method: m }));
    for (const m of ['post', 'put', 'patch']) instance[m] = (url, data, config) => request(d, Object.assign({}, config, { url, data, method: m }));
    instance.defaults = d;
    instance.create = more => create(Object.assign({}, d, more, { headers: Object.assign({}, d.headers, more && more.headers) }));
    instance.isAxiosError = e => !!(e && e.isAxiosError);
    instance.isCancel = e => !!(e && e.code === 'ERR_CANCELED');
    return instance;
}

const axios = create({});
axios.default = axios;
module.exports = axios;
