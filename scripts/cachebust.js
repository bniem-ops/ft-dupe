// CI-only: appends a ?v=<commit-sha> query string to every local script/
// link src in index.html so browsers (mobile Safari especially) can't
// serve a stale cached copy after a deploy — the URL itself changes every
// commit, forcing a fresh fetch. Runs against the checked-out working copy
// in the build job, right before it's uploaded as the Pages artifact; the
// committed index.html in the repo stays plain (no query strings) so local
// dev is unaffected.
const fs = require('fs');
const path = require('path');

const sha = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 8);
const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/(src|href)="((?:data\/)?[\w.-]+\.(?:js|css))"/g, (match, attr, url) => `${attr}="${url}?v=${sha}"`);

fs.writeFileSync(indexPath, html);
console.log(`Cache-busted local assets in index.html with ?v=${sha}`);
