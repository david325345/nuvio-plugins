# Nuvio pluginy pro Apple TV

Repozitář pluginů pro Nuvio (Apple TV, fork NuvioTVOS s podporou pluginů).
Instalace: **Nastavení → Integrace → Plugins → Repository URL** a vložit

```
https://raw.githubusercontent.com/david325345/nuvio-plugins/main/manifest.json
```

## Usenet Direct

Hledá filmy a seriály na Newznab indexerech podle IMDb ID a vrací streamy s
`nzbUrl`, které přehraje **Nuvio Usenet** přímo z usenet serveru (servery se
zadávají v Nastavení → Usenet). Všechno běží v Apple TV: klíče k indexerům
neopustí zařízení, jdou jen na indexer.

| | |
|---|---|
| **Indexery** | NZBGeek, altHUB, Usenet-Crawler, DogNZB a jeden vlastní (název, adresa API, klíč). Hledá se na všech vyplněných najednou. |
| **Filmy** | `t=movie&imdbid=…&cat=2000`, až 2 stránky po 100. |
| **Seriály** | `imdbid`, když ho indexer u seriálů umí, jinak IMDb → TVmaze → `tvdbid`, záloha `tvmazeid`; nejvýš 2 dotazy na indexer. |
| **Cache** | V `localStorage` pluginu na Apple TV: schopnosti indexeru (`t=caps`) den, TVmaze 90 dní, výsledky hledání hodinu (prázdné 15 min). Opakované otevření stejného filmu nebo dílu indexer nevolá. |
| **Limity** | Když indexer ohlásí vyčerpaný denní limit, do půlnoci UTC se přeskakuje. |
| **Filtr a řazení** | Bez hesla, jen požadovaný film/díl, max. rozlišení, velikost, CAM/TS; CZ/SK dabing a titulky nahoru, pak rozlišení, zdroj, velikost. |
| **Nastavení** | Klíče, vlastní indexer, rozlišení, počet výsledků, max. velikosti, CZ/SK, CAM. Tlačítko **Verify** ověří klíče (`t=caps`). |

Plugin je jen pro Apple TV (`supportedPlatforms: ["tvos"]`) — Nuvio na Androidu
ho nenabídne, protože neumí přehrát `nzbUrl`.

## Rozšíření formátu Nuvio pluginů na Apple TV

Pluginy jsou ve stejném formátu jako v Nuvio pro Android (`manifest.json` se
seznamem `scrapers`, funkce `getStreams(tmdbId, mediaType, season, episode)`
a `onSettings()`). Apple TV k tomu navíc umí:

- pátý argument `getStreams`: `{ imdbId, tmdbId, videoId, type, season, episode, platform: "tvos" }`,
- výsledek s `nzbUrl` (a `fileMustInclude`, `fileIdx`) místo `url` — přehraje Nuvio Usenet;
  dál také Stremio pole `description` a `behaviorHints`,
- `onVerify(settings)` → `{ ok, message }` pro tlačítko Verify v nastavení,
- `localStorage` (na plugin a profil, max. 2 MB),
- `NUVIO_PLATFORM === "tvos"`.

## Testy

```
node test/plugin.test.js
```

Spustí plugin stejně jako Apple TV (prázdný JavaScript kontext s polyfilly
z aplikace) proti lokálnímu falešnému indexeru a TVmaze.
