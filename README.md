# Nuvio plugins for Apple TV

Plugin repository for Nuvio on Apple TV (the NuvioTVOS fork with plugin support),
and the documentation of what plugins can do there.
Install it in **Settings → Integrations → Plugins → Repository URL**:

```
https://raw.githubusercontent.com/david325345/nuvio-plugins/main/manifest.json
```

The repository list syncs with your Nuvio account, so adding it on nuvio.tv works too.

### Set up from a computer

Typing API keys with the Siri Remote is slow. In **Settings → Integrations →
Plugins → Set Up from a Computer** the Apple TV shows an address and a QR code;
open it in a browser on a computer or phone on the same network to add
repositories, enter provider settings, run a test search and read the logs.
The page works only while that screen is open on the TV (and stops after 15
minutes without use), and saved keys are never shown in full. With **Keep the
Same Address** the address doesn't change between visits, so you can bookmark
it (give the Apple TV a fixed IP address in your router too); **New Address**
changes the code in it.

## Usenet Direct

Searches Newznab indexers for movies and episodes by IMDb id and returns streams
with `nzbUrl`, which **Nuvio Usenet** plays straight from your usenet server
(servers are set in Settings → Usenet). Everything runs on the Apple TV: your
indexer keys never leave it except to the indexer itself.

| | |
|---|---|
| **Indexers** | NZBGeek, altHUB, Usenet-Crawler, DogNZB and one custom indexer (name, API URL, key). Every indexer with a key is searched at once. |
| **Movies** | `t=movie&imdbid=…&cat=2000`, up to 2 pages of 100. |
| **Series** | `imdbid` where the indexer supports it for TV, otherwise IMDb → TVmaze → `tvdbid`, then `tvmazeid`; at most 2 requests per indexer. |
| **Cache** | In the plugin's `localStorage` on the Apple TV: indexer capabilities (`t=caps`) for a day, TVmaze for 90 days, search results for an hour (empty ones 15 min). Opening the same movie or episode again doesn't call the indexer. |
| **Limits** | When an indexer reports its daily limit, it is skipped until midnight UTC. |
| **Filtering and order** | No passworded releases, only the requested movie/episode, max resolution, size, CAM/TS; Czech/Slovak audio and subtitles first, then resolution, source and size. |
| **Settings** | Keys, custom indexer, resolution, results per indexer, size limits, CZ/SK, CAM. **Verify** checks the keys (`t=caps`). |

The plugin runs on Apple TV only (`supportedPlatforms: ["tvos"]`); Nuvio on
Android doesn't offer it because it can't play `nzbUrl` streams.

## The plugin format on Apple TV

Plugins use the same format as Nuvio on Android (`manifest.json` with a
`scrapers` list, `getStreams(tmdbId, mediaType, season, episode)` and
`onSettings()`), and get the same environment: `fetch`, `cheerio`, `CryptoJS`,
`require()` for both, `TMDB_API_KEY`, `SCRAPER_SETTINGS`. Apple TV adds:

- a fifth `getStreams` argument: `{ imdbId, tmdbId, videoId, type, season, episode, platform: "tvos" }`,
- results with `nzbUrl` (and `fileMustInclude`, `fileIdx`) instead of `url`, played by Nuvio Usenet;
  the Stremio fields `description` and `behaviorHints` are read too,
- `onVerify(settings)` → `{ ok, message }` for the Verify button in the settings,
- `localStorage` (per plugin and profile, up to 2 MB),
- `NUVIO_PLATFORM === "tvos"`,
- subtitles, catalogs, metadata, search and ratings from plugins (below).

### Subtitles

A provider can give subtitles instead of (or besides) streams. List it in the
manifest with the resources it answers:

```json
{
  "id": "my-subs",
  "name": "My Subtitles",
  "filename": "my-subs.js",
  "supportedTypes": ["movie", "series"],
  "resources": ["subtitles"],
  "idPrefixes": ["tt"],
  "supportedPlatforms": ["tvos"]
}
```

- `resources`: `"stream"` (`getStreams`, the default when the key is missing)
  and/or `"subtitles"` (`getSubtitles`).
- `idPrefixes` (optional): only content whose id starts with one of these.
- `supportedPlatforms: ["tvos"]` keeps a provider without `getStreams` out of
  Nuvio on Android, which only knows streams and ignores the other keys.

```js
async function getSubtitles(type, id, context) {
  // type: "movie" | "series"; id: Stremio video id ("tt0133093", "tt0903747:1:1")
  // context: { imdbId, tmdbId, season, episode, filename, videoSize, videoHash, platform }
  return [{ url: 'https://…/file.srt', lang: 'cze', label: 'Release name' }];
}
module.exports = { getSubtitles };
```

Return `[{ url, lang, label }]` (or `{ subtitles: [...] }` like a Stremio
add-on). `url` must be http(s); `lang` is best an ISO 639-2 code (`cze`,
`slo`, `eng`) so the player's preferred-language matching picks it. The player
asks every enabled subtitle provider when playback starts, next to the
subtitle add-ons, with a 20-second limit; answers are kept for 10 minutes
(saving a provider's settings clears them).

The [examples](examples) repository has a working one —
`Example: OpenSubtitles`, which filters the OpenSubtitles v3 add-on by language
(the same repository has `Example: TVmaze`, below):

```
https://raw.githubusercontent.com/david325345/nuvio-plugins/main/examples/manifest.json
```

### Catalogs, metadata, search and ratings

A provider can also fill Home and Discover rows, Details and the ratings. The
app treats it as a Stremio add-on that exists only on the Apple TV, so the
answers use the Stremio / Nuvio add-on formats, and the rows can be ordered and
hidden in Settings like any add-on's. Nothing is added to the add-on list that
syncs with the account.

```json
{
  "id": "my-catalogs",
  "name": "My Catalogs",
  "filename": "my-catalogs.js",
  "supportedTypes": ["series"],
  "resources": ["catalog", "meta", "ratings"],
  "idPrefixes": ["mysite:", "tt"],
  "catalogs": [
    { "type": "series", "id": "new", "name": "New", "extra": [{ "name": "skip" }, { "name": "genre", "options": ["Drama"] }] },
    { "type": "series", "id": "search", "name": "My Site", "extra": [{ "name": "search", "isRequired": true }] }
  ],
  "ratingSources": [{ "source": "mysite", "name": "My Site", "max": 10, "episodes": true }],
  "supportedPlatforms": ["tvos"]
}
```

```js
// catalogs (Home, Discover; a catalog with a "search" extra is used for search)
async function getCatalog(type, id, extra) {   // extra: { skip, genre, search } as strings
  return { metas: [{ id: 'tt0903747', type: 'series', name: 'Breaking Bad', poster: 'https://…' }] };
}
// metadata — only for the provider's own prefixes (here "mysite:"); tt/tmdb ids keep Cinemeta/TMDB
async function getMeta(type, id) {
  return { meta: { id, type, name: '…', poster: '…', description: '…',
    videos: [{ id: id + ':1:1', title: 'Pilot', season: 1, episode: 1, released: '2024-01-01' }] } };
}
// ratings — for the provider's idPrefixes (all ids without them); episodes come as "tt…:1:2"
async function getRatings(type, id, context) {
  return [{ source: 'mysite', value: 8.4, url: 'https://…' }];
}
module.exports = { getCatalog, getMeta, getRatings };
```

- `metas` and `meta` follow the Stremio add-on format (`id`, `type`, `name`,
  `poster`, `background`, `description`, `releaseInfo`, `genres`, `videos`…).
  List IMDb ids (`tt…`) where you have them: Details, streams from other
  add-ons and plugins, and ratings then work for those items as usual.
- `ratingSources` is Nuvio's add-on format (`source`, `name`, `icon`, `max`,
  `episodes`); the sources show up in the rating settings. The built-in
  sources (IMDb, TMDB, Rotten Tomatoes…) can't be replaced.
- Every call must answer within **8 seconds** (the app's add-on time limit).
  Answers are kept for a while (catalogs 10 minutes, searches 2, metadata and
  ratings an hour); keep slow lookups in `localStorage` yourself.

`Example: TVmaze` in the [examples](examples) repository does all four
(catalog, search, metadata for shows without an IMDb id, show and episode
ratings) with the free TVmaze API.

### Writing and testing a plugin

- **Test** (next to each provider on the TV and on the setup page) runs one
  search for The Matrix or Breaking Bad S1E1 (or any IMDb id on the page) and
  shows what the provider offers — streams, subtitles, the first catalog, a
  search, metadata of a catalog item with its own id, ratings — with the time
  it took and everything the plugin logged.
- **Developer mode** (per repository) downloads the plugin code again before
  every search, so you can edit and retry without bumping versions. GitHub's
  raw files are cached for up to 5 minutes; for instant changes serve the
  folder from your computer (`npx http-server -p 8080`) and add
  `http://<computer-ip>:8080/manifest.json`.
- **Logs** show the latest `console.log` / `warn` / `error` lines per provider;
  the setup page refreshes them live.

## Tests

```
node test/plugin.test.js
node test/example-subtitles.test.js
node test/example-tvmaze.test.js
```

Runs the plugins the way Apple TV does (a bare JavaScript context with the
app's polyfills) against local fake servers. To test your own plugin, copy
`test/harness.js` and `test/nuvio-tvos-polyfills.js`:

```js
const { createRuntime } = require('./harness');
const rt = createRuntime({ code: fs.readFileSync('my-plugin.js', 'utf8'), scraperId: 'my-plugin' });
const subs = await rt.call({ /* settings */ }, 'getSubtitles', ['movie', 'tt0133093', { imdbId: 'tt0133093' }]);
```
