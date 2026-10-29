/** Workspace navigation/filter/state regression with fictional UI records.
 * Bytes, private permissions and downloads are covered by the PHP integration.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = process.env.WORKFLOW_ARTIFACT_DIR || join(tmpdir(), 'imporlan-workflow-artifacts');
const require = createRequire(join(repo, 'admin-react/package.json'));
const { createServer } = await import(require.resolve('vite'));
const { default: react } = await import(require.resolve('@vitejs/plugin-react'));
const { default: tailwind } = await import(require.resolve('@tailwindcss/vite'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const harness = await readFile(join(repo, 'test/fixtures/expediente-integridad.jsx'), 'utf8');
const boat = await readFile(join(repo, 'images/rank-mastercraft-x26.webp'));
const csp = (await readFile(join(repo, '.htaccess'), 'utf8')).match(/Header set Content-Security-Policy "([^"]+)"/)[1];

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
const until = async (fn, label) => { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error(label); };
const base = {
  id: 35, order_number: 'IMP-PRUEBA', customer_name: 'Cliente de prueba', customer_email: 'client@example.test', visible_to_client: 1,
  asset_name: 'Búsqueda de prueba', service_type: 'cotizacion_link', plan_name: 'Cotización por links', agent_name: 'Equipo de prueba',
  status: 'in_progress', timeline_step: 2, created_at: '2026-10-20 12:00:00', eleccion: null,
  links: [
    { id: 101, order_id: 35, row_index: 1, title: 'Águila', make: 'Bayliner', model: '175', year: 2007, url: 'https://example.test/boat/101', image_url: '/__boat.webp', value_usa_usd: 10000, value_to_negotiate_usd: 9000, value_chile_clp: 20000000, value_chile_negotiated_clp: 19000000, quote_total_clp: 18000000, quote_calculated_at: '2026-10-25 12:00:00', quote_data: { valor_lancha_usd: 9000 }, quote_pending: false, scrape_state: 'completo' },
    { id: 102, order_id: 35, row_index: 2, title: 'Beta', url: 'https://example.test/boat/102', image_url: '/__boat.webp', value_usa_usd: 5000, value_to_negotiate_usd: 4500, value_chile_clp: 30000000, value_chile_negotiated_clp: 29000000, scrape_state: 'completo' },
    { id: 103, order_id: 35, row_index: 3, title: 'Gamma', url: 'https://example.test/boat/103', image_url: '/__boat.webp', value_usa_usd: 100, quote_pending: true, quote_total_clp: 1000000, value_chile_negotiated_clp: 1000000 },
    { id: 104, order_id: 35, row_index: 4, url: '', title: '', image_url: '' },
  ],
};
const errors = [];
async function open(mode, { initial = base, handler, clock = false, width = 1440, summary, ready = true, captureIntervals = false, trackingId } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ initial, summary }) => {
    window.initialOrder = initial;
    window.summaryLink = summary;
    localStorage.setItem('user', JSON.stringify({ name: 'Equipo de prueba', role: 'admin', email: 'staff@example.test' }));
    localStorage.setItem('imporlan_user', JSON.stringify({ name: 'Cliente de prueba', email: 'client@example.test' }));
  }, { initial, summary });
  if (captureIntervals) await page.addInitScript(() => {
    const nativeInterval = window.setInterval.bind(window);
    window.testIntervals = {};
    window.setInterval = (callback, ms, ...args) => {
      window.testIntervals[ms] = callback;
      return nativeInterval(callback, ms, ...args);
    };
  });
  if (clock) await page.clock.install();
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const body = req.method() === 'GET' ? null : req.postDataJSON();
    const action = url.searchParams.get('action');
    if (handler && await handler({ route, url, action, body })) return;
    const data = url.pathname.endsWith('expediente_files_api.php') ? { success: true, files: [] }
      : url.pathname.endsWith('orders_api.php') ? action === 'admin_list' ? { success: true, orders: [initial] }
        : ['user_detail', 'admin_detail'].includes(action) ? { success: true, order: initial }
          : { success: true, ranking_author_name: 'Cliente de prueba', ranking_author_role: 'user', ranking_updated_at: '2026-10-26 14:00:00' }
      : { success: true, reports: [], inspections: [], requests: [], updates: [] };
    await route.fulfill({ json: data });
  });
  if (mode === 'tracking') await page.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({status:204,body:''}));
  await page.goto(`${origin}/panel/__workspace?mode=${mode}${trackingId ? `&barco=${trackingId}` : ''}`);
  if (ready && (mode === 'admin' || mode === 'customer')) await page.locator('.exp-header h1').waitFor();
  return { page, close: () => context.close() };
}
try {
  // Client polling: unchanged ranking timestamp must still refresh quotes, status and payments.
  let order = structuredClone(base), detailReads = 0, paymentsReads = 0;
  const client = await open('customer', { clock: true, handler: async ({ route, action, url }) => {
    if (action === 'user_detail') { detailReads++; await route.fulfill({ json: { success: true, order } }); return true; }
    if (url.pathname.endsWith('payment_requests_api.php')) paymentsReads++;
  } });
  await client.page.getByRole('heading', { name: 'Águila', exact: true }).waitFor();
  order.links[0].title = 'Águila actualizada'; order.status = 'completed';
  await client.page.clock.runFor(30001);
  await client.page.getByRole('heading', { name: 'Águila actualizada', exact: true }).waitFor();
  check(detailReads >= 2, 'poll refreshes boat data without a ranking timestamp change');
  check(await client.page.getByText('Completado', { exact: true }).count() > 0, 'poll refreshes the expediente status');
  order.eleccion = { link_id: 101, inspection: true, steps: {}, client_can_change: true };
  await client.page.clock.runFor(30001); await until(() => paymentsReads >= 1, 'first payments read');
  await client.page.clock.runFor(30001); await until(() => paymentsReads >= 2, 'periodic payments read');
  check(paymentsReads >= 2, 'payment state refreshes even when the choice does not change');
  await client.close();

  // Ranking: save failure rolls back and never triggers a notification.
  let failedSaves = 0, notifications = 0;
  const ranking = await open('customer', { handler: async ({ route, action }) => {
    if (action === 'save_ranking') { failedSaves++; await route.fulfill({ json: { success: false, error: 'Guardado de prueba rechazado' } }); return true; }
    if (action === 'notify_ranking') notifications++;
  } });
  const cards = ranking.page.getByRole('list', { name: 'Embarcaciones en tu ranking' });
  await ranking.page.getByRole('button', { name: 'Bajar Águila en el ranking' }).click();
  await ranking.page.getByText(/Restablecimos el orden anterior/).waitFor();
  check((await cards.getByRole('heading').allTextContents())[0] === 'Águila', 'failed ranking save restores the previous order');
  await ranking.page.getByRole('button', { name: 'Avisar a mi agente' }).click();
  await until(() => failedSaves >= 2, 'notification save');
  check(notifications === 0, 'failed save prevents sending an outdated ranking notification');
  await ranking.close();

  // Explicit service errors and recovery, rather than pretending there are no reports/payments.
  let unavailable = true;
  const services = await open('customer', { initial: { ...base, eleccion: { link_id: 101, inspection: true, steps: {} } }, handler: async ({ route, url }) => {
    if (unavailable && /reports_api|payment_requests_api/.test(url.pathname)) { await route.fulfill({ status: 503, json: { error: 'Servicio de prueba no disponible' } }); return true; }
  } });
  await services.page.getByText('Hay información pendiente de actualizar', { exact: true }).waitFor();
  check(await services.page.getByRole('button', { name: 'Reintentar pagos' }).count() === 1, 'payments failure offers recovery and does not masquerade as an empty plan');
  unavailable = false;
  await services.page.getByRole('button', { name: 'Reintentar pagos' }).click();
  await services.page.getByRole('button', { name: 'Reintentar pagos' }).waitFor({ state: 'detached' });
  check(true, 'successful retry clears the payment warning');
  await services.close();

  // A late file response from A cannot appear in B; same-order failures retain last good files.
  let delayedA, failB = true, reads = 0;
  const filesTest = await open('files', { handler: async ({ route, url }) => {
    if (!url.pathname.endsWith('expediente_files_api.php')) return;
    reads++;
    if (url.searchParams.get('order_id') === '35') { delayedA = route; return true; }
    await route.fulfill(failB ? { status: 503, json: { error: 'B no disponible' } } : { json: { success: true, files: [{ id: 2, original_name: 'Archivo B.pdf' }] } }); return true;
  } });
  await until(() => !!delayedA, 'A file request');
  await filesTest.page.getByRole('button', { name: 'Expediente B' }).click();
  await filesTest.page.getByText('B no disponible', { exact: true }).waitFor();
  await delayedA.fulfill({ json: { success: true, files: [{ id: 1, original_name: 'Archivo privado A.pdf' }] } });
  check(await filesTest.page.getByText('Archivo privado A.pdf').count() === 0, 'late response cannot disclose another expediente’s files');
  failB = false; await filesTest.page.getByRole('button', { name: 'Actualizar archivos' }).click();
  await filesTest.page.getByText('Archivo B.pdf').waitFor();
  failB = true; await filesTest.page.getByRole('button', { name: 'Actualizar archivos' }).click();
  await filesTest.page.getByText('B no disponible', { exact: true }).waitFor();
  check(await filesTest.page.getByText('Archivo B.pdf').count() === 1, 'same-order refresh failure preserves the last known files');
  await filesTest.close();

  // Comparison uses negotiated values and a single currency, pending figures remain private.
  for (const width of [390, 1440]) {
    const price = await open('prices', { width, initial: { ...base, links: base.links.slice(0, 3) }, summary: { ...base.links[2], quote_available_at: '2026-10-28T18:00:00Z' } });
    const sort = price.page.getByRole('combobox', { name: 'Ordenar embarcaciones' });
    const headings = price.page.getByRole('list', { name: 'Embarcaciones en tu ranking' }).locator('h4');
    await sort.selectOption('price_asc');
    check((await headings.allTextContents()).join(',') === 'Águila,Beta,Gamma', `CLP sort uses final quote, then negotiated Chile, then unknown at ${width}px`);
    await sort.selectOption('usa_asc');
    check((await headings.allTextContents()).join(',') === 'Gamma,Beta,Águila', `USD sorting compares only USA prices at ${width}px`);
    await sort.selectOption('rank');
    await price.page.getByRole('searchbox').fill('aguila');
    check((await headings.allTextContents()).join(',') === 'Águila', 'accent-insensitive boat search');
    check(await price.page.getByRole('button', { name: /Bajar .* en el ranking/ }).count() === 0, 'filtered views prevent ambiguous reordering');
    check(!(await price.page.locator('body').innerText()).includes('$1.000.000'), 'pending totals are hidden from both summary and price matrix');
    check((await price.page.locator('body').innerText()).includes('disponible desde') && !(await price.page.locator('body').innerText()).includes('aproximadamente 24 horas'), 'pending quote shows the server availability date');
    check(await price.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `comparison fits ${width}px`);
    if (process.env.WORKSPACE_SCREENSHOTS) {
      await mkdir(process.env.WORKSPACE_SCREENSHOTS, { recursive: true });
      await price.page.getByRole('searchbox').fill('');
      await price.page.getByRole('list', { name: 'Embarcaciones en tu ranking' }).screenshot({ path: join(process.env.WORKSPACE_SCREENSHOTS, `price-comparison-${width}.png`) });
    }
    await price.close();
  }

  // Actual admin container: in-flight save and background reads must preserve later edits.
  let updateGate, holdUpdate = true, savedForm, savedLinks;
  const admin = await open('admin', { handler: async ({ route, action, body }) => {
    if (action === 'admin_update') { savedForm = body; if (holdUpdate) updateGate = route; else await route.fulfill({ json: { success: true } }); return true; }
    if (action === 'admin_update_links') { savedLinks = body.links; await route.fulfill({ json: { success: true } }); return true; }
  } });
  const editField = admin.page.getByRole('textbox', { name: 'Embarcación u objetivo', exact: true });
  await editField.fill('Primera edición');
  await admin.page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await until(() => !!updateGate, 'admin save started');
  await editField.fill('Segunda edición durante el guardado');
  await updateGate.fulfill({ json: { success: true } });
  await until(() => !!savedLinks, 'link save finished');
  await admin.page.getByText('Se guardó la versión enviada.', { exact: false }).waitFor();
  check(savedForm.asset_name === 'Primera edición' && await editField.inputValue() === 'Segunda edición durante el guardado', 'in-flight save preserves new edits');
  check(await admin.page.getByText('Cambios sin guardar', { exact: true }).first().isVisible(), 'new edits remain visibly unsaved');
  check(await admin.page.getByRole('button', { name: 'Mostrar 1 fila vacía' }).count() === 1, 'empty draft rows start collapsed');
  await admin.page.getByRole('button', { name: 'Mostrar 1 fila vacía' }).click();
  check(await admin.page.locator('[data-link-id="104"]').count() === 1, 'collapsed drafts remain available without data deletion');
  check(await admin.page.evaluate(() => !window.testEmptyLink({ value_to_negotiate_usd: 4000 }) && !window.testEmptyLink({ title: 'Ficha sin URL' }) && window.testEmptyLink({})), 'cleanup protects negotiated prices and title-only rows');
  holdUpdate = false; savedLinks = null;
  await admin.page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await until(() => savedForm.asset_name === 'Segunda edición durante el guardado' && !!savedLinks, 'second save');
  check(true, 'later edits can be saved successfully');
  await admin.close();

  let rejectedOrder;
  const adminRanking = await open('admin', { handler: async ({ route, action }) => {
    if (action === 'admin_reorder_links') { rejectedOrder = route; return true; }
  } });
  const transfer = await adminRanking.page.evaluateHandle(() => new DataTransfer());
  await adminRanking.page.locator('[data-link-id="101"]').dispatchEvent('dragstart', { dataTransfer: transfer });
  await adminRanking.page.locator('[data-link-id="102"]').dispatchEvent('drop', { dataTransfer: transfer });
  await until(() => !!rejectedOrder, 'admin reorder request');
  const concurrentField = adminRanking.page.getByRole('textbox', { name: 'Embarcación u objetivo', exact: true });
  await concurrentField.fill('Edición durante el ordenamiento');
  await rejectedOrder.fulfill({ json: { success: false, error: 'Orden rechazado en prueba' } });
  await adminRanking.page.getByText('No se pudo guardar el nuevo orden.', { exact: false }).waitFor();
  check(await adminRanking.page.locator('[data-link-id]').first().getAttribute('data-link-id') === '101', 'admin failed reorder restores the previous order');
  check(await concurrentField.inputValue() === 'Edición durante el ordenamiento', 'admin ranking rollback preserves concurrent form edits');
  await adminRanking.close();

  // Initial admin loading failure must offer retry, not an endless skeleton.
  let detailFailure = true;
  const brokenAdmin = await open('admin', { ready: false, handler: async ({ route, action }) => {
    if (action === 'admin_detail' && detailFailure) { await route.fulfill({ status: 503, json: { error: 'Falla de carga de prueba' } }); return true; }
  } });
  await brokenAdmin.page.getByText('No pudimos cargar este expediente', { exact: true }).waitFor();
  detailFailure = false;
  await brokenAdmin.page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await brokenAdmin.page.locator('.exp-header h1').waitFor();
  check(true, 'initial admin error offers a working retry');
  await brokenAdmin.close();

  let paymentFailure = true;
  const paymentAdmin = await open('admin', { initial: { ...base, eleccion: { link_id: '101', inspection: true, steps: {} } }, handler: async ({ route, url }) => {
    if (url.pathname.endsWith('payment_requests_api.php') && paymentFailure) { await route.fulfill({ status: 503, json: { error: 'Cobros de prueba no disponibles' } }); return true; }
  } });
  await paymentAdmin.page.getByRole('button', { name: 'Reintentar cobros' }).waitFor();
  check(await paymentAdmin.page.getByRole('button', { name: 'Cobro manual' }).isDisabled(), 'failed payment fetch disables creating another charge');
  paymentFailure = false;
  await paymentAdmin.page.getByRole('button', { name: 'Reintentar cobros' }).click();
  await paymentAdmin.page.getByRole('button', { name: 'Reintentar cobros' }).waitFor({ state: 'detached' });
  check(await paymentAdmin.page.getByRole('button', { name: 'Cobro manual' }).isEnabled(), 'admin payment retry restores charge controls');
  await paymentAdmin.close();

  // A background scrape refresh already in flight must not erase a new form edit.
  let delayedRefresh, adminReads = 0;
  const queued = structuredClone(base); queued.links[0].scrape_state = 'en_cola';
  const adminPoll = await open('admin', { initial: queued, captureIntervals: true, handler: async ({ route, action }) => {
    if (action === 'admin_detail' && ++adminReads > 1) { delayedRefresh = route; return true; }
  } });
  await adminPoll.page.waitForFunction(() => typeof window.testIntervals?.[10000] === 'function');
  await adminPoll.page.evaluate(() => { window.testIntervals[10000](); });
  await until(() => !!delayedRefresh, 'background scrape refresh');
  const pendingField = adminPoll.page.getByRole('textbox', { name: 'Embarcación u objetivo', exact: true });
  await pendingField.fill('Edición mientras llega el scraper');
  await delayedRefresh.fulfill({ json: { success: true, order: queued } });
  await adminPoll.page.getByText('Cambios sin guardar', { exact: true }).first().waitFor();
  check(await pendingField.inputValue() === 'Edición mientras llega el scraper', 'in-flight scrape poll cannot overwrite new form edits');
  await adminPoll.close();

  // Queuing acknowledges persisted rows, then polling still fills the ficha with other edits pending.
  const queueOrder = structuredClone(base); let queuedSaves = 0;
  const automatic = await open('admin', { captureIntervals: true, handler: async ({ route, action, body }) => {
    if (action === 'admin_detail') { await route.fulfill({ json: { success: true, order: queueOrder } }); return true; }
    if (action === 'admin_update_links') {
      queuedSaves++;
      queueOrder.links = structuredClone(body.links);
      queueOrder.links.find(l => l.id === 104).scrape_state = 'en_cola';
      await route.fulfill({ json: { success: true } }); return true;
    }
    if (action === 'admin_rescrape_links') { await route.fulfill({ json: { success: true, results: [{ status: 'en_cola' }] } }); return true; }
  } });
  await automatic.page.getByRole('button', { name: 'Mostrar 1 fila vacía' }).click();
  const queuedCard = automatic.page.locator('[data-link-id="104"]');
  await queuedCard.getByRole('textbox', { name: 'Link del anuncio (USA)' }).fill('https://www.boattrader.com/boat/prueba-104/');
  const queueForm = automatic.page.getByRole('textbox', { name: 'Embarcación u objetivo', exact: true });
  await queueForm.click();
  await queuedCard.getByText('En cola', { exact: true }).waitFor();
  check(queuedSaves === 1, 'pasting a slow URL saves and queues it automatically');
  check(await automatic.page.getByText('Cambios sin guardar', { exact: true }).count() === 0, 'successful queue acknowledges saved links when the form has no pending edits');
  await queueForm.fill('Formulario pendiente durante el scraping');
  await queuedCard.getByRole('textbox', { name: 'Comentarios', exact: true }).fill('Nota pendiente de guardar');
  Object.assign(queueOrder.links.find(l => l.id === 104), { title: 'Ficha automática terminada', make: 'Bayliner', model: '175', value_usa_usd: 4995, image_url: '/__boat.webp', scrape_state: 'completo' });
  await automatic.page.waitForFunction(() => typeof window.testIntervals?.[10000] === 'function');
  await automatic.page.evaluate(() => { window.testIntervals[10000](); });
  await queuedCard.getByRole('heading', { name: 'Ficha automática terminada', exact: true }).waitFor();
  check(await queuedCard.getByText('Ficha completa', { exact: true }).count() === 1, 'background worker result appears automatically while edits remain pending');
  check(await queueForm.inputValue() === 'Formulario pendiente durante el scraping' && await queuedCard.getByRole('textbox', { name: 'Comentarios', exact: true }).inputValue() === 'Nota pendiente de guardar', 'scrape refresh preserves both pending form and row edits');
  check(await automatic.page.getByText('Cambios sin guardar', { exact: true }).first().isVisible(), 'only genuinely pending edits remain marked unsaved after synchronization');
  await automatic.close();

  // Corrupt historical snapshots may show a valid total, never a made-up service or NaN.
  const incomplete = await open('prices', { initial: { ...base, links: [] }, summary: { quote_total_clp: 18000000, quote_data: '{broken', quote_payments: '{broken' } });
  await incomplete.page.getByText('El detalle de esta cotización está pendiente de actualización por tu agente.').waitFor();
  check(!(await incomplete.page.locator('body').innerText()).includes('NaN') && await incomplete.page.getByText('Servicio all inclusive', { exact: true }).count() === 0, 'invalid snapshots keep the total and hide unavailable breakdowns');
  await incomplete.close();

  // Renegotiating must not present a total calculated with a different purchase base as current.
  const reprice = await open('admin');
  const priceCard = reprice.page.locator('[data-link-id="101"]');
  await priceCard.getByRole('button', { name: 'Editar ficha', exact: true }).click();
  const usaPurchase = priceCard.getByLabel('Negociado · USA', { exact: true });
  await usaPurchase.click();
  await usaPurchase.fill('11000');
  check(await priceCard.locator('.admin-boat-card__total > dd:not(.admin-boat-card__note)').textContent() === 'Por actualizar', 'changing the purchase price removes the old quote from the current total');
  check((await priceCard.locator('.admin-boat-card__quote-warning').innerText()).includes('Cambió la compra negociada'), 'outdated quote explains why it needs recalculation');
  check((await priceCard.locator('.admin-boat-card__total .admin-boat-card__note').innerText()).includes('Última cotización'), 'the former amount is explicitly labeled as historical');
  await priceCard.getByRole('button', { name: 'Actualizar cotización', exact: true }).click();
  const repricingModal = reprice.page.getByRole('dialog');
  check((await repricingModal.getByLabel(/^Valor negociado · USA/).inputValue()).replace(/[^0-9]/g, '') === '11000', 'recalculate opens with the edited purchase base');
  await reprice.page.keyboard.press('Escape');
  await usaPurchase.click();
  await usaPurchase.fill('9000.00');
  check(await priceCard.locator('.admin-boat-card__quote-warning').count() === 0 && (await priceCard.locator('.admin-boat-card__total > dd:not(.admin-boat-card__note)').innerText()).includes('18.000.000'), 'the original base including decimal formatting recognizes the saved total as current');
  await usaPurchase.fill('');
  check(await priceCard.locator('.admin-boat-card__total > dd:not(.admin-boat-card__note)').innerText() === 'Por actualizar', 'removing the negotiated purchase never leaves a saved quote looking current');
  await reprice.close();

  // The admin next step uses real payment state before announcing an operational milestone.
  const chosenOrder = structuredClone(base);
  chosenOrder.eleccion = { link_id: 101, inspection: true, steps: {}, client_can_change: true };
  chosenOrder.links[0].quote_payments = { p1_pct: 7, p1_clp: 1260000, p2_pct: 63, p2_clp: 11340000, p3_pct: 30, p3_clp: 5400000 };
  for (const status of ['pending', 'paid']) {
    const nextStep = await open('admin', { initial: chosenOrder, handler: async ({ route, url }) => {
      if (url.pathname.endsWith('payment_requests_api.php')) {
        await route.fulfill({ json: { success: true, requests: [{ id: 1, title: 'Pago 1', status, amount_clp: 1260000, metadata: { order_id: 35, custom_fields: { pago: 1 } } }] } }); return true;
      }
    } });
    const summary = nextStep.page.getByRole('complementary', { name: 'Siguiente paso del expediente' });
    await summary.getByRole('heading', { name: status === 'pending' ? 'Pago 1 pendiente' : 'Confirmando disponibilidad', exact: true }).waitFor();
    check(true, status === 'pending' ? 'pending first payment takes priority over seller confirmation' : 'the next operational milestone appears after the first payment is paid');
    await nextStep.close();
  }
  let paymentGate;
  const waitingPayments = await open('admin', { initial: chosenOrder, handler: async ({ route, url }) => {
    if (url.pathname.endsWith('payment_requests_api.php')) { paymentGate = route; return true; }
  } });
  await waitingPayments.page.getByRole('complementary', { name: 'Siguiente paso del expediente' }).getByRole('heading', { name: 'Consultando pagos' }).waitFor();
  check(true, 'loading payment state does not announce a premature operational step');
  await paymentGate.fulfill({ status: 503, json: { error: 'Falla de pagos de prueba' } });
  await waitingPayments.page.getByRole('complementary', { name: 'Siguiente paso del expediente' }).getByRole('heading', { name: 'Revisar estado de pagos' }).waitFor();
  check(true, 'a payment fetch error offers review instead of guessing the next milestone');
  await waitingPayments.close();

  // Admin visual workspace: prices remain readable and each editor retains its pending values.
  for (const width of [320, 390, 768, 1024, 1440]) {
    const visual = await open('admin', { width });
    const card = visual.page.locator('[data-link-id="101"]');
    await card.getByRole('button', { name: 'Editar ficha', exact: true }).waitFor();
    check(await card.getByRole('button', { name: 'Editar ficha', exact: true }).getAttribute('aria-expanded') === 'false', `existing admin cards start with a readable price overview at ${width}px`);
    check(await visual.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `admin workspace fits ${width}px without horizontal overflow`);
    check(await card.locator('.admin-boat-card__prices').evaluate(el => {
      const total = el.querySelector('.admin-boat-card__total > dd:not(.admin-boat-card__note)');
      const reference = el.querySelector('dd');
      return parseFloat(getComputedStyle(total).fontSize) > parseFloat(getComputedStyle(reference).fontSize);
    }), `final Chile price has stronger visual hierarchy at ${width}px`);
    if (width >= 1024) check(await card.evaluate(el => el.getBoundingClientRect().top < 1000), `boat options appear before the long operation and document sections at ${width}px`);
    await card.getByRole('button', { name: 'Editar ficha', exact: true }).click();
    const model = card.getByRole('textbox', { name: 'Modelo', exact: true });
    await model.fill('Modelo pendiente de prueba');
    await card.getByRole('button', { name: 'Cerrar edición', exact: true }).click();
    await card.getByRole('button', { name: 'Editar ficha', exact: true }).click();
    check(await model.inputValue() === 'Modelo pendiente de prueba', `closing and reopening the card keeps its pending edits at ${width}px`);
    if (width === 1440) {
      await card.getByRole('button', { name: 'Cerrar edición', exact: true }).click();
      await card.locator('.admin-boat-card__grip').dragTo(visual.page.locator('[data-link-id="102"] .admin-boat-card__photo'), { sourcePosition: { x: 5, y: 5 } });
      await visual.page.waitForFunction(() => document.querySelector('[data-link-id]')?.getAttribute('data-link-id') === '102');
      check(true, 'the visible drag handle reorders admin boats through native browser drag and drop');
      await card.getByRole('button', { name: 'Revisar cotización', exact: true }).click();
      const modal = visual.page.getByRole('dialog');
      const negotiated = modal.getByLabel(/^Valor negociado · USA/);
      await negotiated.waitFor();
      check((await negotiated.inputValue()).replace(/[^0-9]/g, '') === '9000', 'the prominent quote button opens the selected boat with its negotiated USA base');
      await visual.page.keyboard.press('Escape');
    }
    if (process.env.WORKSPACE_SCREENSHOTS) {
      await mkdir(process.env.WORKSPACE_SCREENSHOTS, { recursive: true });
      if (await card.getByRole('button', { name: 'Cerrar edición', exact: true }).count()) await card.getByRole('button', { name: 'Cerrar edición', exact: true }).click();
      await visual.page.getByRole('navigation', { name: 'Secciones del expediente' }).getByRole('button', { name: /^Opciones/ }).click();
      await visual.page.screenshot({ path: join(process.env.WORKSPACE_SCREENSHOTS, `admin-ranking-${width}.png`) });
    }
    await visual.close();
  }

  // David's proposal has no effective buyer price until the owner deliberately uses the approved amount.
  let ownerPrice = { request_id: 91, revision: 3, approval_version: 4, status: 'adjusted', confirmed: true, ready: false, original_cents: 2500050, confirmed_cents: 2400025, approved_cents: null };
  let ownerDecision, unexpectedPublications = [];
  const ownership = await open('admin', { initial: chosenOrder, handler: async ({ route, url, body, action }) => {
    if (url.pathname.endsWith('operador_usa.php')) {
      if (url.searchParams.get('r') === 'admin_precio_revisar') {
        ownerDecision = body;
        ownerPrice = { ...ownerPrice, ready: true, approved_cents: Math.round(Number(body.approved_price_usd) * 100), approval_note: body.approval_note, approval_version: 5 };
        await route.fulfill({ json: { success: true, inspection_price: ownerPrice, inspeccion_aprobada: false } }); return true;
      }
      await route.fulfill({ json: { success: true, can_approve_price: true, operador: { nombre: 'David de prueba' }, inspection_price: ownerPrice, updates: [], hito_en_curso: 'inspeccion' } }); return true;
    }
    if (body && action !== 'admin_precio_revisar') unexpectedPublications.push(action);
  } });
  const ownerSection = ownership.page.getByRole('region', { name: 'Precio de compra tras la inspección' });
  await ownerSection.getByRole('button', { name: 'Revisar y aprobar precio' }).click();
  const decisionDialog = ownership.page.getByRole('dialog', { name: 'Aprobar precio de compra' });
  const approvedInput = decisionDialog.getByLabel(/^Valor que apruebas · USD/);
  await approvedInput.click(); await approvedInput.fill('24500.75');
  await decisionDialog.getByRole('textbox', { name: 'Nota de aprobación' }).fill('Valor comercial aprobado por el dueño.');
  await decisionDialog.getByRole('button', { name: 'Guardar aprobación' }).click();
  await ownerSection.getByText('Aprobado por Juan Pablo', { exact: true }).waitFor();
  check(ownerDecision.approved_price_usd === '24500.75' && ownerDecision.revision === 3 && ownerDecision.approval_version === 4, 'owner explicitly approves an edited value against the proposal and approval versions');
  check((await ownerSection.innerText()).includes('24.000,25') && (await ownerSection.innerText()).includes('24.500,75'), 'the admin keeps David’s proposal distinct from the owner-approved value');
  await ownerSection.getByRole('button', { name: 'Usar valor aprobado en cotizador' }).click();
  const ownerQuote = ownership.page.getByRole('dialog');
  const approvedQuoteBase = ownerQuote.getByLabel(/^Valor negociado · USA/);
  await approvedQuoteBase.waitFor();
  check((await approvedQuoteBase.inputValue()).replace(/[^0-9]/g, '') === '2450075', 'the quote editor receives the amount edited and approved by the owner');
  check((await ownership.page.locator('[data-link-id="101"] .admin-boat-card__prices').innerText()).includes('9.000') && unexpectedPublications.length === 0, 'approving and previewing a price does not publish or overwrite the current buyer quotation');
  await ownership.close();
  const supportPrice = await open('admin', { initial: chosenOrder, handler: async ({ route, url }) => {
    if (url.pathname.endsWith('operador_usa.php')) { await route.fulfill({ json: { success: true, can_approve_price: false, inspection_price: ownerPrice, updates: [] } }); return true; }
  } });
  const readonlyPrice = supportPrice.page.getByRole('region', { name: 'Precio de compra tras la inspección' });
  await readonlyPrice.getByText('La aprobación y edición están reservadas a la cuenta principal de Juan Pablo.').waitFor();
  check(await readonlyPrice.getByRole('button', { name: /aprobar|Editar valor|Usar valor aprobado/ }).count() === 0, 'read-only staff cannot approve, edit or apply the owner’s approved price');
  await supportPrice.close();

  // The same customer components cover every purchase/import handoff.
  const workflowSteps = { disponibilidad:'2026-10-22', inspeccion:'2026-10-23', compra:'2026-10-24', transporte:'2026-10-25', aduana:'2026-10-28', entrega:'2026-10-29' };
  const scenarios = [
    { name:'inspection decision', steps:{}, stage:'reporte_listo', report:true, label:'Revisar y aprobar la inspección', next:'Te toca: revisa el reporte y decide' },
    { name:'owner price review', steps:{}, waiting:true, report:true, label:'Confirmación del precio final', next:'Aprobaste el reporte: confirmamos el precio final' },
    { name:'purchase', until:'inspeccion', label:'Cerrando la compra', next:'Estamos cerrando la compra' },
    { name:'transport coordination', until:'compra', label:'Coordinando el transporte', next:'Estamos coordinando el transporte' },
    { name:'customs', until:'transporte', label:'Viaje a Chile y aduana', next:'Seguimos el viaje a Chile' },
    { name:'delivery coordination', until:'aduana', label:'Coordinando la entrega', next:'Coordinamos contigo la entrega' },
    { name:'delivered', until:'entrega', label:'Lancha entregada', next:'Tu lancha fue entregada' },
    { name:'without inspection', steps:{disponibilidad:workflowSteps.disponibilidad}, inspection:false, label:'Cerrando la compra', next:'Estamos cerrando la compra' },
    { name:'second payment', until:'inspeccion', unpaid:2, label:'Cerrando la compra', next:'Te toca: pagar el Pago 2' },
    { name:'report and pending tasks', steps:{}, stage:'reporte_listo', report:true, missingData:true, unpaid:1, label:'Revisar y aprobar la inspección', next:'Te toca: revisa el reporte y decide' },
    { name:'closed expediente', status:'cancelled', steps:{}, stage:'reporte_listo', report:true, label:'Expediente cerrado', next:'Este expediente está cerrado' },
  ];
  for (const [i, scenario] of scenarios.entries()) {
    const initial = structuredClone(base);
    if(scenario.status) initial.status=scenario.status;
    if(scenario.missingData) initial.datos_importacion={completo:false};
    const steps = scenario.steps || Object.fromEntries(Object.entries(workflowSteps).slice(0, Object.keys(workflowSteps).indexOf(scenario.until)+1));
    initial.eleccion = {link_id:101,at:'2026-10-21',by:'cliente',inspection:scenario.inspection !== false,steps,inspection_stage:scenario.stage,inspection_waiting_price:!!scenario.waiting,inspection_client_ok_at:scenario.waiting?'2026-10-29':null,inspection_report:scenario.report?{file_id:26,es_status:'listo'}:null};
    initial.links[0].quote_payments = {p1_pct:7,p1_clp:1260000,p2_pct:63,p2_clp:11340000,p3_pct:30,p3_clp:5400000};
    const requestedPayments = steps.transporte ? [1,2,3] : steps.inspeccion || scenario.inspection === false || scenario.unpaid === 2 ? [1,2] : [1];
    const requests = requestedPayments.map(n=>({id:`workflow-${n}`,title:`Pago ${n}`,status:scenario.unpaid===n?'pending':'paid',amount_clp:initial.links[0].quote_payments[`p${n}_clp`],paid_at:'2026-10-21',created_at:'2026-10-20',metadata:{order_id:initial.order_number,custom_fields:{pago:n}}}));
    const flow = await open('customer',{initial,width:i%2?390:1440,handler:async({route,url})=>{
      if(url.pathname.endsWith('payment_requests_api.php')){await route.fulfill({json:{success:true,requests}});return true;}
    }});
    await flow.page.locator('#estado-importacion').getByText(scenario.label,{exact:true}).waitFor();
    check((await flow.page.locator('#mi-importacion [role="status"]').first().innerText()).includes(scenario.next), `${scenario.name}: current state and next action agree`);
    const rail=flow.page.getByRole('list',{name:'Etapas de tu importación'});
    check(await rail.locator('>li').count()===(scenario.inspection===false?5:6),`${scenario.name}: roadmap has only applicable stages`);
    check(await flow.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${scenario.name}: roadmap fits viewport`);
    if(scenario.missingData){const tasks=flow.page.getByRole('region',{name:'Otras tareas pendientes'});check(await tasks.getByRole('button',{name:'Completar mis datos y cédula',exact:true}).isVisible(),'personal data remains visible next to the inspection decision');check(await tasks.getByRole('link',{name:/Pagar el Pago 1/}).isVisible(),'the unpaid first installment remains visible next to the inspection decision');}
    if(scenario.status)check(await flow.page.getByRole('button',{name:'Aprobar y seguir',exact:true}).count()===0,'closed expedientes cannot initiate inspection approval from the client screen');
    if(scenario.unpaid){check(await flow.page.getByRole('link',{name:/Pagar/}).first().getAttribute('href').then(h=>h.includes(`workflow-${scenario.unpaid}`)), 'public expediente reference connects the charge to its payment button');}
    if(i===0){await mkdir(artifactDir,{recursive:true});await flow.page.locator('section[aria-labelledby="estado-importacion"]').screenshot({path:join(artifactDir,'importacion-cliente-flujo.png')});}
    await flow.close();
  }

  for (const trackingId of ['22','33','999']) {
    const consulted=[];let featuredReads=0;
    const tracking=await open('tracking',{trackingId,ready:false,handler:async({route,url})=>{
      if(!url.pathname.endsWith('tracking_api.php'))return false;
      const action=url.searchParams.get('action');
      if(action==='featured'){featuredReads++;await route.fulfill({json:{success:true,vessels:[{id:11,display_name:'Otro barco de prueba',status:'active'},{id:22,display_name:'Barco del expediente',status:'active'}]}});}
      else {consulted.push(url.searchParams.get('id'));await route.fulfill({json:trackingId==='999'?{success:false,error:'Not found'}:{success:true,vessel:{id:Number(url.searchParams.get('id')),display_name:'Barco del expediente',is_featured:trackingId==='33'?0:1},positions:[]}});}
      return true;
    }});
    if(trackingId!=='999')await tracking.page.getByRole('list',{name:'Barcos en seguimiento'}).waitFor();
    else await tracking.page.getByText('El seguimiento de este expediente todavía no está disponible',{exact:true}).waitFor();
    check(featuredReads===0,'assigned vessel tracking does not depend on the featured list');
    if(trackingId!=='999'){
      await tracking.page.getByRole('heading',{name:'Barco del expediente',exact:true}).waitFor();
      check(consulted.length>0 && consulted.every(id=>id===trackingId),'tracking deep link opens the boat associated with the expediente');
      if(trackingId==='33'){const before=consulted.length;await tracking.page.getByRole('button',{name:'Actualizar posición',exact:true}).click();await until(()=>consulted.length>=before+3,'refresh must reload the assigned vessel');check(featuredReads===0 && consulted.every(id=>id==='33'),'refreshing a non-featured assigned vessel keeps the same boat and route');}
    }else{
      await tracking.page.getByText('El seguimiento de este expediente todavía no está disponible',{exact:true}).waitFor();
      check(consulted.length===1 && consulted[0]==='999','a failed assigned-vessel lookup does not silently load another vessel');
      await tracking.page.getByRole('button',{name:'Reintentar',exact:true}).click();await until(()=>consulted.length===2,'retry must look up the assigned vessel');check(consulted.every(id=>id==='999') && featuredReads===0,'retry preserves the assigned vessel instead of falling back to featured boats');
    }
    await tracking.close();
  }

  check(errors.length === 0, 'all integrity flows run without browser exceptions: ' + errors.join('; '));
  console.log(`${passed} expediente integrity checks passed.`);
} finally { await browser.close(); await server.close(); }
