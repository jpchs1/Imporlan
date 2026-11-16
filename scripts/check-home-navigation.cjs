/* Regression checks for the Home/menu defects reported in the screenshot. */
const { chromium } = require(process.env.IMPorlan_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const url='http://127.0.0.1:8790/';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#proceso-compra-enhanced #proceso').waitFor();
  await page.locator('#imp-pro-footer #contacto').waitFor();
  await page.locator('#deckeva-strip').waitFor();
  const desktop=page.locator('#imp-pro-header .imp-h-nav');
  async function active(name) {
   await page.waitForFunction(expected=>{
    const links=[...document.querySelectorAll('#imp-pro-header .is-active > .imp-h-link')];
    return links.length===1&&links[0].textContent.trim()===expected;
   },name);
   assert.equal(await page.locator('#imp-pro-header .imp-h-link[aria-current]').count(),1);
  }
  async function anchorVisible(id) {
   await page.waitForFunction(id=>{
    const el=document.getElementById(id);
    if(!el)return false;
    const r=el.getBoundingClientRect(),header=document.getElementById('imp-pro-header').getBoundingClientRect();
    return getComputedStyle(el).display!=='none'&&r.height>0&&r.top>=header.bottom-2&&r.top<innerHeight;
   },id);
   assert.equal(await page.locator('[id="'+id+'"]').count(),1,'Anchor must be unique: '+id);
  }
  await active('Inicio');
  await desktop.getByRole('link',{name:'Proceso',exact:true}).click();
  await active('Proceso'); await anchorVisible('proceso');
  const backgrounds=await page.locator('.pc-step-circle-inner').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundImage));
  assert.equal(backgrounds.length,5);
  assert.ok(backgrounds.every(x=>x!=='none'),'All five steps need their own background');
  assert.equal(new Set(backgrounds).size,5,'Each step keeps its intended color');
  const layers=await page.evaluate(()=>({
   boat:getComputedStyle(document.querySelector('.pc-boat-track')).zIndex,
   steps:[...document.querySelectorAll('.pc-step')].map(el=>getComputedStyle(el).zIndex),
   circles:[...document.querySelectorAll('.pc-step-circle')].map(el=>getComputedStyle(el).zIndex)
  }));
  console.log('HOME_FIX_LAYERS='+JSON.stringify(layers));
  console.log('HOME_FIX_DESKTOP='+ (await page.screenshot({type:'jpeg',quality:60})).toString('base64'));
  assert.ok(layers.steps.every(z=>Number.isFinite(Number(z))&&Number(z)>Number(layers.boat)),
            'Each step stacking context must stay above the decorative boat: '+JSON.stringify(layers));
  await desktop.getByRole('link',{name:'Contacto',exact:true}).click();
  await active('Contacto'); await anchorVisible('contacto');
  await desktop.getByRole('link',{name:'Inicio',exact:true}).click();
  await active('Inicio'); await anchorVisible('inicio');
  assert.equal(await page.locator('#inicio h1').isVisible(),true);
  const strip=await page.locator('#deckeva-strip').evaluate(el=>({width:el.getBoundingClientRect().width,viewport:innerWidth,background:getComputedStyle(el).backgroundImage}));
  assert.ok(strip.width>=strip.viewport-2,'The banner background must cover the full width');
  assert.match(strip.background,/linear-gradient/,'No transparent white band below the hero');
  await desktop.getByRole('button',{name:'Servicios',exact:true}).click();
  assert.equal(await desktop.getByRole('button',{name:'Servicios',exact:true}).getAttribute('aria-expanded'),'true');
  await desktop.getByRole('link',{name:'Proceso',exact:true}).click();
  await anchorVisible('proceso');

  await page.setViewportSize({width:390,height:844});
  await page.locator('#imp-h-hamb').click();
  await page.locator('#imp-pro-drawer').getByRole('link',{name:'Contacto',exact:true}).click();
  await page.waitForFunction(()=>!document.body.classList.contains('imp-drawer-open'));
  await active('Contacto'); await anchorVisible('contacto');
  await page.locator('#imp-h-hamb').click();
  await page.locator('#imp-pro-drawer').getByRole('link',{name:'Inicio',exact:true}).click();
  await page.waitForFunction(()=>!document.body.classList.contains('imp-drawer-open'));
  await active('Inicio'); await anchorVisible('inicio');
  console.log('HOME_FIX_MOBILE='+ (await page.screenshot({type:'jpeg',quality:60})).toString('base64'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow at 390px');

  // Direct links must resolve even though the enhancers mount after the bundle.
  for(const hash of ['proceso','contacto']){
   await page.goto(url+'#'+hash,{waitUntil:'domcontentloaded'});
   await page.locator('#proceso-compra-enhanced #proceso').waitFor();
   await page.locator('#imp-pro-footer #contacto').waitFor();
   // Native fragment navigation runs when the destination is inserted.
   await anchorVisible(hash);
   await active(hash==='proceso'?'Proceso':'Contacto');
  }
  console.log('HOME_FIX_PASS '+JSON.stringify({checks:['desktop-menu','mobile-menu','single-active-item','unique-visible-anchors','five-step-colors','boat-layer','hero-visible','partner-background','direct-fragments']}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
