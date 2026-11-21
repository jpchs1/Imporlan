/* Integration checks run against a read-only static preview. No forms are submitted. */
const { chromium } = require(process.env.IMPorlan_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.GALLERY_URL || 'http://127.0.0.1:8790/',{waitUntil:'domcontentloaded'});
    const section=page.locator('#algunas-lanchas-importadas');
    await section.waitFor({state:'visible',timeout:30000});
    assert.equal(await section.locator('[data-ir-index]').count(),8);
    assert.match(await section.locator('.ir-owner').innerText(),/Alberto Lathrop/);
    const names=[];
    for(let i=0;i<8;i++){
      await section.locator('[data-ir-index="'+i+'"]').click();
      await page.waitForFunction(()=>{const i=document.querySelector('.ir-photo img');return i.complete&&i.naturalWidth>0;});
      names.push(await section.locator('h3').innerText());
      assert.equal(await section.locator('[data-ir-index][aria-pressed="true"]').count(),1);
      assert.equal(await section.locator('.ir-badge').innerText(),i>=5?'Imagen referencial':'Fotografía real');
      if(i>=5) assert.match(await section.locator('.ir-provenance').innerText(),/otra unidad/);
    }
    await section.locator('.ir-next').click();
    assert.match(await section.locator('.ir-owner').innerText(),/Alberto/);
    await section.locator('.ir-prev').click();
    assert.match(await section.locator('h3').innerText(),/Limited S/);
    await section.locator('.ir-prev').press('Home');
    assert.equal(await section.locator('h3').innerText(),'Beneteau Oceanis 281');
    await section.locator('.ir-prev').press('ArrowRight');
    assert.equal(await section.locator('h3').innerText(),'Yamaha 242 Limited');
    await section.locator('.ir-prev').press('Home');
    await section.locator('.ir-photo').click();
    assert.equal(await page.locator('.ir-dialog').evaluate(el=>el.open),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.ir-dialog').evaluate(el=>el.open),false);
    assert.equal(await section.locator('.ir-text-link').getAttribute('href'),'/cotizador-importacion/');
    assert.match(await section.locator('.ir-more').innerText(),/Ingrid Ibáñez y Marcos Olivares/);

    // Filters must change both the visible rail and sequential navigation.
    await section.locator('[data-ir-filter="real"]').click();
    assert.equal(await section.locator('[data-ir-index]:visible').count(),5);
    await section.locator('.ir-prev').click();
    assert.equal(await section.locator('h3').innerText(),'Donzi');
    await section.locator('.ir-next').click();
    assert.equal(await section.locator('h3').innerText(),'Beneteau Oceanis 281');
    await section.locator('[data-ir-filter="client"]').click();
    assert.equal(await section.locator('[data-ir-index]:visible').count(),4);
    await section.locator('.ir-next').click();
    assert.equal(await section.locator('h3').innerText(),'Sea Ray 185 Sport');
    assert.equal(await section.locator('.ir-badge').innerText(),'Imagen referencial');
    await section.locator('.ir-next').click();
    assert.equal(await section.locator('h3').innerText(),'Rinker 250 Fiesta Vee');
    await section.locator('.ir-next').click();
    assert.equal(await section.locator('h3').innerText(),'Yamaha 242 Limited S');
    await section.locator('.ir-next').click();
    assert.equal(await section.locator('h3').innerText(),'Beneteau Oceanis 281');
    await section.locator('.ir-prev').press('End');
    assert.equal(await section.locator('h3').innerText(),'Yamaha 242 Limited S');
    await section.locator('.ir-prev').press('Home');
    assert.equal(await section.locator('h3').innerText(),'Beneteau Oceanis 281');
    await section.locator('[data-ir-filter="all"]').click();
    assert.equal(await section.locator('[data-ir-index]:visible').count(),8);
    assert.match(await section.locator('.ir-results').innerText(),/8 embarcaciones/);
    await page.waitForFunction(()=>{const i=document.querySelector('.ir-photo img');return i.complete&&i.naturalWidth>0;});

    await section.scrollIntoViewIfNeeded();
    console.log('GALLERY_SCREENSHOT_DESKTOP='+ (await section.screenshot({type:'jpeg',quality:65,animations:'disabled',style:'#imp-pro-header,#imp-uxpro-cta,#imp-uxpro-progress,#imp-backtop{visibility:hidden!important}'})).toString('base64'));
    await page.setViewportSize({width:390,height:844});
    await section.scrollIntoViewIfNeeded();
    assert.equal(await section.locator('.ir-stage').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
    assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Section must not overflow at 390px');
    await section.locator('.ir-photo-next').click();
    assert.equal(await section.locator('h3').innerText(),'Yamaha 242 Limited');
    await section.locator('.ir-photo-prev').click();
    console.log('GALLERY_SCREENSHOT_MOBILE='+ (await section.screenshot({type:'jpeg',quality:65,animations:'disabled',style:'#imp-pro-header,#imp-uxpro-cta,#imp-uxpro-progress,#imp-backtop{visibility:hidden!important}'})).toString('base64'));
    for(const width of [320,768,1024]){
      await page.setViewportSize({width,height:900});
      assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No gallery overflow at '+width);
      const controls=await section.locator('.ir-filters button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
      assert.ok(controls.every(height=>height>=44),'Filter targets remain touch-friendly at '+width);
    }
    const galleryErrors=errors.filter(e=>/importaciones-reales|ir-carousel/.test(e));
    assert.deepEqual(galleryErrors,[]);
    console.log('GALLERY_PASS '+JSON.stringify({boats:names,desktop:1440,mobile:390,checks:['images','provenance','clients','buttons','keyboard','wrap','modal','CTA','responsive','filters','filtered-navigation','touch-targets']}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
