const adoptRoom=require('./adopt.cjs');
// Optional real-browser acceptance run; see README for the Playwright setup.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
(async()=>{
 const calls=[],errors=[];
 const model=http.createServer(async(req,res)=>{
   let body='';for await(const chunk of req)body+=chunk;
   const payload=JSON.parse(body);calls.push(payload);
   res.setHeader('Content-Type','application/json');
   let content=payload.messages[0].content.includes('candidates')?'[0]':'喵，我听着。';
   if(payload.messages.at(-1).content.includes('来访者刚回到小屋')){
     const context=payload.messages[0].content;
     if(context.includes('辩论比赛') && payload.messages.some(m=>m.content==='我有些紧张。') && context.includes('"daysUntilEvent":1'))content='要不要把我当观众，先试试辩论比赛的开场？';
     if(context.includes('辩论比赛') && context.includes('"daysUntilEvent":0'))content='辩论比赛那边，有哪一刻特别想讲给我听？';
   }
   res.end(JSON.stringify({choices:[{message:{content}}]}));
 });
 await new Promise(ok=>model.listen(0,'127.0.0.1',ok));
 let browser;
 try{
   browser=await chromium.launch({executablePath:process.env.BROWSER_EXE});
   const page=await browser.newPage({reducedMotion:'reduce',viewport:{width:1280,height:800}});
   // Start at midday so yesterday's half-hour replay has at least one diary scene.
   await page.clock.install({time:new Date(2026,10,3,12)});
   page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(String(e)));
   const click=s=>page.locator(s).click(), fill=(s,v)=>page.locator(s).fill(v);
   const db=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')));
   const send=async text=>{await fill('#message',text);await click('#send');await page.waitForFunction(()=>!document.getElementById('message').value);};
   await page.goto('http://127.0.0.1:4317');await adoptRoom(page,{profile:true});await fill('#catName','栗子');await page.check('#proactive');await page.check('#semantic');await fill('#quietStart','00:00');await fill('#quietEnd','00:00');await click('#profile form button:last-child');
   await click('#cat');await click('#bowl');await click('#light');await click('#yarn');await click('#wand');
   assert.equal(calls.length,0);assert.equal((await db()).toys.light,1);assert((await db()).memories.some(m=>m.type==='feed'&&m.state==='confirmed'));
   await page.reload();await page.waitForFunction(()=>document.getElementById('cat').dataset.pose==='play');
   const cat=page.locator('#cat');let pos=await cat.boundingBox();
   await page.mouse.move(pos.x+pos.width/2,pos.y+pos.height/2);await page.mouse.down();
   await page.waitForTimeout(2450);await page.mouse.up();
   assert.equal(await cat.getAttribute('data-pose'),'startled');
   assert((await db()).memories.some(m=>m.type==='pet' && /挪开|坐到旁边/.test(m.text)));
   const before=(await db()).pets;await page.evaluate(()=>{for(let n=0;n<10;n++)document.querySelector('#cat').click()});
   assert.equal((await db()).pets,before);
   const wand=await page.locator('#wand').boundingBox();
   await page.mouse.move(wand.x+wand.width/2,wand.y+wand.height/2);await page.mouse.down();await page.mouse.move(wand.x+65,wand.y-45,{steps:8});
   assert.equal(await cat.getAttribute('data-pose'),'walk');await page.mouse.up();
   await send('我打算自杀');await send('不安全');assert((await page.textContent('#history')).includes('我现在不安全'));assert(!(await db()).memories.some(m=>m.type==='chat'));
   await click('#settings');await fill('#base','http://127.0.0.1:'+model.address().port);await fill('#model','test');await fill('#key','local-only-test');await page.check('#remember');await click('#testConnection');await page.waitForFunction(()=>document.getElementById('cfgStatus').textContent.includes('成功'));await click('#config form .actions button:last-child');
   const composer=page.locator('#message'), requestsBefore=calls.length;
   await composer.fill('你喜欢书吗？');
   await composer.evaluate(el=>{
     el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
     el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}));
     el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
   });
   await composer.press('End');await composer.press('Shift+Enter');await composer.press('X');
   assert.equal(await composer.inputValue(),'你喜欢书吗？\nX');assert.equal(calls.length,requestsBefore);
   await composer.press('Enter');await page.waitForFunction(()=>!document.querySelector('#message').value);
   assert.equal(calls.length,requestsBefore+1);
assert(!(await db()).memories.some(m=>m.type==='chat'));
   await send('我明天要参加辩论比赛。');await send('我有些紧张。');assert(calls.at(-1).messages[0].content.includes('"conversation":"倾听"'));assert((await db()).memories.some(m=>m.text.includes('辩论比赛')&&m.state==='confirmed'));
   assert.equal(await page.locator('#openAlbum, #album, #autoMemory').count(),0);
   await page.evaluate(()=>{const k='orange.room.v1',s=JSON.parse(localStorage.getItem(k));s.profile.auto=false;s.memories.find(m=>m.text.includes('辩论比赛')).state='pending';localStorage.setItem(k,JSON.stringify(s));});

   await page.reload();await page.waitForFunction(()=>document.querySelector('#history p:last-child')?.textContent.includes('把我当观众'));
   assert((await page.textContent('#history')).includes('我有些紧张。'));assert.equal(await page.locator('header, #preferences').count(),0);
   await send('辩论比赛要发挥好真不容易');assert(calls.at(-1).messages.slice(1,-1).some(m=>m.content==='我有些紧张。'));assert(calls.some(c=>c.messages[0].content.includes('candidates')));assert(calls.at(-1).messages[0].content.includes('辩论比赛'));
   await page.evaluate(()=>{const k='orange.room.v1',s=JSON.parse(localStorage.getItem(k));s.profile.since-=86400000;s.livedUntil-=86400000;s.scene.time=s.livedUntil;s.memories.find(m=>m.type==='chat'&&m.state==='confirmed').time=s.livedUntil-1;localStorage.setItem(k,JSON.stringify(s))});
   const replay=page.waitForResponse(r=>r.url().endsWith('/life/replay'));await page.reload();assert.equal((await replay).status(),200);await page.waitForFunction(()=>document.querySelector('#history p:last-child')?.textContent.includes('有哪一刻特别想讲给我听'));
   assert(Object.values((await db()).diaryCounts).every(n=>n<=3));
   await click('#openMoments');assert((await page.textContent('#timeline')).includes('第一次坐下来聊天'));assert.equal(await page.locator('#timeline li').filter({hasText:'第一次一起玩'}).count(),1);await page.keyboard.press('Escape');
   await click('#book');assert.equal(await page.textContent('#diaryTitle'),'栗子的日记');await click('#older');
   const diaryText=await page.textContent('#pageBody');
   assert((await db()).memories.some(m=>m.text===diaryText && !['letter','chat','feed','pet','play'].includes(m.type)));await click('#newer');await click('#diary .close');
   await click('#openDiary');await click('#openRecords');await page.locator('#entries li').filter({hasText:'我明天要参加辩论比赛。'}).filter({has:page.getByText('我明天要参加辩论比赛。',{exact:true})}).getByRole('button',{name:'忘记'}).click();await click('#records .close');await click('#diary .close');assert(!(await db()).memories.some(m=>m.text.includes('辩论比赛')));assert(Object.keys((await db()).deleted).length>=2);
   await click('#settings');assert(!await page.locator('#clearData').isVisible());await click('.dataTools summary');const file=page.waitForEvent('download');await click('#exportData');const exportData=JSON.parse(require('node:fs').readFileSync(await (await file).path(),'utf8'));assert(!JSON.stringify(exportData).includes('local-only-test'));await click('#config .close');
   await page.setViewportSize({width:375,height:740});await click('#drawerGrip');assert(!(await page.locator('#chat').isVisible()));await click('#drawerGrip');assert(await page.locator('#chat').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   const playRoom=await browser.newPage({reducedMotion:'reduce'});
   await playRoom.clock.install({time:new Date(2026,9,11,12).getTime()});
   await playRoom.goto('http://127.0.0.1:4317');await adoptRoom(playRoom);await playRoom.click('#bowl');
   async function chooseToy(id){
     await playRoom.click('#basket');
     await playRoom.click('.toyTray [data-item="'+id+'"]');
   }
   for(const item of ['mouse','butterfly','scratch','mouse'])await chooseToy(item);
   assert.equal(await playRoom.locator('#cat').getAttribute('data-place'),'toy','第四次选择仍应追玩具');
   await playRoom.clock.fastForward(41000);
   assert.equal(await playRoom.locator('#cat').getAttribute('data-place'),'bed','停止互动后才自主回窝');
   await chooseToy('scratch');
   assert.equal(await playRoom.locator('#cat').getAttribute('data-pose'),'knead','回窝后可以再次被邀请');
   const played=await playRoom.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')));
   assert.equal(played.toys.mouse,2);assert.equal(played.playCount,1);assert.equal(played.sleepUntil,0);
   await playRoom.click('#openProfile');
   assert.equal(await playRoom.textContent('#profileMood'),'放松');
   const bond=await playRoom.textContent('#bondScore');
   assert.equal(bond,'4 / 100');assert.equal(await playRoom.textContent('#weightChange'),'初次称重');
   await playRoom.keyboard.press('Escape');await playRoom.reload();
   await playRoom.click('#openProfile');assert.equal(await playRoom.textContent('#bondScore'),bond);
   await playRoom.clock.setSystemTime(new Date(2026,9,12,12));
   await playRoom.reload();await playRoom.click('#openProfile');
   assert.match(await playRoom.textContent('#weightChange'),/比昨天重/);
   assert.equal(await playRoom.textContent('#bondScore'),bond);
   await playRoom.close();
   const abroad=await browser.newPage({timezoneId:'America/Los_Angeles'});
   await abroad.clock.install({time:new Date('2026-11-03T10:59:55Z')});await abroad.goto('http://127.0.0.1:4317');
   const sky=abroad.locator('.scene>img');
   assert.equal(await sky.getAttribute('data-phase'),'dusk');
   await abroad.clock.fastForward(16000);assert.equal(await sky.getAttribute('data-phase'),'night');
   await abroad.close();
   console.log('PASS: local gestures, refresh, safety, automatic memory and legacy migration, model proxy/rank, overnight recall, diary cap, deletion and mobile drawer');
 }finally{if(browser)await browser.close();model.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

