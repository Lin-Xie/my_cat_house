const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXE});
  try{
    const page=await browser.newPage({reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const db=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')));
    await page.goto('http://127.0.0.1:4317');
    await page.reload();await page.waitForSelector('#adoption[open]');
    await page.fill('#adoptName','   ');await page.click('#adoptForm button[value=learn]');
    assert((await db()).adoptionPending);
    await page.fill('#adoptName','桂花');await page.click('#adoptForm button[value=learn]');
    await page.waitForSelector('#guide');assert.match(await page.title(),/桂花/);
    const atStep=(page,step)=>page.waitForFunction(value=>document.querySelector('#guideIndex').selectedOptions[0].label===value,step);
    assert(await page.locator('#tryGuide').isHidden());
    await page.waitForSelector('#guideShade:not([hidden])');
    await page.click('#cat');assert.equal((await db()).pets,1);await atStep(page,'陪它吃饭');
    await page.click('#bowl');await atStep(page,'挥动羽毛棒');
    assert((await db()).memories.some(m=>m.type==='feed'));
    await page.click('#prevGuide');
    await page.click('#pauseGuide');await page.reload();
    assert(await page.locator('#adoption').isHidden());assert(await page.locator('#guide').isHidden());
    await page.click('#openGuide');assert.equal(await page.inputValue('#guideIndex'),'1');
    const initialTranscript=(await db()).transcript;
    await page.selectOption('#guideIndex',{label:'翻玩具篮'});await page.click('#basket');
    await page.click('[data-item=brush]');await atStep(page,'小屋里的一天');
    await page.click('#nest');await atStep(page,'称重与成长');await page.click('#scale');await atStep(page,'了解你的伙伴');
    await page.click('#openProfile');await page.keyboard.press('Escape');await atStep(page,'一起种盆栽');
    await page.click('#plantPot');await page.fill('#plantName','小满');await page.click('#sow button[type=submit]');
    await page.click('#garden .close');await atStep(page,'看植物长大');
    await page.selectOption('#guideIndex',{label:'收到玩耍邀请'});
    await page.click('#tryGuide');await page.click('#tryGuide');await atStep(page,'连接聊天模型');
    assert(!(await page.textContent('#guideText')).includes('DeepSeek'));
    await page.selectOption('#guideIndex',{label:'翻日记，看足迹'});
    for(const id of ['book','memoryFrame'])assert(await page.locator('#'+id+'.guideTarget').count());
    await page.click('#memoryFrame');await page.keyboard.press('Escape');await atStep(page,'翻日记，看足迹');
    await page.click('#book');await page.keyboard.press('Escape');await atStep(page,'管理小屋数据');
    assert.deepEqual((await db()).transcript,initialTranscript);
    await page.click('#nextGuide');await page.reload();
    assert(await page.locator('#guide').isHidden());
    await page.click('#openGuide');assert.equal(await page.inputValue('#guideIndex'),'0');
    // Old rooms predate both fields. Keep their original cat and offer the guide on demand.
    await page.evaluate(()=>{
      const k='orange.room.v1',r=JSON.parse(localStorage.getItem(k));
      delete r.tour;delete r.adoptionPending;localStorage.setItem(k,JSON.stringify(r));
    });
    await page.reload();assert(await page.locator('#adoption').isHidden());
    assert.equal((await db()).profile.name,'桂花');assert(await page.locator('#guide').isHidden());
    assert.deepEqual(errors,[]);console.log('PASS: adoption, practice, examples, pause, resume, replay and existing rooms');
    const skipped=await browser.newPage({reducedMotion:'reduce'});
    await skipped.goto('http://127.0.0.1:4317');
    await skipped.click('#adoptForm button[value=skip]');await skipped.reload();
    assert(await skipped.locator('#adoption').isHidden());
    assert(await skipped.locator('#guide').isHidden());
    await skipped.click('#openGuide');assert.equal(await skipped.inputValue('#guideIndex'),'0');
    await skipped.selectOption('#guideIndex',{label:'挥动羽毛棒'});
    assert.match(await skipped.textContent('#guideText'),/按住.*拖动.*跟着追/);
    await skipped.locator('#wand').scrollIntoViewIfNeeded();
    const wand=await skipped.locator('#wand').boundingBox(),x=wand.x+wand.width/2,y=wand.y+wand.height/2;
    await skipped.mouse.move(x,y);await skipped.mouse.down();await skipped.mouse.move(x-60,y-20,{steps:6});
    assert.equal(await skipped.locator('#cat').getAttribute('data-pose'),'walk');
    await skipped.mouse.up();assert.equal(await skipped.locator('#cat').getAttribute('data-place'),'play-wand');
    await atStep(skipped,'追光点');
    await skipped.click('#light.guideTarget');await atStep(skipped,'滚球线团');
    await skipped.click('#yarn.guideTarget');await atStep(skipped,'翻玩具篮');
    const toys=await skipped.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')).toys);
    assert.equal(toys.light,1);assert.equal(toys.yarn,1);
    await skipped.evaluate(()=>{
      const key='orange.room.v1',room=JSON.parse(localStorage.getItem(key));
      room.tour={step:3,active:false};localStorage.setItem(key,JSON.stringify(room));
    });
    await skipped.reload();await skipped.click('#openGuide');await atStep(skipped,'翻玩具篮');
    console.log('PASS: wand, light and yarn practice; paused legacy lesson resumes at basket');
    await skipped.selectOption('#guideIndex',{label:'一起种盆栽'});
    await skipped.getByRole('button',{name:'演示生长过程 →'}).click();
    for(let stage=0;stage<4;stage++){
      if(stage)await skipped.click('#tryGuide');
      assert.equal(await skipped.locator('#plantPot').getAttribute('data-stage'),String(stage));
    }
    const shapes=new Set();
    for(const kind of await skipped.locator('#guideKind option').allTextContents()){
      await skipped.selectOption('#guideKind',kind);
      assert(await skipped.locator('#plantPot .mature').isVisible());
      shapes.add(await skipped.locator('#plantCrown').getAttribute('d'));
    }
    assert.equal(shapes.size,12);
    assert.equal(await skipped.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')).plant),undefined);
    await skipped.selectOption('#guideIndex',{label:'跟猫咪找线索'});
    assert.equal(await skipped.locator('#plantPot').getAttribute('data-kind'),'');
    if(await skipped.locator('#oddity').isVisible()){
      assert(await skipped.locator('#oddity.guideTarget').count());
      await skipped.click('#oddity');await skipped.click('#helpDiscovery');
      await atStep(skipped,'收到玩耍邀请');await skipped.selectOption('#guideIndex',{label:'跟猫咪找线索'});
    }
    await skipped.click('#guideClue.guideTarget');
    assert.match(await skipped.textContent('#guideExample'),/发条鼠/);
    await skipped.selectOption('#guideIndex',{label:'管理小屋数据'});
    for(const id of ['openDiary','settings','book'])assert(await skipped.locator('#'+id+'.guideTarget').count());
    for(const [width,height] of [[1024,600],[1280,720],[1366,768],[1920,1080]]){
      await skipped.setViewportSize({width,height});
      await skipped.selectOption('#guideIndex',{label:'看植物长大'});await skipped.click('#tryGuide');
      for(let i=0;i<2;i++){
        assert(await skipped.evaluate(()=>{
          const scene=document.querySelector('.scene').getBoundingClientRect();
          return document.documentElement.scrollHeight<=innerHeight+1 && scene.height>150 &&
            Math.abs(scene.width/scene.height-256/140)<0.01 && document.querySelector('.care').getBoundingClientRect().bottom<=innerHeight;
        }),width+' × '+height);
        await skipped.click('#toggleChat');
      }
    }
    console.log('PASS: distinct mature plants, shelf preview, clue fallback, multiple highlights and single-screen tutorial');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
