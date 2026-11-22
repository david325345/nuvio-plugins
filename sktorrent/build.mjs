// Sestaví sktorrent/sktorrent.js z kódu addonu SKTorrent (lib/) a zdrojů pluginu (sktorrent/src).
//   npm install && node sktorrent/build.mjs ../sktorrent-realdebrid-docker
// Volitelně SKT_ARCHIVE_URL=https://…/api/archive – adresa serveru addonu pro anonymní archiv hledání
// (bez ní plugin volbu „Pomoct vylepšit hledání“ nenabízí).
// Parser a hledání se berou z checkoutu addonu, takže oprava v addonu se do pluginu dostane dalším sestavením.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shared = path.join(here, '..', 'shared');
const addonDir = path.resolve(process.argv[2] || path.join(here, '..', '..', 'sktorrent-realdebrid-docker'));
const lib = path.join(addonDir, 'lib');
if (!fs.existsSync(path.join(lib, 'handlers.js'))) { console.error(`Kód addonu nenalezen: ${lib}/handlers.js`); process.exit(1); }

const addonVersion = JSON.parse(fs.readFileSync(path.join(addonDir, 'package.json'), 'utf8')).version;
let commit = 'unknown';
try { commit = execFileSync('git', ['-C', addonDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (e) { /* bez gitu */ }
const pluginVersion = (fs.readFileSync(path.join(here, 'src', 'plugin.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
const archiveUrl = (process.env.SKT_ARCHIVE_URL || '').trim();

const inLib = args => path.resolve(args.resolveDir) === lib;
const alias = {
    name: 'sktorrent-alias',
    setup(b) {
        // kód addonu; cache a archiv mají v pluginu vlastní náhradu (NUVIO.files, odeslání na server)
        b.onResolve({ filter: /^skt\/(cache|archive)$/ }, args => ({ path: path.join(here, 'src', `${args.path.slice(4)}.js`) }));
        b.onResolve({ filter: /^skt\/[a-z]+$/ }, args => ({ path: path.join(lib, `${args.path.slice(4)}.js`) }));
        b.onResolve({ filter: /^\.\/(cache|archive)$/ }, args => (inLib(args) ? { path: path.join(here, 'src', `${args.path.slice(2)}.js`) } : undefined));
        b.onResolve({ filter: /^axios$/ }, () => ({ path: path.join(shared, 'axios.js') }));
        b.onResolve({ filter: /^https$/ }, () => ({ path: path.join(here, 'src', 'https.js') }));
        b.onResolve({ filter: /^crypto$/ }, () => ({ path: path.join(here, 'src', 'crypto.js') }));
        b.onResolve({ filter: /^cheerio$/ }, () => ({ path: 'cheerio', external: true }));   // cheerio dává Nuvio
    }
};

await build({
    entryPoints: [path.join(here, 'src', 'plugin.js')],
    outfile: path.join(here, 'sktorrent.js'),
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    inject: [path.join(shared, 'timers.js'), path.join(shared, 'node-globals.js')],
    define: {
        __ADDON_VERSION__: JSON.stringify(addonVersion),
        __ARCHIVE_URL__: JSON.stringify(archiveUrl),
        __PLUGIN_ENV__: JSON.stringify(JSON.stringify({ CSFD_URL: '', CSFD_PUBLIC_URL: 'https://csfd-rating.duckdns.org' }))
    },
    plugins: [alias],
    banner: { js: `// SKTorrent ${pluginVersion} – plugin pro Nuvio na Apple TV. SESTAVENO, needitovat ručně.\n` +
        `// Zdroj: github.com/david325345/nuvio-plugins/tree/main/sktorrent/src + kód addonu ` +
        `github.com/david325345/sktorrent-realdebrid-docker ${addonVersion} (${commit}).` },
    logLevel: 'warning'
});
const size = fs.statSync(path.join(here, 'sktorrent.js')).size;
console.log(`sktorrent/sktorrent.js: ${(size / 1024).toFixed(0)} kB (plugin ${pluginVersion}, addon ${addonVersion} ${commit})${archiveUrl ? `, archiv ${archiveUrl}` : ', bez archivu'}`);
