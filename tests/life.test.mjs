import test from 'node:test';
import assert from 'node:assert/strict';
import {ageAt, calendarDay, chooseLife, replay, tendPlant, restoreCompany, recordCompany, bodyProfile, notePlayTime, usualPlayToy} from '../web/life.mjs';

const hour = 3600000;
const noon = new Date(2026, 9, 11, 12).getTime();
const roomAt = t => ({adoptedDay:calendarDay(t), livedUntil:t, lastMeal:t, restedAt:t, memories:[], toys:{wand:0,yarn:0}});

test('玩耍邀请看相近时刻的不同日期，识别旧记录，忽略重复和过期习惯',()=>{
  const at=(day,h,m)=>new Date(2026,9,day,h,m).getTime();
  const game=(day,word)=>({type:'play',state:'confirmed',text:word,time:at(day,18,55)});
  const history=[game(3,'弹簧'),game(4,'弹簧'),game(5,'羽毛')];
  const now=at(6,19,5);
  assert.equal(usualPlayToy(history,now),'butterfly');
  assert.equal(usualPlayToy([history[0],history[0],history[1]],now),null);
  assert.equal(usualPlayToy(history,at(6,10,0)),null);
  history.forEach(m=>notePlayTime(m,'mouse',at(new Date(m.time).getDate(),9,55)));
  assert.equal(usualPlayToy(history,at(6,10,0)),'mouse');
  assert.equal(usualPlayToy([...history,game(6,'线团')],now),null);
  assert.equal(usualPlayToy(history,at(40,19,0)),null);
});

test('旧存档按互动种类恢复亲密度，离开不扣分，当天反复互动不重复计入',()=>{
  const room=roomAt(noon);
  room.memories=['play','play','pet','feed','visit'].map(type=>({type,time:noon,state:'confirmed'}));
  room.transcript=[{role:'user',time:noon,content:'你好'}];
  const stats=restoreCompany(room);
  assert.equal(stats.bond,6);
  const initial=bodyProfile(room,noon);
  recordCompany(stats,'feed',noon+hour);
  assert.deepEqual(bodyProfile(room,noon+hour),initial);
  const later=bodyProfile(room,noon+30*24*hour);
  assert.equal(later.bond,6);assert.ok(later.kg>initial.kg);
  recordCompany(stats,'play',noon+30*24*hour);
  assert.equal(stats.bond,8);assert.equal(Object.keys(stats.days).length,1);
  assert.equal(restoreCompany(room).bond,8);
});

test('照看只占空闲时间，湿土只观察，同一天不重复补水',()=>{
  const t=new Date(2026,9,11,16).getTime(),day=calendarDay(t),seed=(4-day%3)%3;
  const p={sown:day-4,lastWater:day-3,waterDays:1};
  assert.equal(tendPlant(p,seed,t,'nap'),undefined);
  assert.equal(tendPlant(p,seed,t,'meal'),undefined);
  assert.ok(tendPlant(p,seed,t,'watch'));assert.equal(p.lastCare,'water');
  assert.equal(p.lastWater,day);assert.equal(p.waterDays,2);
  assert.equal(tendPlant(p,seed,t+1000,'watch'),undefined);
  const wet={sown:day-4,lastWater:day,waterDays:3};
  assert.ok(tendPlant(wet,seed,t,'explore'));assert.equal(wet.lastCare,'watch');assert.equal(wet.waterDays,3);
  assert.equal(tendPlant({sown:day,sownAt:t+1000},seed,t,'watch'),undefined);
});

test('成长取本地日期，跨入第七天不必等够整整六天', () => {
  const late = new Date(2026, 9, 1, 23, 59).getTime();
  const room = roomAt(late);
  assert.equal(ageAt(room, new Date(2026,9,7,0,1)).stage,'少年猫');
  assert.equal(ageAt(room, new Date(2026,9,30)).stage,'成年猫');
});

test('幼猫先解决饥饿，吃饱后才找以前最常玩的玩具', () => {
  const room=roomAt(noon);
  room.memories.push({type:'play',time:noon-hour,text:'追羽毛'});
  room.toys.yarn=4;
  room.lastMeal-=4*hour;
  assert.equal(chooseLife(room,noon)[0],'bowl');
  assert.equal(chooseLife(room,noon+1000)[0],'yarn');
});

test('久别回访只补近七天；相同存档生成同一生活记录', () => {
  const start=noon-40*24*hour, room=roomAt(start);
  const result=replay(structuredClone(room),noon);
  assert.deepEqual(replay(structuredClone(room),noon),result);
  assert.ok(result.events.length>0 && result.events.every(e=>e.time>noon-7*24*hour && e.time<=noon));
  assert.ok(result.events.some(e=>e.type==='meal') && result.events.some(e=>e.type==='nap'));
  assert.deepEqual(replay(roomAt(noon),noon).events,[]);
});
test('恰逢半小时的分段回放不丢事件、不重复',()=>{
  const whole=roomAt(noon), divided=roomAt(noon);
  const first=replay(divided,noon+hour/2);
  divided.livedUntil=noon+hour/2;
  const second=replay(divided,noon+hour);
  assert.deepEqual([...first.events,...second.events],replay(whole,noon+hour).events);
});


test('刚玩累的猫会主动回窝并在原处休息',()=>{
  const room=roomAt(noon);
  room.playCount=3;room.lastPlay=noon+1000;
  assert.deepEqual(chooseLife(room,noon+20000).slice(0,2),['bed','猫窝打盹']);
  assert.equal(chooseLife(room,noon+60000)[0],'bed');
  assert.notEqual(chooseLife(room,noon+81000)[0],'bed','白天玩后的短休到期会恢复日常活动');
});
