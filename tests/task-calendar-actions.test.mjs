import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteTaskWithCalendar} from '../src/task-calendar-actions.mjs';
const task={id:'task-a',title:'Design review',priority:'medium',done:false,calendarLink:{eventId:'old-event',calendarId:'work',start:1000,end:1801000,color:'#b698ff'}};
function fixture(writeCalendar){
 const trace=[],tasks=[structuredClone(task)],events=[{taskId:task.id,eventId:'old-event'}];
 const dispatch=action=>{trace.push(action.type);if(action.type==='taskCalendarUnlinked'){delete tasks.find(t=>t.id===action.id)?.calendarLink;events.splice(0,events.length,...events.filter(e=>e.taskId!==action.id));}if(action.type==='delete')tasks.splice(0,tasks.length,...tasks.filter(t=>t.id!==action.id));if(action.type==='restoreTask')tasks.splice(action.index,0,structuredClone(action.task));if(action.type==='taskCalendarLinked'){tasks.find(t=>t.id===action.id).calendarLink=action.link;events.push({taskId:action.id,...action.link});}};
 return {tasks,events,trace,options:{native:true,index:0,dispatch,writeCalendar:async request=>{trace.push(request.operation);return writeCalendar(request);}}};
}
test('failed Calendar removal leaves the local task and its owned block intact',async()=>{
 const f=fixture(async()=>{throw new Error('Permission denied');});
 await assert.rejects(deleteTaskWithCalendar(f.tasks[0],f.options),/Permission denied/);
 assert.deepEqual(f.trace,['remove']);assert.equal(f.tasks[0].calendarLink.eventId,'old-event');assert.equal(f.events.length,1);
});
test('successful removal deletes the owned time before deleting the local task',async()=>{
 const f=fixture(async()=>({removed:true}));await deleteTaskWithCalendar(f.tasks[0],f.options);
 assert.deepEqual(f.trace,['remove','taskCalendarUnlinked','delete']);assert.equal(f.tasks.length,0);assert.equal(f.events.length,0);
});
test('Undo restores and persists the task without a stale event ID before recreating its time once',async()=>{
 const f=fixture(async request=>request.operation==='remove'?{removed:true}:{event:{eventId:'new-event',calendarId:'work',start:1000,end:1801000}});
 let persist;const persisted=new Promise(resolve=>persist=resolve);
 f.options.restoreTask=async(record,index)=>{assert.equal(record.calendarLink,undefined);f.options.dispatch({type:'restoreTask',task:record,index});await persisted;};
 const undo=await deleteTaskWithCalendar(f.tasks[0],f.options),pending=undo();
 assert.equal(f.tasks.length,1);assert.equal(f.tasks[0].calendarLink,undefined);assert.ok(!f.trace.includes('save'));
 persist();await pending;await undo();
 assert.equal(f.tasks[0].calendarLink.eventId,'new-event');assert.equal(f.tasks[0].calendarLink.color,'#b698ff');assert.equal(f.events.length,1);assert.equal(f.trace.filter(step=>step==='save').length,1);
});
test('failed Calendar recreation keeps the restored task available locally',async()=>{
 const f=fixture(async request=>{if(request.operation==='save')throw new Error('Calendar unavailable');return {removed:true};});
 const undo=await deleteTaskWithCalendar(f.tasks[0],f.options);await assert.rejects(undo(),/Your task is restored/);
 assert.equal(f.tasks.length,1);assert.equal(f.tasks[0].title,task.title);assert.equal(f.tasks[0].calendarLink,undefined);
});
test('ordinary task delete and Undo never call Calendar',async()=>{
 const f=fixture(async()=>{throw new Error('Should not write');});delete f.tasks[0].calendarLink;
 const undo=await deleteTaskWithCalendar(f.tasks[0],f.options);assert.equal(f.tasks.length,0);await undo();assert.equal(f.tasks.length,1);assert.deepEqual(f.trace,['delete','restoreTask']);
});
