const adoptRoom=require('./adopt.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXE});
  try{
    const page=await browser.newPage({timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
    const evening=day=>new Date('2026-11-0'+day+'T18:50:00+08:00');
    const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')));
    await page.clock.install({time:evening(1)});
    await page.goto('http://127.0.0.1:4317');
    await adoptRoom(page);
    await page.click('#scale');assert.match(await page.textContent('#feedback'),/第一次上秤/);
    const first=(await state()).weighIn;
    for(const day of [1,2,3]){
      await page.clock.setSystemTime(evening(day));
      await page.click('#basket');await page.click('[data-item="butterfly"]:is(button):not(#basketItem)');
    }
    await page.clock.setSystemTime(evening(4));
    // Arrange a rested, fed cat to isolate the invitation from the independent nap schedule.
    await page.evaluate(()=>{
      const key='orange.room.v1',r=JSON.parse(localStorage.getItem(key));
      r.lastMeal=r.restedAt=r.livedUntil=Date.now();r.sleepUntil=0;
      localStorage.setItem(key,JSON.stringify(r));
    });
    await page.reload();
    await page.waitForSelector('#basketItem[data-invited]');
    assert.match(await page.textContent('#feedback'),/弹簧蝴蝶/);
    assert.equal((await state()).toys.butterfly,3);
    await page.click('#basketItem');assert.equal((await state()).toys.butterfly,4);
    await page.reload();assert.equal(await page.locator('[data-invited]').count(),0);
    await page.click('#scale');
    const last=(await state()).weighIn;
    assert.match(await page.textContent('#feedback'),new RegExp('比上次重了 '+(last.kg-first.kg).toFixed(1)));
    // While the cat stands on the platform, the wooden front edge remains clickable.
    const scale=await page.locator('#scale').boundingBox();
    await page.click('#scale',{position:{x:scale.width/2,y:scale.height-4}});
    assert.match(await page.textContent('#feedback'),/和上次一样重/);
    assert.equal(await page.textContent('#scaleDial'),last.kg.toFixed(1)+' kg');
    await page.click('#cat');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.click('#bowl');
    const before=(await state()).weighIn;
    await page.click('#scale');
    await page.click('#yarn');
    await page.clock.runFor(2500);
    assert.deepEqual((await state()).weighIn,before);
    await page.click('#scale');await page.clock.runFor(2600);
    await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('一样重'));
    assert.equal(await page.locator('#cat').getAttribute('data-place'),'scale');
    console.log('PASS: learned basket invitation, acceptance and refresh, scale arrival, previous weigh-in and interrupted walk');
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
