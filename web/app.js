import {dayMs,calendarDay,ageAt,chooseLife,replay,favoriteToy,toyNames,tendPlant,restoreCompany,recordCompany,bodyProfile,notePlayTime,usualPlayToy} from './life.mjs';
import {conversationMode,candidates,eventDay,raceRevision,revisedOpening,petReaction,forgetMemory,moodFor} from './companion.mjs';
const el = id => document.getElementById(id);
const defaultCatName='橘子';
const demo=location.hash==='#return-demo';
const store=demo?sessionStorage:localStorage;
const roomKey=demo?'orange.demo.room':'orange.room.v1';
const configKey=demo?'orange.demo.model':'orange.model.v1';
function read(key) {
  try { return JSON.parse(store.getItem(key)) || {}; } catch { return {}; }
}
let room = read(roomKey);
let config = read(configKey);
const firstDemo=demo && !room.demoDay;
if(firstDemo)room=demoFixture(false);
function demoFixture(returning){
  const time=new Date();
  const at=time.getTime(), text='我明天要参加编程比赛。';
  return {demoDay:returning?2:1,adoptedDay:calendarDay(at),livedUntil:at,lastMeal:at,restedAt:at,lastPlay:0,playCount:0,
    profile:{name:defaultCatName,proactive:true,start:'00:00',end:'00:00',since:at,sound:false},
    transcript:[{role:'user',content:text,time:at-1,refs:['demo-competition']}],
    memories:[{id:'demo-competition',type:'chat',state:'confirmed',text,time:at-1,category:'事件',source:'体验示例'}]};
}

let chatVersion=0, awaitingSafety=false;
function forgetContext(){chatVersion++;}
let mode = '看窗外';
function redactConversation(id){
  forgetContext();
  room.transcript=room.transcript.filter(row=>!row.refs?.includes(id));
  renderTranscript();status('');
}
function removeMemory(id){redactConversation(id);forgetMemory(room,id);}
function isShared(type){return ['chat','pet','play','feed','brush','nest','plant','discovery'].includes(type);}
function diaryRecord(type){return !isShared(type)&&type!=='letter';}
let lastFeedback='', lastQuote='', displayedName;
function status(template, activity=mode, quote='') {
  lastFeedback=template;
  lastQuote=quote;
  mode=activity;
  const name=room.profile.name;
  el('feedback').textContent=template.replaceAll('{cat}',()=>name)+quote;
  el('activity').textContent=name+'在'+activity;
}
function saveRoom() {
  try { store.setItem(roomKey, JSON.stringify(room)); }
  catch { el('feedback').textContent += ' 浏览器无法保存，本次记录仅在当前页面有效。'; }
}
if (!Number.isFinite(room.adoptedDay) || !Array.isArray(room.memories)) {
  room = {adoptionPending:true,adoptedDay:calendarDay(), memories:[], lastMeal:0, lastPlay:0, playCount:0};
  saveRoom();
}
room.profile ??= {name:defaultCatName,proactive:false,sound:false,start:'22:00',end:'07:00'};
room.profile.name ||= defaultCatName;
room.transcript??=[];awaitingSafety=room.transcript.at(-1)?.safetyPending===true;renderTranscript();
room.toys ??= {wand:0,yarn:0};
room.milestones ??= {};
room.seed??=crypto.getRandomValues(new Uint32Array(1))[0];
room.pets??=room.memories.filter(m=>m.type==='pet').length;
room.diaryCounts??={};
function migrateMemories(saved){
  delete saved.profile.auto;
  for(const m of saved.memories){
    if(!m.state || m.state==='pending')m.state='confirmed';
  }
}
migrateMemories(room);
restoreCompany(room);
for(const m of room.memories){
  m.id ||= crypto.randomUUID();
  m.source??=m.type==='chat'?'用户原话':'小屋事件';m.visibility??='本机私有';m.deletionState??='active';
}
function available(m){return m.state==='confirmed' && !room.deleted?.[m.id];}
function quiet(){
  const now=new Date(), hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const {start,end}=room.profile;
  return start<end ? hm>=start && hm<end : start>end && (hm>=start || hm<end);
}
function milestone(key,text,time=Date.now()){
  if(!room.milestones[key]) room.milestones[key]={time,text};
}
function adoptionAnniversary(offset){
  const date=new Date((room.adoptedDay+offset)*dayMs);
  return new Date(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()).getTime();
}
milestone('met','第一次见面',adoptionAnniversary(0));
for(const [type,label] of Object.entries({pet:'第一次蹭你的手',feed:'第一次一起开饭',play:'第一次一起玩 · 窗边挂起了小鱼风铃',chat:'第一次坐下来谈心'})){
  const first=room.memories.find(m=>m.type===type);
  if(first) milestone(type,label,first.time);
}
const beijingClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function updateWindow(){
  const clock=beijingClock.format(Date.now());
  const hour=Number(clock.slice(0,2));
  el('roomTime').textContent='北京时间 '+clock;
  el('roomTime').dateTime=clock;
  const phase=hour<5||hour>=19?'night':hour<8?'dawn':hour<17?'day':'dusk';
  const img=document.querySelector('.scene>img');
  if(img.dataset.phase!==phase){
    img.src='/room.svg#'+phase;img.dataset.phase=phase;
    img.alt=({dawn:'晨光照亮了窗外的山丘',day:'窗外是蓝天和绿丘',dusk:'晚霞染红山丘，远处亮起灯火',night:'月亮和星星挂在山丘上方'})[phase]+'，屋里亮着一盏暖灯。';
  }
}
updateWindow();
setInterval(()=>{if(!document.hidden)updateWindow();},1000*15);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateWindow();});
function growth() {
  const {stage,days}=ageAt(room,Date.now());
  if(displayedName!==room.profile.name){
    displayedName=room.profile.name;
    document.title='我的橘猫小屋 · '+displayedName;
    status(lastFeedback,mode,lastQuote);
    renderTranscript();
    if(el('send').disabled)el('chatStatus').textContent=displayedName+'在听……';
  }
  el('age').textContent = stage + ' · 相伴第 ' + days + ' 天';
  el('cat').dataset.stage = stage;
  el('chat').querySelector('h2').textContent='和'+room.profile.name+'聊聊';
  el('diaryTitle').textContent=room.profile.name+'的日记';
  document.querySelector('h1').textContent=room.profile.name+'的小屋';
  el('cat').setAttribute('aria-label',el('cat').title='摸摸'+room.profile.name);
  el('bowl').setAttribute('aria-label',el('bowl').title='给'+room.profile.name+'添粮');
  el('book').setAttribute('aria-label','翻开'+room.profile.name+'的日记');
  el('brushLabel').textContent='给'+room.profile.name+'梳毛';
  el('message').placeholder='和'+room.profile.name+'说点什么…';

  document.querySelector('.scene').classList.toggle('decorated',!!room.milestones.play);
  if(days>=7) milestone('youth','长成少年猫',adoptionAnniversary(6));
  if(days>=30) milestone('adult','长成成年猫',adoptionAnniversary(29));
  if(el('profile').open)drawProfileStats();
  return {stage, days};
}
let diaryDay=calendarDay();
const diaryTitles={
  meal:'碗沿的轻响', nap:'把爪子收起来', explore:'爪尖的新发现', patrol:'绕着地毯走一圈',
  sun:'暖洋洋的木头', groom:'把毛理顺', watch:'窗边的小事', visit:'门边的脚步声'
};
const dateLabel=time=>new Date(time).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});

function renderDiary(){
  // Old saves have several source fragments per day. Pick one scene, and keep its original wording.
  const pages=new Map();
  for(const note of room.memories){
    if(!available(note) || (!diaryRecord(note.type) && !note.diaryTitle))continue;
    const day=calendarDay(note.time);
    const preferred=['explore','nap','watch','meal','sun','groom','patrol'][day%7];
    const score=note.diaryTitle?4:note.type===preferred?3:note.sourceId?2:note.type==='visit'?0:1;
    const current=pages.get(day);
    if(!current || score>current.score)pages.set(day,{note,score});
  }
  const days=[...new Set([calendarDay(),...pages.keys()])].sort((a,b)=>b-a);
  if(!days.includes(diaryDay))diaryDay=days[0];
  const index=days.indexOf(diaryDay);
  el('diaryDate').textContent=new Date(diaryDay*dayMs).toLocaleDateString('zh-CN',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric',weekday:'long'});
  const note=pages.get(diaryDay)?.note;
  el('pageTitle').textContent=note?(note.diaryTitle || diaryTitles[note.type] || '小屋里的一天'):'今天还没有落笔';
  el('pageBody').textContent=note?.text || (room.profile.proactive?'等小屋里有了今天的故事，再来翻翻。':'在猫咪档案里开启自主日记，猫咪就会记下自己的日常。');
  el('signature').textContent=note?'—— '+room.profile.name:'';
  el('older').disabled=index===days.length-1;
  el('newer').disabled=index===0;
  el('older').onclick=()=>{diaryDay=days[index+1];renderDiary();};
  el('newer').onclick=()=>{diaryDay=days[index-1];renderDiary();};
}
function renderMoments(){
  const list=el('timeline');
  list.replaceChildren();
  for(const moment of Object.values(room.milestones).sort((a,b)=>b.time-a.time)){
    const item=document.createElement('li'),date=document.createElement('time'),label=document.createElement('p');
    const day=ageAt(room,moment.time).days;
    date.textContent=dateLabel(moment.time)+' · 相伴第 '+day+' 天';
    label.textContent=moment.text;
    item.append(date,label);list.append(item);
  }
}
function renderRecords(){
  const list=el('entries');list.replaceChildren();
  const records=room.memories.filter(available).sort((a,b)=>b.time-a.time);
  for(const record of records){
    const item=document.createElement('li'),time=document.createElement('time');
    time.textContent=dateLabel(record.time);
    const note=document.createElement('span');note.textContent=record.text;
    const forget=document.createElement('button');forget.textContent='忘记';
    forget.onclick=()=>{
      removeMemory(record.id);
      if(record.type==='chat')awaitingSafety=false;
      saveRoom();renderJournal();
      el('records').querySelector('.close').focus();
    };
    item.append(time,note,forget);list.append(item);
  }
  if(!records.length)list.textContent='还没有已收录的记录。';
}
function renderJournal(){
  if(el('diary').open)renderDiary();
  if(el('moments').open)renderMoments();
  if(el('records').open)renderRecords();
}
function remember(type,text,time=Date.now(),category,sourceId) {
  const key=calendarDay(time), isDiary=diaryRecord(type);
  if(isDiary && ((room.diaryCounts[key]||0)>=3 || (room.profile.since && time<room.profile.since)))return;

  if(type==='chat' && /^(你好|嗯+|哦+|好[的呀啊]?|谢谢[你啦]?|晚安|早安|哈哈+)[！!。～~]*$/.test(text.trim())) return;
  if(!room.profile.proactive && !isShared(type)) return;
  if(room.memories.some(m=>m.type===type && (m.text===text || isDiary) && calendarDay(m.time)===calendarDay(time))) return;
  if(isDiary){
    room.diaryCounts[key]=(room.diaryCounts[key]||0)+1;
    for(const day of Object.keys(room.diaryCounts))if(+day<calendarDay()-8)delete room.diaryCounts[day];
  }
  const entry={id:crypto.randomUUID(),deletionState:'active',sourceId,time,type,text,visibility:'本机私有',category:category||(type==='letter'?'来信':isDiary?'小屋日记':'共同经历'),source:type==='chat'?'用户原话':'小屋事件',state:'confirmed'};
  if(isDiary && !sourceId){
    const prior=room.memories.findLast(m=>available(m) && m.time<time && m.type===({meal:'feed',nap:'pet',explore:'play'})[type]);
    if(prior){entry.sourceId=prior.id;entry.text+=({meal:' 你上次添粮的样子，我还记得。',nap:' 半睡半醒的时候，我又想起被你轻轻摸过的感觉。',explore:' 上次一起玩的时候，你也在这块地毯旁。'})[type];}
  }
  room.memories.push(entry);
  if(room.memories.length>180){
    const oldestCare=room.memories.findIndex(m=>m.type!=='chat');
    room.memories.splice(Math.max(0,oldestCare),1);
  }
  return entry;
}
const visitedAt = Date.now();
// Dates are local calendar days, like the diary and growth stages.
function followupFor(memory) {
  if(memory.race)return null; // Revised races use the latest participant, date and status below.
  const text=memory.text;
  if(/不想提|别再?问|不要问|取消|不参加/.test(text)) return null;
  const day=calendarDay(memory.time);
  const topic=text.match(/(?:篮球|足球|演讲|编程|辩论|唱歌)?比赛|面试|答辩|考试|演出|旅行|聚会|搬家|开学|汇报/);
  const dated=eventDay(text,memory.time);
  if(topic || dated!==null || /打算|计划|准备去/.test(text))return {due:dated??day+1,subject:topic?.[0]};
  return null;
}
function localOpening(topic,plan,today){
  if(plan?.subject){
    if(plan.due>today)return plan.subject+'的准备还顺利吗？我来陪你理理思路。';
    return plan.subject+'怎么样啦？我把窗边的位置给你留着呢。';
  }
  if(plan)return plan.due>today?'要不要一起理一理接下来的安排？':'今天过得怎么样？我来听你慢慢讲。';
  if(conversationMode(topic)==='倾听')return '我挨着你坐一会儿。今天心里有没有轻松一点？';
  if(conversationMode(topic)==='分享喜悦')return '想到你的好消息，我的尾巴尖又翘起来了。';
  const subject=topic.match(/小船|插画|素描|水彩|画稿|配色|论文|作业|剧本|小说|吉他|钢琴|照片|蛋糕/)?.[0];
  if(subject)return '还想和你聊聊'+subject+'。你现在最想试试什么？';
  return /[？?]$/.test(topic)?'那个问题我也好奇。你自己更倾向哪种想法？':'我在窗边给你挪了个位置。想接着聊的话，我在听。';
}
let welcomed=false;
async function welcomeBack(cutoff){
  const today=calendarDay();
  if(firstDemo || !room.profile.proactive || quiet() || awaitingSafety)return;
  const plant=room.plant;
  if(plant?.news){
    const note=room.memories.find(m=>m.id===plant.news && available(m));
    delete plant.news;
    if(note){
      appendTurn('assistant','快来书架这边！'+note.text,{welcome:true,refs:[note.id]});
      welcomed=true;saveRoom();return;
    }
  }
  if(welcomed || cutoff!==visitedAt)return;
  welcomed=true;
  const past=room.memories.filter(m=>available(m)&&m.type==='chat'&&m.time<=cutoff&&!m.race&&!/不想提|别再?问|不要问|取消/.test(m.text)).reverse();
  const plans=past.map(memory=>({memory,plan:followupFor(memory)})).filter(({memory,plan})=>
    plan && today-plan.due<=14 && !past.some(m=>m.time>memory.time && plan.subject && m.text.includes(plan.subject)));
  const choice=plans.find(({memory,plan})=>plan.due<=today && !memory.askedAt) ||
    plans.find(({memory,plan})=>plan.due>today && !memory.preparedAt) ||
    past.filter(m=>!followupFor(m) && !m.askedAt && today-calendarDay(m.time)<=14).map(memory=>({memory}))[0];
  // The transcript also holds questions and everyday topics that aren't long-term facts.
  const recent=[];
  for(let i=room.transcript.length-1;i>=0 && recent.length<2;i--){
    const row=room.transcript[i];
    if(row.time>cutoff || row.role!=='user')continue;
    if(today-calendarDay(row.time)>14)break;
    if(row.localOnly || /别记|不要记|不用记|别保存|不要保存|不想提|别再?问|不要问|不想聊|换个话题/.test(row.content)){
      if(!recent.length)return;
      break;
    }
    if(row.content.trim() && !/^(你好|嗯+|哦+|好[的呀啊]?|谢谢[你啦]?|晚安|早安|哈哈+)[！!。～~]*$/.test(row.content.trim()))recent.push(row);
  }
  const [latest,previous]=recent, last=room.transcript.at(-1);
  const matches=(row,{memory,plan})=>row && (row.refs?.includes(memory.id) || (plan?.subject && row.content.includes(plan.subject)));
  const contextPlan=latest && !/取消|不参加|结束了|比完了|考完了|已经.{0,8}(?:完成|结束)/.test(latest.content) && plans.find(p=>matches(latest,p) ||
    (/^我(?:有些|有点|很|特别)?(?:紧张|害怕|担心)[。！!]*$/.test(latest.content) && matches(previous,p)));
  const active=latest ? contextPlan : choice;
  // A fresh correction gets one grounded acknowledgement, even after a topic change.
  const boundary=room.transcript.findLast(row=>row.role==='user' && (row.localOnly || /不想提|别再?问|不要问|不想聊|换个话题/.test(row.content)));
  const revised=room.memories.filter(m=>available(m) && m.race && m.time>(boundary?.time ?? 0) && m.time<=cutoff && today-calendarDay(m.time)<=14)
    .sort((a,b)=>b.time-a.time).find(m=>!m.revisionSeen ||
      (m.race.status==='scheduled' && m.race.due!==null && m.race.due<=today && today-m.race.due<=14 && !m.askedAt && !last?.welcome));
  let question,source,stamp,plan;
  if(revised){
    source=revised;
    question=revisedOpening(source.race,today);
    source.revisionSeen=true;
    if(source.race.due!==null && source.race.due<=today)stamp='askedAt';
  }else if(active && (!latest || (active.plan.due>today?!active.memory.preparedAt:!active.memory.askedAt))){
    source=active.memory;plan=active.plan;
    stamp=plan?.due>today?'preparedAt':'askedAt';
  }else if(latest){
    // A pending chat welcome is already visible. Old care-only welcomes may be superseded.
    if(last?.welcome && (last.topicTime===latest.time || (contextPlan && last.refs?.includes(contextPlan.memory.id))))return;
    source=past.find(m=>latest.refs?.includes(m.id));
  }else{
    // An unanswered welcome is already visible in the restored conversation.
    if(room.transcript.at(-1)?.welcome)return;
    source=room.memories.findLast(m=>available(m)&&['pet','feed','play'].includes(m.type)&&m.time<=cutoff&&!m.askedAt);
    question=source?{pet:'上次被你摸过的耳朵还记得呢。要来窗边坐坐吗？',feed:'上次你陪我在食碗旁坐了一会儿。今天过得怎么样？',play:'上次和你一起玩得很开心。今天想玩点什么？'}[source.type]:'你回来啦。今天有什么想跟我说的吗？';
    stamp='askedAt';
  }
  const refs=new Set(source?[source.id]:[]);
  if(!question && (latest || source?.type==='chat')){
    question=localOpening(latest?.content || source.text,plan,today);
    if(config.key){
      const version=chatVersion, settings=config, snapshot=room;
      const start=room.transcript.indexOf(previous || latest);
      const turns=start<0?[]:room.transcript.slice(start).filter(row=>row.time<=cutoff && !row.localOnly && !row.welcome).slice(-6);
      const context={name:room.profile.name,topic:source?.text,daysUntilEvent:plan?plan.due-today:undefined};
      const instruction='来访者刚回到小屋。接着上面对话中最后一个有内容的话题，自然地说一两句。结合双方已经说过的细节，别把答过的问题再问一遍。可以回应一个想法、一种感受，或者问一个具体的小问题，不必每次都提问。不要引用或复述对方原话，不要用“上次你说”或“后来呢”。若有活动，按距离活动的天数拿捏语气，不假定结果。只输出猫咪此刻说的话。';
      try{
        const reply=(await requestChat(settings,[...turns.map(({role,content})=>({role,content})),{role:'user',content:instruction}],context,AbortSignal.timeout(12000))).trim();
        const echoed=turns.some(row=>row.role==='user' && row.content.length>=8 && reply.includes(row.content.replace(/[。！？?!]+$/,'')));
        if(reply.length<=220 && !echoed && !/上次你[说问]|后来呢/.test(reply)){
          question=reply;
          for(const row of turns)for(const id of row.refs || [])refs.add(id);
        }
      }catch{/* A local opening is ready if the model is unavailable. */}
      if(version!==chatVersion || room!==snapshot || settings!==config || room.transcript.at(-1)!==last || el('send').disabled || !room.profile.proactive || quiet() || awaitingSafety)return;
    }
  }
  if(source && stamp)source[stamp]=Date.now();
  const letter=remember('letter',question,Date.now(),'来信',source?.id);
  if(letter)letter.refs=[...refs];
  appendTurn('assistant',question,{welcome:true,...(latest && {topicTime:latest.time}),refs:[...refs]});
  saveRoom();renderJournal();

}
async function relevantNotes(query){
  const concepts=[['比赛','赛事','参赛','竞赛'],['面试','求职','应聘'],['压力','焦虑','紧张','担心'],['开心','高兴','快乐'],['猫粮','开饭','喂食'],['偏爱','喜欢','最爱']];
  const terms=new Set(query.toLowerCase().match(/[a-z0-9]+/g)||[]);
  for(const word of query.match(/[\u3400-\u9fff]+/g)||[]){
    for(let i=1;i<word.length;i++) terms.add(word.slice(i-1,i+1));
  }
  for(const group of concepts) if(group.some(term=>query.includes(term))) group.forEach(term=>terms.add(term));
  const ranked=room.memories.filter(m=>available(m) && m.type==='chat').map(m=>({
    m, score:[...terms].filter(word=>m.text.toLowerCase().includes(word)).length
  })).sort((a,b)=>b.score-a.score || b.m.time-a.m.time);
  const asksForRecall=/还记得|你记得|记不记得|以前聊过|上次聊/.test(query);
  const localMatches=()=>ranked.filter(({m,score})=>(score>0 || asksForRecall) && room.memories.includes(m)).slice(0,5).map(({m})=>m);
  if(!room.profile.semantic) return localMatches();
  const pool=ranked.filter(({score})=>room.profile.semantic || score>0 || asksForRecall).slice(0,32).map(({m})=>m);
  if(!pool.length) return [];
  try {
    const candidates=pool.map((m,i)=>[i,m.text.slice(0,120)]);
    const result=await requestChat(config,[{role:'user',content:JSON.stringify({query,candidates})}],undefined,AbortSignal.timeout(4500),'/memory/rank');
    const indices=JSON.parse(result);
    if(Array.isArray(indices)) return [...new Set(indices)].filter(i=>Number.isInteger(i)&&pool[i]&&room.memories.includes(pool[i])).slice(0,5).map(i=>pool[i]);
  } catch { /* Offline and non-JSON providers use local topic matching. */ }
  return localMatches();
}
let lastRecall = 0;
function recollection(type) {
  if (Date.now() - lastRecall < 20000) return '';
  const past = room.memories.filter(m=>available(m)&&m.type!=='letter').filter(m => m.time < visitedAt || Date.now()-m.time > 60000).reverse();
  const m = past.find(m => m.type === type) || past.find(m => m.type === 'chat') || past[0];
  if (!m) return '';
  lastRecall = Date.now();
  const ago = calendarDay() - calendarDay(m.time);
  const when = ago === 0 ? '今天早些时候' : ago === 1 ? '昨天' : new Date(m.time).toLocaleDateString();
  return '「我还记得，' + when + (m.race?'更新了安排：':m.type === 'chat' ? '你说过：' : '，') + m.text + '」';
}
const minute=60000;
const hadVisit=!!room.livedUntil || room.memories.length>0;
room.livedUntil ??= Date.now();
room.restedAt ??= room.livedUntil;
room.lastMeal ||= room.livedUntil - 3*60*minute + 30000;
let holdUntil=0,lastPetAt=0;
const catButton = el('cat');
const sprite = el('sprite').getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ink = '#624333', fur = '#eb9652', stripe = '#b96939', cream = '#ffe2ab';
const colors = {o:ink, f:fur, s:stripe, w:cream, p:'#dc9586', e:'#48352c'};
// Each cell is one sprite pixel. The same face and coat are used in every pose.
const face = [
  '  oo     oo  ', '  ofo   ofo  ', '  opfo ofpo  ', '  offfofffo  ',
  ' offfssfsffo ', 'offfffsfffffo', 'offefffffeffo', 'ossffwwwffwfo',
  'offfwwwpwwwwo', ' owwwwewwweo ', '  oowwwwwoo  ', '    ooooo    '
];
const coat = [
  '   oooooooooo   ', '  offsffssfffoo  ', ' offssffssfffffo ',
  'offfsfffsfffffooo', 'offfffffffffffffo', 'offfffffffffffffo',
  ' offffwwwwwffffo ', '  oowwwwwwwwooo  ', '    oooooooo     '
];
const sleeping = [
  '       oooooooooo      ', '    ooofffssffssfoo    ', '   offssffssfffssffo   ',
  '  offffsfffsfffffffso  ', ' oofffffffffffffffffo  ',
  ' oooo   ooofffffffffso ', ' ofpfo ofpoffffffffffo ', ' offffofffoffffffffffo ',
  'offssfsffffoffffffssfo ', 'offfefffeffowwwwfffso  ', ' osffwwpwwowwwwfffoo   ',
  '  ooowwwwoooffffoo     ', '    oofffsssssfoo      ', '      ooooooooo        '
];
function stamp(rows,x,y) {
  rows.forEach((row,dy)=>{
    for(let dx=0;dx<row.length;dx++){
      const color=colors[row[dx]];
      if(color){sprite.fillStyle=color;sprite.fillRect(x+dx,y+dy,1,1);}
    }
  });
}
function block(color,x,y,w,h){sprite.fillStyle=color;sprite.fillRect(x,y,w,h);}
const stride=[-2,-1,1,2,2,1,-1,-2];
function leg(x,y,phase,far,running) {
  const offset=stride[phase]*(running?2:1);
  const lift=phase===0||phase>=6?2:0;
  const ankle=x+offset;
  block(ink,x,y,4,3);
  block(far?stripe:fur,x+1,y,2,3);
  block(ink,Math.min(x,ankle),y+2,Math.abs(offset)+4,2);
  block(ink,ankle,y+3,4,4-lift);
  block(far?stripe:cream,ankle+1,y+3,2,3-lift);
  block(ink,ankle,y+6-lift,5,1);
}
const poses = {
  idle:[4,440], walk:[8,115], run:[8,75], eat:[6,180],
  sleep:[4,560], greet:[4,260], listen:[4,350], purr:[4,140], happy:[4,160], startled:[4,120], pet:[4,210], play:[6,160]
};
poses.roll=[6,160];
poses.knead=[8,150];
let pose='idle', frameTimer, journey=0, arrival='idle';
function paintFrame(frame) {
  sprite.clearRect(0,0,36,26);
  if(pose==='roll'){
    sprite.save();sprite.translate(18,16);sprite.rotate((frame<3?-1:1)*.14+Math.PI);stamp(coat,-8,-3);stamp(face,-17,-5);block(cream,0,-5,3,5);block(cream,6,-5,3,4);sprite.restore();return;
  }
  if(pose==='sleep'){
    stamp(sleeping,5,frame<2?10:11);
    if(frame===2) {block(cream,24,19,2,1);block(stripe,22,21,3,1);}
    return;
  }
  const moving=pose==='walk'||pose==='run';
  const running=pose==='run';
  const jump=pose==='startled'?[0,3,2,0][frame]:pose==='play'?[0,1,5,6,2,0][frame]:0;
  const y=10-(pose==='idle' && frame===2?1:0)-(moving && (frame%4===2)?1:0)-jump;
  const up=running||pose==='greet'||pose==='happy';
  // Connected, stepped tail silhouette; greeting and running carry the tip high.
  const tip=frame%4<2?0:1;
  block(ink,5,y+2,5,4);block(fur,5,y+3,5,2);
  block(ink,3,y-1,4,6);block(fur,4,y,2,4);
  block(ink,2+tip,y-(up?9:4),4,up?10:5);
  block(fur,3+tip,y-(up?8:3),2,up?9:4);
  block(cream,3+tip,y-(up?8:3),2,2);
  const phase=moving?frame:2;
  leg(11,y+6,(phase+4)%8,true,running);
  leg(22,y+6,phase,true,running);
  stamp(coat,6,y);
  leg(9,y+6,phase,false,running);
  leg(20,y+6,pose==='knead'?frame:(phase+4)%8,false,running);
  if(pose==='knead')leg(22,y+6,(frame+4)%8,true,false);
  if((pose==='play' || pose==='knead') && playTargets[catButton.dataset.place]){
    const reach=pose==='knead'?[1,3,5,6,6,4,2,0][frame]:[0,2,5,8,6,2][frame];
    block(ink,22,y+7,4+reach,3);
    block(fur,23,y+8,2+reach,1);
    block(cream,25+reach,y+8,2,2);
  }
  const dip=pose==='eat'?[0,2,5,6,5,2][frame]:0;
  const nuzzle=['pet','purr','listen'].includes(pose) && frame%2===1?1:0;
  const hx=19+(dip>2?2:0), hy=y-6+dip+nuzzle;
  stamp(face,hx,hy);
  if(pose==='purr'||pose==='pet'||(pose==='idle' && frame===3)){
    block(fur,hx+3,hy+6,2,1);block(fur,hx+9,hy+6,2,1);
    block(ink,hx+2,hy+7,3,1);block(ink,hx+8,hy+7,3,1);
  }
}
function setPose(next) {
  clearInterval(frameTimer);pose=next;catButton.dataset.pose=next;
  let frame=0;paintFrame(frame);
  const [count,delay]=poses[next];
  if(!reducedMotion.matches) frameTimer=setInterval(()=>{
    if(!document.hidden){frame=(frame+1)%count;paintFrame(frame);}
  },delay);
}
// Percentages of the room floor, independent of desktop window size.
const toySpots={
  mouse:[[18,5],[22,8],[25,4]],
  butterfly:[[35,24],[40,26],[38,21]],
  scratch:[[64,13],[67,16],[62,17]],
  brush:[[22,19]]
};
const randomSpot=spots=>spots[Math.floor(Math.random()*spots.length)];
function placeBasketItem(item,renew=false){
  const spots=toySpots[item];
  if(!spots)return;
  const scene=catButton.parentElement;
  const old=room.toySpot;
  if(renew || old?.item!==item || !Number.isFinite(old.x) || !Number.isFinite(old.y)){
    const choices=spots.filter(([x,y])=>old?.item!==item || old.x!==x || old.y!==y);
    const [x,y]=randomSpot(choices.length?choices:spots);
    room.toySpot={item,x,y};
  }
  scene.style.setProperty('--prop-x',room.toySpot.x+'%');
  scene.style.setProperty('--prop-y',room.toySpot.y+'%');
}
function startMouseRun(){
  const start=room.toySpot;
  const destinations=start.x<40?[[57,5],[62,7],[66,4]]:toySpots.mouse;
  const [x,y]=randomSpot(destinations);
  const scene=catButton.parentElement;
  scene.style.setProperty('--mouse-start',start.x+'%');
  scene.style.setProperty('--mouse-start-y',start.y+'%');
  scene.style.setProperty('--mouse-bend',(start.x+(x-start.x)*.45)+'%');
  scene.style.setProperty('--mouse-bend-y',(Math.max(start.y,y)+4)+'%');
  room.toySpot={item:'mouse',x,y,heading:x<start.x?'left':'right'};
  placeBasketItem('mouse');
  el('basketItem').dataset.heading=room.toySpot.heading;
}
const playTargets={toy:'basketItem','play-wand':'wand','play-yarn':'yarn','play-light':'light'};

// The nose ends at pixel 32 on the 36px sprite. Leave the torso outside
// the prop while the animated front paw reaches the nearest visible edge.
function besideToy(prop, propLeft, propBottom){
  const scene=catButton.parentElement;
  const catWidth=catButton.offsetWidth;
  const width=prop.offsetWidth;
  const floor=scene.getBoundingClientRect();
  const bottom=propBottom+prop.querySelector('svg').getBoundingClientRect().height*.20-catWidth*.085;
  const obstacles=[...scene.querySelectorAll('.object:not([hidden]),#bowl')].filter(other=>other!==prop).map(other=>other.getBoundingClientRect());
  const sides=['right','left'].map(facing=>{
    const right=facing==='right';
    const edge=propLeft+width*(right?.10:.90);
    const left=edge-catWidth*(right?.96:.04);
    const x=floor.left+left, y=floor.bottom-bottom;
    const blocked=obstacles.some(r=>x+catWidth*.78>r.left && x+catWidth*.22<r.right && y>r.top+4 && y-catWidth*.52<r.bottom);
    const overflow=Math.max(0,-left,left+catWidth-scene.clientWidth);
    const score=Math.abs(left-catButton.offsetLeft)+overflow*20+(blocked?scene.clientWidth:0);
    return {left,bottom,facing,score};
  });
  return sides[0].score<=sides[1].score?sides[0]:sides[1];
}
function move(place,next='idle',rush=false,onArrival) {
  const ticket=++journey;
  document.querySelector('[data-invited]')?.removeAttribute('data-invited');
  el('scale').removeAttribute('data-reading');
  arrival=next;
  const left=catButton.offsetLeft;
  const floorWidth=catButton.parentElement.clientWidth;
  let targetX={door:29,rug:43,yarn:15,window:19,bowl:68,box:35,light:51,bed:5,basket:83,mat:30,catchMouse:44,shelf:65}[place]*floorWidth/100;
  const targetId=playTargets[place];
  if(place==='scale'){
    const scale=el('scale');
    targetX=scale.offsetLeft+(scale.offsetWidth-catButton.offsetWidth)/2;
    catButton.style.setProperty('--scale-x',targetX/floorWidth*100+'%');
    catButton.dataset.facing=targetX>=left?'right':'left';
  }else if(targetId){
    const prop=el(targetId);
    const scene=catButton.parentElement;
    // A running mouse's DOM offset is in transit; aim for its landing spot.
    const leftEdge=place==='toy'?floorWidth*room.toySpot.x/100:prop.offsetLeft;
    const bottom=place==='toy'?scene.clientHeight*room.toySpot.y/100:scene.clientHeight-prop.offsetTop-prop.offsetHeight;
    const stop=besideToy(prop,leftEdge,bottom);
    catButton.style.setProperty('--paw-x',stop.left/floorWidth*100+'%');
    catButton.style.setProperty('--paw-y',stop.bottom/scene.clientHeight*100+'%');
    catButton.dataset.facing=stop.facing;
    prop.style.setProperty('--roll-away',stop.facing==='right'?'42%':'-42%');
  }else if(Math.abs(targetX-left)>2)catButton.dataset.facing=targetX<left?'left':'right';
  catButton.style.setProperty('--travel',rush?(place==='toy'?'1.2s':'0.65s'):'1.3s');
  catButton.dataset.place=place;
  // Read layout after assigning the destination so interruptions follow the actual CSS trip.
  void catButton.offsetLeft;
  const travel=catButton.getAnimations().filter(a=>['left','bottom'].includes(a.transitionProperty));
  function settle(){
    if(ticket!==journey) return;
    if(place==='bowl') catButton.dataset.facing='right';
    setPose(next);
    onArrival?.();
  }
  if(!travel.length || reducedMotion.matches){settle();return;}
  setPose(rush?'run':'walk');
  Promise.allSettled(travel.map(a=>a.finished)).then(settle);
}
reducedMotion.addEventListener('change',()=>move(catButton.dataset.place,arrival));
setPose('idle');
const plantStages=['嫩芽冒头','子叶展开','新叶','长成'];
let plantPreview=null;
// Group, silhouette, colours, mature stage and the cat's observation.
const seeds={
  向日葵:['观花','disc','#e4b449','#805234','开花','开花了，金色花瓣围着一个圆圆的花心。'],
  金盏菊:['观花','cup','#e48b43','#a95429','开花','开花了，一层层橘色花瓣像个小绒球。'],
  百日菊:['观花','tiers','#cc626d','#efbe57','开花','开花了，红花瓣中间还藏着一点金黄。'],
  矢车菊:['观花','star','#718aca','#454986','开花','开花了，蓝花瓣的尖尖像一圈小星星。'],
  波斯菊:['观花','petals','#dd8faf','#e7b34c','开花','开花了，粉花瓣颤悠悠的，我把尾巴收好才敢靠近。'],
  角堇:['观花','pansy','#926db3','#edcb6a','开花','开花了，紫花瓣中间有一点黄，像一张小脸。'],
  猫草:['观叶','grass','#79934e','#a6b864','草叶舒展','长成了一小丛，细细的草尖都探出盆沿啦。'],
  罗勒:['观叶','herb','#537f4d','#8eab68','叶片长成','长出一对对圆叶子，书架边多了一点清清的香气。'],
  紫苏:['观叶','serrated','#83566c','#b17c93','叶片长成','长出了紫红色的大叶子，我从下面看，叶脉透着光。'],
  草莓:['果实与谷穗','berry','#cb5552','#f5cb78','果实成熟','结的小草莓红啦，我蹲在架子底下都看得见。'],
  彩椒:['果实与谷穗','pepper','#dd8546','#83a35a','果实成熟','结出了橙色的小椒，胖乎乎地挂在枝头。'],
  小米:['果实与谷穗','grain','#c99e4e','#eed18b','谷穗成熟','的谷穗变金黄了，沉得弯下了腰。']
};
const crowns={
  cup:['M221 13h3v2h2v-4h3v3h2v-3h3v4h2v-2h3v5h-3v3h-3v2h-7v-2h-3v-3h-2z','M224 17h3v2h6v-2h3v3h-3v1h-6v-1h-3z'],
  tiers:['M225 10h8v2h3v3h3v4h-3v2h-3v2h-8v-2h-3v-2h-3v-4h3v-3h3z','M226 13h6v3h-6zm-4 4h3v2h-3zm11 0h3v2h-3z'],
  petals:['M224 9h4v4h3V9h4v4h-2v2h6v4h-6v4h-4v-4h-2v4h-4v-5h-4v-4h6z','M226 14h6v4h-6z'],
  pansy:['M222 10h5v2h4v-2h5v6h-2v2h4v4h-6v3h-6v-3h-6v-4h4v-2h-2z','M225 16h3v2h2v-2h3v4h-3v2h-2v-2h-3z'],
  serrated:['M229 25h-4v-2h-3v-3h-2v-3h-2v-6h4v2h4v3h2v4h2zm1-5v-6h2v-4h3V8h4v6h-2v3h-3v3z','M221 15h2v3h2v2h2v2h-3v-3h-3zm12-1h2v-3h2v4h-2v2h-2z'],
  disc:['M226 8h7v2h3v3h2v5h-2v3h-3v2h-7v-2h-3v-3h-2v-5h2v-3h3z','M226 12h6v1h2v5h-2v1h-6v-1h-1v-5h1z'],
  star:['M225 10h3v2h3v-2h3v4h3v3h-4v3h-3v-2h-3v2h-3v-4h-2v-3h3z','M227 14h5v3h-5z'],
  grass:['M222 37v-7h-2v-8h2v6h2v9zm6 0V13h2v24zm5 0V25h2v-7h2v9h-2v10z','M225 36V20h2v16zm6 0V19h2v17z'],
  herb:['M228 22h-5v-2h-3v-5h5v2h3zm2-4v-6h3v-2h4v5h-2v3z','M230 29v-5h3v-2h5v5h-3v2zm-3-14h-3v-4h3z'],
  berry:['M222 26h9v5h-2v3h-2v2h-2v-3h-2v-3h-1z','M224 28h1v2h-1zm4 1h1v1h-1zm-2 3h1v1h-1z'],
  pepper:['M225 23h3v1h2v-1h4v2h1v7h-2v3h-3v-1h-2v1h-2v-3h-2v-6h1z','M228 24v-5h2v3h3v2z'],
  grain:['M229 12h5v2h3v3h2v7h-3v-5h-3v-3h-4z','M231 13h2v2h-2zm3 3h2v2h-2zm2 4h2v2h-2z']
};
const groups=new Map();
for(const [kind,[group]] of Object.entries(seeds)){
  if(!groups.has(group)){
    const opt=document.createElement('optgroup');opt.label=group;groups.set(group,opt);el('seedKind').append(opt);
  }
  groups.get(group).append(new Option(kind,kind));
}
function species(plant){return seeds[plant.kind]||seeds['向日葵'];}
function phaseOf(plant,stage){return stage===3?species(plant)[4]:plantStages[stage];}
function drawCrown(plant){
  const [,shape,main,accent]=species(plant);
  const paths=[['plantStem','#62775a',shape==='grass'?'M228 37v-9h2v9z':'M228 38V14h2v24z'],['plantCrown',main,crowns[shape][0]],['plantDetail',accent,crowns[shape][1]]];
  for(const [id,color,path] of paths){el(id).setAttribute('fill',color);el(id).setAttribute('d',path);}
}
function maturityDay(plant){return (plant.waterDays || 0)>=3?5:7;}
function plantStage(plant,day){
  const watered=plant.waterDays || 0;
  const age=Math.max(0,day-plant.sown);
  return age+1>=maturityDay(plant)?3:age>=3 || (age>=2 && watered>=2)?2:age>=1?1:0;
}
function sharedScene(type,title,text,time){
  const entry=remember(type,text,time);
  if(entry && room.profile.proactive)entry.diaryTitle=title;
  return entry;
}
let replacing=null;
function plantingId(plant){return plant?.id || JSON.stringify([plant?.sown,plant?.kind,plant?.name]);}
function drawPlant(){
  const plant=room.plant, pot=el('plantPot'),day=calendarDay();
  const stage=plant?plantStage(plant,day):0;
  const visiblePlant=plantPreview || plant;
  pot.dataset.stage=plantPreview?.stage ?? stage;pot.dataset.kind=visiblePlant?.kind || '';
  if(Number(pot.dataset.stage)===3)drawCrown(visiblePlant);
  pot.setAttribute('aria-label',plantPreview?'演示：'+plantPreview.kind+' · '+phaseOf(plantPreview,plantPreview.stage):plant?'看看'+plant.name:'在书架上的花盆里种植物');
  const switching=plant && replacing===plantingId(plant);
  el('gardenTitle').textContent=switching?'种下一盆':plant?plant.name:'书架上的盆栽';
  el('sow').hidden=!!plant && !switching;el('plantCare').hidden=!plant || switching;
  el('cancelSow').hidden=!switching;el('replant').hidden=stage!==3;
  if(!plant)return;
  const phase=phaseOf(plant,stage);
  const growingDay=Math.max(0,day-plant.sown)+1;
  const progress=Math.min(100,Math.round(100*growingDay/maturityDay(plant)));
  el('plantInfo').textContent=plant.kind+' · 第 '+growingDay+' 天 · '+phase;
  el('plantProgress').value=progress;
  el('growthPercent').textContent=progress+'%';
  el('careNote').hidden=!plant.lastCareAt;
  if(plant.lastCareAt)el('careNote').textContent=new Date(plant.lastCareAt).toLocaleDateString('zh-CN',{month:'long',day:'numeric'})+'，'+room.profile.name+(plant.lastCare==='water'?'来书架旁帮忙浇了水。':'在书架旁守着花盆坐了一会儿。');
  el('waterPlant').disabled=plant.lastWater===day;
  el('waterPlant').textContent=plant.lastWater===day?'今天浇过水了':'浇点水';
}
function observeGrowth(){
  const plant=room.plant;
  if(!plant)return;
  const stage=plantStage(plant,calendarDay());
  if(stage>(plant.seenStage??0)){
    const lines=['','的两片子叶张开啦，昨天那个小芽尖今天像一对绿耳朵。','的新叶展开了，我的胡须差一点就碰到叶尖。',species(plant)[5]];
    const entry=sharedScene('plant','书架上的'+plant.name,'「'+plant.name+'」'+lines[stage]);plant.seenStage=stage;
    if(entry && room.profile.proactive)plant.news=entry.id;
  }
}
el('plantPot').onclick=()=>{if(plantPreview){el('tryGuide').click();return;}drawPlant();el('garden').showModal();};
el('garden').addEventListener('close',()=>{replacing=null;});
el('replant').onclick=()=>{replacing=plantingId(room.plant);el('sow').reset();drawPlant();el('seedKind').focus();};
el('cancelSow').onclick=()=>{replacing=null;drawPlant();el('replant').focus();};
el('sow').onsubmit=e=>{
  e.preventDefault();
  const name=el('plantName').value.trim();
  if(!name){el('plantName').focus();return;}
  if(room.plant && (replacing!==plantingId(room.plant) || plantStage(room.plant,calendarDay())!==3))return;
  replacing=null;
  room.plant={id:crypto.randomUUID(),name,kind:el('seedKind').value,sown:calendarDay(),sownAt:Date.now(),seenStage:0,waterDays:0};
  sharedScene('plant','我们种下一颗种子','你把'+room.plant.kind+'种在书架上的花盆里，给它取名叫「'+name+'」。我在一旁看着你把土轻轻盖好。');
  milestone('plant','一起种下'+name);
  recordCompany(room.company,'garden',Date.now());
  observeGrowth();drawPlant();saveRoom();renderJournal();
};
el('waterPlant').onclick=()=>{
  const plant=room.plant, day=calendarDay();
  if(!plant || plant.lastWater===day)return;
  plant.lastWater=day;plant.waterDays++;
  recordCompany(room.company,'garden',Date.now());
  move('shelf','listen',false,()=>{catButton.dataset.facing='right';});status('{cat}坐到书架旁，仰头望着你给盆栽浇水。','陪你浇水');idle();recordScene();
  observeGrowth();drawPlant();saveRoom();renderJournal();
};
const discoveries={
  mouse:{place:'shelf',hint:'{cat}趴在书架旁，朝最下面的缝隙伸了伸爪。',title:'书架下的吱呀声',story:'两只小轮子在暗处打转。原来是发条鼠卡在书架底下了。',action:'帮它捡回来',help:'你捡起了书架底下的发条鼠。我用爪子按住它，这次可别再跑丢了。',watch:'我们一起守着书架底下的小轮子，听它吱呀吱呀，直到发条慢慢停下来。'},
  leaf:{place:'box',hint:'{cat}绕着纸箱转了一圈，耳尖跟着箱沿的沙沙声动了动。',title:'纸箱边的沙沙声',story:'一片卷起的金色叶子挂在箱边，每晃一下就擦过纸板。',action:'把叶子放到地毯上',help:'你把箱边的小叶子放在地毯上。我轻轻拨了一下，它打着转落在我脚边。',watch:'我们趴在纸箱旁，看那片金色叶子晃了好一会儿。'}
};
function drawClue(){
  const clue=room.discovery,button=el('oddity');
  button.hidden=!clue || clue.day!==calendarDay() || clue.done;
  const teaching=el('guide').hasAttribute('data-clues');
  button.classList.toggle('guideTarget',teaching && !button.hidden);
  el('guideClue').hidden=!teaching || !button.hidden;
  el('guideClue').classList.toggle('guideTarget',teaching && button.hidden);
  if(button.hidden){if(el('discovery').open)el('discovery').close();return;}
  button.dataset.kind=clue.kind;
  button.setAttribute('aria-label',clue.kind==='mouse'?'看看书架底下':'看看纸箱旁边');
}
function inviteDiscovery(){
  if(demo || document.querySelector('dialog[open]'))return false;
  const day=calendarDay(),old=room.discovery;
  if(old?.day===day)return false;
  const kind=old?.kind==='mouse'?'leaf':'mouse';
  room.discovery={kind,day,done:false};
  const scene=discoveries[kind];
  drawClue();move(scene.place,'listen');status(scene.hint,'寻找声音');recordScene();idle();
  return true;
}
el('oddity').onclick=()=>{
  drawClue();if(el('oddity').hidden)return;
  const scene=discoveries[room.discovery.kind];
  el('discoveryTitle').textContent=scene.title;el('discoveryStory').textContent=scene.story;
  el('helpDiscovery').textContent=scene.action;el('discovery').showModal();
};
function resolveDiscovery(help){
  drawClue();if(el('oddity').hidden)return;
  const clue=room.discovery,scene=discoveries[clue.kind],text=help?scene.help:scene.watch;
  clue.done=true;drawClue();move(scene.place,help?'happy':'listen');status(text,help?'看着你的手':'和你一起看');idle();recordScene();
  sharedScene('discovery',scene.title,text);milestone('discovery','第一次跟着猫咪找到小屋里的秘密');
  recordCompany(room.company,'discovery',Date.now());
  saveRoom();renderJournal();
}
el('helpDiscovery').onclick=()=>resolveDiscovery(true);
el('watchDiscovery').onclick=()=>resolveDiscovery(false);
drawPlant();drawClue();
function shelfVisit(time,type){
  const text=tendPlant(room.plant,room.seed,time,type);
  if(text)sharedScene('plant','去书架边看看','「'+room.plant.name+'」：'+text,time);
  return text;
}
function inviteUsualGame(now){
  if(demo || document.hidden || quiet() || awaitingSafety || room.sleepUntil>now ||
    room.gameInviteDay===calendarDay(now) || document.querySelector('dialog[open]') ||
    el('send').disabled || el('message').value.trim())return false;
  const toy=usualPlayToy(room.memories.filter(available),now);
  if(!toy)return false;
  const fixed=Object.hasOwn(playTargets,'play-'+toy);
  if(!fixed){
    room.basketItem=toy;
    showBasketItem(toy);
  }
  const name=toyNames[toy];
  room.gameInviteDay=calendarDay(now);
  move(fixed?'play-'+toy:'toy','listen');
  el(fixed?toy:'basketItem').dataset.invited='';
  status('{cat}走到'+name+'旁边，回头看你，尾巴尖轻轻晃着。又到你们常一起玩的时间了。','等你一起玩'+name);
  recordScene();holdUntil=now+45000;
  return true;
}
function advance(now,show) {
  drawClue();
  if(show){
    const [place,activity,text,type]=chooseLife(room,now);
    el('cat').classList.remove('pet','play','feed');
    const wantsGame=type!=='meal' && type!=='nap' && inviteUsualGame(now);
    const care=!wantsGame && shelfVisit(now,type);
    if(care){
      move('shelf','listen',false,()=>{catButton.dataset.facing='right';});
      status(care,'照看盆栽');recordScene();
    }else if(!wantsGame && (type==='meal' || type==='nap' || !inviteDiscovery())){
      remember(type,text,now);
      move(place,type==='meal'?'eat':type==='nap'?'sleep':'idle');status(text,activity);recordScene();
    }
  }
  observeGrowth();drawPlant();
  room.livedUntil=now;
  growth();saveRoom();renderJournal();
}
let catchingUp=false;
async function greet(cutoff=visitedAt) {
  if(catchingUp) return;
  const since=room.livedUntil;
  let recap='';
  if(Date.now()-since>=30*minute){
    const snapshot={seed:room.seed,adoptedDay:room.adoptedDay,livedUntil:since,lastMeal:room.lastMeal,restedAt:room.restedAt,sleepUntil:room.sleepUntil,bedUntil:room.bedUntil,lastPlay:room.lastPlay,playCount:room.playCount,toys:room.toys,memories:room.memories.filter(m=>available(m)&&['feed','play'].includes(m.type)).slice(-20).map(m=>({time:m.time,type:m.type,text:m.type==='play'&&m.text.includes('线团')?'线团':''}))};
    const end=Date.now();
    let result;
    catchingUp=true;
    try {
      const response=await fetch('/life/replay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot,end}),signal:AbortSignal.timeout(2500)});
      if(!response.ok) throw Error();
      result=await response.json();
    } catch {result=replay(snapshot,end);}
    finally {catchingUp=false;}
    if(room.livedUntil!==since) return;
    for(const event of result.events){
      if(!shelfVisit(event.time,event.type))remember(event.type,event.text,event.time);
    }
    room.memories.sort((a,b)=>a.time-b.time);
    Object.assign(room,{lastMeal:Math.max(room.lastMeal,result.lastMeal),restedAt:Math.max(room.restedAt,result.restedAt),sleepUntil:result.sleepUntil,bedUntil:result.bedUntil||0});
    if(result.events.length) recap='你离开时，我最后在'+(room.plant?.lastCareAt===result.events.at(-1).time?'照看盆栽':result.events.at(-1).activity)+'。';
  }
  const now=Date.now();
  advance(now,false);
  if(holdUntil>now){welcomeBack(cutoff);saveRoom();renderJournal();return;}
  if(now-room.lastMeal<(ageAt(room,now).days<7?3:5)*60*minute && inviteUsualGame(now)){
    welcomeBack(cutoff);saveRoom();renderJournal();return;
  }
  const discovering=inviteDiscovery();
  const petMemory=room.memories.findLast(m=>available(m)&&m.type==='pet');
  const familiar=!!petMemory;
  const closeCompanions=room.company.bond>=50;
  const greeting=closeCompanions?'{cat}听出你的脚步，翘着尾巴迎上来，绕着你的脚踝蹭了一圈。':familiar?'{cat}认出你的脚步，小跑过来，把脸颊贴到你的手边。':'{cat}从地毯上站起来，慢慢走到你脚边。';
  if(!discovering){move('door','greet',true);status(greeting+recap,'迎接你');}
  welcomeBack(cutoff);
  if(!discovering)remember('visit',familiar?'你的脚步声一近，我就跑到门边。上次被摸过的脸颊，好像又痒起来了。':'门边传来脚步声。我走过去闻了闻，悄悄挨近了一点。',Date.now(),undefined,petMemory?.id);
  holdUntil=now+12000;saveRoom();renderJournal();
}
function recordScene(){room.scene={place:catButton.dataset.place,pose:arrival,activity:mode,time:Date.now()};}
function idle(){holdUntil=Date.now()+16000;}
function enter(){
  const scene=room.scene;
  if(scene && Date.now()-scene.time<20000 && poses[scene.pose] && ['door','window','rug','bowl','yarn','box','light','bed','basket','mat','catchMouse','shelf',...Object.keys(playTargets)].includes(scene.place)){
    move(scene.place,scene.pose);status('{cat}还在'+scene.activity+'。',scene.activity);holdUntil=scene.time+20000;growth();observeGrowth();drawPlant();welcomeBack(visitedAt);saveRoom();renderJournal();return;
  }
  greet();
}
if(!room.adoptionPending){
  if(hadVisit) requestAnimationFrame(()=>requestAnimationFrame(enter));
  else advance(Date.now(),true);
}
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) hiddenAt=Date.now();
  else if(!room.adoptionPending && Date.now()-hiddenAt>15000) greet(hiddenAt);
});
setInterval(()=>{
  if(!room.adoptionPending && !document.hidden && !catchingUp && Date.now()>=holdUntil) advance(Date.now(),true);
},20000);
window.addEventListener('storage',e=>{
  if(e.key===configKey){config=read(configKey);forgetContext();return;}
  if(e.key===roomKey && !e.newValue){location.reload();return;}
  if(e.key!==roomKey) return;
  const latest=read(roomKey);
  if(room.adoptionPending && !latest.adoptionPending){location.reload();return;}
  if(Array.isArray(latest.memories) && Number.isFinite(latest.livedUntil)){
    if(room.memories.some(old=>isShared(old.type) && !latest.memories.some(m=>m.id===old.id && m.text===old.text))) forgetContext();
    latest.transcript??=[];const changed=JSON.stringify(room.transcript)!==JSON.stringify(latest.transcript);
    migrateMemories(latest);restoreCompany(latest);room=latest;drawPlant();drawClue();basketItem.hidden=true;showBasketItem(room.basketItem);if(changed){renderTranscript();awaitingSafety=room.transcript.at(-1)?.safetyPending===true;}growth();renderJournal();drawGuide();
  }
});
function interact(action,toy,gesture='short') {
  const cat=el('cat');
  const now=Date.now();
  if(action==='pet'){if(now-lastPetAt<300)return;lastPetAt=now;}
  cat.classList.remove('pet','play','feed');
  void cat.offsetWidth;
  let reaction,activity,memory,petPose='pet',playPose='play',playPlace='rug';
  if(action==='pet') {
    [petPose,activity,memory]=petReaction(gesture,room.pets);
    reaction=memory;room.pets++;
    if(petPose==='purr') purr();
    if(room.pets===4) milestone('trust','熟悉了你的手，学会翻肚皮');
  } else if(action==='brush'){
    reaction=memory='梳齿顺着背上的条纹慢慢滑下去，我把下巴仰起来，把另一边也交给你。';
    activity='享受梳毛';purr();
  } else if(action==='nest'){
    reaction=memory='你拍了拍窝边，我钻进小帐篷，把下巴搁在软垫上。';
    activity='猫窝打盹';room.restedAt=now;room.bedUntil=room.sleepUntil=now+3*minute;
  } else if(action==='feed') {
    if(now-room.lastMeal<60000) {move(cat.dataset.place,'idle');status('{cat}舔舔嘴角，肚子还饱着呢。','洗脸');idle();guideDid('bowl');return;}
    room.lastMeal=now;
    reaction='{cat}凑到食碗边，低头嚼起了猫粮。'; activity='吃饭'; memory='你替我添了猫粮。我把鼻子伸进碗里，吃完才发现有一粒粘在胡须上。';
  } else {
    const wakingUp=room.sleepUntil>now || arrival==='sleep';
    if(wakingUp || now-room.lastPlay>16000)room.playCount=0;
    if(wakingUp)room.restedAt=now;
    room.sleepUntil=0;
    room.bedUntil=0;
    room.lastPlay=now;
    room.playCount=Math.min(3,room.playCount+1);
    reaction='{cat}盯紧羽毛，跃起来用两只前爪抱住它。'; activity='追羽毛'; memory='你抖了抖羽毛，我扑了个空。第二次总算按住了它，两只前爪都舍不得松。';
    if(toy==='yarn'){
      reaction='线团沿着木地板滚了一圈，{cat}伸出爪子把它勾了回来。';activity='拨线团';memory='你滚过来的线团碰了碰我的爪尖。我把它拨回去，等你再滚一次。';
    }
    if(toy==='light'){reaction='{cat}沿着日光追过去，扑住了两爪之间的小亮斑。';activity='追光点';memory='我和你追了一会儿光点，小亮斑偷偷溜出了爪缝。';}
    playPlace='play-'+toy;
    if(toy==='mouse'){playPlace='toy';startMouseRun();reaction=memory='发条鼠吱溜一下沿着地毯跑了。我追上去，两只爪子刚好把它扣住。';activity='追发条鼠';}
    if(toy==='butterfly'){playPlace='toy';reaction=memory='你拨了一下弹簧，蝴蝶晃到我的鼻尖。我等它弹回来，才轻轻扑上去。';activity='扑蝴蝶';}
    if(toy==='scratch'){playPlace='toy';playPose='knead';reaction=memory='瓦楞纸沙沙响，我左右爪轮着踩，最后把下巴也搁在板边。';activity='踩抓板';}
    const prop=el(toy)||el('basketItem');
    prop.classList.remove('contact');
    for(const id of ['wand','yarn','light','basketItem']) el(id).classList.remove('active');
    void prop.offsetWidth;
    prop.classList.add('active');
  }
  move({feed:'bowl',pet:petPose==='startled'?(cat.dataset.place==='rug'?'door':'rug'):cat.dataset.place,play:playPlace,brush:cat.dataset.place,nest:'bed'}[action],{feed:'eat',pet:petPose,play:playPose,brush:'purr',nest:'sleep'}[action],action==='play'&&toy==='mouse',()=>{
    if(action==='play'){
      const item=el(playTargets[playPlace]);
      item.classList.remove('contact');
      void item.offsetWidth;
      item.classList.add('contact');
      const playJourney=journey;
      setTimeout(()=>{if(playJourney===journey){setPose('idle');arrival='idle';recordScene();saveRoom();}},toy==='scratch'?3200:1600);
    }
  });
  cat.classList.add(action);
  status(reaction,activity,recollection(action));
  milestone(action,{brush:'第一次一起梳毛',nest:'第一次拍拍窝边陪我休息',pet:'第一次蹭你的手',feed:'第一次一起开饭',play:'第一次一起玩 · 窗边挂起了小鱼风铃'}[action]);
  if(action==='play') room.toys[toy]=(room.toys[toy]||0)+1;
  room.lastFeeling={pose:arrival,time:now};
  if(arrival!=='startled')recordCompany(room.company,action,now);
  recordScene();
  const entry=remember(action,memory,now);
  if(action==='play'){
    const game=entry || room.memories.findLast(m=>available(m) && m.type==='play' && m.text===memory && calendarDay(m.time)===calendarDay(now));
    if(game)notePlayTime(game,toy,now);
  }
  growth();saveRoom();renderJournal();idle();
  guideDid(({pet:'cat',feed:'bowl',nest:'nest'})[action] || (room.basketItem===toy?'basketItem':toy));
}
function purr(){
  if(!room.profile.sound || quiet()) return;
  const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='triangle';osc.frequency.value=52;gain.gain.value=.035;
  osc.connect(gain).connect(ctx.destination);osc.start();
  gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.55);
  osc.stop(ctx.currentTime+.6);osc.onended=()=>ctx.close();
}
let lastTouch=0;
for(const id of ['cat','wand']){
  const target=el(id);let start=null;
  target.ondragstart=e=>e.preventDefault();
  target.onpointerdown=e=>{
    if(!e.isPrimary || e.button!==0)return;
    e.preventDefault();
    target.focus({preventScroll:true});
    start={time:Date.now(),x:e.clientX,y:e.clientY,distance:0};
    target.setPointerCapture(e.pointerId);
  };
  target.onpointermove=e=>{
    if(!start)return;
    start.distance+=Math.hypot(e.clientX-start.x,e.clientY-start.y);start.x=e.clientX;start.y=e.clientY;
    if(id==='wand' && start.distance>8){
      const scene=target.parentElement.getBoundingClientRect();
      const x=Math.max(3,Math.min(85,(e.clientX-scene.left)*100/scene.width));
      const y=Math.max(4,Math.min(55,(scene.bottom-e.clientY)*100/scene.height));
      target.style.left=x+'%';target.style.bottom=y+'%';
      const stop=besideToy(target,x*scene.width/100,y*scene.height/100);
      catButton.dataset.facing=stop.facing;
      catButton.style.left=stop.left/scene.width*100+'%';
      catButton.style.bottom=stop.bottom/scene.height*100+'%';
      if(pose!=='walk'){journey++;setPose('walk');}idle();
    }
  };
  target.onpointercancel=()=>{start=null;for(const obj of [target,catButton]){obj.style.removeProperty('left');obj.style.removeProperty('bottom');}};
  target.onpointerup=e=>{
    if(!start)return;
    const held=Date.now()-start.time,dist=start.distance;
    target.onpointercancel();if(Date.now()-lastTouch<300)return;
    const repeated=Date.now()-lastTouch<1800;lastTouch=Date.now();
    interact(id==='cat'?'pet':'play',id,held>=2400?'long':dist>8 || repeated || held>550?'stroke':'short');
  };
}
for (const [id,action] of Object.entries({cat:'pet',bowl:'feed',wand:'play',yarn:'play',light:'play'})) {
  el(id).onclick=e=>{if(!['cat','wand'].includes(id)||e.detail===0)interact(action,id);};
}
const basketItem=el('basketItem');
function showBasketItem(item,renew=false){
  if(!['mouse','scratch','butterfly','brush'].includes(item))return;
  placeBasketItem(item,renew);basketItem.hidden=false;basketItem.classList.remove('active','contact');basketItem.dataset.item=item;
  basketItem.dataset.heading=room.toySpot.heading||'right';
  basketItem.setAttribute('aria-label',toyNames[item]||'梳毛');
  basketItem.querySelector('use').setAttribute('href','#icon-'+item);
}
showBasketItem(room.basketItem);
el('scale').onclick=()=>{
  idle();
  catButton.classList.remove('play','pet','feed');
  status('{cat}朝小木秤走去。','走向小木秤');
  move('scale','idle',false,()=>{
    const {kg}=bodyProfile(room,Date.now());
    el('scaleDial').textContent=kg.toFixed(1)+' kg';
    el('scale').dataset.reading='';
    const ticket=journey;
    const finish=()=>{
      if(ticket!==journey)return;
      const now=Date.now();
      const previous=room.weighIn;
      let comparison='这是第一次上秤。';
      if(previous){
        const delta=Math.round((kg-previous.kg)*10);
        comparison=delta===0?'和上次一样重。':'比上次'+(delta>0?'重':'轻')+'了 '+(Math.abs(delta)/10).toFixed(1)+' kg。';
      }
      room.weighIn={time:now,kg};
      status('{cat}在小木秤上站稳了。'+kg.toFixed(1)+' kg，'+comparison,'站在小木秤上');
      recordScene();saveRoom();
      guideDid('scale');
    };
    if(reducedMotion.matches)finish();else setTimeout(finish,650);
  });
};
el('nest').onclick=()=>interact('nest');
el('basket').onclick=()=>el('toyBox').showModal();
basketItem.onclick=()=>interact(room.basketItem==='brush'?'brush':'play',room.basketItem);
for(const button of el('toyBox').querySelectorAll('[data-item]')){
  button.onclick=()=>{
    room.basketItem=button.dataset.item;showBasketItem(room.basketItem,true);
    el('toyBox').close();basketItem.focus({preventScroll:true});basketItem.click();saveRoom();
  };
}
function openDiary(){
  diaryDay=calendarDay();renderDiary();el('diary').showModal();
}
el('book').onclick=openDiary;
function openMoments(){
  renderMoments();
  el('moments').showModal();
}
el('openMoments').onclick=openMoments;
el('memoryFrame').onclick=openMoments;
el('openRecords').onclick=()=>{renderRecords();el('records').showModal();};
for (const button of document.querySelectorAll('.close')) button.onclick=()=>button.closest('dialog').close();
const configForm = el('config').querySelector('form');
const preset = el('preset');
let testRequest;

function updateModelFields() {
  const url = URL.canParse(el('base').value) ? new URL(el('base').value) : null;
  const official = url?.origin === 'https://api.deepseek.com' && !url.username && !url.password;
  el('presetLabel').hidden = !official;
  el('modelLabel').hidden = official && !!preset.value;
  el('model').disabled = el('modelLabel').hidden;
}

function clearTest() {
  testRequest?.abort();
  testRequest = undefined;
  el('testConnection').disabled = false;
  el('cfgStatus').textContent = '';
}

function settings(){
  el('modelState').textContent=config.key?'已配置 · '+config.model:'未配置密钥';
  el('base').value=config.base || '';el('model').value=config.model || '';
  const saved = config.model;
  preset.value = !saved || saved === 'deepseek' ? 'deepseek-flash' : saved;
  updateModelFields();
  el('key').value=config.key || '';el('remember').checked=!!read(configKey).key;
  el('cfgStatus').textContent='';el('config').showModal();
}
el('settings').onclick=settings;
el('base').oninput=()=>{
  if(config.key && el('key').value===config.key) el('key').value='';
  if(el('presetLabel').hidden) preset.value='deepseek-flash';
  updateModelFields();
};
preset.onchange=updateModelFields;
configForm.addEventListener('input', clearTest);
el('config').addEventListener('close', clearTest);
function draftConfig() {
  if (!configForm.reportValidity()) return;
  const base=el('base').value.trim(),model=el('model').disabled ? preset.value : el('model').value.trim(),key=el('key').value.trim();
  const url=new URL(base);
  if(url.username || url.password || url.search || url.hash || !(url.protocol==='https:' || (url.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)))) {el('cfgStatus').textContent='请填写 HTTPS 基础地址，本机服务可使用 HTTP。';return;}
  if(!model || !key){el('cfgStatus').textContent='请填写模型名与密钥。';return;}
  return {base,model,key};
}
configForm.onsubmit=e=>{
  e.preventDefault();
  const draft = draftConfig();
  if (!draft) return;
  const {base,model,key} = draft;
  try {store.setItem(configKey,JSON.stringify(el('remember').checked ? {base,model,key} : {base,model}));} catch {el('cfgStatus').textContent='浏览器禁止保存配置。';return;}
  config={base,model,key};el('config').close();status('模型配置已保存，可以和{cat}说话了。');
  guideDid('savedConfig');
};
el('testConnection').onclick = async () => {
  const draft = draftConfig();
  if (!draft || testRequest) return;
  const request = new AbortController();
  testRequest = request;
  el('testConnection').disabled = true;
  el('cfgStatus').textContent = '正在等待模型回复……';
  try {
    const reply = await requestChat(draft, [{role:'user', content:'连接测试，请只回复“收到”。'}], undefined, request.signal);
    if (testRequest === request) el('cfgStatus').textContent = '连接成功，模型回复：' + reply.slice(0,100);
  } catch (err) {
    if (testRequest === request) el('cfgStatus').textContent = err.message;
  } finally {
    if (testRequest === request) {
      testRequest = undefined;
      el('testConnection').disabled = false;
    }
  }
};
el('forget').onclick=()=>{store.removeItem(configKey);config={};forgetContext();el('config').close();status('模型配置和已保存的密钥已清除。');};

function paintTurn(row){
  const user=row.role==='user';
  const line=el('chatRow').content.firstElementChild.cloneNode(true);
  line.classList.add(user?'user':'cat');
  const avatar=line.querySelector('svg');
  avatar.setAttribute('aria-label',user?'你':room.profile.name);
  avatar.querySelector('use').setAttribute('href',user?'#avatar-user':'#avatar-cat');
  line.querySelector('.chatBubble').textContent=row.content;
  el('history').append(line);
}
function renderTranscript(){
  const h=el('history');
  h.replaceChildren();
  if(room.transcript.length){
    for(const row of room.transcript)paintTurn(row);
  }else{
    paintTurn({role:'assistant',content:'喵。要来窗边坐一会儿吗？'});
  }
  h.scrollTop=h.scrollHeight;
}
function appendTurn(role,content,meta={}){
  if(role==='user')guideDid('message',2500);
  const row={role,content,time:Date.now(),...meta};room.transcript.push(row);
  if(room.transcript.length>400){room.transcript.shift();renderTranscript();}
  else if(room.transcript.length===1)renderTranscript();
  else{paintTurn(row);const h=el('history');h.scrollTop=h.scrollHeight;}
}
function safetyExchange(content,reply){
  appendTurn('user',content,{localOnly:true});
  appendTurn('assistant',reply,{localOnly:true,safetyPending:awaitingSafety});saveRoom();
}
async function requestChat(settings, turns, companion, signal, path='/chat') {
  const res = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...settings, companion, messages:turns}), signal});
  const data = await res.json();
  if (!res.ok || !data.reply?.trim()) throw Error(data.error || '模型没有返回回复正文。');
  return data.reply;
}
const composer=el('message');
let composing=false;
composer.addEventListener('compositionstart',()=>{composing=true;});
composer.addEventListener('compositionend',()=>{composing=false;});
composer.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.altKey||e.metaKey||e.isComposing||composing||e.keyCode===229)return;
  e.preventDefault();
  if(!e.repeat && !el('send').disabled && composer.value.trim())composer.form.requestSubmit(el('send'));
});
el('chat').querySelector('form').onsubmit=async e=>{
  e.preventDefault();
  const content=el('message').value.trim();
  if(!content || el('send').disabled) return;
  const tone=conversationMode(content);
  if(awaitingSafety && /^(?:不安全|没有|还没有|有危险|是的|不能保证)[。！!\s]*$/.test(content)){
    safetyExchange(content,'请现在就叫身边的人过来，或联系当地急救。如果说不出口，可以把“我现在不安全，请来陪我”发给一个能马上找到你的人。');el('message').value='';return;
  }
  if(awaitingSafety && /^(?:安全|我安全了|现在安全了|已经安全了|有人陪我了)[。！!\s]*$/.test(content)){
    awaitingSafety=false;safetyExchange(content,'谢谢你告诉我。可以请对方再陪你一会儿；你愿意说的话，我也会听。');el('message').value='';return;
  }
  awaitingSafety=false;
  if(tone==='安全支持'){
    awaitingSafety=true;
    safetyExchange(content,'谢谢你告诉我。你现在安全吗？如果你可能马上伤害自己，请先离开危险物品，到有人的地方，联系当地急救或让身边可信任的人现在过来陪你。');el('message').value='';return;
  }
  if(!config.key){settings();el('cfgStatus').textContent='先配置模型，回来就能发送刚写的话。';return;}
  forgetContext();
  const previousMood=currentMood(), previousActivity=mode;
  el('send').disabled=true;el('message').readOnly=true;el('chatStatus').textContent=room.profile.name+'在听……';move('door','listen');idle();
  try {
    const version=chatVersion;
    const turn={role:'user',content};
    const notes = await relevantNotes(content);
    if(version!==chatVersion) throw Error('记忆或配置已更改，请重新发送。');
    const events=room.memories.filter(m=>available(m) && ['feed','pet','play','plant','discovery'].includes(m.type)).slice(-3);
    const privateTurn=/别记|不要记|不用记|别保存|不要保存/.test(content);
    const clauses=privateTurn?[]:content.match(/[^。！？!?；;\n]+[。！？!?；;]?/g)||[];
    const liveNotes=room.memories.filter(available);
    const recent=room.transcript.filter(row=>!row.localOnly).slice(-6);
    const referenced=new Set(recent.flatMap(row=>row.refs || []));
    const raceFacts=new Map(liveNotes.filter(m=>m.race && (referenced.has(m.id) || notes.includes(m))).map(m=>[m.id,m.text]));
    for(const clause of clauses){
      const update=raceRevision(clause,liveNotes,room.transcript,Date.now());
      if(update)raceFacts.set(update.target.id,update.text);
    }
    const memories = [...notes,...events].map(m=>({date:new Date(m.time).toLocaleDateString(),type:m.type,text:(raceFacts.get(m.id) || m.text).slice(0,400)}));
    const plant=room.plant;
    const garden=plant && {名字:plant.name,种类:plant.kind,阶段:phaseOf(plant,plantStage(plant,calendarDay()))};
    const {relation,kg}=bodyProfile(room,Date.now());
    const reply = await requestChat(config, [...recent.map(({role,content})=>({role,content})),turn], {...growth(), name:room.profile.name, activity:previousActivity,mood:previousMood,关系阶段:relation,模拟体重公斤:kg,conversation:tone, memories,书架盆栽:garden,最新赛事情况:[...raceFacts.values()]});
    if(version!==chatVersion) throw Error('记忆或配置已更改，请重新发送。');
    milestone('chat','第一次坐下来聊天');if(tone==='倾听')milestone('confide','第一次认真听你倾诉');const refs=[];
    for(const clause of clauses){
      const now=Date.now();
      const revision=raceRevision(clause,room.memories.filter(available),room.transcript,now);
      if(revision){
        const {target,race,text}=revision;
        if(target.text!==text){
          Object.assign(target,{race,text,time:now,source:'用户更新',revisionSeen:false});
          delete target.askedAt;
          delete target.preparedAt;
        }
        refs.push(target.id);
        continue;
      }
      for(const n of candidates(clause)){
        remember('chat',n.text,now,n.category);
        const m=room.memories.findLast(m=>m.type==='chat' && m.text===n.text);
        if(m)refs.push(m.id);
      }
    }
    appendTurn('user',content,{refs});
    recordCompany(room.company,'chat',Date.now());
    appendTurn('assistant',reply,{refs:[...new Set([...refs,...notes.map(m=>m.id),...events.map(m=>m.id),...recent.flatMap(m=>m.refs||[])])]});
    saveRoom();renderJournal();
    el('message').value='';el('chatStatus').textContent='';
  } catch(err) {el('chatStatus').textContent=err.message || '暂时无法连接';}
  finally {el('send').disabled=false;el('message').readOnly=false;}
};

const profileForm=el('profile').querySelector('form');
function currentMood(){
  const recent=room.lastFeeling;
  const elapsed=recent?Date.now()-recent.time:Infinity;
  const lingering=elapsed>=0 && elapsed<(recent?.pose==='startled'?60000:5*minute);
  const pose=lingering && ['idle','listen','greet'].includes(arrival)?recent.pose:arrival;
  return pose==='knead'?'放松':moodFor(pose);
}
function drawProfileStats(){
  const {kg,delta,bond,relation}=bodyProfile(room,Date.now());
  el('profileMood').textContent=currentMood();
  el('profileBond').textContent=relation;
  el('bondScore').textContent=bond+' / 100';
  el('profileWeight').textContent=kg.toFixed(1)+' kg';
  el('weightChange').textContent=delta===null?'初次称重':delta===0?'与昨天持平':'比昨天'+(delta>0?'重':'轻')+Math.abs(delta).toFixed(1)+' kg';
}
function profileView(){
  const p=room.profile;
  el('catName').value=p.name;
  el('semantic').checked=!!p.semantic;
  el('proactive').checked=p.proactive;
  el('sound').checked=p.sound;
  el('quietStart').value=p.start;
  el('quietEnd').value=p.end;
  const mostPlayed=room.toys[favoriteToy(room.toys)];
  const favorites=Object.keys(toyNames).filter(id=>mostPlayed && room.toys[id]===mostPlayed);
  const likes=favorites.length?'最常玩'+favorites.map(id=>toyNames[id]).join('、'):'还在探索玩具';
  el('traits').textContent='橘色虎斑，喜欢晒太阳，也爱钻纸箱。'+likes+'。';
  drawProfileStats();
  el('profile').showModal();
}
el('openProfile').onclick=profileView;

profileForm.onsubmit=e=>{
  e.preventDefault();
  const name=el('catName').value.trim();
  if(!name){el('catName').focus();return;}
  room.profile={semantic:el('semantic').checked,since:el('proactive').checked?(room.profile.proactive?room.profile.since:Date.now()):null,name,proactive:el('proactive').checked,sound:el('sound').checked,start:el('quietStart').value,end:el('quietEnd').value};
  growth();saveRoom();el('profile').close();
};
el('openDiary').onclick=openDiary;
let gripY=null,suppressGripClick=false;
el('drawerGrip').onpointerdown=e=>{gripY=e.clientY;suppressGripClick=false;e.currentTarget.setPointerCapture(e.pointerId);};
el('drawerGrip').onpointercancel=()=>{gripY=null;};
el('drawerGrip').onpointerup=e=>{
  if(gripY!==null && Math.abs(e.clientY-gripY)>22){
    suppressGripClick=true;
    if((e.clientY>gripY)!==el('chat').hidden)el('toggleChat').click();
  }
  gripY=null;
};
el('drawerGrip').onclick=e=>{if(!suppressGripClick||e.detail===0)el('toggleChat').click();suppressGripClick=false;};
el('toggleChat').onclick=()=>{
  const hidden=!el('chat').hidden;
  el('chat').hidden=hidden;
  el('toggleChat').setAttribute('aria-expanded',String(!hidden));
  for(const id of ['toggleChat','drawerGrip']){
    const button=el(id);
    button.setAttribute('aria-expanded',String(!hidden));
    (button.querySelector('span') || button).textContent=hidden?'展开聊天':'收起聊天';
  }
};
el('exportData').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(room,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='我的橘猫小屋存档.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
el('clearData').onclick=()=>{
  if(!confirm('清除本浏览器中的聊天记录、猫咪档案、回忆、日记和模型配置？此操作无法撤销。'))return;
  store.removeItem(roomKey);store.removeItem(configKey);location.reload();
};

// Each lesson advances on a completed room action or the last frame of its demo.
const lessons=[
  {title:'和它打个招呼',target:'cat',action:'摸摸它',text:'点一下虚线框里的猫咪，看看它的反应。也可以顺着背慢慢滑动，留意它是蹭过来还是想歇一会儿。'},
  {title:'陪它吃饭',target:'bowl',action:'添一次粮',text:'点地板右边的食碗，看它走过去吃饭。刚吃过时它会告诉你已经饱了。你离开时，它饿了也会自己来。'},
  {title:'挥动羽毛棒',target:'wand',action:'示范挥一下',text:'用鼠标左键按住地毯上的羽毛棒，沿地毯慢慢拖动，猫咪就会跟着追。松开鼠标，看它扑向羽毛。也可以直接点一下羽毛棒。'},
  {title:'追光点',target:'light',text:'点一下虚线框里的小光斑，看猫咪追过去，用前爪扑住它。'},
  {title:'滚球线团',target:'yarn',text:'点一下虚线框里的粉色线团，把它滚给猫咪。留意它伸爪拨球时，线团往哪边滚。'},
  {title:'翻玩具篮',target:'basket',action:'打开玩具篮',text:'点右边的篮子，选发条鼠、弹簧蝴蝶或抓板。玩具落地后可以再点。选软毛刷，就能给它梳毛。'},
  {title:'小屋里的一天',target:'nest',action:'拍拍猫窝',text:'点帐篷猫窝邀它休息。平时它也会自己吃饭、打盹或看窗外；窗景随北京时间变换。离开后回来，小屋会补算这段时间的日常。'},
  {title:'称重与成长',target:'scale',action:'让它上秤',text:'点地毯前沿的小木秤，等它站稳再读数。第一次建立基准，以后会和上一次实际称重比较。'},
  {title:'了解你的伙伴',target:'openProfile',action:'查看猫咪档案',text:'档案里能改名，查看心情、亲密度、成长体重和偏爱的玩具。相伴第 7 天进入少年期，第 30 天进入成年期。不同种类的陪伴会增加亲密度。这里还能开关呼噜声、自主日记和回访来信，并设置安静时段。'},
  {title:'一起种盆栽',target:'plantPot',action:'看看书架上的花盆',text:'点书架上的盆栽，从 12 种植物里选种、取名。种下当天会冒芽，详情里能浇水、看成熟进度。你离开时猫咪偶尔也会照看它；成熟后可以种下一盆。'},
  {title:'看植物长大',plantDemo:true,target:'plantPot',action:'演示生长过程',text:'选一种植物，点演示或点书架上的花盆，看嫩芽一天一天长大。成熟后换个品种，就能比较它们的花、叶和果实。'},
  {title:'跟猫咪找线索',clueDemo:true,action:'看看线索',text:'点击小屋里用亮色虚线圈出的线索。有时是书架底下的发条鼠，有时是纸箱旁的叶子。今天的线索已经看过时，可以点示例再练一次。'},
  {title:'收到玩耍邀请',example:['三个不同的傍晚，你都跟猫咪玩过，其中两天选了弹簧蝴蝶。','又到差不多的时间，它走到弹簧蝴蝶旁等你。点玩具回应，或继续忙自己的事。'],action:'演示玩耍邀请',text:'过去 28 天里，在三个不同日期的相近时刻一起玩过，猫咪就可能记住这个习惯。它会在空闲时找来那个时段最常玩的玩具，每天最多邀请一次。'},
  {title:'连接聊天模型',target:'settings',action:'打开模型设置',text:'填入服务商的 API 地址、模型名和密钥，先点「测试连接」，成功后保存。「记住密钥」会以明文保存在这个浏览器，请在自己的设备上选择。'},
  {title:'聊天与倾诉',target:'message',example:['你：今天排练时我有点紧张。','猫咪：我在这儿。是等着上场的那一刻最紧张，还是开口以后？'],action:'看聊天示例',text:'在右侧输入框写下想说的话，按 Enter 发送，Shift+Enter 换行。重新进屋能看到聊天历史。顶部可以收起或展开聊天。下面的示例无需密钥，也不会写入你的聊天记录。'},
  {title:'记忆与回访',returnDemo:true,example:['你：我明天要参加编程比赛。猫咪会自动收录这个安排。','你：其实是室友参赛，比赛也改期了。猫咪会更新这段记忆。','下次回屋，它会按最新情况接话。已取消的安排不会再当作即将发生。'],action:'演示记忆更新',text:'在档案里开启回访来信，猫咪回屋时就有机会接着上次的话题聊。可在档案里开启语义查找。想亲自试试，打开独立回访演示，再点「模拟重新进屋」。'},
  {title:'翻日记，看足迹',target:'book',also:['memoryFrame'],action:'翻开日记',text:'点桌上的日记本，按日期翻看猫咪自己的一天。点墙上的相框或「相伴足迹」，看第一次见面、第一次玩耍等共同节点。开启自主日记后，离开的日子也会留下记录。'},
  {title:'管理小屋数据',target:'settings',also:['openDiary','book'],action:'查看设置与隐私',text:'在「日记 → 管理记录」里可以逐条忘记。设置下方展开「本机数据」可导出存档或清空本机数据。导出不含密钥。以后随时点顶部「使用教程」重看。'}
];
for(const [i,lesson] of lessons.entries())el('guideIndex').add(new Option(lesson.title,String(i)));
for(const kind of Object.keys(seeds))el('guideKind').add(new Option(kind,kind));
let exampleFrame=0,shownStep=null;
let advanceTimer,shadeFrame;
const visitedPages=new Set();
function advanceGuide(){
  const next=room.tour.step+1;
  setGuide(next<lessons.length?next:0,next<lessons.length);
}
function afterLesson(delay=800){
  clearTimeout(advanceTimer);
  const step=shownStep;
  function advanceWhenVisible(){
    if(!room.tour?.active || room.tour.step!==step)return;
    if(document.hidden || document.querySelector('dialog[open]')){
      advanceTimer=setTimeout(advanceWhenVisible,500);
    }else advanceGuide();
  }
  advanceTimer=setTimeout(advanceWhenVisible,delay);
}
function guideDid(action,delay){
  if(!room.tour?.active || demo)return;
  const lesson=lessons[room.tour.step];
  const required={basket:'basketItem',openProfile:'profile',plantPot:'garden',settings:'savedConfig'};
  if(!lesson || lesson.plantDemo || lesson.also || !action)return;
  if(action===(required[lesson.target] || lesson.target))afterLesson(delay);
}
// A separate cutout keeps each target bright, including objects painted into the backdrop.
function paintGuideShade(){
  const panel=el('guide'),shade=el('guideShade');
  shade.toggleAttribute('hidden',panel.hidden);
  if(panel.hidden)return;
  const holes=el('guideHoles');
  const targets=[panel,...document.querySelectorAll('.guideTarget:not([hidden])')];
  if(document.querySelector('.scene .guideTarget'))targets.push(el('feedback'));
  for(const [index,target] of targets.entries()){
    let hole=holes.children[index];
    if(!hole){
      hole=document.createElementNS('http://www.w3.org/2000/svg','rect');
      hole.setAttribute('rx','8');holes.append(hole);
    }
    const rect=target.getBoundingClientRect(),pad=target===panel?2:8;
    for(const [key,value] of Object.entries({x:rect.x-pad,y:rect.y-pad,width:rect.width+2*pad,height:rect.height+2*pad})){
      const pixels=String(Math.round(value));
      if(hole.getAttribute(key)!==pixels)hole.setAttribute(key,pixels);
    }
  }
  while(holes.children.length>targets.length)holes.lastElementChild.remove();
  shadeFrame=requestAnimationFrame(paintGuideShade);
}
for(const dialog of document.querySelectorAll('dialog')){
  dialog.addEventListener('close',()=>{
    if(!room.tour?.active)return;
    const lesson=lessons[room.tour.step];
    if(dialog.id==='profile' || (dialog.id==='garden' && room.plant))guideDid(dialog.id);
    if(dialog.id==='discovery' && lesson.clueDemo && room.discovery?.done)afterLesson();
    if(lesson.target==='book' && ['diary','moments'].includes(dialog.id)){
      visitedPages.add(dialog.id);
      if(visitedPages.size===2)afterLesson();
      else el('guideText').textContent=dialog.id==='diary'?'再点墙上的相框，看看你们一路走过的相伴足迹。':'再点桌上的日记本，翻一翻猫咪自己的一天。';
    }
    if(lesson.also?.includes('openDiary') && (dialog.id==='records' || dialog.id==='config' && el('config').querySelector('.dataTools').open))afterLesson();
  });
}
const previewDays=[1,2,4,7];
function renderPlantExample(stage){
  plantPreview={kind:el('guideKind').value,stage};
  drawPlant();
  const box=el('guideExample');box.hidden=false;
  box.textContent='示例 · '+plantPreview.kind+' · 第 '+previewDays[stage]+' 天 · '+phaseOf(plantPreview,stage);
  el('tryGuide').textContent=stage===3?'重新播种演示':'继续生长';
  clearTimeout(advanceTimer);
  if(stage===3)afterLesson(6000);
}
el('guideKind').onchange=()=>renderPlantExample(plantPreview?.stage ?? 0);
el('guideClue').onclick=()=>{
  const box=el('guideExample');box.hidden=false;
  box.textContent='示例 · '+(exampleFrame++%2===0?discoveries.mouse.story:discoveries.mouse.help);
  afterLesson(4500);
};
function drawGuide(){
  const tour=room.tour,active=tour?.active===true && !demo;
  // The original guide stored a numeric position and went straight from the wand to the basket.
  if(tour && !tour.version){
    if(tour.step>=3)tour.step+=2;
    tour.version=2;saveRoom();
  }
  el('guide').hidden=!active;
  el('openGuide').setAttribute('aria-expanded',String(active));
  document.querySelectorAll('.guideTarget').forEach(target=>target.classList.remove('guideTarget'));
  const current=active?lessons[tour.step]:null;
  el('guide').toggleAttribute('data-clues',!!current?.clueDemo);
  drawClue();
  el('guideSpecies').hidden=!current?.plantDemo;
  if(!current?.plantDemo && plantPreview){plantPreview=null;drawPlant();}
  cancelAnimationFrame(shadeFrame);
  if(!active){shownStep=null;clearTimeout(advanceTimer);el('guideShade').setAttribute('hidden','');return;}
  const index=tour.step,lesson=lessons[index];
  if(shownStep!==index){
    clearTimeout(advanceTimer);visitedPages.clear();
    exampleFrame=0;el('guideExample').hidden=true;
    el('guideExample').textContent='';shownStep=index;
    el('tryGuide').textContent=lesson.action || '';
    if(lesson.plantDemo){
      el('guideKind').value=room.plant?.kind || '向日葵';
      renderPlantExample(0);
    }
  }
  el('guideCount').textContent=(index+1)+' / '+lessons.length;
  el('guideIndex').value=String(index);
  el('guideText').textContent=lesson.text;
  el('prevGuide').disabled=index===0;
  el('nextGuide').textContent=index===lessons.length-1?'学完，回到小屋':lessons[index+1]?.plantDemo?'演示生长过程 →':'下一步';
  el('returnExample').hidden=!lesson.returnDemo;
  el('tryGuide').hidden=!(lesson.example || lesson.plantDemo);
  if(lesson.target)el(lesson.target).classList.add('guideTarget');
  if(lesson.example)el('tryGuide').classList.add('guideTarget');
  for(const id of lesson.also || [])el(id).classList.add('guideTarget');
  paintGuideShade();
}
function setGuide(step,active=true){
  room.tour={step,active,version:2};saveRoom();drawGuide();
  if(active && lessons[step].target==='message' && el('chat').hidden)el('toggleChat').click();
  if(!active)el('openGuide').focus();
}
el('openGuide').onclick=()=>setGuide(room.tour?.step || 0,!room.tour?.active);
el('pauseGuide').onclick=()=>setGuide(room.tour.step,false);
el('guideIndex').onchange=e=>setGuide(Number(e.target.value));
el('prevGuide').onclick=()=>setGuide(room.tour.step-1);
el('nextGuide').onclick=advanceGuide;
el('returnExample').addEventListener('click',()=>afterLesson());
el('tryGuide').onclick=()=>{
  const lesson=lessons[room.tour.step];
  if(lesson.plantDemo){
    const stage=(plantPreview.stage+1)%4;
    renderPlantExample(stage);
  }else if(lesson.clueDemo){
    el(el('oddity').hidden?'guideClue':'oddity').click();
  }else if(lesson.example){
    clearTimeout(advanceTimer);
    const box=el('guideExample');box.hidden=false;
    box.textContent='示例 · '+lesson.example[exampleFrame++];
    if(exampleFrame===lesson.example.length){exampleFrame=0;afterLesson(5000);}
    el('tryGuide').textContent=exampleFrame?'继续演示':'重看演示';
  }else el(lesson.target).click();
};

el('adoption').oncancel=e=>e.preventDefault();
el('adoptForm').onsubmit=e=>{
  e.preventDefault();
  const input=el('adoptName'),name=input.value.trim();
  if(!name){input.setCustomValidity('给它起个名字再一起回家吧。');input.reportValidity();return;}
  const now=Date.now();
  room.adoptionPending=false;room.profile.name=name;
  room.profile.proactive=el('adoptLetters').checked;
  room.profile.since=room.profile.proactive?now:null;
  room.adoptedDay=calendarDay(now);room.livedUntil=room.restedAt=now;room.lastMeal=now-60*minute;
  room.company.latestDay=room.adoptedDay;
  room.milestones.met={time:now,text:'第一次见面'};
  const startTutorial=e.submitter?.value!=='skip';
  el('adoption').close();advance(now,true);setGuide(0,startTutorial);
  if(startTutorial)el('cat').focus({preventScroll:true});
};
el('adoptName').oninput=e=>e.target.setCustomValidity('');
if(demo){
  el('openGuide').hidden=true;
  const panel=document.createElement('aside');panel.className='demoPanel';
  const info=document.createElement('span'), next=document.createElement('button'),home=document.createElement('a');
  info.textContent=room.demoDay===1?'示例记忆：我明天要参加编程比赛。':'同一天 · 再次进屋';
  next.textContent=room.demoDay===1?'模拟重新进屋':'重新体验';
  next.onclick=()=>{if(room.demoDay===1){room.demoDay=2;saveRoom();}else store.removeItem(roomKey);location.reload();};
  home.href='/';home.textContent='进入我的小屋';home.onclick=e=>{e.preventDefault();history.replaceState(null,'','/');location.reload();};
  panel.append(info,next,home);document.querySelector('main').prepend(panel);
}else if(room.adoptionPending){
  saveRoom();el('adoption').showModal();el('adoptName').select();
}else drawGuide();
