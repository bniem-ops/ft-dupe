// Copies the pre-built browser ESM files that preact/htm already ship into
// ui/vendor/, so the UI can load them via a plain <script type="module">
// + import map (see ui/index.html) with no bundler and no CDN dependency.
// Re-run after a deliberate version bump (npm run vendor-libs); the copied
// files are committed to git like any other vendored asset.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'ui', 'vendor');

const FILES = [
  ['node_modules/preact/dist/preact.module.js', 'preact.js'],
  ['node_modules/preact/hooks/dist/hooks.module.js', 'hooks.js'],
  ['node_modules/htm/dist/htm.module.js', 'htm.js'],
  // Pre-bound htm+preact combo (exports `html`) — avoids manual htm.bind(h).
  ['node_modules/htm/preact/index.module.js', 'htm-preact.js'],
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [src, destName] of FILES) {
  const srcPath = path.join(ROOT, src);
  const destPath = path.join(OUT_DIR, destName);
  fs.copyFileSync(srcPath, destPath);
  console.log(`Copied ${src} -> ui/vendor/${destName}`);
}
