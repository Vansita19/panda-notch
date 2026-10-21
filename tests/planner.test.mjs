import test from 'node:test';import assert from 'node:assert/strict';
import {dayRange,slotAt,timeAt,hoverHourAt,selectionRange,validSlot,layoutEvents,reconcileTaskLinks} from '../src/planner.mjs';
import {initialState,reduce,restore} from '../src/model.mjs';
test('today range and drops clamp to working hours on a quarter hour',()=>{const r=dayRange(new Date(2026,9,21,12).getTime());assert.equal(new Date(r.start).getHours(),7);assert.equal(new Date(r.end).getHours(),23);assert.deepEqual(slotAt(-10,640,r),{start:r.start,end:r.start+1800000});assert.equal(slotAt(900,640,r).end,r.end);assert.equal(slotAt(100,0,r),null);assert.equal((slotAt(101,640,r).start-r.start)%900000,0);});
test('invalid and inverted durations cannot reach calendar',()=>{assert.equal(validSlot(10,5),false);assert.equal(validSlot(NaN,100),false);assert.equal(validSlot(0,90000000),false);assert.equal(validSlot(0,1800000),true);});
test('overlap lanes reset for separate groups and omit all-day/outside events',()=>{const out=layoutEvents([{id:'a',start:0,end:40},{id:'b',start:20,end:60},{id:'c',start:70,end:90},{id:'d',start:0,end:100,allDay:true}],{start:0,end:100});assert.deepEqual(out.map(e=>[e.id,e.lane,e.lanes]),[['a',0,2],['b',1,2],['c',0,1]]);});
test('provider id changes reconcile by task identity without losing done state or color',()=>{const t={id:'t',title:'old',done:true,calendarLink:{eventId:'old',color:'#62a8ff'}};const [next]=reconcileTaskLinks([t],[{taskId:'t',eventId:'new',calendarId:'cal',title:'Renamed in Calendar',start:10,end:30}]);assert.equal(next.title,'Renamed in Calendar');assert.equal(next.done,true);assert.equal(next.calendarLink.eventId,'new');assert.equal(next.calendarLink.color,'#62a8ff');});
test('omitting events outside the window never silently deletes a link',()=>{const t={id:'t',calendarLink:{eventId:'old'}};assert.deepEqual(reconcileTaskLinks([t],[]),[t]);});
test('acknowledged writes link a task, backup preserves link, unlink only clears link',()=>{let s=initialState();const id=s.tasks[0].id;s=reduce(s,{type:'taskCalendarLinked',id,link:{eventId:'event',calendarId:'cal',start:1000,end:1801000}});assert.equal(s.tasks[0].calendarLink.eventId,'event');assert.equal(restore(s).tasks[0].calendarLink.eventId,'event');s=reduce(s,{type:'taskCalendarUnlinked',id});assert.equal(s.tasks[0].calendarLink,undefined);assert.equal(s.tasks.length,2);});

const MINUTE=60000,HOUR=60*MINUTE;
const workday={start:7*HOUR,end:23*HOUR};
test('pointer time follows quarter-hour boundaries, including both workday edges',()=>{
 assert.equal(timeAt(-20,640,workday),workday.start);
 assert.equal(timeAt(640,640,workday),workday.end);
 assert.equal(timeAt(900,640,workday),workday.end);
 assert.equal(timeAt(81,640,workday),9*HOUR);
 assert.equal(timeAt(86,640,workday),9*HOUR+15*MINUTE);
 assert.equal(timeAt(NaN,640,workday),null);
 assert.equal(timeAt(20,0,workday),null);
 assert.equal(timeAt(20,640,{start:5,end:5}),null);
});
test('hover previews a whole hour rather than a fixed appointment duration',()=>{
 assert.deepEqual(hoverHourAt(84,640,workday),{start:9*HOUR,end:10*HOUR});
 assert.deepEqual(hoverHourAt(119,640,workday),{start:9*HOUR,end:10*HOUR});
 assert.deepEqual(hoverHourAt(-10,640,workday),{start:7*HOUR,end:8*HOUR});
 assert.deepEqual(hoverHourAt(640,640,workday),{start:22*HOUR,end:23*HOUR});
 assert.equal(hoverHourAt(0,0,workday),null);
});
test('calendar drag selects the chosen duration in either direction',()=>{
 assert.deepEqual(selectionRange(7*HOUR,9*HOUR,workday),{start:7*HOUR,end:9*HOUR});
 assert.deepEqual(selectionRange(9*HOUR,7*HOUR,workday),{start:7*HOUR,end:9*HOUR});
 assert.deepEqual(selectionRange(9*HOUR+4*MINUTE,10*HOUR+23*MINUTE,workday),{start:9*HOUR,end:10*HOUR+30*MINUTE});
});
test('calendar drag retains a minimum quarter hour and respects day limits',()=>{
 assert.deepEqual(selectionRange(9*HOUR,9*HOUR,workday),{start:9*HOUR,end:9*HOUR+15*MINUTE});
 assert.deepEqual(selectionRange(23*HOUR,23*HOUR,workday),{start:22*HOUR+45*MINUTE,end:23*HOUR});
 assert.deepEqual(selectionRange(5*HOUR,25*HOUR,workday),workday);
 assert.deepEqual(selectionRange(22*HOUR+45*MINUTE,24*HOUR,workday),{start:22*HOUR+45*MINUTE,end:23*HOUR});
 assert.equal(selectionRange(NaN,9*HOUR,workday),null);
 assert.equal(selectionRange(9*HOUR,10*HOUR,{start:10,end:0}),null);
});
