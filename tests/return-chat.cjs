const adoptRoom=require('./adopt.cjs');
// Run against the local room with the same Playwright settings as browser.cjs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXE});
  try {
    const page=await browser.newPage();
    const url='http://127.0.0.1:4317', topic='给画里的小船涂成蓝色会不会更好看？';
    await page.goto(url);await adoptRoom(page);
    await page.evaluate(topic=>{
      const k='orange.room.v1', s=JSON.parse(localStorage.getItem(k)), time=Date.now()-2000;
      Object.assign(s.profile,{proactive:true,start:'00:00',end:'00:00'});
      s.livedUntil=time;
      s.memories=[
        {type:'chat',id:'old',text:'我明天要参加考试。',time:time-86400000,state:'confirmed'},
        {type:'play',id:'toy',text:'玩线团',time,state:'confirmed'}
      ];
      s.transcript=[{role:'user',content:topic,time},{role:'assistant',content:'蓝色像水面的倒影。',time}];
      localStorage.setItem(k,JSON.stringify(s));
    },topic);
    await page.reload();
    const welcomes=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orange.room.v1')).transcript.filter(r=>r.welcome));
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orange.room.v1')).transcript.at(-1)?.welcome);
    assert.match((await welcomes()).at(-1).content,/小船/);
    assert(!(await welcomes()).at(-1).content.includes(topic));
    await page.reload();await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
    assert.equal((await welcomes()).length,1);
    await page.evaluate(()=>{
      const k='orange.room.v1',s=JSON.parse(localStorage.getItem(k));
      s.memories=s.memories.filter(m=>m.type==='play');
      s.transcript[s.transcript.length-1]={role:'assistant',welcome:true,refs:['toy'],time:Date.now(),content:'上次和你一起玩得很开心。今天想玩点什么？'};
      localStorage.setItem(k,JSON.stringify(s));
    });
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#history p:last-child')?.textContent.includes('小船'));
    assert.equal((await welcomes()).length,2);
    let generated='水面的倒影已经有蓝色了，小船要不要试一笔暖黄？';
    let requests=0;
    await page.route('**/chat',async route=>{
      const {messages}=route.request().postDataJSON();
      assert(messages.some(m=>m.role==='user' && m.content===topic));
      assert(messages.some(m=>m.role==='assistant' && m.content==='蓝色像水面的倒影。'));
      requests++;
      await route.fulfill({json:{reply:generated}});
    });
    async function reopen(){
      await page.evaluate(()=>{
        localStorage.setItem('orange.model.v1',JSON.stringify({key:'test',model:'test',base:'http://localhost'}));
        const k='orange.room.v1',s=JSON.parse(localStorage.getItem(k));
        s.transcript=s.transcript.filter(row=>!row.welcome);
        localStorage.setItem(k,JSON.stringify(s));
      });
      await page.reload();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orange.room.v1')).transcript.at(-1)?.welcome);
      return (await welcomes()).at(-1).content;
    }
    assert.equal(await reopen(),generated);
    generated='上次你问：“'+topic+'” 后来呢？';
    assert.doesNotMatch(await reopen(),/后来呢|上次你问/);
    assert.equal(requests,2);
    console.log('PASS: ordinary conversation takes priority over older plans and play; reload does not repeat it');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
