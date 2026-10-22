import test from 'node:test';
import assert from 'node:assert/strict';

test('move delta includes calendar scrolling even when the pointer stays still',async()=>{
 const {plannerMoveDelta}=await import('../src/planner-viewport.mjs');
 const duration=16*60*60*1000,gridHeight=960,originGridY=100;
 assert.equal(plannerMoveDelta(200,100,originGridY,gridHeight,duration),0);
 assert.equal(plannerMoveDelta(200,50,originGridY,gridHeight,duration),50*60*1000);
 assert.equal(plannerMoveDelta(200,150,originGridY,gridHeight,duration),-50*60*1000);
});
test('pointer motion and scroll compose without changing the original grab offset',async()=>{
 const {plannerMoveDelta}=await import('../src/planner-viewport.mjs');
 const duration=16*60*60*1000;
 assert.equal(plannerMoveDelta(230,40,100,960,duration),90*60*1000);
 assert.equal(plannerMoveDelta(230,40,130,960,duration),60*60*1000);
 assert.equal(plannerMoveDelta(180,100,100,960,duration),-20*60*1000);
});
test('move delta uses the full grid scale and leaves boundary clamping to the range helper',async()=>{
 const {plannerMoveDelta}=await import('../src/planner-viewport.mjs');
 assert.equal(plannerMoveDelta(700,-100,100,1000,16),11.2);
 assert.equal(plannerMoveDelta(0,100,500,100,16),-96);
 for(const input of [[100,0,0,0,16],[100,0,0,-1,16],[100,0,0,100,0],[NaN,0,0,100,16],[100,Infinity,0,100,16]])assert.equal(plannerMoveDelta(...input),0);
});
test('hour labels distinguish midnight, noon, and afternoon across the full day',async()=>{
 const {plannerHourLabel}=await import('../src/planner-viewport.mjs');
 const expected=['12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM','11 PM','12 AM'];
 assert.deepEqual(Array.from({length:25},(_,hour)=>plannerHourLabel(hour)),expected);
 assert.equal(plannerHourLabel(0,true),'12:00 AM');assert.equal(plannerHourLabel(12,true),'12:00 PM');assert.equal(plannerHourLabel(24,true),'12:00 AM');
});
test('select labels can include minutes without locale-dependent 24-hour output',async()=>{
 const {plannerHourLabel}=await import('../src/planner-viewport.mjs');
 assert.equal(plannerHourLabel(7.5,true),'7:30 AM');assert.equal(plannerHourLabel(13.25,true),'1:15 PM');assert.equal(plannerHourLabel(23.75,true),'11:45 PM');
 for(const hour of [-1,25,NaN,Infinity,'12',null])assert.equal(plannerHourLabel(hour),'');
});
