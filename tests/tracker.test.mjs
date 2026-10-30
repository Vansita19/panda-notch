import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,restore,validateState,resumeView,dayKey} from '../src/model.mjs';
const now=new Date(2026,9,26,12).getTime(),today=dayKey(now),yesterday=dayKey(new Date(2026,9,25,12));
const fresh=()=>initialState(now);
const check=(state,slot,checked=true,day=today,id=state.trackers[0].id)=>reduce(state,{type:'trackerCheck',id,day,slot,checked},now);

test('Tracker starts with one Job applications habit and fifteen empty slots',()=>{
 const state=fresh();assert.equal(state.trackers.length,1);assert.equal(state.trackers[0].title,'Job applications');
 assert.equal(state.trackers[0].slots,15);assert.deepEqual(state.trackers[0].days,{});
 assert.equal(resumeView(reduce(state,{type:'view',view:'tracker'},now)),'tracker');
});
test('a new habit keeps its chosen daily target through checks, dates and native-style reload',()=>{
 let state=reduce(fresh(),{type:'addTracker',title:'Drinking water',slots:3},now),water=state.trackers[1];
 assert.equal(water.slots,3);assert.equal(state.trackers[0].slots,15);
 state=check(state,0,true,today,water.id);state=check(state,2,true,today,water.id);state=check(state,1,true,yesterday,water.id);
 assert.equal(state.trackers[1].days[today],5);assert.equal(state.trackers[1].days[yesterday],2);
 assert.strictEqual(check(state,3,true,today,water.id),state,'a three-box habit cannot record a fourth box');
 const sorted=JSON.stringify(state,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
 assert.deepEqual(restore(JSON.parse(sorted),now).trackers,state.trackers);
});
test('daily targets accept one through thirty boxes without signed-bit overflow',()=>{
 let state=reduce(fresh(),{type:'addTracker',title:'One thing',slots:1},now);assert.equal(state.trackers[1].slots,1);
 state=reduce(state,{type:'addTracker',title:'Thirty things',slots:30},now);const id=state.trackers[2].id;
 for(let slot=0;slot<30;slot++)state=check(state,slot,true,today,id);
 assert.equal(state.trackers[2].days[today],2**30-1);assert.deepEqual(restore(state,now).trackers,state.trackers);
});
test('invalid target values cannot create a tracker or enter a backup',()=>{
 const state=fresh();for(const slots of [0,31,-1,1.5,'3',null,NaN])assert.strictEqual(reduce(state,{type:'addTracker',title:'Water',slots},now),state);
 const habit={...state.trackers[0],slots:3,days:{[today]:8}};assert.throws(()=>validateState({...state,trackers:[habit]}),/not a valid Panda file/);
});
test('legacy saves receive the default tracker once while explicit empty lists stay empty',()=>{
 const old=fresh();delete old.trackers;const before=structuredClone(old),migrated=restore(old,now);
 assert.equal(migrated.trackers.length,1);assert.deepEqual(migrated.tasks,before.tasks);assert.deepEqual(migrated.notes,before.notes);assert.deepEqual(migrated.settings,before.settings);assert.equal(Object.hasOwn(old,'trackers'),false);
 assert.deepEqual(restore(JSON.parse(JSON.stringify(migrated)),now).trackers,migrated.trackers);
 assert.deepEqual(restore({...old,trackers:[]},now).trackers,[]);
});
test('each checkbox records exactly one slot and duplicate callbacks are idempotent',()=>{
 let state=check(fresh(),0);state=check(state,2);state=check(state,14);assert.equal(state.trackers[0].days[today],16389);
 assert.strictEqual(check(state,2),state);state=check(state,2,false);assert.equal(state.trackers[0].days[today],16385);
 for(let i=0;i<15;i++)state=check(state,i);assert.equal(state.trackers[0].days[today],32767);
 for(let i=0;i<15;i++)state=check(state,i,false);assert.equal(state.trackers[0].days[today],0);
});
test('dates and habits remain independent and unrelated Panda data is untouched',()=>{
 let state=fresh();const tasks=structuredClone(state.tasks),timer=structuredClone(state.timer),settings=structuredClone(state.settings);
 state=check(state,0);state=check(state,4,true,yesterday);state=reduce(state,{type:'addTracker',title:'  Water  '},now);const water=state.trackers[1];
 assert.equal(water.title,'Water');assert.equal(water.slots,15);state=check(state,7,true,today,water.id);
 assert.equal(state.trackers[0].days[today],1);assert.equal(state.trackers[0].days[yesterday],16);assert.equal(state.trackers[1].days[today],128);
 assert.deepEqual(state.tasks,tasks);assert.deepEqual(state.timer,timer);assert.deepEqual(state.settings,settings);
 assert.equal(fresh().trackers[0].days[today],undefined);
});
test('daily checks survive JSON backup and the next local day starts empty',()=>{
 let state=check(fresh(),3);state=check(state,5,true,yesterday);const nextDay=new Date(2026,9,27,0,1).getTime();
 const restored=restore(JSON.parse(JSON.stringify(state)),nextDay);assert.deepEqual(restored.trackers,state.trackers);
 assert.equal(restored.trackers[0].days[dayKey(nextDay)],undefined);assert.equal(restored.trackers[0].days[today],8);
});
test('invalid checks never alter a saved tracker',()=>{
 const state=fresh(),id=state.trackers[0].id;
 for(const patch of [{slot:-1},{slot:15},{slot:1.2},{slot:'1'},{checked:'yes'},{day:'2026-2-30'},{day:'2026-10-27'},{day:'2026-010-26'},{id:'missing'}]){
  assert.strictEqual(reduce(state,{type:'trackerCheck',id,day:today,slot:0,checked:true,...patch},now),state);
 }
});
test('renaming and reversible deletion retain every day and do not recreate the default',()=>{
 let state=check(fresh(),1),habit=state.trackers[0];state=reduce(state,{type:'renameTracker',id:habit.id,title:'  Applications  '},now);
 assert.equal(state.trackers[0].title,'Applications');assert.deepEqual(state.trackers[0].days,habit.days);habit=state.trackers[0];
 state=reduce(state,{type:'deleteTracker',id:habit.id},now);assert.deepEqual(state.trackers,[]);assert.deepEqual(restore(state,now).trackers,[]);
 state=reduce(state,{type:'restoreTracker',tracker:habit,index:0},now);assert.deepEqual(state.trackers,[habit]);
 assert.strictEqual(reduce(state,{type:'restoreTracker',tracker:habit,index:0},now),state);
 for(const title of ['',42,'Applications'])assert.strictEqual(reduce(state,{type:'renameTracker',id:habit.id,title},now),state);
});
test('bad tracker collections reject a backup without mutating the input',()=>{
 const base=fresh(),original=structuredClone(base),habit=base.trackers[0];
 const bad=[null,{},[habit,habit],[{...habit,slots:31}],[{...habit,title:''}],[{...habit,created:NaN}],[{...habit,days:[]}],[{...habit,days:{'2026-2-30':1}}],[{...habit,days:{[today]:32768}}],[{...habit,days:{[today]:-1}}],[{...habit,days:{[today]:1.5}}]];
 for(const trackers of bad)assert.throws(()=>validateState({...base,trackers}),/not a valid Panda file/);
 assert.deepEqual(base,original);
});
test('adding many habits is bounded and blank or oversized names are ignored',()=>{
 let state=fresh();for(const title of ['',null,' '.repeat(10),'x'.repeat(101)])assert.strictEqual(reduce(state,{type:'addTracker',title},now),state);
 for(let i=1;i<100;i++)state=reduce(state,{type:'addTracker',title:`Habit ${i}`},now);
 assert.equal(state.trackers.length,100);assert.strictEqual(reduce(state,{type:'addTracker',title:'Too many'},now),state);
});
test('calendar helpers navigate months, years, leap days, and DST using local dates',async()=>{
 const {shiftTrackerDay}=await import('../src/tracker.mjs');
 assert.equal(shiftTrackerDay('2026-10-31',1),'2026-11-1');assert.equal(shiftTrackerDay('2026-1-1',-1),'2025-12-31');
 assert.equal(shiftTrackerDay('2028-2-28',1),'2028-2-29');assert.equal(shiftTrackerDay('2028-3-1',-1),'2028-2-29');
 assert.equal(shiftTrackerDay('2026-3-8',1),'2026-3-9');assert.equal(shiftTrackerDay('2026-11-1',1),'2026-11-2');assert.equal(shiftTrackerDay('invalid',1),null);
});
test('recorded date history sorts chronologically and counts only checked slots',async()=>{
 const {trackerCount,recordedTrackerDays}=await import('../src/tracker.mjs');
 let state=check(fresh(),0);state=check(state,14);state=check(state,2,true,'2026-2-3');state=check(state,5,true,'2026-10-4');
 assert.equal(trackerCount(state.trackers[0],today),2);assert.equal(trackerCount(state.trackers[0],yesterday),0);
 assert.deepEqual(recordedTrackerDays(state.trackers),[today,'2026-10-4','2026-2-3']);
});
