/*
 * Usenet Direct — Nuvio plugin for Apple TV (Nuvio Usenet).
 *
 * Searches Newznab indexers (NZBGeek, altHUB, Usenet-Crawler, DogNZB and one
 * custom indexer) by IMDb id and returns streams with `nzbUrl`, which Nuvio
 * Usenet on Apple TV plays straight from your usenet server. Everything runs
 * on the Apple TV: your indexer keys never leave it except to the indexer.
 *
 * Plugin API (Nuvio): getStreams(tmdbId, mediaType, season, episode) and
 * onSettings(). Apple TV extensions used here: a fifth getStreams argument
 * with { imdbId }, onVerify(settings), localStorage and `nzbUrl` results.
 */

var VERSION = '1.1.0';

var TEST = (typeof globalThis.__usenetDirectTest === 'object' && globalThis.__usenetDirectTest) || {};

var INDEXERS = [
  { id: 'nzbgeek', name: 'NZBGeek', url: 'https://api.nzbgeek.info/api' },
  { id: 'althub', name: 'altHUB', url: 'https://api.althub.co.za/api' },
  { id: 'usenetcrawler', name: 'Usenet-Crawler', url: 'https://www.usenet-crawler.com/api' },
  { id: 'dognzb', name: 'DogNZB', url: 'https://api.dognzb.cr/api' }
];
var TVMAZE = TEST.tvmaze || 'https://api.tvmaze.com';

var HOUR = 3600 * 1000;
var DAY = 24 * HOUR;
var SEARCH_TTL = HOUR;
var EMPTY_TTL = 15 * 60 * 1000;
var CAPS_TTL = DAY;
var CAPS_FAIL_TTL = 10 * 60 * 1000;
var TVMAZE_HIT_TTL = 90 * DAY;
var TVMAZE_MISS_TTL = 7 * DAY;
var MAX_CACHED_SEARCHES = 40;
var MOVIE_PAGES = 2;
var GB = 1024 * 1024 * 1024;

// Without caps: the Newznab basics (movies by imdbid, series by tvdbid).
var FALLBACK_CAPS = { tvParams: ['q', 'tvdbid', 'season', 'ep'], movieParams: ['q', 'imdbid'], fallback: true };

// ---------------------------------------------------------------- settings

function onSettings() {
  return [
    { type: 'info', label: 'Usenet Direct ' + VERSION, description: 'Enter the API key of at least one indexer. All indexers with a key are searched at once; streams play in Nuvio Usenet (servers in Settings → Usenet).' },
    { type: 'text', key: 'key_nzbgeek', label: 'NZBGeek API key', isPassword: true, placeholder: 'nzbgeek.info → Profile' },
    { type: 'text', key: 'key_althub', label: 'altHUB API key', isPassword: true, placeholder: 'althub.co.za → Profile' },
    { type: 'text', key: 'key_usenetcrawler', label: 'Usenet-Crawler API key', isPassword: true, placeholder: 'usenet-crawler.com → Profile' },
    { type: 'text', key: 'key_dognzb', label: 'DogNZB API key', isPassword: true, placeholder: 'dognzb.cr → Profile' },
    { type: 'text', key: 'custom_name', label: 'Custom indexer — name', placeholder: 'optional' },
    { type: 'text', key: 'custom_url', label: 'Custom indexer — API URL', placeholder: 'https://…/api' },
    { type: 'text', key: 'custom_key', label: 'Custom indexer — API key', isPassword: true },
    { type: 'select', key: 'max_res', label: 'Highest resolution', defaultValue: '2160p',
      options: [{ label: '2160p (4K)', value: '2160p' }, { label: '1080p', value: '1080p' }, { label: '720p', value: '720p' }] },
    { type: 'toggle', key: 'include_sd', label: 'Include SD', defaultValue: false },
    { type: 'select', key: 'max_results', label: 'Results per indexer', defaultValue: '20',
      options: ['10', '20', '30', '50'] },
    { type: 'text', key: 'max_movie_gb', label: 'Max movie size (GB)', placeholder: 'no limit' },
    { type: 'text', key: 'max_episode_gb', label: 'Max episode size (GB)', placeholder: 'no limit' },
    { type: 'toggle', key: 'prefer_cz', label: 'Czech/Slovak audio and subtitles first', defaultValue: true },
    { type: 'toggle', key: 'hide_cam', label: 'Hide CAM/TS', defaultValue: true }
  ];
}

function readSettings(raw) {
  var s = raw || {};
  var text = function (key) { return typeof s[key] === 'string' ? s[key].trim() : (s[key] == null ? '' : String(s[key]).trim()); };
  var bool = function (key, fallback) {
    if (typeof s[key] === 'boolean') return s[key];
    if (s[key] === 'true') return true;
    if (s[key] === 'false') return false;
    return fallback;
  };
  var number = function (key) { var n = parseFloat(text(key).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; };

  var indexers = [];
  INDEXERS.forEach(function (ix) {
    var key = text('key_' + ix.id);
    if (key) indexers.push({ id: ix.id, name: ix.name, url: (TEST.urls && TEST.urls[ix.id]) || ix.url, key: key });
  });
  var customUrl = text('custom_url');
  var customKey = text('custom_key');
  if (customUrl && customKey && /^https?:\/\//i.test(customUrl)) {
    indexers.push({ id: 'custom', name: text('custom_name') || hostName(customUrl), url: customUrl.replace(/\/+$/, ''), key: customKey });
  }

  var maxRes = ['2160p', '1080p', '720p'].indexOf(text('max_res')) >= 0 ? text('max_res') : '2160p';
  var order = ['2160p', '1080p', '720p'];
  var res = order.slice(order.indexOf(maxRes));
  if (bool('include_sd', false)) res.push('sd');
  var max = parseInt(text('max_results'), 10);

  return {
    indexers: indexers,
    res: res,
    max: isFinite(max) && max > 0 ? Math.min(max, 100) : 20,
    maxMovieGb: number('max_movie_gb'),
    maxEpisodeGb: number('max_episode_gb'),
    preferCz: bool('prefer_cz', true),
    hideCam: bool('hide_cam', true)
  };
}

function hostName(url) {
  try { return new URL(url).hostname.replace(/^api\./, ''); } catch (e) { return 'Indexer'; }
}

// ---------------------------------------------------------------- storage

function cacheGet(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return undefined;
    var entry = JSON.parse(raw);
    if (!entry || entry.exp < Date.now()) { localStorage.removeItem(key); return undefined; }
    return entry.v;
  } catch (e) {
    return undefined;
  }
}

function cacheSet(key, value, ttl) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: value, exp: Date.now() + ttl }));
    return true;
  } catch (e) {
    return false;
  }
}

// Search results are the big entries: keep only the newest few dozen.
function rememberSearch(key, items, ttl) {
  var index = [];
  try { index = JSON.parse(localStorage.getItem('search:index') || '[]'); } catch (e) { index = []; }
  index = index.filter(function (k) { return k !== key; });
  index.push(key);
  while (index.length > MAX_CACHED_SEARCHES) localStorage.removeItem(index.shift());
  if (!cacheSet(key, items, ttl)) {
    // Storage full: drop the older half and try once more.
    index.splice(0, Math.floor(index.length / 2)).forEach(function (k) { localStorage.removeItem(k); });
    cacheSet(key, items, ttl);
  }
  try { localStorage.setItem('search:index', JSON.stringify(index)); } catch (e) { /* ignore */ }
}

function keyTag(indexer) {
  var h = 5381;
  for (var i = 0; i < indexer.key.length; i++) h = ((h << 5) + h + indexer.key.charCodeAt(i)) | 0;
  return indexer.id + ':' + (h >>> 0).toString(36);
}

function nextUtcMidnight() {
  var d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

// ---------------------------------------------------------------- newznab

function NewznabError(code, description) {
  this.name = 'NewznabError';
  this.code = code;
  this.description = description;
  this.message = 'Newznab ' + code + ': ' + description;
}
NewznabError.prototype = Object.create(Error.prototype);
NewznabError.prototype.constructor = NewznabError;
NewznabError.prototype.isLimit = function () {
  return this.code === 429 || /limit|too many|exceeded|maximum/i.test(this.description || '');
};

var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text) {
  if (!text) return '';
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (match, ent) {
    if (ent[0] === '#') {
      var code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return isFinite(code) ? String.fromCodePoint(code) : match;
    }
    var hit = ENTITIES[ent.toLowerCase()];
    return hit === undefined ? match : hit;
  });
}

function elementText(block, tag) {
  var m = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i'));
  if (!m) return '';
  var text = m[1].trim();
  var cdata = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) return cdata[1].trim();
  return decodeEntities(text);
}

function tagAttrs(tagBody) {
  var out = {};
  var re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  var m;
  while ((m = re.exec(tagBody))) out[m[1]] = decodeEntities(m[2]);
  return out;
}

function parseError(xml) {
  var m = xml.match(/<error\b([^>]*)\/?>/i);
  if (!m) return null;
  var a = tagAttrs(m[1]);
  return new NewznabError(parseInt(a.code, 10) || 900, a.description || 'Unknown error');
}

function toInt(value) {
  if (value === undefined || value === null) return null;
  var m = String(value).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function toDateMs(value) {
  if (!value) return null;
  var t = Date.parse(value);
  return isFinite(t) ? t : null;
}

function parseItem(block) {
  var attrs = {};
  var re = /<newznab:attr\b([^>]*?)\/?>/gi;
  var m;
  while ((m = re.exec(block))) {
    var a = tagAttrs(m[1]);
    if (!a.name) continue;
    var name = a.name.toLowerCase();
    (attrs[name] = attrs[name] || []).push(a.value == null ? '' : a.value);
  }
  var one = function (n) { return attrs[n] ? attrs[n][0] : undefined; };
  var enclosure = block.match(/<enclosure\b([^>]*?)\/?>/i);
  var enc = enclosure ? tagAttrs(enclosure[1]) : {};

  var guid = one('guid');
  if (!guid) {
    var g = elementText(block, 'guid');
    var gm = /^[A-Za-z0-9_-]{6,64}$/.test(g) ? [null, g] : g.match(/(?:guid=|\/details\/|[?&]id=)([A-Za-z0-9_-]{6,64})/);
    if (gm) guid = gm[1];
  }
  if (!guid && enc.url) {
    var em = enc.url.match(/[?&]id=([A-Za-z0-9_-]{6,64})/);
    if (em) guid = em[1];
  }
  if (guid && !/^[A-Za-z0-9_-]{6,64}$/.test(guid)) guid = null;

  var size = toInt(one('size'));
  if (size === null) size = toInt(enc.length);
  var pub = toDateMs(one('usenetdate'));
  if (pub === null) pub = toDateMs(elementText(block, 'pubDate'));
  var nz = function (v, d) { return v === null ? d : v; };
  return {
    guid: guid && /^[a-f0-9]+$/i.test(guid) ? guid.toLowerCase() : guid || null,
    title: elementText(block, 'title'),
    size: size || 0,
    pubDate: pub,
    categories: (attrs.category || []).map(toInt).filter(function (c) { return c !== null; }),
    grabs: nz(toInt(one('grabs')), 0),
    password: nz(toInt(one('password')), 0),
    imdb: toInt(one('imdb')),
    season: toInt(one('season')),
    episode: toInt(one('episode')),
    languages: (attrs.language || []).map(function (s) { return s.trim(); }).filter(Boolean),
    subs: (attrs.subs || []).map(function (s) { return s.trim(); }).filter(Boolean)
  };
}

function parseSearch(xml) {
  var err = parseError(xml);
  if (err) throw err;
  if (!/<rss\b|<channel\b/i.test(xml)) throw new NewznabError(900, 'Unexpected response (not RSS)');
  var resp = xml.match(/<newznab:response\b([^>]*?)\/?>/i);
  var r = resp ? tagAttrs(resp[1]) : {};
  var items = [];
  var re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  var m;
  while ((m = re.exec(xml))) {
    var item = parseItem(m[1]);
    if (item.guid && item.title) items.push(item);
  }
  var total = toInt(r.total);
  return { total: total === null ? items.length : total, items: items };
}

function parseCaps(xml) {
  var err = parseError(xml);
  if (err) throw err;
  if (!/<caps\b/i.test(xml)) throw new NewznabError(900, 'Unexpected response (not caps)');
  var params = function (tag) {
    var m = xml.match(new RegExp('<' + tag + '\\b([^>]*?)\\/?>', 'i'));
    var a = m ? tagAttrs(m[1]) : {};
    return (a.supportedParams || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  };
  return { tvParams: params('tv-search'), movieParams: params('movie-search') };
}

// ---------------------------------------------------------------- client

function buildUrl(indexer, params) {
  var url = new URL(indexer.url);
  Object.keys(params).forEach(function (k) {
    var v = params[k];
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.href;
}

function request(indexer, params, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 12000);
  return fetch(buildUrl(indexer, params), {
    headers: { Accept: 'application/xml, text/xml, */*' },
    signal: controller.signal
  }).then(function (res) {
    return res.text().then(function (body) {
      clearTimeout(timer);
      if (!res.ok) {
        var err = parseError(body);
        throw err || new NewznabError(res.status === 429 ? 429 : 900, 'HTTP ' + res.status);
      }
      return body;
    });
  }, function (e) {
    clearTimeout(timer);
    throw new NewznabError(900, e && e.name === 'AbortError' ? 'Timed out' : String((e && e.message) || e));
  });
}

function isBlocked(indexer) {
  var until = cacheGet('blocked:' + keyTag(indexer));
  return Boolean(until && until > Date.now());
}

function noteError(indexer, e) {
  if (e instanceof NewznabError && e.isLimit()) {
    var until = nextUtcMidnight();
    cacheSet('blocked:' + keyTag(indexer), until, until - Date.now());
  }
  throw e;
}

async function searchPages(indexer, kind, query, maxPages) {
  if (isBlocked(indexer)) throw new NewznabError(429, 'Daily limit reached (skipped until midnight UTC)');
  var items = [];
  var seen = {};
  var limit = 100;
  for (var page = 0; page < maxPages; page++) {
    var params = Object.assign({ t: kind === 'movie' ? 'movie' : 'tvsearch', apikey: indexer.key, extended: 1, limit: limit, offset: page * limit }, query);
    var r;
    try {
      r = parseSearch(await request(indexer, params));
    } catch (e) {
      noteError(indexer, e);
    }
    r.items.forEach(function (it) {
      if (seen[it.guid]) return;
      seen[it.guid] = true;
      items.push(it);
    });
    if (r.items.length < limit || (page + 1) * limit >= r.total) break;
  }
  return items;
}

async function getCaps(indexer) {
  var key = 'caps:' + indexer.url;
  var hit = cacheGet(key);
  if (hit) return hit;
  try {
    var caps = parseCaps(await request(indexer, { t: 'caps', apikey: indexer.key }, 10000));
    cacheSet(key, caps, CAPS_TTL);
    return caps;
  } catch (e) {
    cacheSet(key, FALLBACK_CAPS, CAPS_FAIL_TTL);
    return FALLBACK_CAPS;
  }
}

async function tvmazeLookup(imdb) {
  var key = 'tvmaze:' + imdb;
  var hit = cacheGet(key);
  if (hit !== undefined) return hit.miss ? null : hit;
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 8000);
  try {
    var res = await fetch(TVMAZE + '/lookup/shows?imdb=' + encodeURIComponent(imdb), {
      headers: { Accept: 'application/json' }, signal: controller.signal
    });
    if (res.status === 404) {
      cacheSet(key, { miss: true }, TVMAZE_MISS_TTL);
      return null;
    }
    if (!res.ok) throw new Error('TVmaze HTTP ' + res.status);
    var show = await res.json();
    if (!show || !show.id) {
      cacheSet(key, { miss: true }, TVMAZE_MISS_TTL);
      return null;
    }
    var entry = { tvmaze: show.id, tvdb: (show.externals && show.externals.thetvdb) || null, name: show.name || null };
    cacheSet(key, entry, TVMAZE_HIT_TTL);
    return entry;
  } catch (e) {
    console.warn('TVmaze lookup failed for ' + imdb + ': ' + (e && e.message));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function imdb7(imdb) {
  return String(parseInt(String(imdb).replace(/^tt/, ''), 10)).padStart(7, '0');
}

async function searchMovie(indexer, imdb) {
  var caps = await getCaps(indexer);
  if (caps.movieParams.length && caps.movieParams.indexOf('imdbid') === -1) return { items: [], via: 'no imdbid' };
  var key = 'search:' + indexer.id + ':movie:' + imdb;
  var hit = cacheGet(key);
  if (hit) return { items: hit, via: 'cache' };
  var items = await searchPages(indexer, 'movie', { imdbid: imdb7(imdb), cat: '2000' }, MOVIE_PAGES);
  rememberSearch(key, items, items.length ? SEARCH_TTL : EMPTY_TTL);
  return { items: items, via: 'imdbid' };
}

// Series: imdbid where the indexer supports it, else IMDb → TVmaze → tvdbid,
// then tvmazeid. Two tries at most, so free daily limits last.
async function searchEpisode(indexer, imdb, season, episode, getShow) {
  var key = 'search:' + indexer.id + ':tv:' + imdb + ':' + season + ':' + episode;
  var hit = cacheGet(key);
  if (hit) return { items: hit, via: 'cache' };
  var caps = await getCaps(indexer);
  var attempts = [];
  if (caps.tvParams.indexOf('imdbid') >= 0) attempts.push(['imdbid', function () { return imdb7(imdb); }]);
  if (caps.tvParams.indexOf('tvdbid') >= 0) attempts.push(['tvdbid', async function () { var s = await getShow(); return s && s.tvdb; }]);
  if (caps.tvParams.indexOf('tvmazeid') >= 0) attempts.push(['tvmazeid', async function () { var s = await getShow(); return s && s.tvmaze; }]);

  var tried = 0;
  var via = 'no id';
  var items = [];
  for (var i = 0; i < attempts.length && tried < 2; i++) {
    var value = await attempts[i][1]();
    if (!value) continue;
    tried++;
    via = attempts[i][0];
    var query = { season: season, ep: episode, cat: '5000' };
    query[attempts[i][0]] = value;
    items = await searchPages(indexer, 'tv', query, 1);
    if (items.length) break;
  }
  rememberSearch(key, items, items.length ? SEARCH_TTL : EMPTY_TTL);
  return { items: items, via: via };
}

// ---------------------------------------------------------------- releases

var JUNK_SUFFIXES = ['AsRequested', 'AlternativeToRequested', 'Obfuscated', 'Scrambled', 'Rakuv\\d*', 'Rakuvfinhel',
  'postbot', 'xpost', 'RePACKPOST', 'BUYMORE', 'Chamele0n', 'WhiteRev', '4P', '4Planet',
  'NZBgeek', 'Sample', 'iNTERNAL', 'Converted', 'Encoded', 'Repost'];
var JUNK_RE = new RegExp('(?:[-.\\s](?:' + JUNK_SUFFIXES.join('|') + '))+$', 'i');
var RES_RANK = { '2160p': 4, '1080p': 3, '720p': 2, sd: 1, unknown: 0 };
var SOURCE_RANK = { remux: 8, bluray: 7, webdl: 6, webrip: 5, hdtv: 4, dvd: 3, other: 2, cam: 0 };
var SOURCE_LABEL = { remux: 'BluRay REMUX', bluray: 'BluRay', webdl: 'WEB-DL', webrip: 'WEBRip', hdtv: 'HDTV', dvd: 'DVD', other: '', cam: 'CAM' };

function cleanTitle(title) {
  return title.replace(/[-.\s]*\[[^\]]*\]\s*$/, '').replace(JUNK_RE, '').trim();
}

function detectResolution(t, categories) {
  if (/\b(2160p|4k|uhd)\b/i.test(t) && !/\b(1080p|720p)\b/i.test(t)) return '2160p';
  if (/\b2160p\b/i.test(t)) return '2160p';
  if (/\b1080[pi]\b/i.test(t)) return '1080p';
  if (/\b720p\b/i.test(t)) return '720p';
  if (/\b(576p|480p|360p|sd|dvdrip|xvid)\b/i.test(t)) return 'sd';
  if (categories.indexOf(2045) >= 0 || categories.indexOf(5045) >= 0) return '2160p';
  if (categories.indexOf(2030) >= 0 || categories.indexOf(5030) >= 0) return 'sd';
  return 'unknown';
}

function detectSource(t) {
  if (/\b(cam|camrip|hdcam|ts|telesync|hdts|tc|telecine|scr|screener|dvdscr)\b/i.test(t)) return 'cam';
  if (/\bremux\b/i.test(t)) return 'remux';
  if (/\b(blu-?ray|bdrip|brrip|bd(?:25|50|mv)?|uhd\.?bd)\b/i.test(t)) return 'bluray';
  if (/\bweb[-. ]?dl\b|\bwebdl\b/i.test(t)) return 'webdl';
  if (/\bweb-?rip\b/i.test(t)) return 'webrip';
  if (/\bweb\b/i.test(t)) return 'webdl';
  if (/\b(hdtv|pdtv|dsr|tvrip)\b/i.test(t)) return 'hdtv';
  if (/\b(dvd|dvdrip|dvd5|dvd9)\b/i.test(t)) return 'dvd';
  return 'other';
}

function detectHdr(t) {
  var out = [];
  if (/\b(dv|dovi|dolby[ .]?vision)\b/i.test(t)) out.push('DV');
  if (/hdr10\+|hdr10plus/i.test(t)) out.push('HDR10+');
  else if (/\bhdr10\b/i.test(t)) out.push('HDR10');
  else if (/\bhdr\b/i.test(t)) out.push('HDR');
  if (/\bhlg\b/i.test(t)) out.push('HLG');
  return out;
}

function detectCodec(t) {
  if (/\b(x265|h[ .]?265|hevc)\b/i.test(t)) return 'HEVC';
  if (/\bav1\b/i.test(t)) return 'AV1';
  if (/\b(x264|h[ .]?264|avc)\b/i.test(t)) return 'AVC';
  if (/\bvc-?1\b/i.test(t)) return 'VC-1';
  if (/\b(xvid|divx)\b/i.test(t)) return 'XviD';
  if (/\bmpeg-?2\b/i.test(t)) return 'MPEG-2';
  return null;
}

function detectAudio(t) {
  var codec = null;
  if (/\batmos\b/i.test(t)) codec = 'Atmos';
  if (/\btrue-?hd\b/i.test(t)) codec = codec ? 'TrueHD ' + codec : 'TrueHD';
  else if (/\bdts[-. ]?hd[-. ]?ma\b|\bdts-?hd\b/i.test(t)) codec = 'DTS-HD MA';
  else if (/\bdts[-. ]?x\b/i.test(t)) codec = 'DTS:X';
  else if (/\bdts\b/i.test(t)) codec = 'DTS';
  else if (/\b(ddp|dd\+|e-?ac-?3|eac3)/i.test(t)) codec = codec ? 'DD+ ' + codec : 'DD+';
  else if (/\b(dd|ac-?3)(?:[. ]?[257]\.?[01])?\b/i.test(t)) codec = 'DD';
  else if (/\baac\b/i.test(t)) codec = 'AAC';
  else if (/\bflac\b/i.test(t)) codec = 'FLAC';
  else if (/\bopus\b/i.test(t)) codec = 'Opus';
  var ch = t.match(/(?:^|[^\d])([2578])[. ]([01])(?!\d)/);
  var channels = ch ? ch[1] + '.' + ch[2] : null;
  return [codec, channels].filter(Boolean).join(' ') || null;
}

var NOT_GROUP = {};
['dl', 'hd', 'ma', 'rip', 'x', 'mkv', 'mp4', 'avi', 'web', 'webdl', 'webrip', 'bluray', 'remux', 'hdtv',
  'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'av1', 'xvid', 'dual', 'multi', 'proper', 'repack',
  'ddp', 'dd', 'aac', 'ac3', 'eac3', 'dts', 'truehd', 'atmos', 'flac', 'opus', 'hdr', 'hdr10', 'dv',
  'dovi', '10bit', '2160p', '1080p', '720p', '480p', 'uhd', 'cz', 'eng', 'czech', 'english', 'subs', 'complete'
].forEach(function (w) { NOT_GROUP[w] = true; });

function detectGroup(cleaned) {
  var dash = cleaned.match(/-([A-Za-z0-9][A-Za-z0-9_]{1,24})$/);
  if (dash && !NOT_GROUP[dash[1].toLowerCase()] && !/^\d+$/.test(dash[1])) return dash[1];
  var technical = /[. ](2160p|1080p|720p|web|web-dl|bluray|hdtv|x264|x265|h264|h\.264|hevc)[. ]/i.test(cleaned);
  if (!dash && technical) {
    var last = cleaned.split('.').pop();
    if (/^[A-Za-z][A-Za-z0-9]{1,11}$/.test(last) && /[A-Z]/.test(last)
      && !NOT_GROUP[last.toLowerCase()] && !/^(s\d+(e\d+)?|e\d+)$/i.test(last)) return last;
  }
  return null;
}

function parseRelease(title, categories) {
  var cleaned = cleanTitle(title);
  var t = cleaned.replace(/[._]/g, ' ');
  var resolution = detectResolution(t, categories || []);
  var source = detectSource(t);
  return {
    resolution: resolution,
    source: source,
    sourceLabel: SOURCE_LABEL[source],
    hdr: detectHdr(t),
    codec: detectCodec(t),
    tenBit: /\b10[- ]?bit\b/i.test(t),
    audio: detectAudio(cleaned.replace(/_/g, ' ')),
    multiAudio: /\b(dual|multi|2audio|dual[- ]audio)\b/i.test(t),
    group: detectGroup(cleaned),
    resRank: RES_RANK[resolution],
    sourceRank: SOURCE_RANK[source]
  };
}

var LANGS = {
  czech: ['cs', '🇨🇿'], slovak: ['sk', '🇸🇰'], english: ['en', '🇬🇧'], german: ['de', '🇩🇪'],
  french: ['fr', '🇫🇷'], spanish: ['es', '🇪🇸'], italian: ['it', '🇮🇹'], portuguese: ['pt', '🇵🇹'],
  polish: ['pl', '🇵🇱'], hungarian: ['hu', '🇭🇺'], russian: ['ru', '🇷🇺'], ukrainian: ['uk', '🇺🇦'],
  japanese: ['ja', '🇯🇵'], chinese: ['zh', '🇨🇳'], cantonese: ['zh', '🇨🇳'], mandarin: ['zh', '🇨🇳'],
  korean: ['ko', '🇰🇷'], dutch: ['nl', '🇳🇱'], swedish: ['sv', '🇸🇪'], norwegian: ['no', '🇳🇴'],
  danish: ['da', '🇩🇰'], finnish: ['fi', '🇫🇮'], turkish: ['tr', '🇹🇷'], greek: ['el', '🇬🇷'],
  romanian: ['ro', '🇷🇴'], bulgarian: ['bg', '🇧🇬'], croatian: ['hr', '🇭🇷'], serbian: ['sr', '🇷🇸'],
  slovenian: ['sl', '🇸🇮'], arabic: ['ar', '🇸🇦'], hebrew: ['he', '🇮🇱'], hindi: ['hi', '🇮🇳'],
  thai: ['th', '🇹🇭'], vietnamese: ['vi', '🇻🇳'], indonesian: ['id', '🇮🇩'], malay: ['ms', '🇲🇾'],
  estonian: ['et', '🇪🇪'], latvian: ['lv', '🇱🇻'], lithuanian: ['lt', '🇱🇹'],
  icelandic: ['is', '🇮🇸'], persian: ['fa', '🇮🇷'], macedonian: ['mk', '🇲🇰'], tamil: ['ta', '🇮🇳'],
  telugu: ['te', '🇮🇳'], filipino: ['tl', '🇵🇭']
};

function normalizeLanguages(names) {
  var out = [];
  var seen = {};
  (names || []).forEach(function (raw) {
    var base = String(raw).replace(/\(.*?\)/g, '').trim().toLowerCase();
    var hit = LANGS[base];
    if (!hit || seen[hit[0]]) return;
    seen[hit[0]] = true;
    out.push({ code: hit[0], flag: hit[1] });
  });
  return out;
}

function titleLanguageHints(title) {
  var t = title.replace(/[._\-[\]()]/g, ' ');
  var czSubs = /\b(cz|cze|czech)\s*(sub|subs|tit|titulky|subtitles?)\b/i.test(t);
  var czAny = /\b(cz|cze|czech|cesky|dabing)\b/i.test(t);
  return { czAudio: czAny && !czSubs, czSubs: czSubs, skAudio: /\b(svk|slovak)\b|\bsk\s*dab/i.test(t) };
}

// ---------------------------------------------------------------- streams

function formatSize(bytes) {
  if (!bytes) return '?';
  if (bytes >= GB) return (bytes / GB).toFixed(bytes >= 10 * GB ? 1 : 2) + ' GB';
  return Math.round(bytes / (1024 * 1024)) + ' MB';
}

function formatAge(ms, now) {
  if (!ms) return null;
  var days = Math.floor((now - ms) / 86400000);
  if (days < 1) return 'today';
  if (days < 60) return days + ' d';
  if (days < 730) return Math.round(days / 30) + ' mo';
  return Math.round(days / 365) + ' y';
}

var RES_LABEL = { '2160p': '2160p', '1080p': '1080p', '720p': '720p', sd: 'SD', unknown: '' };

function matchesRequest(item, req) {
  if (req.type === 'movie') return item.imdb === null || item.imdb === req.imdbNum;
  if (item.season !== null && item.season !== req.season) return false;
  if (item.episode !== null) return item.episode === req.episode;
  var s = String(req.season).padStart(2, '0');
  var e = String(req.episode).padStart(2, '0');
  return new RegExp('(?:^|[^a-z0-9])s' + s + '[ ._-]?e' + e + '(?![0-9]|[ ._-]?e\\d)', 'i').test(item.title);
}

function dedupe(items) {
  var keyOf = function (it) { return cleanTitle(it.title).toLowerCase() + '|' + Math.round(it.size / (20 * 1024 * 1024)); };
  var best = {};
  items.forEach(function (it) {
    var k = keyOf(it);
    if (!best[k] || it.grabs > best[k].grabs) best[k] = it;
  });
  return items.filter(function (it) { return best[keyOf(it)] === it; });
}

function enrich(item) {
  var rel = parseRelease(item.title, item.categories);
  var hints = titleLanguageHints(item.title);
  var audio = normalizeLanguages(item.languages);
  var subs = normalizeLanguages(item.subs);
  var has = function (list, code) { return list.some(function (l) { return l.code === code; }); };
  var add = function (list, code, flag) { if (!has(list, code)) list.push({ code: code, flag: flag }); };
  if (hints.czAudio) add(audio, 'cs', '🇨🇿');
  if (hints.czSubs) add(subs, 'cs', '🇨🇿');
  if (hints.skAudio) add(audio, 'sk', '🇸🇰');
  var czAudio = has(audio, 'cs') || has(audio, 'sk');
  var czSubs = has(subs, 'cs') || has(subs, 'sk');
  return { item: item, rel: rel, audio: audio, subs: subs, czScore: czAudio ? 2 : czSubs ? 1 : 0, czAudio: czAudio, czSubs: czSubs };
}

function compare(a, b, preferCz) {
  return (preferCz ? b.czScore - a.czScore : 0)
    || b.rel.resRank - a.rel.resRank
    || b.rel.sourceRank - a.rel.sourceRank
    || b.item.size - a.item.size
    || b.item.grabs - a.item.grabs;
}

var FLAG_PRIORITY = ['cs', 'sk', 'en'];
function flags(list, max) {
  max = max || 6;
  var rank = function (l) { var i = FLAG_PRIORITY.indexOf(l.code); return i === -1 ? FLAG_PRIORITY.length : i; };
  var sorted = list.slice().sort(function (a, b) { return rank(a) - rank(b); });
  var shown = sorted.slice(0, max).map(function (l) { return l.flag; }).join('');
  return list.length > max ? shown + ' +' + (list.length - max) : shown;
}

function describe(e, now) {
  var item = e.item, rel = e.rel;
  var lines = [cleanTitle(item.title) || item.title];
  var video = [rel.sourceLabel, rel.codec, rel.tenBit ? '10bit' : null].concat(rel.hdr).filter(Boolean).join(' · ');
  var tech = [video ? '🎞 ' + video : null, rel.group ? '👥 ' + rel.group : null].filter(Boolean).join('   ');
  if (tech) lines.push(tech);
  var sound = [rel.audio, e.audio.length ? flags(e.audio) : null, rel.multiAudio && e.audio.length < 2 ? 'MULTI' : null].filter(Boolean).join(' ');
  var langLine = [sound ? '🔊 ' + sound : null, e.subs.length ? '💬 ' + flags(e.subs) : null].filter(Boolean).join('   ');
  if (langLine) lines.push(langLine);
  if (e.czAudio || e.czSubs) lines.push(e.czAudio ? '🇨🇿 CZ/SK audio' : '🇨🇿 CZ/SK subtitles');
  var age = formatAge(item.pubDate, now);
  lines.push(['💾 ' + formatSize(item.size), age ? '📅 ' + age : null, item.grabs ? '⬇ ' + item.grabs : null].filter(Boolean).join('   '));
  return lines.join('\n');
}

function selectEntries(items, req, settings) {
  var maxGb = req.type === 'movie' ? settings.maxMovieGb : settings.maxEpisodeGb;
  var allowed = {};
  settings.res.concat(['unknown']).forEach(function (r) { allowed[r] = true; });
  var enriched = dedupe(items)
    .filter(function (it) { return it.password === 0; })
    .filter(function (it) { return matchesRequest(it, req); })
    .filter(function (it) { return !maxGb || it.size <= maxGb * GB; })
    .map(enrich)
    .filter(function (e) { return !(settings.hideCam && e.rel.source === 'cam'); })
    .filter(function (e) { return allowed[e.rel.resolution]; });
  enriched.sort(function (a, b) { return compare(a, b, settings.preferCz); });
  return enriched.slice(0, settings.max);
}

function toStream(e, now) {
  var res = RES_LABEL[e.rel.resolution];
  var name = ['UD · ' + e.indexer.name, [res, e.czAudio ? '🇨🇿' : null].filter(Boolean).join(' ')].filter(Boolean).join('\n');
  return {
    name: name,
    description: '🔎 ' + e.indexer.name + '\n' + describe(e, now),
    quality: res || undefined,
    size: formatSize(e.item.size),
    nzbUrl: buildUrl(e.indexer, { t: 'get', id: e.item.guid, apikey: e.indexer.key }),
    behaviorHints: {
      notWebReady: true,
      bingeGroup: 'usenet-direct|' + e.rel.resolution + '|' + e.rel.source + '|' + (e.rel.group || ''),
      videoSize: e.item.size || undefined,
      filename: e.item.title
    }
  };
}

// ---------------------------------------------------------------- entry points

async function getStreams(tmdbId, mediaType, season, episode, context) {
  var started = Date.now();
  var settings = readSettings(typeof SCRAPER_SETTINGS === 'object' ? SCRAPER_SETTINGS : {});
  if (!settings.indexers.length) {
    console.warn('Usenet Direct: no indexer key set — open the provider settings.');
    return [];
  }
  var imdb = (context && context.imdbId) || (/^tt\d+$/i.test(String(tmdbId)) ? String(tmdbId) : null);
  if (!imdb) {
    console.warn('Usenet Direct: no IMDb id for ' + tmdbId + ' — indexers search by IMDb.');
    return [];
  }
  var isSeries = mediaType === 'tv' || mediaType === 'series';
  if (isSeries && (season == null || episode == null)) return [];
  var req = {
    type: isSeries ? 'series' : 'movie',
    imdb: imdb,
    imdbNum: parseInt(imdb.replace(/^tt/i, ''), 10),
    season: isSeries ? Number(season) : null,
    episode: isSeries ? Number(episode) : null
  };

  var showPromise = null;
  var getShow = function () {
    if (!showPromise) showPromise = tvmazeLookup(imdb);
    return showPromise;
  };

  var groups = await Promise.all(settings.indexers.map(async function (indexer) {
    try {
      var r = req.type === 'movie'
        ? await searchMovie(indexer, imdb)
        : await searchEpisode(indexer, imdb, req.season, req.episode, getShow);
      return { indexer: indexer, items: r.items, via: r.via };
    } catch (e) {
      var message = e instanceof NewznabError ? e.description + ' (' + e.code + ')' : String((e && e.message) || e);
      return { indexer: indexer, items: [], error: message };
    }
  }));

  var now = Date.now();
  var all = [];
  groups.forEach(function (g) {
    selectEntries(g.items, req, settings).forEach(function (e) {
      e.indexer = g.indexer;
      all.push(e);
    });
  });
  all.sort(function (a, b) { return compare(a, b, settings.preferCz); });

  console.log('Usenet Direct ' + (req.type === 'movie' ? imdb : imdb + ' S' + req.season + 'E' + req.episode)
    + ' → ' + all.length + ' · ' + groups.map(function (g) {
      return g.indexer.name + ' ' + (g.error ? '✕ ' + g.error : g.items.length + (g.via ? ' [' + g.via + ']' : ''));
    }).join(', ') + ' · ' + (Date.now() - started) + ' ms');

  return all.map(function (e) { return toStream(e, now); });
}

// Apple TV extension: Settings → provider → Verify.
async function onVerify(rawSettings) {
  var settings = readSettings(rawSettings || (typeof SCRAPER_SETTINGS === 'object' ? SCRAPER_SETTINGS : {}));
  if (!settings.indexers.length) return { ok: false, message: 'Enter the API key of at least one indexer.' };
  var results = await Promise.all(settings.indexers.map(async function (indexer) {
    try {
      var caps = parseCaps(await request(indexer, { t: 'caps', apikey: indexer.key }, 10000));
      cacheSet('caps:' + indexer.url, caps, CAPS_TTL);
      var ids = caps.tvParams.filter(function (p) { return /imdbid|tvdbid|tvmazeid/.test(p); });
      return { ok: true, text: indexer.name + ' ✓' + (ids.length ? ' (series by ' + ids.join(', ') + ')' : '') };
    } catch (e) {
      var message = e instanceof NewznabError ? e.description + ' (' + e.code + ')' : String((e && e.message) || e);
      return { ok: false, text: indexer.name + ' ✕ ' + message };
    }
  }));
  return {
    ok: results.every(function (r) { return r.ok; }),
    message: results.map(function (r) { return r.text; }).join(' · ')
  };
}

module.exports = { getStreams: getStreams, onSettings: onSettings, onVerify: onVerify };
