/**
 * Example: OpenSubtitles — a subtitles plugin for Nuvio on Apple TV.
 *
 * Shows the Apple TV `getSubtitles(type, id, context)` extension: it asks the
 * public OpenSubtitles v3 add-on for Stremio and keeps only the languages
 * chosen in the settings. The manifest lists it with
 * `"resources": ["subtitles"]`, `"idPrefixes": ["tt"]` and
 * `"supportedPlatforms": ["tvos"]`.
 *
 *   type     "movie" or "series"
 *   id       Stremio video id: "tt0133093", "tt0903747:1:1"
 *   context  { imdbId, tmdbId, season, episode, filename, videoSize, videoHash, platform }
 *   returns  [{ url, lang, label }] — lang preferably ISO 639-2 ("cze", "slo", "eng")
 */
'use strict';

var BASE = (typeof __exampleTest !== 'undefined' && __exampleTest.base) || 'https://opensubtitles-v3.strem.io';

var LANGUAGES = {
  'cs-sk': ['cze', 'ces', 'cs', 'slo', 'slk', 'sk'],
  'cs': ['cze', 'ces', 'cs'],
  'en': ['eng', 'en'],
  'all': null
};

function onSettings() {
  return [
    {
      type: 'select',
      key: 'languages',
      label: 'Languages',
      options: [
        { label: 'Czech and Slovak', value: 'cs-sk' },
        { label: 'Czech', value: 'cs' },
        { label: 'English', value: 'en' },
        { label: 'All languages', value: 'all' }
      ],
      defaultValue: 'cs-sk'
    },
    {
      type: 'info',
      label: 'Example plugin',
      description: 'Shows how getSubtitles() works on Apple TV. Subtitles come from the OpenSubtitles v3 add-on for Stremio.'
    }
  ];
}

// Stremio's optional extras: /subtitles/{type}/{id}/filename=…&videoSize=…&videoHash=….json
function extraPath(context) {
  var parts = [];
  if (context.filename) parts.push('filename=' + encodeURIComponent(context.filename));
  if (context.videoSize) parts.push('videoSize=' + context.videoSize);
  if (context.videoHash) parts.push('videoHash=' + encodeURIComponent(context.videoHash));
  return parts.length ? '/' + parts.join('&') : '';
}

async function getSubtitles(type, id, context) {
  context = context || {};
  if (!/^tt\d+/.test(id)) return [];
  var settings = typeof SCRAPER_SETTINGS === 'object' && SCRAPER_SETTINGS ? SCRAPER_SETTINGS : {};
  var wanted = LANGUAGES.hasOwnProperty(settings.languages) ? LANGUAGES[settings.languages] : LANGUAGES['cs-sk'];

  var url = BASE + '/subtitles/' + (type === 'series' ? 'series' : 'movie') + '/' + encodeURIComponent(id) + extraPath(context) + '.json';
  var res = await fetch(url);
  if (!res.ok) throw new Error('OpenSubtitles answered HTTP ' + res.status);
  var data = await res.json();
  var list = (data && Array.isArray(data.subtitles)) ? data.subtitles : [];

  var result = list
    .filter(function (sub) {
      var lang = String((sub && sub.lang) || '').toLowerCase();
      return sub && sub.url && (!wanted || wanted.indexOf(lang) >= 0);
    })
    .map(function (sub) {
      return { url: sub.url, lang: sub.lang, label: 'OpenSubtitles ' + String(sub.lang).toUpperCase() };
    });
  console.log(id + ': ' + result.length + ' of ' + list.length + ' subtitles' + (context.filename ? ' for ' + context.filename : ''));
  return result;
}

module.exports = { getSubtitles: getSubtitles, onSettings: onSettings };
