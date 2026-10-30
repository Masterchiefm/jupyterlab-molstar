// Copy the prebuilt Mol* viewer bundle into the labextension static dir so it
// can be loaded at runtime from /lab/extensions/jupyterlab-molstar/static/vendor/.
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'node_modules', 'molstar', 'build', 'viewer');
const dest = path.join(root, 'labextension', 'static', 'vendor');

if (!fs.existsSync(src)) {
  console.error(`Mol* viewer bundle not found at ${src}. Did jlpm install run?`);
  process.exit(1);
}
if (!fs.existsSync(path.join(dest, '..'))) {
  console.error(`Labextension output dir does not exist yet: ${path.join(dest, '..')}`);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

// molstar.js/molstar.css plus theme/*.css (light/blue) are self-contained:
// images are inlined data URIs, so no other assets are needed.
for (const f of ['molstar.js', 'molstar.css']) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
  console.log(`copied ${f}`);
}
const themeSrc = path.join(src, 'theme');
const themeDest = path.join(dest, 'theme');
fs.mkdirSync(themeDest, { recursive: true });
for (const f of fs.readdirSync(themeSrc)) {
  if (!f.endsWith('.css')) {
    continue;
  }
  fs.copyFileSync(path.join(themeSrc, f), path.join(themeDest, f));
  console.log(`copied theme/${f}`);
}
