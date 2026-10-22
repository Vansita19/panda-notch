import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce} from '../src/model.mjs';
const now=new Date(2026,9,22,12).getTime(),id='00000000-0000-4000-8000-000000000001';
const input={title:'  Draft portfolio story  ',start:now+3600000,end:now+7200000,calendarId:'work'};
const event={eventId:'provider-event',calendarId:'work',start:input.start+900000,end:input.end+900000};
function fixture(){
 let state=initialState(now);state.tasks=[];const trace=[],requests=[];
 const options={native:true,now,id,persistTask:async task=>{trace.push('persist');state=reduce(state,{type:'restoreTask',task,index:0},now);trace.push('persisted');},writeCalendar:async request=>{trace.push('write');requests.push(request);assert.ok(state.tasks.some(task=>task.id===id));return {event};},dispatch:action=>{trace.push(action.type);state=reduce(state,action,now);}};
 return {options,trace,requests,get state(){return state;}};
}
test('native creation persists a standard task before requesting Calendar and links acknowledged provider times',async()=>{
 const {createTaskFromCalendar}=await import('../src/calendar-task-create.mjs'),f=fixture();
 const result=await createTaskFromCalendar(input,f.options);
 assert.deepEqual(f.trace,['persist','persisted','write','taskCalendarLinked']);
 assert.deepEqual(f.requests,[{operation:'save',taskId:id,title:'Draft portfolio story',calendarId:'work',start:input.start,end:input.end}]);
 assert.equal(f.state.tasks.length,1);assert.deepEqual(f.state.tasks[0],{id,title:'Draft portfolio story',section:'today',done:false,pinned:false,created:now,due:null,priority:'medium',calendarLink:{...event,missing:false}});
 assert.equal(result.ok,true);assert.deepEqual(result.task,f.state.tasks[0]);
});
test('Calendar cannot write while the task persistence barrier is still pending',async()=>{
 const {createTaskFromCalendar}=await import('../src/calendar-task-create.mjs'),f=fixture();let release;
 const barrier=new Promise(resolve=>release=resolve),persist=f.options.persistTask;
 f.options.persistTask=async task=>{await persist(task);await barrier;};
 const pending=createTaskFromCalendar(input,f.options);assert.equal(f.requests.length,0);assert.equal(f.state.tasks.length,1);
 release();await pending;assert.equal(f.requests.length,1);
});
test('a persistence failure never requests an event or dispatches a calendar link',async()=>{
 const {createTaskFromCalendar}=await import('../src/calendar-task-create.mjs'),f=fixture();
 f.options.persistTask=async()=>{throw new Error('Disk unavailable');};
 const result=await createTaskFromCalendar(input,f.options);
 assert.equal(result.ok,false);assert.match(result.error,/Disk unavailable/);assert.equal(result.task,undefined);
 assert.equal(f.state.tasks.length,0);assert.deepEqual(f.trace,[]);assert.deepEqual(f.requests,[]);
});
test('a failed Calendar write retains one unscheduled task with the entered name',async()=>{
 const {createTaskFromCalendar}=await import('../src/calendar-task-create.mjs'),f=fixture();
 f.options.writeCalendar=async()=>{throw new Error('Calendar permission denied');};
 const result=await createTaskFromCalendar(input,f.options);
 assert.equal(result.ok,false);assert.match(result.error,/^Task added, but /);assert.match(result.error,/permission denied/);
 assert.equal(f.state.tasks.length,1);assert.equal(f.state.tasks[0].title,'Draft portfolio story');assert.equal(f.state.tasks[0].calendarLink,undefined);assert.deepEqual(result.task,f.state.tasks[0]);
});
test('an incomplete or malformed acknowledgement cannot create an unconfirmed local link',async()=>{
 const {createTaskFromCalendar}=await import('../src/calendar-task-create.mjs');
 for(const acknowledgement of [undefined,{}, {event:{...event,eventId:''}},{event:{...event,end:event.start}}]){
  const f=fixture();f.options.writeCalendar=async()=>acknowledgement;
  const result=await createTaskFromCalendar(input,f.options);assert.equal(result.ok,false);assert.ok(result.task);assert.equal(f.state.tasks[0].calendarLink,undefined);
 }
});
test('invalid names, time spans, native calendar, identity, or clock cause no mutation',async()=>{
 const {createTaskFromCalendar}=await import('../src/calendar-task-create.mjs');
 for(const [patch,options] of [[{title:'  '},{}],[{title:'x'.repeat(501)},{}],[{title:42},{}],[{end:input.start},{}],[{start:NaN},{}],[{end:input.start+86400001},{}],[{calendarId:''},{}],[{}, {id:'not-a-uuid'}],[{}, {now:NaN}]]){
  const f=fixture(),result=await createTaskFromCalendar({...input,...patch},{...f.options,...options});
  assert.equal(result.ok,false);assert.equal(result.task,undefined);assert.equal(f.state.tasks.length,0);assert.deepEqual(f.trace,[]);assert.deepEqual(f.requests,[]);
 }
});
test('preview creation uses the same persisted task path without invoking native Calendar',async()=>{
 const {createTaskFromCalendar}=await import('../src/calendar-task-create.mjs'),f=fixture();
 const result=await createTaskFromCalendar({...input,calendarId:''},{...f.options,native:false});
 assert.equal(result.ok,true);assert.deepEqual(f.trace,['persist','persisted','taskCalendarLinked']);assert.deepEqual(f.requests,[]);
 assert.equal(f.state.tasks[0].calendarLink.calendarId,'preview');assert.equal(f.state.tasks[0].calendarLink.start,input.start);assert.equal(f.state.tasks[0].calendarLink.end,input.end);assert.equal(f.state.tasks[0].calendarLink.missing,false);assert.match(f.state.tasks[0].calendarLink.eventId,/^[0-9a-f-]{36}$/i);
});
