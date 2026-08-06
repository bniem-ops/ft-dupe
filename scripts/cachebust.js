// CI-only: appends a ?v=<commit-sha> query string to every local script/
// link src in ui/index.html so browsers (mobile Safari especially) can't
// serve a stale cached copy after a deploy — the URL itself changes every
// commit, forcing a fresh fetch. Runs against the checked-out working copy
// in the build job, right before it's uploaded as the Pages artifact; the
// committed ui/index.html in the repo stays plain (no query strings) so
// local dev (scripts/serve.js) is unaffected. Only busts the entry
// document's own src/href attributes (the app's real dependency graph —
// engine/dist, vendored libs, generated data — isn't busted this way; a
// deeper fix isn't needed yet since those rarely change independently of
// the entry script).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sha = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 8);
const indexPath = path.join(__dirname, '..', 'ui', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Matches relative src/href values of any depth (styles.css, src/app.js,
// ../data/firebase-config.js) but not absolute/external URLs (no ":").
html = html.replace(/(src|href)="([^":]+\.(?:js|css))"/g, (match, attr, url) => `${attr}="${url}?v=${sha}"`);

fs.writeFileSync(indexPath, html);
console.log(`Cache-busted local assets in ui/index.html with ?v=${sha}`);
