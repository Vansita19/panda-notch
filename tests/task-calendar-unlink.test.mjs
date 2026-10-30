import test from 'node:test';
import assert from 'node:assert/strict';
import {unlinkCalendarTaskTime} from '../src/task-calendar-unlink.mjs';

const original={id:'task-a',title:'Design review',done:false,priority:'medium',calendarLink:{eventId:'old-event',calendarId:'work',start:1000,end:1801000,color:'#b698ff'}};
const acknowledged={eventId:'new-event',calendarId:'work',start:61000,end:1861000};
function fixture(writeCalendar=async request=>request.operation==='remove'?{removed:true}:{event:acknowledged},native=true){
 const tasks=[structuredClone(original)],trace=[],requests=[];
 const dispatch=action=>{trace.push(action.type);const task=tasks.find(task=>task.id===action.id);if(!task)return;if(action.type==='taskCalendarUnlinked')delete task.calendarLink;if(action.type==='taskCalendarLinked')task.calendarLink=structuredClone(action.link);if(action.type==='taskPlannedTime'){if(action.time)task.plannedTime=structuredClone(action.time);else delete task.plannedTime;}};
 return {tasks,trace,requests,options:{native,dispatch,getTask:id=>tasks.find(task=>task.id===id),writeCalendar:async request=>{requests.push(request);trace.push(request.operation);return writeCalendar(request);}}};
}

test('native unlink waits for removal acknowledgement and leaves the task intact',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>finish=resolve));
 const pending=unlinkCalendarTaskTime(f.tasks[0],f.options);
 assert.deepEqual(f.trace,['remove']);assert.deepEqual(f.tasks,[original]);
 finish({removed:true});await pending;
 assert.deepEqual(f.trace,['remove','taskCalendarUnlinked']);
 assert.deepEqual(f.tasks,[{id:'task-a',title:'Design review',done:false,priority:'medium'}]);
});

test('failed or unconfirmed removal leaves the local schedule intact',async()=>{
 for(const write of [async()=>{throw new Error('Permission denied');},async()=>({})]){
  const f=fixture(write);await assert.rejects(unlinkCalendarTaskTime(f.tasks[0],f.options));
  assert.deepEqual(f.tasks,[original]);assert.deepEqual(f.trace,['remove']);
 }
});

test('Undo uses the current task name, acknowledged new event ID and times, and original color once',async()=>{
 let finish;const f=fixture(async request=>request.operation==='remove'?{removed:true}:new Promise(resolve=>finish=resolve));
 const undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);f.tasks[0].title='Updated review';
 const pending=undo();await undo();
 assert.deepEqual(f.requests[1],{operation:'save',taskId:'task-a',title:'Updated review',calendarId:'work',start:1000,end:1801000});
 assert.equal(f.tasks[0].calendarLink,undefined);
 finish({event:acknowledged});await pending;await undo();
 assert.deepEqual(f.tasks[0].calendarLink,{...acknowledged,color:'#b698ff',missing:false});
 assert.equal(f.tasks[0].title,'Updated review');assert.deepEqual(f.trace,['remove','taskCalendarUnlinked','save','taskCalendarLinked']);
});

test('failed or unconfirmed Undo keeps the task unscheduled and reports a recoverable error',async()=>{
 for(const restore of [async()=>{throw new Error('Calendar unavailable');},async()=>({}),async()=>({event:{...acknowledged,end:0}})]){
  const f=fixture(request=>request.operation==='remove'?{removed:true}:restore());
  const undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);
  await assert.rejects(undo(),/Calendar time could not be restored/);await undo();
  assert.equal(f.tasks.length,1);assert.equal(f.tasks[0].calendarLink,undefined);
  assert.deepEqual(f.trace,['remove','taskCalendarUnlinked','save']);
 }
});

test('stale Undo never recreates time for a deleted or rescheduled task',async()=>{
 for(const change of [tasks=>tasks.splice(0),tasks=>{tasks[0].calendarLink={...acknowledged};}]){
  const f=fixture(),undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);change(f.tasks);
  const before=structuredClone(f.tasks);await assert.rejects(undo(),/no longer exists|already scheduled/);await undo();
  assert.deepEqual(f.tasks,before);assert.deepEqual(f.trace,['remove','taskCalendarUnlinked']);
 }
});

test('preview unlink and Undo restore the original link without a Calendar write',async()=>{
 const f=fixture(async()=>{throw new Error('Must not call Calendar');},false);
 const undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);assert.equal(f.tasks[0].calendarLink,undefined);
 await undo();await undo();assert.deepEqual(f.tasks,[original]);assert.deepEqual(f.trace,['taskCalendarUnlinked','taskCalendarLinked']);
});

test('a reschedule while native Undo waits is not overwritten by its acknowledgement',async()=>{
 let finish;const f=fixture(async request=>request.operation==='remove'?{removed:true}:new Promise(resolve=>finish=resolve));
 const undo=await unlinkCalendarTaskTime(f.tasks[0],f.options),pending=undo();
 const newer={...acknowledged,eventId:'different-event',start:3000000,end:4800000};f.tasks[0].calendarLink=newer;
 finish({event:acknowledged});await assert.rejects(pending,/changed while Calendar/);
 assert.deepEqual(f.tasks[0].calendarLink,newer);assert.deepEqual(f.trace,['remove','taskCalendarUnlinked','save']);
});

test('native bridge acknowledgement may already have linked the restored event before Undo resolves',async()=>{
 const f=fixture(async request=>{if(request.operation==='remove')return {removed:true};f.tasks[0].calendarLink={...acknowledged};return {event:acknowledged};});
 const undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);await undo();
 assert.deepEqual(f.tasks[0].calendarLink,{...acknowledged,color:'#b698ff',missing:false});
});

test('local unlink and one-shot Undo only change plannedTime without calling Calendar',async()=>{
 const f=fixture(async()=>{throw new Error('Must not call Calendar');}),time={start:1000,end:1801000,timezone:'Asia/Kolkata',color:'#efab78'};
 f.tasks[0]={id:'local',title:'Portfolio improvement',done:false,campaign:{campaign_id:'november-2026',slot:'portfolio'},plannedTime:time};
 const original=structuredClone(f.tasks[0]),undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);
 assert.equal(f.tasks[0].plannedTime,undefined);assert.equal(f.tasks.length,1);assert.equal(f.tasks[0].title,'Portfolio improvement');assert.deepEqual(f.requests,[]);
 await undo();await undo();assert.deepEqual(f.tasks,[original]);assert.deepEqual(f.trace,['taskPlannedTime','taskPlannedTime']);assert.deepEqual(f.requests,[]);
});

test('local Undo preserves a replacement local or real Calendar schedule',async()=>{
 for(const replacement of [{plannedTime:{start:2000,end:1802000,timezone:'Asia/Kolkata'}},{calendarLink:{...acknowledged}}]){
  const f=fixture(async()=>{throw new Error('Must not call Calendar');});f.tasks[0]={id:'local',title:'Review',plannedTime:{start:1000,end:1801000,timezone:'Asia/Kolkata'}};
  const undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);Object.assign(f.tasks[0],replacement);const before=structuredClone(f.tasks[0]);
  await assert.rejects(undo(),/already scheduled/);assert.deepEqual(f.tasks[0],before);assert.deepEqual(f.requests,[]);
 }
});

test('local time behind a missing provider link can be unlinked and restored locally',async()=>{
 const f=fixture(async()=>{throw new Error('Must not call Calendar');});f.tasks[0].calendarLink.missing=true;f.tasks[0].plannedTime={start:1000,end:1801000,timezone:'Asia/Kolkata'};
 const before=structuredClone(f.tasks[0]),undo=await unlinkCalendarTaskTime(f.tasks[0],f.options);assert.equal(f.tasks[0].plannedTime,undefined);
 await undo();assert.deepEqual(f.tasks[0],before);assert.deepEqual(f.requests,[]);
});
