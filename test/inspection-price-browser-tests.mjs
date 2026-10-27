/** Actual private PHP portal with a disposable SQLite operation and no SMTP. */
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const box = await mkdtemp(join(tmpdir(), 'imporlan-price-browser-'));
const php = process.env.PHP_BINARY || 'php';
const token = 'a'.repeat(48); // Only this disposable fixture uses this token.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
let server, browser, passed = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log(`PASS ${++passed}: ${label}`); };
try {
  for (const name of ['operador_usa.php', 'inspection_upload_followup.php', 'inspection_upload_template.php', 'inspection_price_followup.php', 'inspection_price_template.php', 'eleccion_lancha.php', 'auth_helper.php']) await copyFile(join(root, 'api', name), join(box, name));
  await writeFile(join(box, 'db_config.php'), `<?php function getDbConnection() { $pdo = new PDO('sqlite:' . __DIR__ . '/fixture.sqlite'); $pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION); $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC); return $pdo; }`);
  await writeFile(join(box, 'email_service.php'), `<?php class EmailService { function __call($name,$args) { throw new RuntimeException('SMTP forbidden in browser fixture'); } }`);
  await writeFile(join(box, 'seed.php'), `<?php
require __DIR__ . '/operador_usa.php';
$pdo=getDbConnection();
$pdo->exec('CREATE TABLE orders (id INTEGER PRIMARY KEY,order_number TEXT,status TEXT,chosen_link_id INT,chosen_inspection INT,import_steps TEXT,usa_token TEXT,inspection_result TEXT,refund_requested_at TEXT)');
$pdo->exec('CREATE TABLE order_links (id INTEGER PRIMARY KEY,order_id INT,title TEXT)');
$pdo->exec('CREATE TABLE order_events (id INTEGER PRIMARY KEY,order_id INT,event_type TEXT,meta_json TEXT,user_id TEXT)');
$pdo->exec('CREATE TABLE order_usa_updates (id INTEGER PRIMARY KEY,order_id INT,note TEXT,file_ids TEXT,shared_text TEXT,shared_at TEXT,created_at TEXT)');
$pdo->exec('CREATE TABLE expediente_files (id INTEGER PRIMARY KEY,order_id INT,original_name TEXT,stored_name TEXT,category TEXT,mime_type TEXT,file_size INT)');
$pdo->exec("INSERT INTO orders (id,order_number,status,chosen_link_id,chosen_inspection,usa_token) VALUES (1,'IMP-DEMO','in_progress',11,1,'${token}')");
$pdo->exec("INSERT INTO order_links VALUES (11,1,'Demo inspection boat')");
opuInspectionSchema($pdo); opuInspectionRequest($pdo,opuOrden($pdo,1),['nombre'=>'Demo Coordinator','email'=>'coordinator@example.test']);
`);
  await writeFile(join(box, 'email.php'), `<?php require __DIR__ . '/inspection_price_template.php'; echo opuInspectionPriceEmail(['operator_name'=>'David','boat'=>'Demo inspection boat','order_number'=>'IMP-DEMO','portal_url'=>'https://www.imporlan.cl/'])['html'];`);
  execFileSync(php, [join(box, 'seed.php')]);
  const portServer = createServer(); await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port; await new Promise(resolve => portServer.close(resolve));
  server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', box], { stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { await fetch(`${origin}/email.php`); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(`${origin}/operador_usa.php?r=portal&t=${token}#purchase-price`);
    check(response.status() === 200 && await page.getByRole('heading', { name: 'Confirm the purchase price', exact: true }).count() === 1, `actual private form loads at ${width}px`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `portal fits ${width}px`);
    const form = page.locator('#purchase-price form');
    await form.getByRole('radio', { name: /^Price adjusted/ }).check();
    await form.getByLabel('Previously agreed purchase price (USD)', { exact: true }).fill('25000.50');
    await form.getByLabel('Current confirmed purchase price (USD)', { exact: true }).fill('24000.25');
    await form.getByLabel('Inspection finding, seller agreement or pending negotiation', { exact: true }).fill('short');
    await form.getByRole('button', { name: 'Save price update' }).click();
    check(await page.getByRole('alert').innerText().then(s => s.includes('15–2,000')), 'server refuses unexplained price change');
    check(await form.getByLabel('Current confirmed purchase price (USD)', { exact: true }).inputValue() === '24000.25', 'validation preserves the entered price draft');
    await form.getByLabel('Inspection finding, seller agreement or pending negotiation', { exact: true }).fill('Seller confirmed a reduction because the engine mount needs replacement after the survey.');
    await form.getByRole('button', { name: 'Save price update' }).click();
    check(page.url().includes('r=portal') && await page.getByRole('status').innerText().then(s => s.includes('recorded')), 'real POST redirects to a saved confirmation');
    check(await page.locator('#purchase-price').innerText().then(s => s.includes('Received · awaiting team review')), 'saved adjustment waits for the team to review');
    await form.getByRole('radio', { name: /^Still being negotiated/ }).check();
    await form.getByLabel('Inspection finding, seller agreement or pending negotiation', { exact: true }).fill('Seller has reopened the negotiation. We expect a final answer tomorrow morning.');
    await form.getByRole('button', { name: 'Save price update' }).click();
    check(await page.locator('#purchase-price').innerText().then(s => s.includes('Your confirmation is required')), 'pending negotiation keeps confirmation open');
    if (process.env.PRICE_SCREENSHOTS) {
      await mkdir(process.env.PRICE_SCREENSHOTS, { recursive: true });
      await page.locator('#purchase-price').screenshot({ path: join(process.env.PRICE_SCREENSHOTS, `price-portal-${width}.png`) });
    }
    await page.goto(`${origin}/email.php`);
    check(await page.getByRole('heading', { level: 1 }).count() === 1 && await page.getByRole('link', { name: /^Update purchase price/ }).count() === 1 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `professional HTML email fits ${width}px with one clear CTA`);
    if (process.env.PRICE_SCREENSHOTS) await page.screenshot({ path: join(process.env.PRICE_SCREENSHOTS, `price-email-${width}.png`), fullPage: true });
    check(errors.length === 0, 'form and email render without browser errors');
    await context.close();
  }
  const unauthorized = await fetch(`${origin}/operador_usa.php?r=portal&t=${'b'.repeat(48)}`);
  check(unauthorized.status === 404, 'unknown private link cannot open the operation');
  const wrongBoat = await fetch(`${origin}/operador_usa.php?r=precio&t=${token}`, { method: 'POST', body: new URLSearchParams({ boat_link_id: '99', price_request_id: '1', price_revision: '0', price_status: 'unchanged', price_original: '1', price_confirmed: '1' }) });
  check(wrongBoat.status === 409, 'real POST refuses a different selected boat');
  console.log(`${passed} price portal and email checks passed`);
} finally {
  await browser?.close(); server?.kill(); await rm(box, { recursive: true, force: true });
}
