import test from 'node:test';
import assert from 'node:assert/strict';
import {durationParts,minutesFromDurationParts,stepDurationPart,focusModeOnEntry,focusElapsed} from '../src/focus-duration.mjs';
import {initialState,reduce,remaining} from '../src/model.mjs';

test('duration fields represent hours and minutes without treating minutes as seconds',()=>{
 assert.deepEqual(durationParts(25),{hours:'00',minutes:'25'});
 assert.deepEqual(durationParts(90),{hours:'01',minutes:'30'});
 assert.deepEqual(durationParts(120),{hours:'02',minutes:'00'});
 assert.equal(minutesFromDurationParts('01','30'),90);
 assert.equal(minutesFromDurationParts('00','01'),1);
 assert.equal(minutesFromDurationParts('02','00'),120);
});
test('partial, zero, invalid minute fields, and durations beyond two hours do not commit',()=>{
 for(const [hours,minutes] of [['','25'],['1',''],['a','25'],['00','00'],['00','60'],['02','01'],['03','00'],['-1','30']])assert.equal(minutesFromDurationParts(hours,minutes),null);
});
test('roller steps carry across hours and independently respect the model duration limits',()=>{
 assert.equal(stepDurationPart(59,'minutes',1),60);
 assert.equal(stepDurationPart(60,'minutes',-1),59);
 assert.equal(stepDurationPart(25,'hours',1),85);
 assert.equal(stepDurationPart(85,'hours',-1),25);
 for(let total=1;total<=120;total++)for(const unit of ['hours','minutes'])for(const direction of [-1,1]){
  const value=stepDurationPart(total,unit,direction);
  assert.ok(Number.isInteger(value)&&value>=1&&value<=120);
 }
});
test('opening Focus defaults idle timers to Work and preserves running or paused sessions',()=>{
 assert.equal(focusModeOnEntry({mode:'short',running:false},300,300),'focus');
 assert.equal(focusModeOnEntry({mode:'long',running:true},900,900),'long');
 assert.equal(focusModeOnEntry({mode:'short',running:false},240,300),'short');
 assert.equal(focusModeOnEntry({mode:'focus',running:false},1200,1500),'focus');
});
test('typed duration keeps the timer model in minutes while the countdown progresses in seconds',()=>{
 const now=10000;let state=initialState(now);
 state=reduce(state,{type:'settings',patch:{focusMinutes:minutesFromDurationParts('01','30')}},now);
 state=reduce(state,{type:'timerStart'},now);
 assert.equal(state.settings.focusMinutes,90);assert.equal(state.timer.seconds,5400);
 assert.equal(remaining(state.timer,now+1000),5399);
 assert.equal(state.settings.shortMinutes,5);
 assert.equal(focusElapsed(2700,5400),.5);
 assert.equal(focusElapsed(6000,5400),0);assert.equal(focusElapsed(-1,5400),1);
 assert.equal(focusElapsed(10,0),0);
});
test('duration reels include every intermediate minute in either direction',async()=>{
 const {durationReelSteps}=await import('../src/focus-duration.mjs');
 assert.equal(typeof durationReelSteps,'function');
 assert.deepEqual(durationReelSteps(40,45),[41,42,43,44,45]);
 assert.deepEqual(durationReelSteps(45,40),[44,43,42,41,40]);
 assert.deepEqual(durationReelSteps(45,45),[]);
 assert.deepEqual(durationReelSteps(59,61).map(durationParts),[{hours:'01',minutes:'00'},{hours:'01',minutes:'01'}]);
 assert.deepEqual(durationReelSteps(61,59).map(durationParts),[{hours:'01',minutes:'00'},{hours:'00',minutes:'59'}]);
});
test('long reverse reels and capped durations never emit zero or more than two hours',async()=>{
 const {durationReelSteps}=await import('../src/focus-duration.mjs');
 assert.equal(typeof durationReelSteps,'function');
 const reverse=durationReelSteps(120,1);
 assert.equal(reverse.length,119);assert.equal(reverse[0],119);assert.equal(reverse.at(-1),1);
 assert.ok(reverse.every((value,index)=>value===119-index));
 assert.deepEqual(durationReelSteps(-10,3),[2,3]);
 assert.deepEqual(durationReelSteps(118,500),[119,120]);
 assert.deepEqual(durationReelSteps(1,-20),[]);
 assert.deepEqual(durationReelSteps(120,500),[]);
});
test('duration wheel responds to tiny deltas and accumulates events without rendered state',async()=>{
 const {createDurationWheelGesture}=await import('../src/focus-duration.mjs');
 assert.equal(typeof createDurationWheelGesture,'function');
 const positive=createDurationWheelGesture(40,'minutes');assert.ok(positive.move(.2)>40);assert.equal(positive.finish(),41);
 const negative=createDurationWheelGesture(40,'minutes');assert.ok(negative.move(-.2)<40);assert.equal(negative.finish(),39);
 const composed=createDurationWheelGesture(40,'minutes');for(let i=0;i<20;i++)composed.move(.7);assert.equal(composed.finish(),41);
 composed.move(28);assert.equal(composed.finish(),43);
});
test('duration wheel normalizes delta modes and clamps minute and hour results',async()=>{
 const {createDurationWheelGesture}=await import('../src/focus-duration.mjs');
 assert.equal(typeof createDurationWheelGesture,'function');
 const results=[[14,0],[.875,1],[.175,2]].map(([delta,mode])=>{const wheel=createDurationWheelGesture(59,'minutes');wheel.move(delta,mode);return wheel.finish();});
 assert.deepEqual(results,[60,60,60]);
 const top=createDurationWheelGesture(120,'minutes');assert.equal(top.move(140),120);assert.equal(top.finish(),120);
 const bottom=createDurationWheelGesture(1,'minutes');assert.equal(bottom.move(-140),1);assert.equal(bottom.finish(),1);
 const hourUp=createDurationWheelGesture(90,'hours');hourUp.move(.2);assert.equal(hourUp.finish(),120);
 const hourDown=createDurationWheelGesture(90,'hours');hourDown.move(-.2);assert.equal(hourDown.finish(),30);
 const retarget=createDurationWheelGesture(45,'minutes',43.6);assert.ok(retarget.move(.2)>43.6);assert.equal(retarget.finish(),46);
});


test('switching wheel units composes from the previous settled total without losing its hour or minutes',async()=>{
 const {createDurationWheelGesture}=await import('../src/focus-duration.mjs');
 const hour=createDurationWheelGesture(45,'hours');hour.move(.2);
 const flushedHour=hour.finish();assert.equal(flushedHour,105);
 const minute=createDurationWheelGesture(flushedHour,'minutes',flushedHour);minute.move(.2);
 const flushedMinute=minute.finish();assert.equal(flushedMinute,106);
 const nextHour=createDurationWheelGesture(flushedMinute,'hours');nextHour.move(-.2);
 assert.equal(nextHour.finish(),46);
});
