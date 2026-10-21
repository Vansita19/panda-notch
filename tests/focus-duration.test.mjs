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
