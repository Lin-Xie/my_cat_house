const adoptRoom=require('./adopt.cjs');
// Local acceptance test. Use the Playwright environment from tests/browser.cjs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXE});
  try{
    const page=await browser.newPage({timezoneId:'Asia/Shanghai'});
    await page.clock.install({time:new Date('2026-11-03T14:00:00+08:00')});
    await page.goto('http://127.0.0.1:4317');await adoptRoom(page,{profile:true});
    await page.check('#proactive');
    await page.fill('#quietStart','00:00');await page.fill('#quietEnd','00:00');
    await page.click('#profile form button:last-child');
    await page.evaluate(()=>localStorage.setItem('orange.model.v1',JSON.stringify({key:'fixture',model:'fixture',base:'http://localhost'})));
    let request;
    await page.route('**/chat',async route=>{
      request=route.request().postDataJSON();
      await route.fulfill({json:{reply:'我在听。'}});
    });
    await page.reload();
    const db=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')));
    async function send(text){
      await page.fill('#message',text);await page.press('#message','Enter');
      await page.waitForFunction(()=>!document.querySelector('#message').value);
    }
    async function returnToRoom(){
      await page.reload();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orange.room.v1')).transcript.at(-1)?.welcome);
      return (await db()).transcript.at(-1).content;
    }
    await send('我明天要参加辩论比赛。');
    const original=(await db()).memories.find(m=>m.type==='chat');
    await send('比赛改到下周五了。');
    await send('窗外那棵树真漂亮。');
    assert.match(await returnToRoom(),/11月13日/);
    await send('其实是室友参赛，不是我。');
    for(let i=0;i<4;i++)await send('今天看了第'+(i+1)+'集动画。');
    const greeting=await returnToRoom();
    assert.match(greeting,/室友/);assert.match(greeting,/11月13日/);
    await send('你还记得辩论比赛是谁参加、哪天办吗？');
    assert(request.companion.memories.some(m=>m.text.includes('室友') && m.text.includes('11月13日')));
    await send('辩论比赛取消了。');
    await send('这本漫画很好看。');
    assert.match(await returnToRoom(),/辩论比赛取消了/);
    const saved=await db();
    assert.equal(saved.memories.find(m=>m.id===original.id).race.status,'cancelled');
    assert.equal(saved.memories.filter(m=>m.type==='chat' && /辩论比赛/.test(m.text)).length,1);
    await page.reload();
    await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
    assert.equal((await db()).transcript.length,saved.transcript.length);
    console.log('PASS: reschedule, owner correction, recall after context rolls off, cancellation and reload');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
