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
  check((await fetch(`${origin}/payment_requests_api.php?action=user_list_public&user_email=client@example.test`,{headers:{Authorization:`Bearer ${jwt('client@example.test','agent')}`}})).status===403,'operator cannot bypass receipt privacy through the legacy financial-record listing');
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
  const historicalNotices=(await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).slice(historicalBefore);
  check(historicalResponse.status===200 && historical.request.status==='paid' && historical.request.reconciled_after_advance && historicalNotices.length===3 && historicalNotices.every(m=>m.subject.includes('Cuadre listo')||m.subject.includes('Client installment completed')),'historical Pago 1 confirmation emits completion notices without restarting inspection instructions');

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

    if(width===390) {
      await page.getByLabel('Moneda del comprobante',{exact:true}).selectOption('USD');
      await page.getByLabel('Monto transferido en USD').fill('100,50');
      await page.getByLabel('Referencia o número de transferencia').fill('AMBIGUOUS-AMOUNT');
      await page.getByLabel('Archivo del comprobante',{exact:true}).setInputFiles({name:'monto.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nReceipt\n')});
      await page.getByRole('button',{name:'Adjuntar comprobante',exact:true}).click();
      await page.getByText('Indica el monto transferido sin separador de miles; en USD usa punto decimal',{exact:true}).waitFor();
      check(await page.getByLabel('Monto transferido en USD').inputValue()==='100,50' && !JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests[0].receipts,'ambiguous decimal comma remains visible and is rejected rather than silently recorded as a hundredfold amount');
      await page.getByLabel('Moneda del comprobante',{exact:true}).selectOption('CLP');
      await page.getByLabel('Monto transferido en CLP').fill('26891827');
    }

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
      check(await detail.getByRole('button',{name:'Pagar',exact:true}).count()===0 && await detail.getByText('Comprobante en revisión',{exact:true}).count()===1 && gatewayCalls.length===0,'uploading in payment details immediately replaces the payment CTA with review status before list refresh');
      await refreshed;
      await detail.getByRole('button',{name:'Cerrar',exact:true}).last().click();
      const uploaded=JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests[0].receipts[0];
      const rejected=await receiptCall('review',{request_id:'fixture-p2',receipt_id:uploaded.id,decision:'rejected',note:'El archivo no muestra la referencia bancaria.'},'owner@example.test','admin');
      check(rejected.httpStatus===200,'actual evidence review can request a replacement without changing the pending bank status');
      delayPaymentList=false;await page.reload();
      await page.getByRole('heading',{name:'Reemplazar comprobante',exact:true}).waitFor();
      await page.getByText('Se requiere otro comprobante: El archivo no muestra la referencia bancaria.',{exact:true}).waitFor();
      check(await page.getByRole('radiogroup',{name:'Medio de pago'}).count()===0 && await page.getByLabel('Archivo del comprobante',{exact:true}).isVisible() && gatewayCalls.length===0,'a rejected proof opens the replacement form and reviewer note without offering a second transfer');
    }

    await page.close();
  }

  // Native partial-credit API and actual admin/client controls; no payment-provider traffic.
  const creditSeed=()=>execFileSync(php,['-r',`$f='${join(box,'payment_requests.json')}';$d=json_decode(file_get_contents($f),true);$d['requests']=array_values(array_filter($d['requests'],function($r){return $r['id']!=='fixture-credit';}));$d['requests'][]=['id'=>'fixture-credit','title'=>'Pago 2 de prueba','user_email'=>'client@example.test','amount_clp'=>10000,'status'=>'pending','created_at'=>'2026-10-20','metadata'=>['order_id'=>'IMP-DEMO','custom_fields'=>['pago'=>2]]];file_put_contents($f,json_encode($d));`]);
  const creditApi=async(action,data,email='owner@example.test',role='admin')=>{
    const response=await fetch(`${origin}/payment_requests_api.php?action=${action}`,{method:'POST',headers:{Authorization:`Bearer ${jwt(email,role)}`,'Content-Type':'application/json'},body:JSON.stringify({request_id:'fixture-credit',...data})});return {code:response.status,...await response.json()};
  };
  const creditPayload={amount_clp:2000,received_on:'2026-10-20',bank:'global66',reference:'CREDIT-API-1',note:'Verified fictional bank credit',expected_amount_clp:10000,expected_remaining_clp:10000,idempotency_key:'fixture-credit-api-1'};
  creditSeed();
  check((await creditApi('register_credit',creditPayload,'client@example.test','user')).code===403,'customer cannot confirm their own bank credit through the native API');
  check((await creditApi('register_credit',creditPayload,'client@example.test','agent')).code===403,'operator cannot register bank credits through legacy financial routes');
  const firstCredit=await creditApi('register_credit',creditPayload);
  check(firstCredit.code===200 && firstCredit.balance.remaining===8000 && firstCredit.request.status==='pending','authenticated finance API stores a partial credit without settling the entire invoice');
  check((await creditApi('register_credit',creditPayload)).duplicate,'API retry with the same registration key is idempotent');
  check((await creditApi('update_status',{new_status:'paid',payment_method:'transferencia_bancaria'})).code===409,'old full-payment action cannot bypass the remaining balance once bank credits exist');
  check((await creditApi('admin_update',{amount_clp:9000})).code===409,'an invoice with confirmed money cannot silently change its original amount');
  const publicCredit=await fetch(`${origin}/payment_requests_api.php?action=get_by_id&id=fixture-credit`,{headers:{Authorization:`Bearer ${jwt('client@example.test','user')}`}}).then(r=>r.json());
  check(publicCredit.request.payment_credits[0].amount_clp===2000 && !publicCredit.request.payment_credits[0].idempotency_key && !publicCredit.request.payment_credits[0].note,'customer can inspect their credits without receiving internal audit or retry fields');
  for(const width of [390,1440]) {
    creditSeed();const page=await browser.newPage({viewport:{width,height:1050}});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({admin,user})=>{localStorage.setItem('token',admin);localStorage.setItem('imporlan_token',user);localStorage.setItem('imporlan_user',JSON.stringify({email:'client@example.test',name:'Cliente de prueba',role:'user'}));},{admin:jwt('owner@example.test','admin'),user:jwt('client@example.test','user')});
    const gateway=[];
    await page.route('**/api/**',async route=>{
      const u=new URL(route.request().url());
      if(/webpay|mercadopago/.test(u.pathname)){gateway.push(route.request().postDataJSON());return route.fulfill({json:{success:false,error:'No real provider traffic in this fixture'}});}
      if(/payment_requests_api|payment_receipts_api/.test(u.pathname)) {
        const remote=await fetch(`${origin}/${u.pathname.split('/').pop()}${u.search}`,{method:route.request().method(),headers:route.request().headers(),body:route.request().method()==='POST'?route.request().postData():undefined});
        return route.fulfill({status:remote.status,contentType:remote.headers.get('content-type') || 'application/json',body:Buffer.from(await remote.arrayBuffer())});
      }
      return route.fulfill({json:{success:true,orders:[{id:1,order_number:'IMP-DEMO'}]}});
    });
    await page.goto(`${uiOrigin}/panel/__reminders?mode=credits`);
    await page.getByText('Registrar abono bancario',{exact:true}).click();
    await page.getByLabel('Monto del abono en CLP').fill('2000');await page.getByLabel('Fecha del abono bancario').fill('2026-10-20');
    await page.getByLabel('Cuenta que recibió el abono').selectOption('global66');await page.getByLabel('Número de operación o referencia bancaria',{exact:true}).fill(`CREDIT-UI-${width}`);
    await page.getByRole('button',{name:'Revisar abono',exact:true}).click();
    const confirmation=page.getByRole('dialog');await confirmation.getByRole('heading',{name:'Confirmar ingreso bancario',exact:true}).waitFor();
    check(JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests.find(r=>r.id==='fixture-credit').payment_credits===undefined,'reviewing a proposed bank credit never records money before explicit confirmation');
    await confirmation.getByRole('button',{name:'Confirmar abono verificado',exact:true}).click();
    await page.getByText('Abono confirmado. Los recordatorios usarán el saldo restante.',{exact:true}).waitFor();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`credit registration fits ${width}px`);
    await page.goto(`${uiOrigin}/panel/__reminders?mode=payments&request=fixture-credit`);
    await page.getByRole('button',{name:/^Pagar.*con WebPay$/}).waitFor({timeout:10000}).catch(async e=>{console.log('PARTIAL UI DIAGNOSTIC',await page.locator('body').innerText(),errors);throw e;});
    check(await page.getByRole('region',{name:'Abonos de Pago 2 de prueba'}).getByText('$2.000',{exact:true}).count()>0,'customer sees confirmed credits and the correct unpaid balance in the payment dialog');
    if(process.env.ACTION_SCREENSHOTS)await page.screenshot({path:join(process.env.ACTION_SCREENSHOTS,`saldo-abonos-ejemplo-${width}.png`),fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:/^Pagar.*con WebPay$/}).click();
    check(gateway.length===1 && gateway[0].amount===8000 && gateway[0].payment_request_id==='fixture-credit','explicit gateway action requests only the remaining balance for the selected invoice');
    await page.getByRole('radio',{name:/Transferencia bancaria/}).click();await page.getByRole('button',{name:'Ver datos de transferencia',exact:true}).click();
    check(await page.getByLabel('Monto transferido en CLP').inputValue()==='8000','transfer and proof form use the same net balance');
    await page.goto(`${uiOrigin}/panel/__reminders?mode=payments&request=fixture-credit`);
    await page.getByRole('button',{name:'Adjuntar comprobante de $2.000',exact:true}).click();
    check(await page.getByLabel('Monto transferido en CLP').inputValue()==='2000' && await page.getByLabel('Referencia o número de transferencia').inputValue()===`CREDIT-UI-${width}`,'per-credit proof action pre-fills that bank movement instead of asking for the outstanding invoice balance');
    await page.goto(`${uiOrigin}/panel/__reminders?mode=payments&request=fixture-credit&proof=1`);
    await page.getByRole('heading',{name:'Adjuntar comprobante',exact:true}).waitFor();
    check(await page.getByRole('radiogroup',{name:'Medio de pago'}).count()===0 && await page.getByLabel('Monto transferido en CLP').inputValue()==='2000','email proof deep link goes directly to upload, without offering another payment');
    await page.getByLabel('Archivo del comprobante',{exact:true}).setInputFiles({name:'respaldo-ejemplo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nExample proof for existing credit\n')});
    if(process.env.ACTION_SCREENSHOTS)await page.screenshot({path:join(process.env.ACTION_SCREENSHOTS,`respaldo-abono-ejemplo-${width}.png`),fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'Adjuntar comprobante',exact:true}).click();
    await page.getByText('Respaldo recibido. Tu abono sigue registrado; el equipo revisará el archivo.',{exact:true}).waitFor();
    const withProof=JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests.find(r=>r.id==='fixture-credit');
    check(withProof.status==='pending' && withProof.payment_credits.length===1 && !withProof.payment_credits[0].receipt_id && withProof.receipts[0].credit_id===withProof.payment_credits[0].id,'upload hints identify the existing credit but never book it twice or auto-approve evidence');
    check(gateway.length===1 && await page.getByRole('radiogroup',{name:'Medio de pago'}).count()===0,'saving a proof never contacts a payment gateway');
    const forged=receiptPayload(`FORGED-CREDIT-${width}`);forged.set('request_id','fixture-credit');forged.set('credit_id','foreign-credit');
    check((await receiptCall('upload',forged)).httpStatus===400,'proof hints cannot reference a credit from another invoice');
    await page.goto(`${uiOrigin}/panel/__reminders?mode=credits`);
    const suggested=page.getByLabel('Comprobante para abono de $2.000');await suggested.waitFor();
    check(await suggested.inputValue()===withProof.receipts[0].id,'admin gets the customer-selected receipt preselected for explicit reconciliation');
    await page.getByRole('button',{name:'Asociar comprobante',exact:true}).click();
    await page.getByText('Comprobante asociado al abono confirmado.',{exact:true}).waitFor();
    const linked=JSON.parse(await readFile(join(box,'payment_requests.json'),'utf8')).requests.find(r=>r.id==='fixture-credit');
    check(linked.payment_credits.length===1 && linked.payment_credits[0].amount_clp===2000 && linked.payment_credits[0].receipt_id===linked.receipts[0].id,'explicit admin association reconciles the file without adding money');
    await creditApi('register_credit',{...creditPayload,amount_clp:8000,reference:`PAID-PROOF-${width}`,expected_remaining_clp:8000,idempotency_key:`paid-proof-credit-${width}`});
    await page.goto(`${uiOrigin}/panel/__reminders?mode=payments&request=fixture-credit&proof=1`);
    await page.getByRole('heading',{name:'Adjuntar comprobante',exact:true}).waitFor();
    check(await page.getByLabel('Monto transferido en CLP').inputValue()==='8000' && await page.getByRole('radiogroup',{name:'Medio de pago'}).count()===0,'a fully paid installment still opens missing-proof upload directly without requesting money');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`proof journey fits ${width}px`);
    await page.close();
  }

  // The production completion flow uses native authorization, captured SMTP and explicit retries.
  const reconciliationLogStart=(await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length;
  const reconciliationSeed=join(box,'reconciliation-seed.php');
  await writeFile(reconciliationSeed,`<?php require __DIR__.'/payment_reconciliation.php';$db=getDbConnection();$columns=$db->query('PRAGMA table_info(orders)')->fetchAll(PDO::FETCH_COLUMN,1);foreach(['usa_token'=>'TEXT','usa_link_id'=>'INT'] as $name=>$type)if(!in_array($name,$columns,true))$db->exec('ALTER TABLE orders ADD COLUMN '.$name.' '.$type);impReconciliationSchema($db);$db->exec('DELETE FROM payment_reconciliation_notices');$r=['id'=>'fixture-credit','title'=>'Pago 2 de prueba','user_email'=>'client@example.test','status'=>'paid','amount_clp'=>26891827,'metadata'=>['order_id'=>'IMP-DEMO','custom_fields'=>['pago'=>2,'link_id'=>11]],'payment_credits'=>[['id'=>'settled-fixture','status'=>'confirmed','bank'=>'global66','amount_clp'=>26891827,'received_on'=>'2026-10-20']]];file_put_contents(__DIR__.'/payment_requests.json',json_encode(['requests'=>[$r]]));`);
  execFileSync(php,[reconciliationSeed]);
  check((await creditApi('reconciliation_notice',{},'client@example.test','user')).code===403,'customer cannot send reconciliation confirmations');
  check((await creditApi('reconciliation_notice',{},'operator@example.test','agent')).code===403,'coordinator cannot access financial completion controls');
  check((await creditApi('reconciliation_notice',{},'support@example.test','support')).code===403,'support cannot send owner-only reconciliation notices');
  const getNotice=async(email='owner@example.test',role='admin')=>{const r=await fetch(`${origin}/payment_requests_api.php?action=reconciliation_notice&request_id=fixture-credit`,{headers:{Authorization:`Bearer ${jwt(email,role)}`}});return {code:r.status,...await r.json()};};
  check((await getNotice('support@example.test','support')).can_send===false,'support can inspect delivery state without getting a send control');
  for(const width of [390,768,1440]) {
    execFileSync(php,[reconciliationSeed]);
    const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(token=>localStorage.setItem('token',token),jwt('owner@example.test','admin'));
    await page.route('**/api/payment_requests_api.php?**',async route=>{const u=new URL(route.request().url());const response=await fetch(`${origin}/payment_requests_api.php${u.search}`,{method:route.request().method(),headers:route.request().headers(),body:route.request().method()==='POST'?route.request().postData():undefined});return route.fulfill({status:response.status,json:await response.json()});});
    await page.goto(`${uiOrigin}/panel/__reminders?mode=credits`);
    const notice=page.getByRole('region',{name:'Avisos de cuadre de esta cuota'});
    await notice.getByRole('button',{name:'Enviar cuadre',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'¿Enviar el cuadre de esta cuota?',exact:true}).waitFor();
    check((await getNotice()).deliveries.length===0,'opening the completion confirmation never sends an email');
    await dialog.getByRole('button',{name:'Enviar cuadre',exact:true}).click();
    await notice.getByText('Coordinador: Enviado',{exact:true}).waitFor();
    check((await getNotice()).deliveries.every(d=>d.status==='sent') && await notice.getByRole('button',{name:'Enviar cuadre',exact:true}).count()===0,'confirmed completion exposes all audience delivery states and removes duplicate send');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`completion controls fit ${width}px`);
    await page.close();
  }
  const reconciliationSent=(await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line)).slice(reconciliationLogStart).filter(m=>m.subject.includes('Cuadre listo')||m.subject.includes('Client installment completed'));
  check(reconciliationSent.filter(m=>m.to==='client@example.test').length===3,'each fictional paid-request reset sends exactly one customer confirmation');
  const beforeRetry=reconciliationSent.length;
  check((await creditApi('reconciliation_notice',{})).deliveries.every(d=>d.status==='sent'),'replaying the owner API preserves sent deliveries');
  const afterReplay=(await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length;
  await creditApi('reconciliation_notice',{});
  check((await readFile(join(box,'captured.jsonl'),'utf8')).trim().split('\n').length===afterReplay && beforeRetry===9,'repeated completion API calls cannot duplicate SMTP delivery');
  await writeFile(join(box,'reconciled-preview.php'),`<?php require __DIR__.'/payment_reconciliation.php';$c=impReconciliationContext('fixture-credit');$mail=($_GET['audience'] ?? '')==='coordinator'?impReconciliationCoordinatorEmail(['order_number'=>'IMP-DEMO','portal'=>'https://www.imporlan.cl/api/operador_usa.php?r=portal&k=FIXTURE','purchase_hold'=>true]):impReconciliationFinancialEmail($c,'client');echo str_replace('cid:imporlan-signature-jp','/email-assets/firma-jp.jpg',$mail['html']);`);
  for(const width of [390,768,1440])for(const audience of ['client','coordinator']) {
    const page=await browser.newPage({viewport:{width,height:1050}});await page.goto(`${origin}/reconciled-preview.php?audience=${audience}`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${audience} completion email fits ${width}px`);
    const body=await page.locator('body').innerText();
    check(audience==='client'?body.includes('$26.891.827')&&body.includes('saldo de esta cuota: $0'):!/(CLP|USD|26\.891\.827|client@example.test|Cliente Ejemplo)/.test(body),'completion email follows the audience financial privacy rules');
    await page.close();
  }
  check(errors.length===0,`admin controls render without runtime errors: ${errors.join('; ')}`);
  console.log(`${passed} reminder API, email and UI checks passed`);
} finally {await browser?.close();await vite?.close();phpServer?.kill();await rm(box,{recursive:true,force:true});}
