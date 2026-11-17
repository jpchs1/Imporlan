/* Timing regressions and gallery loading/accessibility states. Read-only preview only. */
const {chromium}=require(process.env.IMPorlan_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:8790/',{waitUntil:'domcontentloaded'});
  await page.locator('.pc-boat-wrapper').waitFor({state:'attached'});
  await page.locator('#algunas-lanchas-importadas').waitFor();
  const normal=await page.evaluate(()=>{
   const boat=document.querySelector('.pc-boat-wrapper'),cue=document.querySelector('#inicio .animate-bounce');
   return {boat:getComputedStyle(boat).animationDuration,cue:getComputedStyle(cue).animationDuration,
    timing:boat.getAnimations()[0].effect.getTiming().duration};
  });
  assert.deepEqual(normal,{boat:'18s',cue:'3s',timing:18000});
  const start=await page.locator('.pc-boat-wrapper').evaluate(el=>el.getAnimations()[0].currentTime);
  await page.waitForTimeout(600);
  const elapsed=await page.locator('.pc-boat-wrapper').evaluate(el=>el.getAnimations()[0].currentTime);
  assert.ok(elapsed-start>300&&elapsed-start<1600,'The boat must advance at normal playback speed');
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>['#inicio .animate-bounce','.pc-boat-wrapper','.pc-step-circle-ring'].map(selector=>{
   const el=document.querySelector(selector),s=getComputedStyle(el);
   return {selector,name:s.animationName,iterations:s.animationIterationCount};
  }));
  assert.ok(reduced.every(x=>x.name==='none'||!x.iterations.split(',').some(i=>i.trim()==='infinite')),
            'Reduced motion must never create 0.01ms infinite loops');
  assert.equal(await page.locator('.pc-boat-track').evaluate(el=>getComputedStyle(el).display),'none');
  const section=page.locator('#algunas-lanchas-importadas');
  assert.match(await section.locator('[data-ir-index="0"]').innerText(),/Alberto Lathrop/);
  await page.waitForFunction(()=>document.querySelector('.ir-photo').getAttribute('aria-busy')==='false');
  await section.locator('.ir-photo').click();
  await page.keyboard.press('Escape');
  assert.equal(await section.locator('.ir-photo').evaluate(el=>el===document.activeElement),true);
  await page.route('**/beneteau-oceanis-281.jpg',route=>route.abort());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.ir-photo.ir-load-error').waitFor();
  assert.equal(await page.locator('.ir-photo').isDisabled(),true);
  await page.locator('.ir-next').click();
  await page.waitForFunction(()=>document.querySelector('.ir-photo').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('.ir-photo').isEnabled(),true);
  console.log('MOTION_UX_PASS '+JSON.stringify({normal,reduced,checks:['real-playback','finite-reduced-motion','client-thumbnails','modal-focus','image-error-recovery']}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
