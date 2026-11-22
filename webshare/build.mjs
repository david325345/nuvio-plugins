// Sestaví webshare/webshare.js z jádra addonu Webshare a zdrojů pluginu (webshare/src).
//   npm install && node webshare/build.mjs ../webshare-stremio-docker
// Jádro (lib/engine.js, matcher.js) se bere z checkoutu addonu, takže oprava parseru v addonu
// se do pluginu dostane dalším sestavením. Platforma a needle se nahradí verzemi pro Nuvio.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const engineDir = path.resolve(process.argv[2] || path.join(here, '..', '..', 'webshare-stremio-docker'));
const engineFile = path.join(engineDir, 'lib', 'engine.js');
if (!fs.existsSync(engineFile)) { console.error(`Jádro addonu nenalezeno: ${engineFile}`); process.exit(1); }

const server = fs.readFileSync(path.join(engineDir, 'server.js'), 'utf8');
const engineVersion = (server.match(/const VERSION = '([^']+)'/) || [])[1] || 'dev';
let commit = 'unknown';
try { commit = execFileSync('git', ['-C', engineDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (e) { /* bez gitu */ }
const pluginVersion = (fs.readFileSync(path.join(here, 'src', 'plugin.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];

const alias = {
    name: 'webshare-alias',
    setup(b) {
        b.onResolve({ filter: /^webshare-engine$/ }, () => ({ path: engineFile }));
        b.onResolve({ filter: /^needle$/ }, () => ({ path: path.join(here, 'src', 'needle.js') }));
        b.onResolve({ filter: /^\.\/platform$/ }, args =>
            path.resolve(args.resolveDir) === path.join(engineDir, 'lib') ? { path: path.join(here, 'src', 'platform.js') } : undefined);
    }
};

await build({
    entryPoints: [path.join(here, 'src', 'plugin.js')],
    outfile: path.join(here, 'webshare.js'),
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    inject: [path.join(here, 'src', 'timers.js')],
    define: { __ENGINE_VERSION__: JSON.stringify(engineVersion) },
    plugins: [alias],
    banner: { js: `// Webshare ${pluginVersion} – plugin pro Nuvio na Apple TV. SESTAVENO, needitovat ručně.\n` +
        `// Zdroj: github.com/david325345/nuvio-plugins/tree/main/webshare/src + jádro addonu ` +
        `github.com/david325345/webshare-stremio-docker ${engineVersion} (${commit}).` },
    logLevel: 'warning'
});
const size = fs.statSync(path.join(here, 'webshare.js')).size;
console.log(`webshare/webshare.js: ${(size / 1024).toFixed(0)} kB (plugin ${pluginVersion}, jádro ${engineVersion} ${commit})`);
