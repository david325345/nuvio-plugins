/**
 * Example: TVmaze — catalogs, search, metadata and ratings from a plugin on
 * Nuvio for Apple TV. Uses the free TVmaze API (no key).
 *
 * The manifest lists it with
 *   "resources": ["catalog", "meta", "ratings"],
 *   "idPrefixes": ["tvmaze:", "tt"],
 *   "catalogs": [...], "ratingSources": [...], "supportedPlatforms": ["tvos"]
 *
 *   getCatalog(type, id, extra)  → { metas: [...] }   extra: { search, skip, genre } (strings)
 *   getMeta(type, id)            → { meta: {...} }    only for ids with the plugin's own prefix (tvmaze:)
 *   getRatings(type, id, context) → [{ source, value, url }]  id: "tt…" or "tt…:season:episode"
 *
 * Shows with an IMDb id are listed as "tt…", so Details, streams and other
 * add-ons work as usual; the rest get "tvmaze:<id>" and this plugin's
 * metadata. Every call must answer within 8 seconds.
 */
'use strict';

var API = (typeof __exampleTest !== 'undefined' && __exampleTest.tvmaze) || 'https://api.tvmaze.com';
var PAGE = 50;
var DAY = 24 * 3600 * 1000;

async function getJSON(path) {
  var res = await fetch(API + path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('TVmaze answered HTTP ' + res.status);
  return res.json();
}

// localStorage keeps values between calls (per plugin and profile).
function cached(key, maxAge) {
  try {
    var entry = JSON.parse(localStorage.getItem(key) || 'null');
    return entry && Date.now() - entry.time < maxAge ? entry.value : undefined;
  } catch (e) { return undefined; }
}

function remember(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), value: value })); } catch (e) { /* full */ }
  return value;
}

function plain(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function idFor(show) {
  return show.externals && show.externals.imdb ? show.externals.imdb : 'tvmaze:' + show.id;
}

function years(show) {
  if (!show.premiered) return undefined;
  return show.premiered.slice(0, 4) + '–' + (show.ended ? show.ended.slice(0, 4) : '');
}

function preview(show) {
  return {
    id: idFor(show),
    type: 'series',
    name: show.name,
    poster: show.image ? (show.image.original || show.image.medium) : undefined,
    description: plain(show.summary),
    releaseInfo: years(show),
    genres: show.genres || []
  };
}

async function getCatalog(type, id, extra) {
  extra = extra || {};
  if (id === 'search') {
    if (!extra.search) return { metas: [] };
    var found = (await getJSON('/search/shows?q=' + encodeURIComponent(extra.search))) || [];
    return { metas: found.map(function (r) { return preview(r.show); }) };
  }
  if (id === 'today') {
    var date = new Date().toISOString().slice(0, 10);
    var shows = cached('today:' + date, 3600 * 1000);
    if (!shows) {
      var episodes = (await getJSON('/schedule/web?date=' + date)) || [];
      var seen = {};
      shows = [];
      episodes.forEach(function (episode) {
        var show = episode._embedded && episode._embedded.show;
        if (show && !seen[show.id]) { seen[show.id] = true; shows.push(preview(show)); }
      });
      remember('today:' + date, shows);
    }
    var skip = parseInt(extra.skip || '0', 10) || 0;
    var list = extra.genre ? shows.filter(function (s) { return s.genres.indexOf(extra.genre) >= 0; }) : shows;
    return { metas: list.slice(skip, skip + PAGE) };
  }
  return { metas: [] };
}

async function getMeta(type, id) {
  var tvmazeId = String(id).replace(/^tvmaze:/, '');
  var show = await getJSON('/shows/' + encodeURIComponent(tvmazeId) + '?embed=episodes');
  if (!show) return null;
  var meta = preview(show);
  meta.id = id;
  meta.background = meta.poster;
  meta.videos = ((show._embedded && show._embedded.episodes) || []).map(function (ep) {
    return {
      id: 'tvmaze:' + show.id + ':' + ep.season + ':' + ep.number,
      title: ep.name,
      season: ep.season,
      episode: ep.number,
      released: ep.airstamp || ep.airdate,
      thumbnail: ep.image ? ep.image.original : undefined,
      overview: plain(ep.summary)
    };
  });
  return { meta: meta };
}

// IMDb id → TVmaze show id, remembered for 30 days.
async function tvmazeShow(imdbId) {
  var key = 'imdb:' + imdbId;
  var known = cached(key, 30 * DAY);
  if (known !== undefined) return known;
  var show = await getJSON('/lookup/shows?imdb=' + encodeURIComponent(imdbId));
  return remember(key, show ? { id: show.id, url: show.url, rating: show.rating ? show.rating.average : null } : null);
}

async function getRatings(type, id, context) {
  var parts = String(id).split(':');
  var show;
  var season;
  var number;
  if (parts[0] === 'tvmaze') {
    var data = await getJSON('/shows/' + encodeURIComponent(parts[1]));
    show = data ? { id: data.id, url: data.url, rating: data.rating ? data.rating.average : null } : null;
    season = parts[2];
    number = parts[3];
  } else {
    show = await tvmazeShow(parts[0]);
    season = parts[1];
    number = parts[2];
  }
  if (!show) return [];
  if (season && number) {
    var episode = await getJSON('/shows/' + show.id + '/episodebynumber?season=' + season + '&number=' + number);
    var value = episode && episode.rating ? episode.rating.average : null;
    return value ? [{ source: 'tvmaze', value: value, url: episode.url }] : [];
  }
  return show.rating ? [{ source: 'tvmaze', value: show.rating, url: show.url }] : [];
}

module.exports = { getCatalog: getCatalog, getMeta: getMeta, getRatings: getRatings };
