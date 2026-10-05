import test from 'node:test';
import assert from 'node:assert/strict';
import {taskProgress,dayKey} from '../src/model.mjs';
const now=new Date(2026,9,4,12).getTime();
test('task progress counts today’s completed tasks and unfinished carry-over',()=>{
 const tasks=Array.from({length:6},(_,i)=>({id:String(i),done:i<2,completedDay:i<2?dayKey(now):null}));
 assert.deepEqual(taskProgress({tasks},now),{done:2,total:6});
 assert.deepEqual(taskProgress({tasks},now+86400000),{done:0,total:4});
 tasks[1].done=false;assert.deepEqual(taskProgress({tasks},now),{done:1,total:6});
});
test('empty and all-complete progress remain valid',()=>{
 assert.deepEqual(taskProgress({tasks:[]},now),{done:0,total:0});
 assert.deepEqual(taskProgress({tasks:[{done:true,completedDay:dayKey(now)}]},now),{done:1,total:1});
});
