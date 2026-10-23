import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,taskProgress,visibleTasks,dayKey} from '../src/model.mjs';
import {finishesVisibleTasks} from '../src/task-completion.mjs';

const now=new Date(2026,9,23,12).getTime();
const task=(id,patch={})=>({id,title:id,section:'today',done:false,pinned:false,created:now,due:null,priority:'medium',...patch});
const state=tasks=>({...initialState(now),tasks});

test('celebrate only the last unfinished task using the same visible progress as the app',()=>{
 let current=state([task('done',{done:true,completedDay:dayKey(now)}),task('one'),task('two')]);
 assert.equal(finishesVisibleTasks(current,'one',now),false);
 current=reduce(current,{type:'toggle',id:'one'},now);
 assert.equal(finishesVisibleTasks(current,'two',now),true);
 current=reduce(current,{type:'toggle',id:'two'},now);
 assert.deepEqual(taskProgress(current,now),{done:3,total:3});
 assert.equal(finishesVisibleTasks(current,'two',now),false,'Reopening must not celebrate');
});

test('the final carry-over task celebrates and historical completed tasks are excluded',()=>{
 const current=state([task('past',{done:true,completedDay:dayKey(now-86400000)}),task('carry',{created:now-86400000})]);
 assert.equal(visibleTasks(current,now).length,1);
 assert.equal(finishesVisibleTasks(current,'carry',now),true);
 const finished=reduce(current,{type:'toggle',id:'carry'},now);
 assert.deepEqual(taskProgress(finished,now),{done:1,total:1});
 assert.equal(finishesVisibleTasks(finished,'past',now),false);
});

test('empty lists, missing tasks, and already complete tasks never trigger',()=>{
 assert.equal(finishesVisibleTasks(state([]),'none',now),false);
 assert.equal(finishesVisibleTasks(state([task('one')]),'missing',now),false);
 const complete=state([task('one',{done:true,completedDay:dayKey(now)})]);
 assert.equal(finishesVisibleTasks(complete,'one',now),false);
});

test('Undo restores an unfinished task and progress without changing another task',()=>{
 const current=state([task('one',{done:true,completedDay:dayKey(now)}),task('two')]);
 assert.equal(finishesVisibleTasks(current,'two',now),true);
 const completed=reduce(current,{type:'toggle',id:'two'},now);
 const undone=reduce(completed,{type:'toggle',id:'two'},now);
 assert.deepEqual(taskProgress(undone,now),{done:1,total:2});
 assert.equal(undone.tasks.find(item=>item.id==='one').done,true);
 assert.equal(undone.tasks.find(item=>item.id==='two').done,false);
});
