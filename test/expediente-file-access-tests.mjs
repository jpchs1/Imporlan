/** Real PHP HTTP integration: signed bytes, session recovery, and privacy.
 * PHP_BIN=php node test/expediente-file-access-tests.mjs
 * Only the database/config are fixtures. The API/auth code is unmodified.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'imporlan-file-api-'));
const key = 'synthetic-test-secret-not-a-production-credential';
const jpg = await readFile(join(repo, 'images/winery-vina-vik.jpg'));
const pdf = Buffer.from('%PDF-1.4\n% Synthetic inspection report\n%%EOF\n');
const token = (role, email, extra = {}) => {
  const parts = [{ alg: 'HS256', typ: 'JWT' }, { role, email, exp: Math.floor(Date.now() / 1000) + 3600, ...extra }].map(o => Buffer.from(JSON.stringify(o)).toString('base64url'));
  return `${parts.join('.')}.${createHmac('sha256', key).update(parts.join('.')).digest('base64url')}`;
};
export const testTokens = { admin: token('admin', 'admin@example.test'), customer: token('user', 'owner@example.test'), other: token('user', 'other@example.test'), agent: token('agent', 'agent@example.test') };
await mkdir(join(temp, 'api/expediente_files'), { recursive: true });
for (const name of ['expediente_files_api.php', 'auth_helper.php', 'session_revocation.php', 'cors_helper.php']) await copyFile(join(repo, 'api', name), join(temp, 'api', name));
await writeFile(join(temp, 'api/email_service.php'), '<?php // No mail is sent by this integration test.\n');
await writeFile(join(temp, 'api/credentials.php'), `<?php define('IMPORLAN_JWT_SECRET', '${key}');\n`);
await writeFile(join(temp, 'api/expediente_files/photo.jpg'), jpg);
await writeFile(join(temp, 'api/expediente_files/report.pdf'), pdf);
await writeFile(join(temp, 'api/db_config.php'), `<?php
class FileTestDb extends PDO {
 function query(string $query, ?int $fetchMode = null, mixed ...$args): PDOStatement|false {
  if (str_starts_with($query, 'SHOW COLUMNS')) $query = "SELECT name FROM pragma_table_info('expediente_files')";
  return $fetchMode === null ? parent::query($query) : parent::query($query, $fetchMode, ...$args);
 }
}
function getDbConnection() {
 $db = new FileTestDb('sqlite:' . __DIR__ . '/../state.sqlite');
 $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
 $db->exec('CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, customer_email TEXT)');
 $db->exec("INSERT OR IGNORE INTO orders VALUES(35, 'owner@example.test')");
 $db->exec('CREATE TABLE IF NOT EXISTS expediente_files(id INTEGER PRIMARY KEY, order_id INTEGER, original_name TEXT, stored_name TEXT, mime_type TEXT, file_size INTEGER, category TEXT, description TEXT, uploaded_by TEXT, created_at TEXT, visible_to_client INTEGER)');
 $insert = $db->prepare('INSERT OR IGNORE INTO expediente_files VALUES(?,35,?,?,?,?,?,NULL,?,CURRENT_TIMESTAMP,?)');
 foreach ([[1,'photo_52_page_33.jpg','photo.jpg','image/jpeg',${jpg.length},'image','operador_usa',1], [2,'Informe inspección.pdf','report.pdf','application/pdf',${pdf.length},'document','operador_usa',0], [3,'identity.pdf','report.pdf','application/pdf',${pdf.length},'document','cliente_identidad',0], [4,'missing.jpg','missing.jpg','image/jpeg',10,'image','operador_usa',1]] as $row) $insert->execute($row);
 return $db;
}
`);
const socket = createServer();
// The public test mirror uses the same production database on the hosting.
// Its file permissions must match too.
await mkdir(join(temp, 'test/api/expediente_files'), { recursive: true });
for (const name of ['auth_helper.php', 'session_revocation.php', 'cors_helper.php', 'email_service.php', 'credentials.php', 'db_config.php']) await copyFile(join(temp, 'api', name), join(temp, 'test/api', name));
await copyFile(join(repo, 'test/api/expediente_files_api.php'), join(temp, 'test/api/expediente_files_api.php'));
await writeFile(join(temp, 'test/api/expediente_files/photo.jpg'), jpg);
await writeFile(join(temp, 'test/api/expediente_files/report.pdf'), pdf);
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const php = spawn(process.env.PHP_BIN || 'php', ['-d', 'display_errors=0', '-S', `127.0.0.1:${port}`, '-t', temp], { stdio: ['ignore', 'ignore', 'pipe'] });
let logs = ''; php.stderr.on('data', chunk => { logs += chunk; });
const origin = `http://127.0.0.1:${port}`;
const request = (path, auth) => fetch(origin + path, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
const list = '/api/expediente_files_api.php?action=list&order_id=35';
const download = id => `/api/expediente_files_api.php?action=download&id=${id}&exp=1&sig=old`;
let passed = 0;
const check = (value, label) => { assert.ok(value, label); console.log(`PASS ${++passed}: ${label}`); };
try {
  for (let i = 0; i < 50; i++) {
    try { await request('/'); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  // Canary: the former dispatch accessed FILE_LINK_TTL before defining it.
  const current = await readFile(join(temp, 'api/expediente_files_api.php'), 'utf8');
  const canary = current.replace("define('FILE_LINK_TTL', 7 * 86400);", '').replace('function requireAdminAuth()', "define('FILE_LINK_TTL', 7 * 86400);\nfunction requireAdminAuth()");
  await writeFile(join(temp, 'api/old.php'), canary);
  check((await request(list.replace('expediente_files_api.php', 'old.php'), testTokens.admin)).status === 500, 'canary reproduces a real HTTP 500 before the file-link initialization fix');
  check((await request(list)).status === 401, 'listing requires a valid session');
  check((await request(list, testTokens.other)).status === 403, 'a different customer cannot list this order');
  const response = await request(list, testTokens.admin);
  const data = await response.json();
  check(response.ok && data.files.length === 4, 'admin lists the real inspection PDF and photos with generated links');
  const signed = data.files.find(f => f.id === 1).download_url;
  let result = await request(signed);
  check(result.ok && result.headers.get('content-type') === 'image/jpeg' && Buffer.from(await result.arrayBuffer()).equals(jpg), 'signed JPEG response is byte-for-byte original, not JSON');
  result = await request(download(1));
  check(result.status === 403 && result.headers.get('content-type').includes('application/json'), 'an old link reproduces the forbidden JSON download');
  result = await request(download(1), testTokens.admin);
  check(result.ok && Buffer.from(await result.arrayBuffer()).equals(jpg), 'an admin session recovers the original image from an old link');
  result = await request(download(1), testTokens.customer);
  check(result.ok && Buffer.from(await result.arrayBuffer()).equals(jpg), 'the customer session recovers their visible photo');
  check((await request(download(1), testTokens.other)).status === 403, 'session recovery never grants access to another customer');
  check((await request(download(2), testTokens.customer)).status === 403, 'an internal inspection PDF stays private from the customer');
  check((await request(download(3), testTokens.agent)).status === 403, 'the US agent cannot retrieve customer identity documents');
  result = await request(download(2) + '&download=1', testTokens.admin);
  check(result.ok && result.headers.get('content-type') === 'application/pdf' && Buffer.from(await result.arrayBuffer()).equals(pdf), 'admin receives the uploaded PDF bytes');
  check(result.headers.get('content-disposition').includes("filename*=UTF-8''Informe%20inspecci%C3%B3n.pdf"), 'PDF download preserves the original filename and .pdf extension');
  check((await request(download(4), testTokens.admin)).status === 404, 'a physically missing file reports 404 rather than fake image bytes');
  check((await request(download(1), token('admin', 'admin@example.test', { purpose: '2fa_pending' }))).status === 401, 'pending 2FA cannot recover private files');
  const customer = await (await request(list, testTokens.customer)).json();
  check(customer.files.length === 2 && !customer.files.some(f => f.mime_type === 'application/pdf'), 'customer list excludes internal reports and identity documents');
  const mirrorList = await (await request('/test' + list, testTokens.customer)).json();
  check(mirrorList.files.length === 2 && mirrorList.files.every(f => f.download_url.startsWith('/test/api/')), 'the live test mirror also hides internal PDFs and returns its own signed links');
  result = await request('/test' + download(1), testTokens.admin);
  check(result.ok && Buffer.from(await result.arrayBuffer()).equals(jpg), 'the test mirror also recovers original JPG bytes for an authorized session');
  check((await request('/test' + download(2), testTokens.customer)).status === 403, 'the test mirror cannot expose an internal PDF through session recovery');
  // Optional browser harness gets a live backend with no mocked byte responses.
  if (process.env.FILE_BROWSER_TEST) {
    const { runBrowserChecks } = await import('./expediente-file-browser-tests.mjs');
    await runBrowserChecks({ repo, origin, tokens: testTokens, jpg, pdf, check });
  }
  console.log(`${passed} file access checks passed.`);
} catch (error) { console.error(logs); throw error; }
finally { php.kill(); await new Promise(resolve => php.once('exit', resolve)); await rm(temp, { recursive: true, force: true }); }
