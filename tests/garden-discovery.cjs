const adoptRoom=require('./adopt.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXE});
  try{
    for(const [kind,mature] of [['向日葵','开花'],['猫草','草尖'],['草莓','草莓红'],['小米','谷穗变金黄']]){
      const page=await browser.newPage({timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
      const base=Date.parse('2026-11-03T14:00:00+08:00'), day=86400000;
      await page.clock.install({time:new Date(base)});
      await page.goto('http://127.0.0.1:4317');await adoptRoom(page,{profile:true});
      await page.check('#proactive');await page.click('#profile form button:last-child');
      await page.click('#plantPot');await page.selectOption('#seedKind',kind);
      assert.equal(await page.locator('#seedKind option').count(),12);
      await page.fill('#plantName','小满');await page.click('#sow button[type=submit]');
      assert.match(await page.textContent('#plantInfo'),/第 1 天 · 嫩芽冒头/);
      assert.equal(await page.textContent('#growthPercent'),'14%');
      await page.click('#waterPlant');assert(await page.locator('#waterPlant').isDisabled());
      await page.click('#garden .close');
      assert(await page.locator('#plantPot .bud').isVisible());
      const db=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')));
      for(const [age,stage] of [[1,'1'],[3,'2'],[8,'3']]){
        await page.clock.setSystemTime(new Date(base+age*day));
        await page.reload();await page.waitForSelector('#oddity');
        assert.equal(await page.locator('#plantPot').getAttribute('data-stage'),stage);
        await page.click('#plantPot');assert.equal(await page.textContent('#gardenTitle'),'小满');
        const state=await db();
        const percent=await page.locator('#plantProgress').evaluate(bar=>bar.value);
        assert(stage==='3'?percent===100:percent>14 && percent<100);
        assert.equal(await page.locator('#waterPlant').isDisabled(),state.plant.lastWater===state.plant.sown+age);
        const news=state.transcript.filter(t=>t.welcome && t.content.includes('「小满」'));
        assert.equal(news.length,age===1?1:age===3?2:3);
        assert(news.at(-1).content.includes(age===1?'子叶':age===3?'新叶':mature));
        await page.click('#garden .close');
        await page.click('#oddity');const title=await page.textContent('#discoveryTitle');
        await page.click('#discovery .close');await page.click('#oddity');
        await page.click(age===1?'#helpDiscovery':'#watchDiscovery');
        assert(await page.locator('#oddity').isHidden());
        assert((await db()).memories.some(m=>m.type==='discovery' && m.diaryTitle===title));
        await page.reload();assert(await page.locator('#oddity').isHidden());
        assert.equal((await db()).transcript.filter(t=>t.welcome && t.content.includes('「小满」')).length,news.length);
      }
      const state=await db();assert.equal(state.plant.kind,kind);assert(state.plant.waterDays>1);
      assert(state.plant.lastCareAt);assert(state.memories.some(m=>m.type==='plant' && m.text.includes('滴水瓶')));
      assert(state.memories.some(m=>m.type==='plant' && m.text.includes('新叶')));
      await page.click('#openMoments');assert.match(await page.textContent('#timeline'),/一起种下小满/);
      await page.click('#moments .close');await page.click('#plantPot');await page.click('#replant');
      await page.click('#cancelSow');assert.equal((await db()).plant.kind,kind);
      await page.click('#replant');await page.selectOption('#seedKind','紫苏');await page.fill('#plantName','阿紫');await page.click('#sow button[type=submit]');
      assert.equal((await db()).plant.name,'阿紫');assert((await db()).memories.some(m=>m.text.includes('小满')));
      await page.close();
    }
    const page=await browser.newPage({timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
    await page.clock.install({time:new Date('2026-11-03T23:00:00+08:00')});
    await page.goto('http://127.0.0.1:4317');await adoptRoom(page,{profile:true});await page.check('#proactive');await page.click('#profile form button:last-child');
    // Pre-upgrade save: already growing, no care metadata or planting ID.
    await page.evaluate(()=>{
      const key='orange.room.v1',r=JSON.parse(localStorage.getItem(key));
      r.plant={kind:'向日葵',name:'小金',sown:r.adoptedDay-8,waterDays:0,seenStage:0};
      localStorage.setItem(key,JSON.stringify(r));
    });
    await page.reload();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orange.room.v1')).plant.news);
    assert(!(await page.textContent('#history')).includes('开花'));
    await page.clock.setSystemTime(new Date('2026-11-04T10:00:00+08:00'));
    await page.reload();await page.waitForFunction(()=>document.querySelector('#history').textContent.includes('「小金」开花'));
    assert(!(await page.textContent('#history')).includes('发芽'));
    await page.close();
    console.log('PASS: 12 seeds, shelf care, offline milestones, quiet hours, legacy saves, deduplicated greetings, replanting and discoveries');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
