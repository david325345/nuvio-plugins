# Nuvio plugins for Apple TV

Plugin repository for Nuvio on Apple TV (the NuvioTVOS fork with plugin support).
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
minutes without use), and saved keys are never shown in full.

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
- `NUVIO_PLATFORM === "tvos"`.

### Writing and testing a plugin

- **Test** (next to each provider on the TV and on the setup page) runs one
  search for The Matrix or Breaking Bad S1E1 (or any IMDb id on the page) and
  shows the streams, the time it took and everything the plugin logged.
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
```

Runs the plugin the way Apple TV does (a bare JavaScript context with the
app's polyfills) against a local fake indexer and TVmaze.
