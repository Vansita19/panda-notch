import test from 'node:test';
import assert from 'node:assert/strict';
const task={id:'task-a',title:'Review',priority:'high',calendarLink:{eventId:'event-a',calendarId:'work',start:1000,end:3601000,color:'#62a8ff'}};
test('linked task rename confirms only its existing Calendar slot before the local name changes',async()=>{
 const {renameTaskWithCalendar}=await import('../src/task-rename.mjs');
 const trace=[];
 const result=await renameTaskWithCalendar(task,'  Portfolio review  ',{native:true,writeCalendar:async request=>{trace.push(request);return {event:{title:'Portfolio review'}};},dispatch:action=>trace.push(action)});
 assert.deepEqual(trace,[{operation:'save',taskId:'task-a',title:'Portfolio review',calendarId:'work',start:1000,end:3601000},{type:'edit',id:'task-a',title:'Portfolio review'}]);
 assert.equal(result.title,'Portfolio review');assert.equal(task.title,'Review');assert.equal(task.priority,'high');
});
test('failed Calendar rename preserves the task and unchanged or empty names never write',async()=>{
 const {renameTaskWithCalendar}=await import('../src/task-rename.mjs');
 const actions=[];let writes=0;
 const options={native:true,writeCalendar:async()=>{writes++;throw new Error('Calendar unavailable');},dispatch:action=>actions.push(action)};
 await assert.rejects(renameTaskWithCalendar(task,'New name',options),/Calendar unavailable/);
 assert.equal(writes,1);assert.deepEqual(actions,[]);
 await renameTaskWithCalendar(task,' Review ',options);await renameTaskWithCalendar(task,'   ',options);
 assert.equal(writes,1);assert.deepEqual(actions,[]);
});
test('ordinary local renames never alter timer or calendar metadata',async()=>{
 const {renameTaskWithCalendar}=await import('../src/task-rename.mjs');
 const actions=[];await renameTaskWithCalendar({...task,calendarLink:undefined},'Prepare',{native:true,writeCalendar:async()=>{throw new Error('Unexpected Calendar write');},dispatch:action=>actions.push(action)});
 assert.deepEqual(actions,[{type:'edit',id:'task-a',title:'Prepare'}]);
});
