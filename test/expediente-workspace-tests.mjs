/** Workspace navigation/filter/state regression with fictional UI records.
 * Bytes, private permissions and downloads are covered by the PHP integration.
 */
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
const harness = await readFile(join(repo, 'test/fixtures/expediente-workspace.jsx'), 'utf8');
const boat = await readFile(join(repo, 'images/rank-mastercraft-x26.webp'));
const csp = (await readFile(join(repo, '.htaccess'), 'utf8')).match(/Header set Content-Security-Policy "([^"]+)"/)[1];
const files = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, order_id: 35, original_name: i === 8 ? 'Informe de inspección de la embarcación.pdf' : `Inspección · detalle ${String(i + 1).padStart(2, '0')}.webp`, stored_name: '', mime_type: i === 8 ? 'application/pdf' : 'image/webp', category: i === 8 ? 'document' : 'image', visible_to_client: i === 8 ? 0 : 1, uploaded_by: 'operador_usa', file_size: 220000, file_size_formatted: '215 KB', download_url: '/__boat.webp', created_at: i === 7 ? '2026-10-20 12:00:00' : '2026-10-23 12:00:00' }));
const css = `.workspace-demo-sidebar{position:fixed;inset:0 auto 0 0;width:230px;background:var(--color-sidebar);color:var(--color-sidebar-ink);padding:24px 18px;z-index:31}.workspace-demo-sidebar strong{display:block;font-size:21px;color:var(--color-surface)}.workspace-demo-sidebar small{display:block;color:var(--color-sidebar-muted);margin-bottom:40px}.workspace-demo-sidebar p{font-size:14px;padding:12px;margin-top:7px}.workspace-demo-sidebar .active{background:var(--color-sidebar-active);border-radius:8px;color:var(--color-brand-200)}.workspace-demo-topbar{position:fixed;top:0;left:230px;right:0;height:56px;background:var(--color-surface);border-bottom:1px solid var(--color-line);display:flex;align-items:center;justify-content:space-between;padding:0 30px;z-index:30;font-size:13px}.workspace-demo-main{margin-left:230px;padding:88px 32px 32px;max-width:1600px}.workspace-demo-shell{--topbar-h:56px;--page-gutter:32px}@media(max-width:1023px){.workspace-demo-sidebar{display:none}.workspace-demo-topbar{left:0;padding:0 16px}.workspace-demo-main{margin-left:0;padding:80px 16px 24px}.workspace-demo-shell{--page-gutter:16px}}`;
const server = await createServer({ root: join(repo, 'admin-react'), configFile: false, base: '/', plugins: [react(), tailwind(), {
  name: 'workspace-test', resolveId: id => id === '/__workspace.jsx' ? id : null, load: id => id === '/__workspace.jsx' ? harness : null,
  configureServer(s) { s.middlewares.use((req, res, next) => {
    if (req.url === '/__boat.webp') { res.setHeader('Content-Type', 'image/webp'); res.end(boat); return; }
    if (!req.url.startsWith('/panel/__workspace?')) return next();
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Security-Policy', csp);
    res.end(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/__workspace.jsx"></script></body></html>`);
  }); },
}], server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let passed = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log(`PASS ${++passed}: ${label}`); };
try {
  for (const mode of ['admin-list', 'admin-detail', 'customer-list', 'customer-detail', 'customer-error', 'agent-detail']) for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = [], mutations = [];
    let fileResponseError = mode === 'customer-error';
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      if (route.request().method() !== 'GET') mutations.push(route.request().url());
      const url = new URL(route.request().url());
      if (fileResponseError && url.pathname.endsWith('expediente_files_api.php')) return route.fulfill({ status: 500, json: { error: 'Synthetic temporary file service failure' } });
      const data = url.pathname.endsWith('expediente_files_api.php') ? { success: true, files: mode.startsWith('customer') ? files.filter(f => f.visible_to_client) : files }
        : url.pathname.endsWith('operador_usa.php') ? { success: true, operador: { nombre: 'David Morris', email: 'operator@example.test' }, hito_en_curso: 'inspeccion', inspection_price: { request_id: 1, revision: 1, status: 'adjusted', confirmed: true, ready: false, original_cents: 2500050, confirmed_cents: 2400025, reason: 'Seller confirmed a price adjustment for the engine inspection finding.', last_sent_at: '2026-10-25 12:00:00' }, updates: [{ id: 1, created_at: '2026-10-23 12:00:00', note: 'Inspection documents uploaded for review.', file_ids: files.map(f => f.id) }] }
          : url.pathname.endsWith('orders_api.php') ? url.searchParams.get('action') === 'user_detail' ? { success: true, order: await page.evaluate(() => window.fixtureOrder) } : { success: true, orders: await page.evaluate(() => window.fixtureOrders) }
            : url.pathname.endsWith('reports_api.php') ? { success: true, reports: [] }
              : { success: true, requests: [], inspections: [] };
      await route.fulfill({ json: data });
    });
    await page.goto(`${origin}/panel/__workspace?mode=${mode}`);
    await page.locator('.exp-header h1').waitFor();
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    if (mode.includes('detail')) await page.locator('.exp-navigation').waitFor();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${mode} fits ${width}px without horizontal page overflow`);
    check(await page.locator('h1').count() === 1, `${mode} has one primary heading`);
    if (process.env.WORKSPACE_SCREENSHOTS) {
      await mkdir(process.env.WORKSPACE_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.WORKSPACE_SCREENSHOTS, `${mode}-${width}.png`), fullPage: false });
    }
    if (mode === 'admin-detail') {
      const price = page.getByRole('region', { name: 'Precio de compra tras la inspección' });
      await price.getByRole('button', { name: 'Validar confirmación', exact: true }).waitFor();
      check(await price.innerText().then(s => s.includes('Precio reajustado') && s.includes('25.000,50') && s.includes('24.000,25') && s.includes('1.000,25')), 'admin sees previous, confirmed and changed USD purchase prices');
      await price.getByRole('button', { name: 'Validar confirmación', exact: true }).click();
      const review = page.getByRole('dialog', { name: '¿Validar esta confirmación de precio?' });
      await review.waitFor();
      check(await review.innerText().then(s => s.includes('no modifica cotizaciones ni crea cobros')), 'team validation explains the financial boundary before proceeding');
      await review.getByRole('button', { name: 'Cancelar', exact: true }).click();
      const nav = page.getByRole('navigation', { name: 'Secciones del expediente' });
      await nav.getByRole('button', { name: 'Datos', exact: true }).click();
      check(await page.locator('#datos h2').evaluate(el => el === document.activeElement), 'section navigation places keyboard focus on its heading');
      const field = page.getByRole('textbox', { name: 'Embarcación u objetivo', exact: true });
      await field.fill('Nueva preferencia de prueba');
      check(await page.locator('.exp-action-bar p').first().evaluate(el => el.clientWidth >= 70), 'unsaved badges do not hide the expediente identity beside Save');
      await nav.getByRole('button', { name: /^Archivos/ }).click();
      await page.getByRole('list', { name: 'Galería de archivos del expediente' }).waitFor();
      check(await page.getByRole('list', { name: 'Galería de archivos del expediente' }).locator(':scope > li').count() === 9, 'file gallery includes the original documents and photos');
      const section = page.locator('#archivos');
      if (process.env.WORKSPACE_SCREENSHOTS) await page.screenshot({ path: join(process.env.WORKSPACE_SCREENSHOTS, `admin-files-${width}.png`) });
      check(await section.evaluate(el => {
        const nav = document.querySelector('[data-exp-navigation]');
        const top = el.getBoundingClientRect().top;
        return top >= nav.getBoundingClientRect().bottom - 2 && top < innerHeight;
      }), 'sticky navigation reaches the file section without covering its heading');
      await section.getByRole('button', { name: /^Documentos/ }).click();
      if (process.env.WORKSPACE_SCREENSHOTS) await page.screenshot({ path: join(process.env.WORKSPACE_SCREENSHOTS, `admin-documents-${width}.png`) });
      check(await section.getByRole('list').locator(':scope > li').count() === 1, 'document filter isolates the report without losing other files');
      await section.getByRole('button', { name: /^Todos/ }).click();
      const fileSearch = section.getByRole('searchbox', { name: 'Buscar archivos', exact: true });
      await fileSearch.fill('inspeccion');
      check(await section.getByRole('list').locator(':scope > li').count() === 9, 'file search finds accented names without requiring accents');
      await fileSearch.fill('detalle 08');
      await section.getByRole('button', { name: 'Ver foto Inspección · detalle 08.webp', exact: true }).click();
      check(await page.getByRole('dialog').locator('img').getAttribute('alt') === 'Inspección · detalle 08.webp', 'filtered admin photo opens its original image rather than the first image');
      await page.keyboard.press('Escape');
      await fileSearch.fill('');
      await section.getByRole('combobox', { name: 'Ordenar archivos', exact: true }).selectOption('name');
      check(await section.locator('.exp-file-card__name').first().textContent() === 'Informe de inspección de la embarcación.pdf', 'name sorting changes only the display order of the files');
      await section.getByRole('button', { name: /^Documentos/ }).click();
      await section.getByRole('button', { name: 'Vista de lista', exact: true }).click();
      check(await section.getByRole('button', { name: 'Vista de lista' }).getAttribute('aria-pressed') === 'true', 'file display can switch to the accessible list view');
      await nav.getByRole('button', { name: 'Datos', exact: true }).click();
      check(await field.inputValue() === 'Nueva preferencia de prueba', 'section navigation preserves unsaved edits');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      check(await page.evaluate(() => window.savedForm.asset_name) === 'Nueva preferencia de prueba', 'the existing save handler receives the edited fields');
      check(await nav.getByRole('button', { name: 'EE. UU.', exact: true }).count() === 1, 'Chile staff retains the operator workflow navigation');
    }
    if (mode === 'admin-list') {
      await page.getByRole('button', { name: 'Más filtros', exact: true }).click();
      check(await page.getByRole('textbox', { name: 'Agente', exact: true }).isVisible(), 'advanced filters remain available');
      await page.getByRole('searchbox').fill('Martín');
      check(await page.getByText('Martín Silva', { exact: true }).filter({ visible: true }).isVisible()
        && await page.getByText('Sofía Carrasco', { exact: true }).filter({ visible: true }).count() === 0, 'customer search still filters the order list');
    }
    if (mode === 'agent-detail') {
      check(await page.getByRole('navigation').getByRole('button', { name: 'EE. UU.', exact: true }).count() === 0, 'agent does not gain access to the Chile operator controls');
      check(await page.getByText('sofia@example.test', { exact: true }).count() === 0, 'redesign does not reveal customer contact to the agent');
    }
    if (mode === 'customer-detail') {
      check(await page.getByText('Informe de inspección de la embarcación.pdf', { exact: true }).count() === 0, 'customer view respects internal-document visibility');
      await page.getByRole('navigation', { name: 'Secciones del expediente' }).getByRole('button', { name: /^Archivos/ }).click();
      check(await page.locator('#archivos').evaluate(el => el.getBoundingClientRect().top < innerHeight), 'customer navigation reaches the shared photo gallery');
      const section = page.locator('#archivos');
      const fileSearch = section.getByRole('searchbox', { name: 'Buscar archivos', exact: true });
      await fileSearch.fill('inspeccion');
      check(await section.getByRole('list').locator(':scope > li').count() === 8, 'customer search includes visible photos and does not reveal internal PDFs');
      await section.getByRole('combobox', { name: 'Ordenar archivos', exact: true }).selectOption('oldest');
      check(await section.getByRole('list').locator(':scope > li').first().getByRole('button').getAttribute('aria-label') === 'Ver Inspección · detalle 08.webp', 'customer can sort photos by their upload date');
      await section.getByRole('list').locator(':scope > li').first().getByRole('button').click();
      check(await page.getByRole('dialog').locator('img').getAttribute('alt') === 'Inspección · detalle 08.webp', 'sorted customer photo maps to the correct lightbox image');
      await page.keyboard.press('Escape');
      fileResponseError = true;
      await section.getByRole('button', { name: 'Actualizar archivos', exact: true }).click();
      await section.getByText('No pudimos actualizar los archivos', { exact: true }).waitFor();
      check(await section.getByRole('list').locator(':scope > li').count() === 8, 'failed refresh preserves the last successfully loaded customer files');
      fileResponseError = false;
      await section.getByRole('button', { name: 'Actualizar archivos', exact: true }).click();
      await section.getByText('No pudimos actualizar los archivos', { exact: true }).waitFor({ state: 'hidden' });
      await section.getByText('8 de 8 archivos', { exact: true }).waitFor();
      check(true, 'customer can recover the file list with an explicit refresh');
    }
    if (mode === 'customer-error') {
      const section = page.locator('#archivos');
      await section.getByText('No pudimos cargar los archivos', { exact: true }).waitFor();
      check(await section.getByText('Todavía no hay archivos compartidos', { exact: true }).count() === 0, 'file service errors are not presented as an empty expediente');
      const metric = page.locator('.exp-metric').filter({ has: page.locator('dt', { hasText: 'Fotos y videos' }) }).locator('dd').first();
      check(await metric.textContent() === '—', 'an unavailable file count is not displayed as zero');
      fileResponseError = false;
      await section.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await section.getByRole('searchbox', { name: 'Buscar archivos', exact: true }).waitFor();
      check(await section.getByRole('list').locator(':scope > li').count() === 8, 'initial customer file failure recovers without reloading the page');
    }
    if (mode === 'customer-list') {
      await page.getByRole('button', { name: /^En importación/ }).click();
      check(await page.getByRole('list', { name: 'Expedientes', exact: true }).locator(':scope > li').count() === 1
        && await page.getByText('Compra activa', { exact: true }).isVisible(), 'active import filter excludes completed expedientes');
      await page.getByRole('button', { name: /^Todos/ }).click();
      await page.getByRole('searchbox').fill('embarcacion');
      check(await page.getByRole('list', { name: 'Expedientes', exact: true }).locator(':scope > li').count() === 4, 'customer expediente search handles names with accents');
    }
    check(mutations.length === 0, 'visual navigation does not send customer mail, payments, or other API mutations');
    check(errors.length === 0, `${mode} runs without browser errors: ${errors.join(', ')}`);
    await context.close();
  }
  console.log(`${passed} workspace checks passed.`);
} finally { await browser.close(); await server.close(); }
