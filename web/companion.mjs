import {calendarDay} from './life.mjs';

export function conversationMode(text) {
  const clauses=text.split(/[，。！？；\n]/);
  if(clauses.some(s=>!/(?:他说|她说|台词|小说里|电影里|不再想|以前想|曾经想|没有想过|并不想|不打算|不准备)/.test(s) &&
    /(?:我(?:现在|真的|马上|已经|有点|越来越|快要|就要|很|就|今晚|今天|一下子)*(?:不想活了?|想死|(?:想|要|准备|打算|决定|计划)(?:马上|去|要|直接)*(?:自杀|跳楼|跳桥|自残|割腕|伤害自己|结束(?:自己的)?生命))|^(?:不想活了|想自杀|想结束生命))/.test(s)))return '安全支持';
  if(/给.*建议|该怎么办|有什么办法|帮我想|怎么做|给.*主意/.test(text))return '请求建议';
  if(/难过|委屈|烦恼|压力|伤心|焦虑|紧张|害怕|好累|很累|失落|孤单|不开心|听我说/.test(text))return '倾听';
  if(/开心|好消息|高兴|获奖|太棒了/.test(text))return '分享喜悦';
  return '闲聊';
}

// Extract only verbatim declarative clauses. Never invent a predicate or promote
// a question, a hypothetical, or someone else's preference into a user fact.
export function candidates(text) {
  if(conversationMode(text)==='安全支持'||/别记|不要记|不用记|别保存|不要保存/.test(text))return [];
  const notes=[];
  for(const part of text.match(/[^。！？!?；;\n]+[。！？!?；;]?/g)||[]){
    const s=part.trim();
    if(!s || /[？?]|[吗呢][。！!]?\s*$|要是|如果|假如|是不是|你记得|(?:他|她|别人|朋友|家人|同学|姐姐|哥哥|妈妈|爸爸|有人)说|没(?:有)?说过|你觉得|能不能|怎么办|怎么样/.test(s))continue;
    const category=/生日|纪念日/.test(s)?'重要日期':
      /我(?:最|很|特别|更|不太|不)?(?:喜欢|爱吃|爱听|偏爱|讨厌)|我最爱/.test(s)?'偏好':
      /(?:我|我们|今天|明天|后天|下周|昨天|刚刚|下个月).*(?:比赛|考试|聚会|演出|面试|答辩|旅行|开学|毕业|汇报|搬家|准备|打算|计划|参加|一起|去了|完成|通过|见到|收到)|^我要去/.test(s)?'事件':
      /我.*(?:难过|焦虑|高兴|开心|失落|委屈|害怕|压力|紧张|烦恼|好累|很累)/.test(s)?'心事':null;
    if(category && !notes.some(n=>n.text===s))notes.push({category,text:s});
  }
  return notes.slice(0,4);
}

export function explicitDate(text,at) {
  const m=text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]/);
  if(!m)return null;
  const now=new Date(at);
  let year=Number(m[1])||now.getFullYear();
  const make=y=>new Date(y,Number(m[2])-1,Number(m[3]),12);
  let d=make(year);
  if(!m[1] && calendarDay(d)<calendarDay(now))d=make(++year);
  return d.getMonth()===Number(m[2])-1 && d.getDate()===Number(m[3])?calendarDay(d):null;
}

export function eventDay(text,at){
  const absolute=explicitDate(text,at);
  if(absolute!==null)return absolute;
  const day=calendarDay(at);
  const when=text.match(/大后天|后天|明[天早晚]|今[天晚]|(?:下下|下|本|这)(?:周|星期)[一二三四五六日天]?|(?:周|星期)[一二三四五六日天]/u)?.[0];
  if(!when)return null;
  if(/周|星期/.test(when)){
    const monday=day-(new Date(at).getDay()+6)%7;
    const weeks=when.startsWith('下下')?2:Number(when.startsWith('下'));
    const target=monday+weeks*7+Math.max(0,'一二三四五六日'.indexOf(when.at(-1).replace('天','日')));
    return /^(周|星期)/.test(when) && target<day?target+7:target;
  }
  if(when==='大后天')return day+3;
  if(when==='后天')return day+2;
  return day+Number(when.startsWith('明'));
}

const raceName=/(?:篮球|足球|网球|演讲|编程|辩论|唱歌|数学|机器人|游泳|钢琴|书法|羽毛球)?(?:比赛|竞赛|大赛)/;
const racePerson=/(室友|舍友|队友|同学|朋友)(?:去|要|才是|才|在|来|替我|代我|自己|一个人|的)*(?:参赛|参加(?:的?[是这那场]*(?:.{0,5}(?:比赛|竞赛|大赛))|的?[，。！\s]*$)|比赛)|(?:参赛的|参赛者|参加比赛的)(?:其实)?是(?:我的?)?(室友|舍友|队友|同学|朋友)/;
const changeDate=/改(?:期(?:到|至)?|到|在|为|成)|(?:推迟|延期|延后|提前|挪)(?:到|至|了)?/;

// Resolve a correction to an existing chat memory. Its ID stays the same, so
// the transcript, the current fact and the forget action keep referring to one event.
export function raceRevision(clause,memories,transcript,at){
  if(/[？?]|吗|是否|会不会|如果|假如|可能|也许|别记|不要记|不用记|不要保存|别保存|没(?:有)?取消|并未取消|取消不了|不(?:会|用|打算)取消|没(?:有)?改期/.test(clause))return null;
  const named=clause.match(raceName)?.[0];
  const personMatch=clause.match(racePerson);
  let participant=personMatch?.[1] || personMatch?.[2];
  if(!participant)participant=clause.match(/(?:其实是|换成|改成|不是我[，, ]*是)(?:我的?)?(室友|舍友|队友|同学|朋友)[。！\s]*$/)?.[1];
  const cancelled=/取消|不办了|不比了/.test(clause) && !/不是取消/.test(clause);
  const changed=clause.match(changeDate);
  if(!participant && !cancelled && !changed)return null;
  if(!named && !participant && !/^(?:对了[，, ]*)?(?:那场|这场|它|活动|时间)?(?:已经|又|临时)?(?:改期|改到|改在|改成|改为|取消|延期|推迟|延后|提前|挪到)/.test(clause.trim()))return null;
  const options=memories.filter(m=>m.type==='chat' && (m.race || (m.category==='事件' && raceName.test(m.text))));
  const matching=options.filter(m=>!named || /^(比赛|竞赛|大赛)$/.test(named) || (m.race?.subject || m.text).includes(named));
  const lastUser=transcript.findLast(r=>r.role==='user');
  const focused=matching.filter(m=>lastUser?.refs?.includes(m.id));
  const target=matching.length===1 && (named || participant || focused.length) ? matching[0] : focused.length===1?focused[0]:null;
  if(!target)return null;
  const originalPerson=target.text.match(racePerson);
  const race={subject:target.text.match(raceName)?.[0],participant:originalPerson?.[1] || originalPerson?.[2] || '你',status:'scheduled',due:eventDay(target.text,target.time),...target.race};
  if(participant)race.participant=participant;
  if(changed){
    race.due=eventDay(clause.slice(changed.index+changed[0].length),at);
    race.status='scheduled';
  }
  if(cancelled){race.status='cancelled';race.due=null;}
  const date=race.due===null?'日期待定':new Date(race.due*86400000).toLocaleDateString('zh-CN',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'});
  const text=race.status==='cancelled' ? race.subject+'已取消。' : race.subject+'，参赛人是'+race.participant+'，'+date+'。';
  return {target,race,text};
}

export function revisedOpening(race,today){
  if(race.status==='cancelled')return race.subject+'取消了，今天想换个话题，还是在窗边歇一会儿？';
  const who=race.participant==='你'?'你':'你'+race.participant;
  const day=race.due===null?'日期还没定':new Date(race.due*86400000).toLocaleDateString('zh-CN',{timeZone:'UTC',month:'long',day:'numeric'});
  if(race.due===null)return who+'的'+race.subject+'日期还没定。等有消息了再聊也好。';
  if(race.due<=today)return day+'那场'+race.subject+'，'+(who==='你'?'有什么想讲给我听的吗？':who+'那边有消息吗？');
  return who+'的'+race.subject+'在'+day+'。'+(who==='你'?'这次想从哪里开始准备？':'到时候你想去看看吗？');
}

export function petReaction(gesture,count,random=Math.random) {
  const choices=gesture==='long'?[
    ['startled','往旁边挪','耳尖轻轻抖了一下，我挪开半步，留了点空隙。'],
    ['startled','收起爪子','这次摸得有点久，我缩了缩脖子，转身坐到旁边。']
  ]:gesture==='stroke'?[
    ['purr','打呼噜','你的手指慢慢滑过耳后，我眯起眼，喉咙里响起小小的呼噜。'],
    ['purr','蹭你的手','我把脸颊沿着你的掌心蹭了一圈，尾巴尖轻轻打着拍子。']
  ]:count>=4?[
    ['roll','翻肚皮','我认得这只手，往软垫上一倒，把奶油色的肚皮翻给你看。'],
    ['happy','贴近你','手还没落下，我就认出来了，抬起尾巴把脑袋送过去。']
  ]:[
    ['pet','蹭你的手','我把下巴搁进你的手心，舒服得眯了一下眼睛。'],
    ['pet','享受抚摸','你碰到我脑门上的条纹，我把耳朵转向你，又靠近了一点。']
  ];
  return choices[Math.floor(random()*choices.length)];
}

export function forgetMemory(room,id,at=Date.now()) {
  if(!id)return;
  const removed=room.memories.filter(m=>m.id===id || m.sourceId===id || m.refs?.includes(id));
  room.deleted??={};
  for(const m of removed)room.deleted[m.id]={state:'deleted',time:at};
  room.memories=room.memories.filter(m=>!room.deleted[m.id]);
}
export function moodFor(pose){
  return ({sleep:'困倦',eat:'满足',startled:'警觉',play:'兴奋',greet:'期待',happy:'愉快',roll:'放松',pet:'放松',purr:'放松',listen:'专注'})[pose]||'平静';
}
