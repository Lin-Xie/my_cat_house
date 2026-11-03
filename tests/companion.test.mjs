import test from 'node:test';
import assert from 'node:assert/strict';
import {candidates,conversationMode,explicitDate,petReaction,forgetMemory} from '../web/companion.mjs';
import {calendarDay} from '../web/life.mjs';

test('只从明确陈述中摘取原话；不把问题、假设、拒绝存储当事实',()=>{
  assert.deepEqual(candidates('我喜欢爵士乐。我明天要参加编程比赛。'),[
    {category:'偏好',text:'我喜欢爵士乐。'},{category:'事件',text:'我明天要参加编程比赛。'}]);
  for(const s of ['你喜欢爵士乐吗？','如果我明天参加比赛呢','我喜欢猫，但不要记住这句','她说我喜欢摇滚','多谢啦'])assert.deepEqual(candidates(s),[]);
});
test('重要日期跨年时使用下次有效日期；无效日期不滚动',()=>{
  const now=new Date(2026,11,20,15);
  assert.equal(explicitDate('我的生日是1月8日',now),calendarDay(new Date(2027,0,8)));
  assert.equal(explicitDate('我会在2月30日参加比赛',now),null);
});
test('倾诉、求建议、喜悦和直接危险求助的路径不同',()=>{
  for(const [s,mode] of [['我有些紧张','倾听'],['我有压力，该怎么办','请求建议'],['有个好消息','分享喜悦'],['我现在不想活了','安全支持'],['今晚天气不错','闲聊']])assert.equal(conversationMode(s),mode);
});
test('长按记录和动作一致；重复抚摸才解锁亲近动作',()=>{
  assert.equal(petReaction('long',5,()=>0)[0],'startled');
  assert.match(petReaction('long',5,()=>0)[2],/挪开/);
  assert.equal(petReaction('short',0,()=>0)[0],'pet');
  assert.equal(petReaction('short',4,()=>0)[0],'roll');
});
test('遗忘同时移除关联原文，仅留下无正文的删除标志',()=>{
  const room={memories:[{id:'a',text:'隐私'},{id:'b',sourceId:'a',text:'隐私的来信'},{id:'c',text:'独立记录'}]};
  forgetMemory(room,'a',100);
  assert.deepEqual(room.memories.map(m=>m.id),['c']);assert(!JSON.stringify(room).includes('隐私'));
  assert.deepEqual(room.deleted.b,{state:'deleted',time:100});
});
