// Plugin Webshare je sestavený z aktuálního parseru addonu? Porovná otisk parseru v hlavičce
// webshare/webshare.js s lib/engine.js + matcher.js v checkoutu addonu vedle (../webshare-stremio-docker,
// nebo cesta v WEBSHARE_ADDON). Bez checkoutu addonu se test přeskočí.
// Po opravě parseru v addonu: node webshare/build.mjs ../webshare-stremio-docker && npm test
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const addon = path.resolve(process.env.WEBSHARE_ADDON || path.join(__dirname, '..', '..', 'webshare-stremio-docker'));
const engine = path.join(addon, 'lib', 'engine.js');
if (!fs.existsSync(engine)) {
    console.log(`(webshare-sync: přeskočeno – addon nenalezen v ${addon})`);
    process.exit(0);
}
const head = fs.readFileSync(path.join(__dirname, '..', 'webshare', 'webshare.js'), 'utf8').slice(0, 600);
const built = (head.match(/parser ([0-9a-f]{12})\)/) || [])[1];
const now = crypto.createHash('sha1').update(fs.readFileSync(engine))
    .update(fs.readFileSync(path.join(addon, 'matcher.js'))).digest('hex').slice(0, 12);
const ver = (fs.readFileSync(path.join(addon, 'server.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
if (built !== now) {
    console.error(`✗ webshare/webshare.js je sestavený ze starého parseru (${built || 'bez otisku'}), addon ${ver} má ${now}.\n` +
        '  Sestavit znovu: node webshare/build.mjs ../webshare-stremio-docker');
    process.exit(1);
}
console.log(`webshare-sync: ✓ plugin = parser addonu ${ver} (${now})`);
