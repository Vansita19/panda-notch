import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,restore,validateState} from '../src/model.mjs';

const now=new Date(2026,9,21,12).getTime();
const fresh=()=>initialState(now);

test('sample and newly captured tasks start at medium priority',()=>{
 const state=fresh();
 assert.ok(state.tasks.every(task=>task.priority==='medium'));
 const next=reduce(state,{type:'add',title:'Prepare a portfolio review'},now);
 assert.equal(next.tasks.at(-1).priority,'medium');
 assert.equal(next.tasks.at(-1).title,'Prepare a portfolio review');
});

test('legacy saves gain medium priority without losing task or calendar details',()=>{
 const legacy=fresh();
 for(const task of legacy.tasks)delete task.priority;
 legacy.tasks[0].calendarLink={eventId:'event',calendarId:'work',start:now,end:now+3600000,color:'#62a8ff'};
 legacy.tasks[1].done=true;legacy.tasks[1].completedDay='2026-10-21';
 legacy.brainDump='Keep this draft\nAnd this detail';
 legacy.notes=[{id:'note',body:'Saved idea',created:now}];
 const expectedTasks=structuredClone(legacy.tasks),next=restore(JSON.parse(JSON.stringify(legacy)));
 assert.ok(next.tasks.every(task=>task.priority==='medium'));
 assert.deepEqual(next.tasks.map(({priority,...task})=>task),expectedTasks);
 assert.equal(next.brainDump,legacy.brainDump);assert.deepEqual(next.notes,legacy.notes);
 assert.equal(Object.hasOwn(legacy.tasks[0],'priority'),false);
});

test('all three priorities survive JSON export and restore without changing other tasks',()=>{
 let state=fresh();const id=state.tasks[0].id,other=structuredClone(state.tasks[1]);
 for(const priority of ['low','high','medium']){
  state=reduce(state,{type:'taskPriority',id,priority},now);
  const restored=restore(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.tasks[0].priority,priority);
  assert.deepEqual(restored.tasks[1],other);
  assert.equal(restored.tasks[0].title,state.tasks[0].title);
 }
});

test('calendar synchronization, unlinking, and undo preserve the chosen priority',()=>{
 let state=fresh();const id=state.tasks[0].id;
 state=reduce(state,{type:'taskPriority',id,priority:'high'},now);
 state=reduce(state,{type:'calendarSelect',ids:['work']},now);
 state=reduce(state,{type:'calendarSnapshot',events:[{id:'provider',taskId:id,eventId:'event',calendarId:'work',title:'Renamed in Calendar',start:now,end:now+3600000}]},now);
 assert.equal(state.tasks[0].priority,'high');assert.equal(state.tasks[0].title,'Renamed in Calendar');
 state=reduce(state,{type:'taskCalendarUnlinked',id},now);
 const task=state.tasks[0];state=reduce(state,{type:'delete',id},now);
 state=reduce(state,{type:'restoreTask',task,index:0},now);
 assert.equal(restore(JSON.parse(JSON.stringify(state))).tasks[0].priority,'high');
});

test('malformed explicit priority values reject a backup without changing its data',()=>{
 const state=fresh(),original=structuredClone(state);
 for(const priority of [null,'urgent','',42,true,{},[]]){
  const invalid=structuredClone(state);invalid.tasks[0].priority=priority;
  assert.throws(()=>validateState(invalid),/not a valid Panda file/);
 }
 assert.deepEqual(state,original);
});

test('invalid or unchanged priority actions do not rewrite state',()=>{
 const state=fresh(),id=state.tasks[0].id;
 for(const priority of ['urgent',null,undefined,2])assert.strictEqual(reduce(state,{type:'taskPriority',id,priority},now),state);
 assert.strictEqual(reduce(state,{type:'taskPriority',id,priority:'medium'},now),state);
 assert.strictEqual(reduce(state,{type:'taskPriority',id:'absent-task',priority:'high'},now),state);
});
