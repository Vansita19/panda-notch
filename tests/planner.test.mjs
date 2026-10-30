import test from 'node:test';import assert from 'node:assert/strict';
import {dayRange,slotAt,timeAt,hoverHourAt,selectionRange,validSlot,layoutEvents,mergePlannerEvents,reconcileTaskLinks} from '../src/planner.mjs';
import {initialState,reduce,restore} from '../src/model.mjs';
test('today range and drops clamp to working hours on a quarter hour',()=>{const r=dayRange(new Date(2026,9,21,12).getTime());assert.equal(new Date(r.start).getHours(),7);assert.equal(new Date(r.end).getHours(),23);assert.deepEqual(slotAt(-10,640,r),{start:r.start,end:r.start+1800000});assert.equal(slotAt(900,640,r).end,r.end);assert.equal(slotAt(100,0,r),null);assert.equal((slotAt(101,640,r).start-r.start)%900000,0);});
test('invalid and inverted durations cannot reach calendar',()=>{assert.equal(validSlot(10,5),false);assert.equal(validSlot(NaN,100),false);assert.equal(validSlot(0,90000000),false);assert.equal(validSlot(0,1800000),true);});
test('overlap lanes reset for separate groups and omit all-day/outside events',()=>{const out=layoutEvents([{id:'a',start:0,end:40},{id:'b',start:20,end:60},{id:'c',start:70,end:90},{id:'d',start:0,end:100,allDay:true}],{start:0,end:100});assert.deepEqual(out.map(e=>[e.id,e.lane,e.lanes]),[['a',0,2],['b',1,2],['c',0,1]]);});
test('provider id changes reconcile by task identity without losing done state or color',()=>{const t={id:'t',title:'old',done:true,calendarLink:{eventId:'old',color:'#62a8ff'}};const [next]=reconcileTaskLinks([t],[{taskId:'t',eventId:'new',calendarId:'cal',title:'Renamed in Calendar',start:10,end:30}]);assert.equal(next.title,'Renamed in Calendar');assert.equal(next.done,true);assert.equal(next.calendarLink.eventId,'new');assert.equal(next.calendarLink.color,'#62a8ff');});
test('omitting events outside the window never silently deletes a link',()=>{const t={id:'t',calendarLink:{eventId:'old'}};assert.deepEqual(reconcileTaskLinks([t],[]),[t]);});
test('acknowledged writes link a task, backup preserves link, unlink only clears link',()=>{let s=initialState();const id=s.tasks[0].id;s=reduce(s,{type:'taskCalendarLinked',id,link:{eventId:'event',calendarId:'cal',start:1000,end:1801000}});assert.equal(s.tasks[0].calendarLink.eventId,'event');assert.equal(restore(s).tasks[0].calendarLink.eventId,'event');s=reduce(s,{type:'taskCalendarUnlinked',id});assert.equal(s.tasks[0].calendarLink,undefined);assert.equal(s.tasks.length,2);});

const MINUTE=60000,HOUR=60*MINUTE;
const workday={start:7*HOUR,end:23*HOUR};
test('moving a block preserves its duration and the grabbed pointer offset',async()=>{
 const {moveRange}=await import('../src/planner.mjs');
 assert.equal(typeof moveRange,'function');
 assert.deepEqual(moveRange(9*HOUR,11*HOUR,74*MINUTE,workday),{start:10*HOUR+15*MINUTE,end:12*HOUR+15*MINUTE});
 assert.deepEqual(moveRange(9*HOUR,11*HOUR,-29*MINUTE,workday),{start:8*HOUR+30*MINUTE,end:10*HOUR+30*MINUTE});
 assert.deepEqual(moveRange(9*HOUR+7*MINUTE,10*HOUR+7*MINUTE,0,workday),{start:9*HOUR+7*MINUTE,end:10*HOUR+7*MINUTE});
});
test('moving a block clamps both day edges without shrinking it',async()=>{
 const {moveRange}=await import('../src/planner.mjs');
 assert.equal(typeof moveRange,'function');
 assert.deepEqual(moveRange(9*HOUR,11*HOUR,-10*HOUR,workday),{start:7*HOUR,end:9*HOUR});
 assert.deepEqual(moveRange(9*HOUR,11*HOUR,30*HOUR,workday),{start:21*HOUR,end:23*HOUR});
 assert.deepEqual(moveRange(workday.start,workday.end,2*HOUR,workday),workday);
 assert.equal(moveRange(0,24*HOUR,2*HOUR,workday),null);
 assert.equal(moveRange(9*HOUR,8*HOUR,0,workday),null);
 assert.equal(moveRange(9*HOUR,10*HOUR,NaN,workday),null);
});
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

test('task event previews replace stale provider entries without hiding other commitments',()=>{
 const task={id:'task-a',title:'Current task name',calendarLink:{eventId:'provider-a',calendarId:'work',start:8*HOUR,end:9*HOUR,color:'#b698ff'}};
 const unrelated={id:'meeting',title:'Team meeting',start:10*HOUR,end:11*HOUR,calendarId:'team'};
 const base=[{id:'old-a',taskId:'task-a',eventId:'provider-a',calendarId:'work',calendarLabel:'Work',writable:true,title:'Old task name',start:8*HOUR,end:9*HOUR},unrelated,{id:'duplicate-a',taskId:'task-a',start:8*HOUR,end:9*HOUR},{id:'other-task',taskId:'task-b',title:'Another task',start:12*HOUR,end:13*HOUR}];
 const result=mergePlannerEvents(base,[task],{taskId:'task-a',start:14*HOUR,end:16*HOUR,title:'Stale preview name',phase:'selecting'});
 assert.equal(result.length,3);
 const active=result.find(e=>e.taskId==='task-a');
 assert.deepEqual([active.id,active.start,active.end,active.title,active.phase],['task:task-a',14*HOUR,16*HOUR,'Current task name','selecting']);
 assert.deepEqual([active.eventId,active.calendarId,active.calendarLabel,active.writable],['provider-a','work','Work',true]);
 assert.equal(result.find(e=>e.id==='meeting'),unrelated);
 assert.equal(result.find(e=>e.taskId==='task-b').id,'task:task-b');
 assert.equal(base[0].id,'old-a');assert.equal(base[0].start,8*HOUR);
});
test('selection, pending save, acknowledgement, and provider refresh retain one task identity',()=>{
 const task={id:'new-task',title:'Prepare review'};
 const slot={taskId:task.id,start:9*HOUR,end:11*HOUR,title:task.title};
 const selecting=mergePlannerEvents([], [task], {...slot,phase:'selecting'});
 const saving=mergePlannerEvents([], [task], {...slot,phase:'saving'});
 const linked={...task,calendarLink:{eventId:'saved',calendarId:'work',start:slot.start,end:slot.end}};
 const committed=mergePlannerEvents([], [linked], {...slot,phase:'committed'});
 const refreshed=mergePlannerEvents([{id:'provider-changing-id',taskId:task.id,eventId:'saved',calendarId:'work',start:slot.start,end:slot.end,title:task.title,writable:true}], [linked]);
 for(const result of [selecting,saving,committed,refreshed]){
  assert.equal(result.length,1);assert.equal(result[0].id,'task:new-task');
  assert.equal(result[0].start,slot.start);assert.equal(result[0].end,slot.end);
 }
 assert.equal(refreshed[0].eventId,'saved');
 assert.equal(refreshed[0].writable,true);
});
test('missing or absent links stay absent while valid previews can still represent a new selection',()=>{
 const tasks=[{id:'none',title:'Unscheduled'},{id:'missing',title:'Missing event',calendarLink:{missing:true,eventId:'gone',start:8*HOUR,end:9*HOUR}},{id:'linked',title:'Later task',calendarLink:{eventId:'later',calendarId:'work',start:25*HOUR,end:26*HOUR}}];
 const merged=mergePlannerEvents([],tasks);
 assert.equal(merged.length,1);assert.equal(merged[0].taskId,'linked');
 assert.equal(layoutEvents(merged,workday).length,0);
 const preview=mergePlannerEvents([],tasks,{taskId:'missing',start:8*HOUR,end:9*HOUR,phase:'selecting'});
 assert.equal(preview.length,2);assert.equal(preview.find(e=>e.taskId==='missing').title,'Missing event');
 assert.equal(mergePlannerEvents([],tasks,{taskId:'none',start:9*HOUR,end:8*HOUR,phase:'saving'}).length,1);
});

test('acknowledged task time wins until the provider snapshot catches up',()=>{
 const task={id:'rescheduled',title:'Updated task title',calendarLink:{eventId:'event-a',calendarId:'work',start:9*HOUR,end:11*HOUR}};
 const stale={id:'old-time-id',taskId:task.id,title:'Old task title',eventId:'event-a',calendarId:'work',calendarLabel:'Work',writable:true,start:7*HOUR,end:9*HOUR};
 const result=mergePlannerEvents([stale],[task]);
 assert.equal(result.length,1);
 assert.deepEqual([result[0].start,result[0].end,result[0].title],[9*HOUR,11*HOUR,'Updated task title']);
 assert.deepEqual([result[0].id,result[0].eventId,result[0].calendarLabel,result[0].writable],['task:rescheduled','event-a','Work',true]);
 const refreshed=mergePlannerEvents([{...stale,id:'new-time-id',start:9*HOUR,end:11*HOUR}],[task]);
 assert.equal(refreshed[0].id,result[0].id);
});
test('unlink acknowledgement hides stale owned events without hiding tasks outside the visible list',()=>{
 const stale=[{id:'unlinked-event',taskId:'unlinked',title:'Removed time',start:7*HOUR,end:8*HOUR},{id:'missing-event',taskId:'missing',title:'Unavailable time',start:8*HOUR,end:9*HOUR},{id:'other-day-task',taskId:'not-visible',title:'Calendar commitment',start:9*HOUR,end:10*HOUR}];
 const tasks=[{id:'unlinked',title:'Task stays here'},{id:'missing',title:'Missing task',calendarLink:{missing:true,start:8*HOUR,end:9*HOUR}}];
 const result=mergePlannerEvents(stale,tasks);
 assert.equal(result.length,1);assert.equal(result[0].taskId,'not-visible');assert.equal(result[0].title,'Calendar commitment');
 const preview=mergePlannerEvents(stale,tasks,{taskId:'unlinked',start:11*HOUR,end:12*HOUR,phase:'selecting'});
 assert.equal(preview.length,2);assert.equal(preview.find(e=>e.taskId==='unlinked').title,'Task stays here');
});

test('local planned time renders once without fabricating a Calendar link or changing the task',()=>{
 const task={id:'campaign-local',title:'Portfolio improvement',campaign:{campaign_id:'november-2026',date:'2026-11-01',slot:'portfolio'},plannedTime:{start:Date.parse('2026-11-01T06:30:00Z'),end:Date.parse('2026-11-01T08:30:00Z'),timezone:'Asia/Kolkata',color:'#b698ff'}};
 const before=structuredClone(task),range={start:Date.parse('2026-11-01T01:30:00Z'),end:Date.parse('2026-11-01T17:30:00Z')};
 const events=mergePlannerEvents([{taskId:task.id,id:'stale-provider',eventId:'stale',start:0,end:1}],[task]);
 assert.equal(events.length,1);assert.equal(events[0].id,'task:campaign-local');assert.equal(events[0].local,true);assert.equal(events[0].eventId,undefined);
 assert.deepEqual([events[0].start,events[0].end,events[0].title],[Date.parse('2026-11-01T06:30:00Z'),Date.parse('2026-11-01T08:30:00Z'),'Portfolio improvement']);
 assert.equal(layoutEvents(events,range).length,1);assert.deepEqual(task,before);assert.equal(task.calendarLink,undefined);
});

test('real Calendar time wins over local time while missing Calendar time falls back locally',()=>{
 const local={start:8*HOUR,end:9*HOUR,timezone:'Asia/Kolkata'},link={eventId:'real',calendarId:'work',start:10*HOUR,end:11*HOUR};
 const linked={id:'linked-local',title:'Review',plannedTime:local,calendarLink:link};
 const real=mergePlannerEvents([],[linked]);assert.equal(real.length,1);assert.equal(real[0].eventId,'real');assert.equal(real[0].start,10*HOUR);assert.equal(real[0].local,false);
 const fallback=mergePlannerEvents([],[{...linked,calendarLink:{...link,missing:true}}]);assert.equal(fallback.length,1);assert.equal(fallback[0].start,8*HOUR);assert.equal(fallback[0].local,true);assert.equal(fallback[0].eventId,undefined);
 assert.deepEqual(mergePlannerEvents([],[{id:'invalid',plannedTime:{...local,end:local.start}},{id:'zone-less',plannedTime:{start:8*HOUR,end:9*HOUR}}]),[]);
});

test('campaign day geometry uses its Asia/Kolkata date even when the host day differs',()=>{
 const range=dayRange(Date.parse('2026-10-31T20:00:00Z'),7,23,'Asia/Kolkata');
 assert.deepEqual(range,{start:Date.parse('2026-11-01T01:30:00Z'),end:Date.parse('2026-11-01T17:30:00Z')});
});
