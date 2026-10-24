import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function runBrowserChecks({ repo, origin, tokens, jpg, pdf, check }) {
  const require = createRequire(join(repo, 'admin-react/package.json'));
  const { createServer } = await import(require.resolve('vite'));
  const { default: react } = await import(require.resolve('@vitejs/plugin-react'));
  const { default: tailwind } = await import(require.resolve('@tailwindcss/vite'));
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const harness = `import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import FilesSection from '/src/admin/components/FilesSection.jsx';
import InspectionFilesSection from '/src/admin/components/InspectionFilesSection.jsx';
import SeccionArchivos from '/src/user/pages/expedientes/SeccionArchivos.jsx';
import {Lightbox} from '/src/shared/components/Lightbox.jsx';
import '/src/index.css';
function App(){const [files,setFiles]=useState([]),[lb,setLb]=useState(null);const admin=location.pathname.includes('/admin/');
useEffect(()=>{fetch('/api/expediente_files_api.php?action=list&order_id=35',{headers:{Authorization:'Bearer '+localStorage.getItem(admin?'token':'imporlan_token')}}).then(r=>r.json()).then(data=>setFiles(data.files.map(f=>({...f,download_url:f.download_url.replace(/exp=\\d+/,'exp=1')}))));},[]);
const archivos={files,loading:false,recargar:()=>{}};const images=files.filter(f=>f.category==='image');const items=images.map(f=>({src:f.download_url,downloadUrl:f.download_url,originalName:f.original_name,alt:f.original_name}));
return <main style={{padding:16}}>{admin?<><InspectionFilesSection archivos={archivos}/><FilesSection orderId={35} archivos={archivos}/></>:<><SeccionArchivos files={files} onPreview={setLb}/><Lightbox open={lb!==null} items={items} index={lb||0} onIndexChange={setLb} onClose={()=>setLb(null)}/></>}</main>}
createRoot(document.getElementById('root')).render(<App/>);`;
  const csp = (await readFile(join(repo, '.htaccess'), 'utf8')).match(/Header set Content-Security-Policy "([^"]+)"/)[1];
  const server = await createServer({ root: join(repo, 'admin-react'), configFile: false, base: '/',
    plugins: [react(), tailwind(), { name: 'file-http-test', resolveId: id => id === '/__files.jsx' ? id : null, load: id => id === '/__files.jsx' ? harness : null,
      configureServer(s) { s.middlewares.use((req, res, next) => {
        if (!/^\/panel\/(?:admin\/)?__file-test/.test(req.url)) return next();
        res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Security-Policy', csp);
        res.end(`<html><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/__files.jsx"></script></body></html>`);
      }); },
    }], server: { host: '127.0.0.1', port: 0, proxy: { '/api': origin } },
  });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const admin of [true, false]) for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1200 }, acceptDownloads: true });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(15000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ tokens, admin }) => localStorage.setItem(admin ? 'token' : 'imporlan_token', admin ? tokens.admin : tokens.customer), { tokens, admin });
      await page.goto(`${base}/panel/${admin ? 'admin/' : ''}__file-test`);
      await page.waitForFunction(() => [...document.querySelectorAll('img')].some(img => img.complete && img.naturalWidth > 0));
      check(true, `${admin ? 'admin' : 'customer'} ${width}px renders JPG thumbnails through real forbidden-link recovery`);
      if (admin) {
        await page.getByRole('heading', { name: 'Informe de inspección', exact: true }).waitFor();
        check(await page.getByText('Informe inspección.pdf', { exact: true }).count() > 0, `admin ${width}px shows the uploaded PDF in inspection reports`);
        check(await page.getByText('Sólo equipo · pendiente de compartir', { exact: true }).isVisible(), 'inspection report clearly identifies its private status');
        const popup = page.waitForEvent('popup');
        await page.getByRole('button', { name: 'Ver Informe inspección.pdf', exact: true }).first().click();
        const tab = await popup;
        await tab.waitForURL(/^blob:/, { waitUntil: 'commit' });
        check(true, 'inspection PDF preview opens recovered application/pdf bytes');
        await tab.close();
      }
      const photo = admin ? page.getByRole('button', { name: 'Ver foto photo_52_page_33.jpg', exact: true }).first() : page.getByRole('button', { name: 'Ver photo_52_page_33.jpg', exact: true });
      await photo.click();
      await page.waitForFunction(() => { const img = document.querySelector('[role="dialog"] img'); return img?.complete && img.naturalWidth > 0; });
      check(true, `${admin ? 'admin' : 'customer'} ${width}px opens the full photo in the lightbox`);
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Descargar', exact: true }).click();
      const download = await downloadPromise;
      check(download.suggestedFilename() === 'photo_52_page_33.jpg', 'download saves the original JPG name rather than expediente_files_api.json');
      const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
      check(Buffer.concat(chunks).equals(jpg), 'browser downloads the original JPEG bytes after permission recovery');
      await page.keyboard.press('Escape');
      if (admin) {
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Descargar Informe inspección.pdf', exact: true }).first().click();
        const download = await downloadPromise;
        check(download.suggestedFilename() === 'Informe inspección.pdf', 'inspection PDF retains its original filename in the browser');
        const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
        assert.ok(Buffer.concat(chunks).equals(pdf));
        // A missing physical image must show an error, never create a .json download.
        let downloads = 0; page.on('download', () => downloads++);
        await page.getByRole('button', { name: 'Descargar missing.jpg', exact: true }).first().click();
        await page.getByRole('alert').getByText('Archivo no disponible en el servidor').waitFor();
        check(downloads === 0, 'failed image download displays the server error without saving JSON');
      } else {
        check(await page.getByText('Informe inspección.pdf', { exact: true }).count() === 0, 'the customer UI does not expose the private inspection report');
      }
      check(errors.length === 0, 'no browser application errors');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px layout fits the viewport`);
      await context.close();
    }
  } finally { await browser.close(); await server.close(); }
}
