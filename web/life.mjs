export const dayMs = 86400000;
export function calendarDay(time = Date.now()) {
  const d = new Date(time);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / dayMs;
}
export function ageAt(room,time) {
  const days = Math.max(1, calendarDay(time) - room.adoptedDay + 1);
  const stage = days >= 30 ? '成年猫' : days >= 7 ? '少年猫' : '幼猫';
  return {stage,days};
}
const bondActions=new Set(['pet','feed','play','brush','nest','chat','garden','discovery']);

// Keep the lifetime score when old memories expire, but retain only recent daily activity.
export function recordCompany(stats,action,time){
  if(!bondActions.has(action))return;
  const day=calendarDay(time);
  if(day<stats.latestDay)return;
  if(day>stats.latestDay){
    stats.latestDay=day;
    for(const key of Object.keys(stats.days))if(Number(key)<day-8)delete stats.days[key];
  }
  const actions=stats.days[day]??=[];
  if(actions.includes(action))return;
  if(actions.length<3)stats.bond=Math.min(100,stats.bond+2);
  actions.push(action);
}

export function restoreCompany(room){
  if(room.company)return room.company;
  const stats={bond:0,days:{},latestDay:room.adoptedDay};
  const history=room.memories.filter(m=>m.state==='confirmed' && !room.deleted?.[m.id]);
  const chats=(room.transcript||[]).filter(row=>row.role==='user' && !row.localOnly)
    .map(row=>({type:'chat',time:row.time}));
  for(const entry of [...history,...chats].sort((a,b)=>a.time-b.time)){
    recordCompany(stats,entry.type,entry.time);
  }
  room.company=stats;
  return stats;
}

export function bodyProfile(room,time){
  const stats=restoreCompany(room),today=calendarDay(time);
  const days=ageAt(room,time).days;
  // Fictional growth curve on the room's accelerated calendar, measured once per day.
  const adultKg=4.1+((room.seed||0)%5)*0.1;
  function weight(day,age){
    let balance=0;
    for(let back=1;back<=7;back++){
      const actions=stats.days[day-back]||[];
      balance+=Number(actions.includes('feed'))-Number(actions.includes('play'));
    }
    return Math.round((1.1+(adultKg-1.1)*(1-Math.exp(-(age-1)/13))+balance*0.02)*10)/10;
  }
  const kg=weight(today,days);
  const delta=days===1?null:Math.round((kg-weight(today-1,days-1))*10)/10;
  const bond=stats.bond;
  const relation=bond>=80?'亲密伙伴':bond>=50?'默契伙伴':bond>=20?'亲近':bond>=6?'渐渐熟悉':'初识';
  return {kg,delta,bond,relation};
}
// Overlay a shelf visit on a free daytime activity, never on a meal or a nap.
// Both a live tick and a replayed half-hour use the same daily opportunity.
export function tendPlant(plant,seed,time,activityType){
  if(!plant || !['explore','watch','patrol','sun','groom'].includes(activityType))return;
  const day=calendarDay(time), slot=day+(seed>>>0), hour=new Date(time).getHours();
  if(day<plant.sown || time<(plant.sownAt||0) || day<= (plant.lastCareDay??-Infinity) ||
    slot%3===0 || hour<9+slot%6 || hour>=19)return;
  const water=day-(plant.lastWater??plant.sown)>=2;
  if(water){plant.lastWater=day;plant.waterDays=(plant.waterDays||0)+1;}
  plant.lastCareDay=day;plant.lastCareAt=time;plant.lastCare=water?'water':'watch';
  return water?'我在书架旁闻了闻干土，用爪子碰了碰滴水瓶，让水珠落进盆里。':'我踮起脚看了看花盆。土还是润的，就在书架旁坐了一会儿。';
}
export const toyNames={wand:'羽毛棒',yarn:'毛线球',light:'光点',mouse:'发条鼠',butterfly:'弹簧蝴蝶',scratch:'瓦楞抓板'};
const legacyToyWords={wand:'羽毛',yarn:'线团',light:'光点',mouse:'发条鼠',butterfly:'弹簧',scratch:'瓦楞'};
const minuteOfDay=time=>new Date(time).getHours()*60+new Date(time).getMinutes();
export function notePlayTime(memory,toy,time){
  memory.toy=toy;
  memory.playMinutes??=[minuteOfDay(memory.time)];
  const minute=minuteOfDay(time);
  if(!memory.playMinutes.some(n=>Math.floor(n/15)===Math.floor(minute/15)))memory.playMinutes.push(minute);
}

// Count separate days rather than clicks. Forgetting a play memory removes its evidence.
export function usualPlayToy(memories,now){
  const today=calendarDay(now), minute=minuteOfDay(now);
  const days=new Set(), votes=new Map();
  for(const m of memories){
    if(m.type!=='play' || m.state!=='confirmed' || m.time>now)continue;
    const day=calendarDay(m.time);
    if(today-day>28)continue;
    const near=(m.playMinutes||[minuteOfDay(m.time)]).some(n=>{
      const gap=Math.abs(n-minute);
      return Math.min(gap,1440-gap)<=30;
    });
    if(!near)continue;
    if(day===today)return null;
    const toy=m.toy || Object.keys(legacyToyWords).find(id=>m.text?.includes(legacyToyWords[id]));
    if(!toyNames[toy])continue;
    days.add(day);
    if(!votes.has(toy))votes.set(toy,new Set());
    votes.get(toy).add(day);
  }
  if(days.size<3)return null;
  return [...votes].sort(([,a],[,b])=>b.size-a.size || Math.max(...b)-Math.max(...a))[0][0];
}
export function favoriteToy(counts={}){
  return Object.keys(toyNames).filter(id=>counts[id]>0).sort((a,b)=>counts[b]-counts[a])[0];
}
const minute=60000;
export function chooseLife(room,time) {
  const {stage}=ageAt(room,time);
  const young=stage==='幼猫';
  const hour=new Date(time).getHours();
  const past=room.memories.filter(m=>m.time<=time && m.state!=='pending');
  const wasFed=past.some(m=>m.type==='feed');
  const lastGame=past.findLast(m=>m.type==='play');
  if(time-room.lastMeal >= (young?3:5)*60*minute){
    room.lastMeal=time;
    return ['bowl','吃饭',wasFed?'我认得你添粮时碗沿的轻响。今天自己走到那儿，慢慢嚼完了几颗。':'肚子咕噜了一声。我绕过地毯，在碗底挑了一颗最脆的粮。','meal'];
  }
  const afterPlay=room.playCount>=3 && room.lastPlay>room.restedAt && time>=room.lastPlay && time-room.lastPlay<5*minute;
  if(afterPlay){
    room.restedAt=time;
    room.sleepUntil=time+minute;
    room.bedUntil=room.sleepUntil;
  }
  if(hour<7 || hour>=22 || time<(room.sleepUntil||0) || time-room.restedAt >= (young?75:150)*minute){
    if(time>=(room.sleepUntil||0)) {room.restedAt=time;room.sleepUntil=time+(young?35:25)*minute;}
    const restSlot=Math.floor(room.restedAt/(30*minute));
    if(time<(room.bedUntil||0) || (restSlot+(room.seed??0))%3!==0)return ['bed','猫窝打盹','我伸着懒腰钻进猫窝，转了两圈，把四只爪子藏进软垫。','nap'];
    return ['window','窗台睡觉',young?'窗台刚好够我蜷成一小团。我把鼻尖埋进尾巴，连鸟叫都听得模模糊糊。':'我把前爪叠在窗沿上，找到了最暖的那块木头，睡了一觉。','nap'];
  }
  const favorite=favoriteToy(room.toys);
  if(lastGame && hour%2===0 && ['mouse','butterfly','scratch'].includes(favorite))
    return ['basket','翻玩具篮','我用鼻尖顶开篮边的布，找到了最常玩的'+toyNames[favorite]+'。','explore'];
  if(lastGame && hour%2===0 && (room.toys?.light||0)>Math.max(room.toys?.yarn||0,room.toys?.wand||0))return ['light','追地毯上的光点','我盯住地毯上的亮斑，两只前爪齐齐落下，小亮斑又溜了出去。','explore'];
  if(lastGame && (young || stage==='少年猫') && hour%2===0 && (room.toys?.yarn>room.toys?.wand || (room.toys?.yarn===room.toys?.wand && lastGame.text.includes('线团'))))
    return ['yarn','找线团','我绕到地毯的另一头，找到上次和你玩过的线团，拨了它一下。','explore'];
  if(lastGame && (young || stage==='少年猫') && hour%2===0)
    return ['rug','找羽毛','地毯边露出一截羽毛。我想起上次陪你玩的样子，用爪尖轻轻拨了两下。','explore'];
  const seed=((room.seed??room.adoptedDay)>>>0)+calendarDay(time);
  if(hour>=17 && hour<21 && seed%2===0) return ['box','探纸箱','我把前爪搭在箱沿，钻进去转了一圈。从里面看，小屋像换了个样子。','explore'];
  if(hour>=10 && hour<15 && hour!==12 && seed%2===0) return ['window','晒太阳','我在窗边挑了块暖木板，摊开前爪，让阳光慢慢爬过背上的条纹。','sun'];
  if(hour<10) return ['rug','巡视小屋','我伸长了前爪，沿着地毯巡视了一圈。','patrol'];
  if(hour>=17 && hour<21) return ['yarn','探索玩具篮','我把玩具篮嗅了一圈，在角落里发现一截毛线。','explore'];
  if(hour===12) return ['window','梳理毛发','我用爪背擦了擦脸，在窗边把胸前的毛一根根理顺。','groom'];
  const morning=[
    '早上的光落在地毯上。我盯着那块亮斑，看它一点点爬过木地板。',
    '窗框的影子横过前爪。我往前挪了一点，四只爪子就都晒到了。',
    '有只小鸟落在窗外。我蹲得很低，尾巴尖却偷偷动了。'
  ];
  const afternoon=[
    '我从窗边踱回地毯。外头有片叶子翻了个身，我的耳朵也跟着转了一下。',
    '地毯角翘起来了。我伸手压平它，一松爪，它又站了起来。',
    '下午屋里静悄悄的。我趴在地板上听了一会儿，最响的居然是自己的呼噜。'
  ];
  const observations=hour<12?morning:afternoon;
  return ['rug','看窗外',observations[seed%observations.length],'watch'];
}

export function replay(room,now) {
  const step=30*minute;
  const start=Math.max(room.livedUntil,now-7*dayMs);
  const events=[];
  for(let time=(Math.floor(start/step)+1)*step;time<=now;time+=step){
    const [,activity,text,type]=chooseLife(room,time);
    events.push({time,activity,text,type});
  }
  return {lastMeal:room.lastMeal,restedAt:room.restedAt,sleepUntil:room.sleepUntil||0,bedUntil:room.bedUntil||0,events};
}


