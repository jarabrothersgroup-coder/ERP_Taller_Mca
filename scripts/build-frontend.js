/**
 * Build Script — AutomotiveOS Frontend
 *
 * Bundles all JS modules into optimized chunks with minification.
 * Run: node scripts/build-frontend.js
 *
 * @module scripts/build-frontend
 */

import { build } from 'esbuild';
import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_DIR = join(ROOT, 'src', 'shared', 'public');
const DIST_DIR = join(ROOT, 'dist', 'public');

// Ensure dist directory exists
if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}

// Get all JS module files
const jsDir = join(PUBLIC_DIR, 'js');
const moduleFiles = readdirSync(jsDir)
  .filter(f => f.endsWith('.js'))
  .map(f => join(jsDir, f));

console.log(`[build] Bundling ${moduleFiles.length} JS modules...`);

async function buildFrontend() {
  // 1. Bundle all modules + app.js into a single optimized file
  const result = await build({
    entryPoints: [...moduleFiles, join(PUBLIC_DIR, 'app.js')],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    format: 'iife',
    globalName: 'AutomotiveOS',
    outfile: join(DIST_DIR, 'app.bundle.js'),
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    drop: ['debugger'],
    treeShaking: true,
    mangleProps: /^_/,
    reserveProps: /^__/,
  });

  console.log(`[build] ✓ app.bundle.js created`);

  // 2. Copy static assets
  const staticFiles = [
    'index.html',
    'manifest.json',
    'sw.js',
    'icon.svg',
  ];

  for (const file of staticFiles) {
    const src = join(PUBLIC_DIR, file);
    const dst = join(DIST_DIR, file);
    if (existsSync(src)) {
      copyFileSync(src, dst);
      console.log(`[build] ✓ ${file} copied`);
    }
  }

  // 3. Update index.html to use bundled JS
  const { readFileSync, writeFileSync } = await import('fs');
  const htmlPath = join(DIST_DIR, 'index.html');
  let html = readFileSync(htmlPath, 'utf-8');

  // Replace all individual script tags with single bundle
  const scriptRegex = /<script src="js\/[^"]+"><\/script>\s*\n/g;
  html = html.replace(scriptRegex, '');

  // Replace core app.js with bundle
  html = html.replace(
    '<script src="app.js"></script>',
    '<script src="app.bundle.js"></script>'
  );

  writeFileSync(htmlPath, html);
  console.log(`[build] ✓ index.html updated to use bundle`);

  // 4. Report sizes
  const { statSync } = await import('fs');
  const bundleSize = statSync(join(DIST_DIR, 'app.bundle.js')).size;
  const originalSize = moduleFiles.reduce((sum, f) => sum + statSync(f).size, 0) + statSync(join(PUBLIC_DIR, 'app.js')).size;

  console.log(`\n[build] 📊 Results:`);
  console.log(`  Original: ${(originalSize / 1024).toFixed(1)} KB (${moduleFiles.length + 1} files)`);
  console.log(`  Bundled:  ${(bundleSize / 1024).toFixed(1)} KB (1 file)`);
  console.log(`  Saved:    ${((1 - bundleSize / originalSize) * 100).toFixed(1)}%`);
  console.log(`\n[build] 🚀 Build complete!`);
}

buildFrontend().catch((err) => {
  console.error('[build] ❌ Build failed:', err);
  process.exit(1);
});
