/** Actual process components with fictional records; no authenticated live customer data or SMTP. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile,mkdir } from 'node:fs/promises';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(join(repo,'admin-react/package.json'));
const { createServer }=await import(require.resolve('vite'));
const { default:react }=await import(require.resolve('@vitejs/plugin-react'));
const { default:tailwind }=await import(require.resolve('@tailwindcss/vite'));
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const harness=await readFile(join(repo,'test/fixtures/import-process.jsx'),'utf8');
const boat=await readFile(join(repo,'images/rank-mastercraft-x26.webp'));
const server=await createServer({root:join(repo,'admin-react'),base:'/',configFile:false,plugins:[react(),tailwind(),{
  name:'process-fixture',resolveId:id=>id==='/__process.jsx'?id:null,load:id=>id==='/__process.jsx'?harness:null,
  configureServer(s){s.middlewares.use((req,res,next)=>{
    if(req.url==='/__boat.webp'){res.setHeader('Content-Type','image/webp');res.end(boat);return;}
    if(!req.url.startsWith('/panel/__process?'))return next();
    res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import R from "/@react-refresh";R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/__process.jsx"></script></body></html>');
  });},
}],server:{host:'127.0.0.1',port:0}});
await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
let passed=0;const check=(v,label)=>{assert.ok(v,label);console.log(`PASS ${++passed}: ${label}`);};
try {
  for(const mode of ['client','admin','agent']) for(const width of [390,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:1050},reducedMotion:'reduce'});page.setDefaultTimeout(12000);const errors=[],mutations=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      if(route.request().method()!=='GET')mutations.push(route.request().url());
      const u=new URL(route.request().url());
      if(u.pathname.endsWith('payment_receipts_api.php')) { const id=u.searchParams.get('request_id');const receipts=await page.evaluate(id=>(window.fixtureRequests.find(r=>r.id===id)?.receipts || []),id);return route.fulfill({json:{success:true,receipts}}); }
      return route.fulfill({json:{success:true,settings:{enabled:false},preview:{plan:{kind:'none'}}}});
    });
    for(const scenario of (mode==='agent'?['due']:['due','review','rejected','history','price','report','declined','closed','without'])) {
      await page.goto(`${origin}/panel/__process?mode=${mode}&scenario=${scenario}`);
      await page.getByRole('list',{name:mode==='client'?'Etapas de tu importación':'Etapas de la operación'}).waitFor();
      await page.waitForFunction(()=>document.fonts.status==='loaded');
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${mode}/${scenario} fits ${width}px`);
      if(mode==='client') {
        const action=page.locator('.client-import-action');const plan=page.getByRole('list',{name:'Pagos del plan'});
        if(scenario==='due') {check(await action.getByRole('link',{name:'Pagar $11.340.000',exact:true}).getAttribute('href').then(h=>h.includes('demo-p2')),'post-inspection CTA targets only the actual second charge');check(await plan.getByRole('link',{name:'Realizar Pago 3'}).count()===0,'future third payment has no premature payment CTA');}
        if(scenario==='review') {check((await action.innerText()).includes('Comprobante recibido') && await plan.getByRole('link',{name:'Realizar Pago 2'}).count()===0,'received proof replaces repeat-payment CTA with review status');check(await page.locator('.payment-overview__paid dd').innerText()==='$1.260.000','proof is excluded from confirmed income');}
        if(scenario==='rejected') check(await action.getByRole('link',{name:'Reemplazar comprobante',exact:true}).count()===1 && await page.getByRole('link',{name:/^(Realizar Pago 2|Pagar)$/}).count()===0,'rejected proof offers replacement without another transfer');
        if(scenario==='history') check(await page.getByRole('link',{name:/^(Realizar Pago 1|Pagar)$/}).count()===0 && (await action.innerText()).includes('conciliando'),'advanced unpaid first-payment record is reconciled without asking to pay again');
        if(scenario==='report') {await page.getByRole('button',{name:'Aprobar y seguir',exact:true}).waitFor();check(await page.evaluate(()=>window.processActions.length)===0,'report decision remains explicit; opening the process never approves it');}
        if(scenario==='without') check(await page.getByRole('list',{name:'Etapas de tu importación'}).locator('li').count()===5,'without-inspection journey omits inspection');
        if(scenario==='closed') check(await page.locator('.import-journey [aria-current]').count()===0 && await plan.getByRole('link',{name:/Realizar Pago/}).count()===0,'closed delivered operation has no current task or payment demand');
      } else if(mode==='admin' && ['due','review','history'].includes(scenario)) {
        const action=page.getByRole('region',{name:'Próxima acción de la operación'});
        await action.getByRole('button').click();
        check(await page.locator('#importacion-cobros').evaluate(el=>el===document.activeElement),'admin next action focuses the actual financial section');
        if(scenario==='review') {await page.getByText('Comprobantes y revisión del Pago 2',{exact:true}).click();await page.getByText('DEMO-REF-2',{exact:false}).waitFor();check(await page.getByRole('button',{name:'Registrar revisión',exact:true}).isVisible(),'admin can reach evidence review directly in the matching payment');}
      }
      if(mode==='agent') check(await page.locator('.payment-overview').count()===0 && await page.getByText('Pagos y comprobantes',{exact:true}).count()===0 && !/18\.000\.000|1\.260\.000/.test(await page.locator('main').innerText()),'operator process view contains no financial controls or amounts');
      if(process.env.PROCESS_SCREENSHOTS && ['due','review'].includes(scenario) && mode!=='agent') {await mkdir(process.env.PROCESS_SCREENSHOTS,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(process.env.PROCESS_SCREENSHOTS,`${mode}-${scenario}-${width}.png`),fullPage:true});}
      check(await page.evaluate(()=>window.processActions.length)===0 && mutations.length===0,'viewing stages and navigating to payments never mutates the operation');
    }
    check(errors.length===0,`${mode}/${width} has no browser runtime errors`);
    await page.close();
  }
  console.log(`${passed} process UI checks passed.`);
} finally {await browser.close();await server.close();}
