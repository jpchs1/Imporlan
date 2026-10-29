/** Authenticated real PHP endpoints with captured SMTP; production email and admin control at three sizes. */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const box=await mkdtemp(join(tmpdir(),'imporlan-action-browser-'));
const php=process.env.PHP_BINARY || (process.env.CHROMIUM_PATH ? '/workspace/.onboarding/bin/php' : 'php');
const require=createRequire(join(root,'admin-react/package.json'));
const { createServer }=await import(require.resolve('vite'));
const { default: react }=await import(require.resolve('@vitejs/plugin-react'));
const { default: tailwind }=await import(require.resolve('@tailwindcss/vite'));
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const csp=(await readFile(join(root,'.htaccess'),'utf8')).match(/Header set Content-Security-Policy "([^"]+)"/)[1];
let phpServer,vite,browser,passed=0;
const check=(ok,label)=>{assert.ok(ok,label);console.log(`PASS ${++passed}: ${label}`);};
const jwt=(email,role)=>{
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({email,role,exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
  return `${header}.${payload}.${createHmac('sha256','fixture-import-secret').update(`${header}.${payload}`).digest('base64url')}`;
};
try {
  execFileSync(php,[join(root,'test/fixtures/import-action-bootstrap.php'),box]);
  await writeFile(join(box,'email.php'),`<?php require __DIR__.'/import_action_reminders.php'; $p=impActionPreview(getDbConnection(),1); echo str_replace('cid:imporlan-signature-jp','/email-assets/firma-jp.jpg',$p['mail']['html']);`);
  const socket=netServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  phpServer=spawn(php,['-S',`127.0.0.1:${port}`,'-t',box],{stdio:'ignore'});
  const origin=`http://127.0.0.1:${port}`;
  for(let i=0;i<50;i++){try{await fetch(`${origin}/email.php`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const api=async(action='preview',data=null,email='owner@example.test',role='admin',query='')=>{
    const headers={'Content-Type':'application/json'};if(email)headers.Authorization=`Bearer ${jwt(email,role)}`;
    const response=await fetch(`${origin}/import_actions_api.php?action=${action}&order_id=1${query}`,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined});
    return {status:response.status,...await response.json()};
  };
  check((await api('preview',null,null)).status===401,'real preview requires verified authentication');
  for(const role of ['agent','user'])check((await api('preview',null,'owner@example.test',role)).status===403,`${role} cannot access customer reminder data`);
  const support=await api('preview',null,'staff@example.test','support');
  check(support.status===200 && !support.can_send && !support.can_configure,'support can review client copy without send/configure capability');
  for(const [email,role] of [['owner@example.test','support'],['other@example.test','admin'],['owner@example.test','agent']]) {
    check((await api('configure',{enabled:true,template_hash:'forged',can_configure:true},email,role)).status===403,'server rejects forged global configuration capability');
    check((await api('send_now',{fingerprint:'forged',can_send:true},email,role)).status===403,'server rejects forged send capability');
    check((await api('preview',null,email,role,'&audience=owner')).status===403,'owner-only internal tasks never leak to other roles');
  }
  const preview=await api();
  check(preview.status===200 && preview.can_send && preview.preview.plan.inspection_approved && preview.preview.plan.tasks[0].kind==='payment','actual order produces a payment reminder after inspection approval');
  check(preview.preview.plan.to==='client@example.test' && preview.preview.plan.tasks[0].amount_clp===26891827,'actual preview derives recipient and amount from persisted records');
  check((await api('send_now',{fingerprint:'stale'})).status===409,'stale review cannot send through HTTP');
  check((await api('configure',{enabled:true,template_hash:'stale'})).status===409,'stale deployed template cannot be enabled');
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [390,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:1000}});
    await page.goto(`${origin}/email.php`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`real payment email fits ${width}px`);
    check(await page.getByRole('heading',{name:'Tu próximo paso: Pago 2',exact:true}).count()===1 && await page.getByRole('link',{name:/^Realizar Pago 2/}).getAttribute('href')==='https://www.imporlan.cl/panel/#/payments?pagar=fixture-p2',`one clear existing-payment CTA at ${width}px`);
    check(await page.getByAltText('Juan Pablo · Imporlan').evaluate(image=>image.complete && image.naturalWidth>0),`graphic owner signature loads at ${width}px`);
    if(process.env.ACTION_SCREENSHOTS){await mkdir(process.env.ACTION_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.ACTION_SCREENSHOTS,`correo-pago-referencia-${width}.png`),fullPage:true});}
    await page.close();
  }
  const bytes=await readFile(join(box,'payment_requests.json'),'utf8');
  const sent=await api('send_now',{fingerprint:preview.preview.fingerprint,to:'attacker@example.test',amount_clp:1,html:'forged'});
  check(sent.status===200 && sent.sent,'native transactional API accepts fresh principal send with captured SMTP');
  const captured=(await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  check(captured.length===1 && captured[0].to==='client@example.test' && captured[0].bccEmails.includes('jpchs1@gmail.com'),'body cannot override recipient; owner BCC remains on real MIME');
  check((await api('send_now',{fingerprint:preview.preview.fingerprint})).status===409,'actual API prevents a second same-day attempt');
  const after=await api();check(!after.can_send && after.delivery.status==='sent','actual refreshed preview shows sent audit and disables sending');
  check((await api('configure',{enabled:true,template_hash:preview.settings.template_hash})).settings.enabled===true,'principal can activate exact deployed daily template');
  check((await readFile(join(box,'payment_requests.json'),'utf8'))===bytes,'real send never creates or edits payment requests');
  execFileSync(php,['-r',`$f='${join(box,'payment_requests.json')}';$d=json_decode(file_get_contents($f),true);$d['requests'][0]['status']='paid';file_put_contents($f,json_encode($d));`]);
  const paid=await api();check(paid.preview.plan.tasks.every(t=>t.kind!=='payment' && t.kind!=='inspection'),'settled payment and approved inspection are both absent on next snapshot');
  check((await api('send_now',{fingerprint:preview.preview.fingerprint})).status===409,'paid-state fingerprint blocks an outdated send');


  // Actual authenticated evidence routes. No bank status or mail is inferred from an upload.
  execFileSync(php,['-r',`$f='${join(box,'payment_requests.json')}';$d=json_decode(file_get_contents($f),true);$d['requests'][0]['status']='pending';file_put_contents($f,json_encode($d));`]);
  const receiptCall=async(action,body=null,email='client@example.test',role='user',query='')=>{
    const headers={Authorization:`Bearer ${jwt(email,role)}`};if(body && !(body instanceof FormData))headers['Content-Type']='application/json';
    const r=await fetch(`${origin}/payment_receipts_api.php?action=${action}&request_id=fixture-p2${query}`,{method:body?'POST':'GET',headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
    return {...await r.json(),httpStatus:r.status};
  };
  const receiptPayload=(reference,content='%PDF-1.4\nFixture receipt\n',type='application/pdf')=>{const f=new FormData();f.append('request_id','fixture-p2');f.append('amount_clp','26891827');f.append('reference',reference);f.append('receipt',new Blob([content],{type}),'../../receipt.php');return f;};
  check((await fetch(`${origin}/payment_receipts_api.php?action=list&request_id=fixture-p2`)).status===401,'anonymous callers cannot list payment evidence');
  check((await receiptCall('list',null,'other@example.test')).httpStatus===403 && (await receiptCall('list',null,'client@example.test','agent')).httpStatus===403,'foreign customers and agents cannot access financial evidence');
  check((await receiptCall('upload',receiptPayload('BAD','<?php echo 1;','application/pdf'))).httpStatus===400,'server inspects file bytes rather than trusting PDF extension or MIME');
  const upload=await receiptCall('upload',receiptPayload('BANK-FIXTURE-1'));
  check(upload.httpStatus===200 && upload.status==='pending' && upload.receipt.declared_amount_clp===26891827,'actual multipart upload records amount and reference without confirming payment');
  const stored=JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests[0];
  check(stored.status==='pending' && stored.receipt_status==='pending' && stored.receipts.length===1 && stored.receipts[0].stored_name.endsWith('.pdf'),'evidence remains pending, attached to the exact request with a safe private filename');
  check((await receiptCall('upload',receiptPayload('BANK-FIXTURE-1'))).httpStatus===409,'duplicate bank reference is not attached twice');
  const download=`${origin}${upload.receipt.download_url.replace('/api/','/')}`;
  check((await fetch(download,{headers:{Authorization:`Bearer ${jwt('other@example.test','user')}`}})).status===403,'a guessed receipt id cannot cross customer boundaries');
  const privatePdf=await fetch(download,{headers:{Authorization:`Bearer ${jwt('client@example.test','user')}`}});
  check(privatePdf.status===200 && privatePdf.headers.get('content-type').includes('application/pdf') && (await privatePdf.text()).startsWith('%PDF-1.4'),'owner downloads original evidence through the authenticated route');
  check((await receiptCall('review',{request_id:'fixture-p2',receipt_id:upload.receipt.id,decision:'reviewed'})).httpStatus===403,'customer cannot validate their own payment proof');
  check((await receiptCall('review',{request_id:'fixture-p2',receipt_id:upload.receipt.id,decision:'reviewed'},'owner@example.test','admin')).httpStatus===200,'verified admin can record evidence review');
  check(JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests[0].status==='pending','reviewing evidence alone still does not confirm bank income');
  check((await receiptCall('review',{request_id:'fixture-p2',receipt_id:upload.receipt.id,decision:'rejected',note:'The bank reference needs a corrected document.'},'owner@example.test','admin')).httpStatus===200,'admin can request corrected evidence with an audited explanation');
  check((await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length===1,'uploads and evidence review send no false paid emails');


  const usdForm=receiptPayload('USD-FIXTURE');usdForm.set('request_id','fixture-p1');usdForm.set('currency','USD');usdForm.set('amount_clp','100.50');
  const usdReceipt=await receiptCall('upload',usdForm);
  check(usdReceipt.httpStatus===200 && usdReceipt.receipt.currency==='USD' && usdReceipt.receipt.declared_amount==='100.50' && usdReceipt.receipt.declared_amount_clp===null,'USD evidence preserves original amount without inventing a CLP conversion');


  execFileSync(php,['-r',`$f='${join(box,'payment_requests.json')}';$d=json_decode(file_get_contents($f),true);$d['requests'][1]['status']='pending';file_put_contents($f,json_encode($d));`]);
  const historicalBefore=(await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length;
  const historicalResponse=await fetch(`${origin}/payment_requests_api.php?action=update_status`,{method:'POST',headers:{Authorization:`Bearer ${jwt('owner@example.test','admin')}`,'Content-Type':'application/json'},body:JSON.stringify({request_id:'fixture-p1',new_status:'paid',payment_method:'transferencia_bancaria'})});
  const historical=await historicalResponse.json();
  check(historicalResponse.status===200 && historical.request.status==='paid' && historical.request.reconciled_after_advance && (await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length===historicalBefore,'reconciling historical Pago 1 records the owner confirmation without repeating old customer or inspection emails');

  const confirmPaid=()=>fetch(`${origin}/payment_requests_api.php?action=update_status`,{method:'POST',headers:{Authorization:`Bearer ${jwt('owner@example.test','admin')}`,'Content-Type':'application/json'},body:JSON.stringify({request_id:'fixture-p2',new_status:'paid',payment_method:'transferencia_bancaria'})});
  const confirmed=await confirmPaid();const confirmedJson=await confirmed.json();
  check(confirmed.status===200 && confirmedJson.request.status==='paid' && confirmedJson.request.receipts.length===1 && confirmedJson.request.paid_confirmed_by==='owner@example.test','actual bank confirmation persists verified admin and preserves concurrently stored proof');
  const paidMails=(await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length;
  await confirmPaid();
  check((await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length===paidMails,'repeating bank confirmation never sends another paid email');

  const harness=await readFile(join(root,'test/fixtures/import-reminders.jsx'),'utf8');
  const signature=await readFile(join(root,'api/email-assets/firma-jp.jpg'));
  vite=await createServer({root:join(root,'admin-react'),base:'/',configFile:false,plugins:[react(),tailwind(),{
    name:'action-reminder-fixture',resolveId:id=>id==='/__reminders.jsx'?id:null,load:id=>id==='/__reminders.jsx'?harness:null,
    configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url.split('?')[0]!=='/panel/__reminders')return next();res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',csp);res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import R from "/@react-refresh";R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/__reminders.jsx"></script></body></html>');});},
  }],server:{host:'127.0.0.1',port:0}});await vite.listen();
  const uiOrigin=`http://127.0.0.1:${vite.httpServer.address().port}`;
  const errors=[];
  for(const width of [390,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/email-assets/firma-jp.jpg',r=>r.fulfill({contentType:'image/jpeg',body:signature}));
    let enabled=false,sentUI=false;const mutations=[];
    await page.route('**/api/import_actions_api.php?**',async r=>{
      const url=new URL(r.request().url());const action=url.searchParams.get('action');const id=Number(url.searchParams.get('order_id')||r.request().postDataJSON()?.order_id||1);
      const audience=url.searchParams.get('audience')||'client';
      if(r.request().method()==='POST')mutations.push({action,body:r.request().postDataJSON()});
      if(action==='configure'){enabled=r.request().postDataJSON().enabled;return r.fulfill({json:{success:true,settings:{...preview.settings,enabled}}});}
      if(action==='send_now'){sentUI=true;return r.fulfill({json:{success:true,sent:true}});}
      const p=structuredClone(preview);p.settings.enabled=enabled;p.preview.plan.to=audience==='owner'?'owner@example.test':`client${id}@example.test`;p.preview.fingerprint=`hash-${id}-${audience}`;p.can_send=!sentUI;p.delivery=sentUI?{status:'sent'}:null;
      if(id===2)await new Promise(resolve=>setTimeout(resolve,50));
      return r.fulfill({json:p});
    });
    await page.goto(`${uiOrigin}/panel/__reminders`);await page.getByRole('button',{name:'Ver correo del proceso'}).click();
    await page.getByText('client1@example.test',{exact:false}).waitFor();
    check(mutations.length===0,`opening preview at ${width}px never sends or enables automation`);
    const iframe=page.frameLocator('iframe[title="Vista previa del correo del proceso"]');
    await iframe.getByRole('heading',{name:'Tu próximo paso: Pago 2'}).waitFor();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`owner modal fits ${width}px under actual CSP`);
    await page.getByRole('button',{name:'Enviar este correo',exact:true}).click();
    await page.getByText('Este destinatario ya recibió un aviso hoy.').waitFor();
    check(mutations.length===1 && mutations[0].body.fingerprint==='hash-1-client' && await page.getByRole('button',{name:'Enviar este correo',exact:true}).isDisabled(),`explicit send uses reviewed fingerprint and blocks duplicate at ${width}px`);
    await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
    await page.getByRole('button',{name:'Activar recordatorios diarios',exact:true}).click();
    await page.getByText('Recordatorios diarios activos',{exact:true}).waitFor();
    check(mutations[1].body.enabled===true && mutations[1].body.template_hash===preview.settings.template_hash,`explicit owner activation binds deployed template at ${width}px`);
    await page.getByRole('button',{name:'Expediente B',exact:true}).click();
    await page.getByRole('button',{name:'Ver correo del proceso'}).click();await page.getByText('client2@example.test',{exact:false}).waitFor();
    check(await page.getByText('client1@example.test',{exact:false}).count()===0,'switching orders clears the previous recipient and mail');
    await page.close();
  }

  for(const width of [390,768,1440]) {
    execFileSync(php,['-r',`$f='${join(box,'payment_requests.json')}';$d=json_decode(file_get_contents($f),true);$r=&$d['requests'][0];$r['status']='pending';unset($r['receipts'],$r['receipt_received_at'],$r['receipt_status'],$r['receipt_url']);file_put_contents($f,json_encode($d));`]);
    const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(token=>{localStorage.setItem('imporlan_token',token);localStorage.setItem('imporlan_user',JSON.stringify({email:'client@example.test',name:'Cliente de ejemplo',role:'user'}));window.receiptBlobs=[];const nativeBlob=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.receiptBlobs.push({type:blob.type,size:blob.size});return nativeBlob(blob);};},jwt('client@example.test','user'));
    const gatewayCalls=[];const downloadAuth=[];let delayPaymentList=false;
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.pathname.endsWith('payment_receipts_api.php')) {
        const headers={};const auth=request.headers().authorization;if(auth)headers.Authorization=auth;const mime=request.headers()['content-type'];if(mime)headers['Content-Type']=mime;if(url.searchParams.get('action')==='download')downloadAuth.push(!!auth);
        const response=await fetch(`${origin}${url.pathname.replace('/api/','/')}${url.search}`,{method:request.method(),headers,body:request.method()==='POST'?request.postDataBuffer():undefined});
        return route.fulfill({status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json'},body:Buffer.from(await response.arrayBuffer())});
      }
      if(/webpay|mercadopago/.test(url.pathname))gatewayCalls.push(url.pathname);
      if(delayPaymentList && url.pathname.endsWith('payment_requests_api.php'))await new Promise(resolve=>setTimeout(resolve,1500));
      const json=url.pathname.endsWith('payment_requests_api.php') ? JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')) : {success:true,orders:[{id:1,order_number:'IMP-DEMO'}]};
      return route.fulfill({json});
    });
    await page.goto(`${uiOrigin}/panel/__reminders?mode=payments`);
    await page.getByRole('radio',{name:/Transferencia bancaria/}).click();
    await page.getByRole('button',{name:'Ver datos de transferencia',exact:true}).click();
    await page.getByLabel('Referencia o número de transferencia').fill(`UI-BANK-${width}`);
    await page.getByLabel('Archivo del comprobante',{exact:true}).setInputFiles({name:'transferencia.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nUI payment receipt\n')});
    await page.getByRole('button',{name:'Adjuntar comprobante',exact:true}).click();
    await page.getByText('Comprobante recibido · ingreso en revisión',{exact:true}).waitFor();
    check(gatewayCalls.length===0 && await page.getByRole('radio',{name:/Transferencia bancaria/}).count()===0,`upload at ${width}px blocks a second payment and waits for bank review`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`payment evidence UI fits ${width}px under actual CSP`);
    const row=JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests[0];
    check(row.status==='pending' && row.receipts[0].reference===`UI-BANK-${width}`,`actual client form attaches evidence to pending Pago 2 at ${width}px`);
    if(process.env.ACTION_SCREENSHOTS)await page.screenshot({path:join(process.env.ACTION_SCREENSHOTS,`comprobante-cliente-${width}.png`),fullPage:true});

    if(width===1440) {
      await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
      const paymentRow=page.getByRole('row').filter({hasText:'Pago 2'});
      await paymentRow.getByRole('button',{name:'Más acciones',exact:true}).click();
      const popupPromise=page.waitForEvent('popup');
      const receiptBytes=page.waitForResponse(r=>r.url().includes('payment_receipts_api.php?action=download') && r.status()===200);
      await page.getByRole('menuitem',{name:'Ver comprobante',exact:true}).click();
      const popup=await popupPromise;await receiptBytes;
      // Chromium headless-shell downloads PDFs; it has no built-in PDF viewer.
      // Assert the actual UI authenticated and created a nonempty PDF blob before that navigation.
      await page.waitForFunction(()=>window.receiptBlobs.some(b=>b.type==='application/pdf' && b.size>0));
      check(downloadAuth.includes(false) && downloadAuth.includes(true),'payment-table receipt action retries the protected download with verified owner authentication');
      if(!popup.isClosed())await popup.close();
      execFileSync(php,['-r',`$f='${join(box,'payment_requests.json')}';$d=json_decode(file_get_contents($f),true);$r=&$d['requests'][0];unset($r['receipts'],$r['receipt_received_at'],$r['receipt_status'],$r['receipt_url']);file_put_contents($f,json_encode($d));`]);
      await page.reload();await page.getByRole('radio',{name:/Transferencia bancaria/}).waitFor();
      await page.getByRole('button',{name:'Cancelar',exact:true}).last().click();
      await page.getByRole('row').filter({hasText:'Pago 2'}).click();
      const detail=page.getByRole('dialog');
      await detail.getByLabel('Referencia o número de transferencia').fill('DETAIL-RECEIPT');
      await detail.getByLabel('Archivo del comprobante',{exact:true}).setInputFiles({name:'detalle.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nDetail receipt\n')});
      delayPaymentList=true;
      const refreshed=page.waitForResponse(r=>r.url().includes('payment_requests_api.php'));
      await detail.getByRole('button',{name:'Adjuntar comprobante',exact:true}).click();
      await detail.getByText('Comprobante recibido. El equipo revisará el ingreso antes de confirmar el pago.',{exact:true}).waitFor();
      await detail.getByRole('button',{name:'Pagar',exact:true}).click();
      await page.getByText('Comprobante recibido · ingreso en revisión',{exact:true}).waitFor();
      check(await page.getByRole('radiogroup',{name:'Medio de pago'}).count()===0 && gatewayCalls.length===0,'uploading in payment details cannot reopen gateways even before the list refresh completes');
      await refreshed;
    }

    await page.close();
  }

  check(errors.length===0,`admin controls render without runtime errors: ${errors.join('; ')}`);
  console.log(`${passed} reminder API, email and UI checks passed`);
} finally {await browser?.close();await vite?.close();phpServer?.kill();await rm(box,{recursive:true,force:true});}
