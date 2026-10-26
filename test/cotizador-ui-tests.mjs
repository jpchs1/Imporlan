/** Cotizador real con API simulada: lectura, cálculo y guardado en varios tamaños. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(repo, 'admin-react/package.json'));
const { createServer } = await import(require.resolve('vite'));
const { default: react } = await import(require.resolve('@vitejs/plugin-react'));
const { default: tailwind } = await import(require.resolve('@tailwindcss/vite'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const harness = await readFile(join(repo, 'test/fixtures/cotizador.jsx'), 'utf8');
const csp = (await readFile(join(repo, '.htaccess'), 'utf8')).match(/Header set Content-Security-Policy "([^"]+)"/)[1];
const server = await createServer({
  root: join(repo, 'admin-react'), configFile: false, base: '/',
  plugins: [react(), tailwind(), {
    name: 'quote-ui-test',
    resolveId: id => id === '/__quote.jsx' ? id : null,
    load: id => id === '/__quote.jsx' ? harness : null,
    configureServer(s) {
      s.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/panel/__quote?')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Security-Policy', csp);
        res.end(`<html data-density="compact"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/__quote.jsx"></script></body></html>`);
      });
    },
  }], server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let checks = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log(`PASS ${++checks}: ${label}`); };

try {
  for (const width of [1200, 390, 320, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], saves = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'POST') {
        assert.equal(url.searchParams.get('action'), 'admin_save_quote', 'only the intended quote save is allowed');
        saves.push(route.request().postDataJSON());
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({ json: { success: true, pricing: {} } });
    });
    await page.goto(`${origin}/panel/__quote?new=1`);
    await page.getByRole('button', { name: 'Cotizar', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Cotizador de importación', exact: true });
    await modal.getByLabel('Valor de la lancha', { exact: true }).waitFor();
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.waitForTimeout(200);
    check(await modal.locator('.quote-total').textContent() === '$24.969.966', 'the existing quote calculation remains unchanged');
    check(await modal.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth), `dialog fits ${width}px`);
    check(await modal.locator('.quote-dialog-body').evaluate(el => el.scrollWidth <= el.clientWidth), `body has no horizontal overflow at ${width}px`);
    check(await modal.getByRole('button', { name: 'Guardar cotización', exact: true }).evaluate(el => {
      const box = el.getBoundingClientRect(); return box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth && box.height >= 44;
    }), `save remains visible and has a usable target at ${width}px`);
    check(await modal.getByLabel('Valor de la lancha', { exact: true }).inputValue() === '4.995', 'money values use readable thousands separators');
    check(saves.length === 0, 'opening the calculator does not save or send anything');
    await modal.getByRole('tab', { name: 'Costos en USD', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    check(await modal.getByRole('tab', { name: 'Costos en CLP', exact: true }).getAttribute('aria-selected') === 'true', 'cost tabs work with the keyboard');
    await modal.getByRole('tab', { name: 'Costos en USD', exact: true }).click();

    if (process.env.QUOTE_SCREENSHOTS) {
      await mkdir(process.env.QUOTE_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.QUOTE_SCREENSHOTS, `cotizador-${width}.png`) });
    }

    await modal.getByLabel('Valor de la lancha', { exact: true }).click();
    await modal.getByLabel('Valor de la lancha', { exact: true }).fill('10000');
    await modal.getByRole('tab', { name: 'Costos en CLP', exact: true }).click();
    check(await modal.locator('.quote-total').textContent() === '$30.449.440', 'editing the purchase price recalculates the final total: ' + await modal.locator('.quote-total').textContent());
    await modal.getByLabel('Entrega / traslado', { exact: true }).click();
    await modal.getByLabel('Entrega / traslado', { exact: true }).fill('100000');
    await modal.getByRole('tab', { name: 'Costos en USD', exact: true }).click();
    check(await modal.getByLabel('Valor de la lancha', { exact: true }).inputValue() === '10.000', 'switching tabs preserves purchase edits');
    await modal.locator('summary').click();
    await modal.getByLabel('THC', { exact: true }).click();
    await modal.getByLabel('THC', { exact: true }).fill('249,50');
    await modal.getByRole('tab', { name: 'Impuestos y pagos', exact: true }).click();
    check(await modal.locator('.quote-total').textContent() === '$30.631.780', 'USD decimals and local costs feed the same calculation');
    await modal.getByRole('switch', { name: /Aplicar impuesto al lujo/ }).click();
    check(await modal.locator('.quote-total').textContent() === '$30.815.780', 'luxury switch applies the existing tax calculation');
    await modal.getByLabel('Tipo de cambio', { exact: true }).fill('920.5');
    check(await modal.locator('.quote-total').textContent() === '$30.829.656', 'exchange rates retain fractional pesos instead of treating them as thousands');
    await modal.getByLabel('Tipo de cambio', { exact: true }).fill('920');
    await modal.getByLabel('Pago 1', { exact: true }).fill('8');
    check(await modal.getByRole('alert').textContent().then(text => text.includes('101.0 %')), 'invalid payment distribution is visible');
    await modal.getByLabel('Pago 1', { exact: true }).fill('7');
    check(await modal.getByRole('alert').count() === 0, 'payment warning clears when the sum is 100%');
    await modal.getByRole('button', { name: 'Publicar ahora', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '¿Publicar la cotización ahora?', exact: true });
    await confirmation.waitFor();
    await page.keyboard.press('Escape');
    check(await confirmation.count() === 0 && await modal.count() === 1 && saves.length === 0, 'publication requires confirmation and Escape closes only that confirmation');
    await modal.getByRole('button', { name: 'Guardar cotización', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    check(saves.length === 1 && !saves[0].publish_now, 'ordinary save keeps the existing 24-hour publication mode');
    check(saves[0].quote_total_clp === 30815780 && saves[0].quote_data.thc_usd === 249.5 && saves[0].quote_data.entrega_clp === 100000,
      'save includes the computed total and edits from hidden cost sections');
    check(Object.keys(saves[0].quote_data).length === 36 && saves[0].quote_payments.p1_pct === 7, 'all original cost and payment fields survive the redesign');
    if (width === 1440) {
      await page.goto(`${origin}/panel/__quote?saved=1`);
      await page.getByRole('button', { name: 'Cotizar', exact: true }).click();
      await modal.getByLabel('Valor de la lancha', { exact: true }).waitFor();
      check(await modal.getByLabel('Tipo de cambio', { exact: true }).inputValue() === '950'
        && await modal.getByLabel('Valor de la lancha', { exact: true }).inputValue() === '10.000', 'saved quote values take priority over current templates');
      await modal.locator('summary').click();
      check(await modal.getByLabel('THC', { exact: true }).inputValue() === '249,50', 'saved decimals survive reopening an existing quote');
      check(await modal.getByRole('button', { name: 'Más acciones de la cotización', exact: true }).count() === 1, 'published quotes keep their existing secondary actions');
      await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
      check(saves.length === 1, 'cancelling a saved quote does not mutate it');
    }
    check(errors.length === 0, `no runtime errors at ${width}px: ${errors.join(', ')}`);
    await context.close();
  }
  console.log(`${checks} calculator checks passed.`);
} finally { await browser.close(); await server.close(); }
