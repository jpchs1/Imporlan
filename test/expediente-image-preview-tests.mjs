/** Browser regression using the real admin/customer components and a real HEIC.
 * npm --prefix admin-react ci
 * npm install --prefix /tmp/imporlan-browser-tests playwright
 * PLAYWRIGHT_MODULE=/tmp/imporlan-browser-tests/node_modules/playwright/index.mjs \
 *   CHROMIUM_PATH=/usr/bin/chromium node test/expediente-image-preview-tests.mjs
 * HEIC_FIXTURE / HEIC_DECODER can point to pre-downloaded copies for offline runs.
 * All API requests use synthetic signed links. No production data is accessed.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(repo, 'admin-react/package.json'));
const { createServer } = await import(require.resolve('vite'));
const { default: react } = await import(require.resolve('@vitejs/plugin-react'));
const { default: tailwind } = await import(require.resolve('@tailwindcss/vite'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = async (env, url) => {
  if (process.env[env]) return readFile(process.env[env]);
  const response = await fetch(url);
  assert.ok(response.ok, `Fixture unavailable: ${url}`);
  return Buffer.from(await response.arrayBuffer());
};
const heic = await fixture('HEIC_FIXTURE', 'https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic');
const decoder = await fixture('HEIC_DECODER', 'https://cdn.jsdelivr.net/npm/heic-to@1.6.6/+esm');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=', 'base64');
const harness = await readFile(join(repo, 'test/fixtures/expediente-image-preview.jsx'), 'utf8');
const csp = (await readFile(join(repo, '.htaccess'), 'utf8')).match(/Header set Content-Security-Policy "([^"]+)"/)[1];
const entry = '/__image-test.jsx';
const server = await createServer({
  root: join(repo, 'admin-react'), configFile: false, base: '/',
  plugins: [react(), tailwind(), {
    name: 'expediente-image-test',
    resolveId: id => id === entry ? id : null,
    load: id => id === entry ? harness : null,
    configureServer(s) {
      s.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/api/expediente_files_api.php?action=download')) {
          res.setHeader('Content-Type', 'image/heic');
          res.setHeader('Content-Disposition', 'attachment; filename=original.HEIC');
          res.end(heic); return;
        }
        if (!req.url.startsWith('/__image-test?')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Security-Policy', csp);
        res.end(`<html><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="${entry}"></script></body></html>`);
      });
    },
  }], server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const temp = await mkdtemp(join(tmpdir(), 'imporlan-image-preview-'));
let passed = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log(`PASS ${++passed}: ${label}`); };
async function pageFor(mode, viewport = { width: 1440, height: 1100 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const stats = { decoder: 0, files: new Map(), active: 0, maxActive: 0, errors: [] };
  page.on('pageerror', error => { stats.errors.push(error.message); console.error('BROWSER ERROR:', mode, error.message); });
  await page.addInitScript(() => {
    window.previewUrls = new Set();
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); window.previewUrls.add(url); return url; };
    URL.revokeObjectURL = url => { window.previewUrls.delete(url); revoke(url); };
  });
  await page.route('https://cdn.jsdelivr.net/npm/heic-to@1.6.6/+esm', route => {
    stats.decoder++;
    return route.fulfill({ contentType: 'text/javascript', body: decoder });
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('operador_usa.php')) return route.fulfill({ json: {
      operador: { nombre: 'David Morris' }, hito_en_curso: 'inspeccion', updates: [{ id: 1, created_at: '2026-10-23 15:51:00', file_ids: Array.from({ length: 30 }, (_, i) => i + 1) }],
    } });
    if (url.pathname.endsWith('orders_api.php')) return route.fulfill({ json: { orders: [{ id: 35, order_number: 'IMP-TEST' }] } });
    if (url.pathname.endsWith('reports_api.php')) return route.fulfill({ json: { reports: [] } });
    if (url.searchParams.get('action') === 'list') return route.fulfill({ json: { files: [{ id: 1, category: 'image', mime_type: 'image/heic', original_name: 'IMG_1.HEIC', download_url: '/api/expediente_files_api.php?action=download&id=1&exp=9999999999&sig=test-1' }] } });
    if (url.pathname.endsWith('/expired')) return route.fulfill({ status: 403, json: { error: 'Enlace vencido' } });
    if (url.pathname.endsWith('/corrupt')) return route.fulfill({ contentType: 'image/heic', body: 'corrupt file' });
    if (url.pathname.endsWith('/jpeg')) return route.fulfill({ contentType: 'image/png', body: png });
    const id = url.searchParams.get('id');
    stats.files.set(id, (stats.files.get(id) || 0) + 1);
    stats.active++; stats.maxActive = Math.max(stats.maxActive, stats.active);
    await route.fulfill({ contentType: 'image/heic', headers: { 'Content-Disposition': 'attachment; filename="original.HEIC"' }, body: heic });
    stats.active--;
  });
  await page.goto(`${origin}/__image-test?mode=${mode}`);
  return { page, context, stats };
}
async function loaded(page, selector, count) {
  await page.waitForFunction(({ selector, count }) => {
    const images = [...document.querySelectorAll(selector)];
    return images.length === count && images.every(img => img.complete && img.naturalWidth > 0);
  }, { selector, count }, { timeout: 60000 });
}
try {
  let t = await pageFor('native');
  await loaded(t.page, 'main img', 1);
  check(t.stats.decoder === 0, 'native images load without downloading the HEIC decoder');
  const rawFails = await t.page.evaluate(async () => {
    const img = new Image();
    return new Promise(resolve => { img.onload = () => resolve(false); img.onerror = () => resolve(true); img.src = '/api/expediente_files_api.php?action=download&id=raw'; });
  });
  check(rawFails, 'Chromium reproduces the broken native HEIC image');
  await t.context.close();

  t = await pageFor('admin');
  await loaded(t.page, '#operacion-usa img', 30);
  check(t.stats.decoder === 1, 'all 30 admin HEIC thumbnails render using one decoder load');
  check(t.stats.maxActive <= 2, 'HEIC batch downloads are serialized (plus native mislabeled-image attempt)');
  const requests = t.stats.files.get('1');
  const baselineUrls = await t.page.evaluate(() => window.previewUrls.size);
  await t.page.getByRole('button', { name: 'Ver IMG_1.HEIC', exact: true }).click();
  await loaded(t.page, '[role="dialog"] img', 1);
  check(t.stats.files.get('1') === requests, 'lightbox reuses the decoded thumbnail without another download');
  check(await t.page.getByRole('button', { name: 'Descargar', exact: true }).isEnabled(), 'lightbox provides the validated original-file download');
  const downloading = t.page.waitForEvent('download');
  await t.page.locator('[aria-label="Descargar"]').click();
  const download = await downloading;
  const path = join(temp, 'original.heic');
  await download.saveAs(path);
  const downloaded = await readFile(path);
  check(downloaded.equals(heic), 'downloaded original is byte-for-byte unchanged');
  await t.page.keyboard.press('ArrowRight');
  await loaded(t.page, '[role="dialog"] img', 1);
  check(await t.page.locator('[role="dialog"] img').getAttribute('alt') === 'MISLABELLED.jpg', 'mislabelled HEIC is detected by its bytes and works in the lightbox');
  await t.page.keyboard.press('Escape');
  await t.page.waitForFunction(count => window.previewUrls.size === count, baselineUrls);
  check(t.stats.errors.length === 0, 'admin preview opens, navigates, and closes without application errors or leaked lightbox blobs');
  if (process.env.IMAGE_PREVIEW_SCREENSHOTS) await t.page.screenshot({ path: join(process.env.IMAGE_PREVIEW_SCREENSHOTS, 'admin-heic-fixed.png'), fullPage: true });
  await t.context.close();

  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    t = await pageFor('customer', viewport);
    await t.page.getByRole('button', { name: 'Ver IMG_1.HEIC', exact: true }).first().waitFor();
    // Each converted blob still uses native lazy loading. Bring every photo
    // into view and wait for it before moving to the next row.
    const photos = t.page.locator('main button[aria-label^="Ver "]');
    for (let i = 0; i < await photos.count(); i++) {
      const photo = photos.nth(i);
      await photo.scrollIntoViewIfNeeded();
      await photo.locator('img').waitFor();
      await photo.locator('img').evaluate(img => img.decode());
    }
    await t.page.evaluate(() => window.scrollTo(0, 0));
    await loaded(t.page, 'main img', 40); // 8 gallery + 2 update + 30 documents
    check(t.stats.decoder === 1, `customer galleries render on ${viewport.width}px, sharing the same conversion cache`);
    await t.page.getByRole('button', { name: 'Ver IMG_1.HEIC', exact: true }).first().click();
    await loaded(t.page, '[role="dialog"] img', 1);
    check(t.stats.errors.length === 0, `customer lightbox works on ${viewport.width}px`);
    await t.page.keyboard.press('Escape');
    if (process.env.IMAGE_PREVIEW_SCREENSHOTS) await t.page.screenshot({ path: join(process.env.IMAGE_PREVIEW_SCREENSHOTS, `customer-heic-fixed-${viewport.width}.png`), fullPage: true });
    await t.context.close();
  }
  t = await pageFor('documents');
  await loaded(t.page, 'main img', 1);
  check(t.stats.errors.length === 0, 'customer Documents page also renders a real HEIC thumbnail');
  await t.context.close();
  t = await pageFor('error');
  await t.page.waitForFunction(() => document.querySelectorAll('[role="img"]').length === 2 && [...document.querySelectorAll('[role="img"]')].every(e => e.textContent.includes('Vista no disponible')));
  check(t.stats.decoder === 0 && t.stats.errors.length === 0, 'expired/corrupt files show a usable fallback without loops or decoding an error response');
  await t.context.close();
  console.log(`${passed} image preview checks passed.`);
} finally {
  await browser.close(); await server.close(); await rm(temp, { recursive: true, force: true });
}
