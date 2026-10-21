import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,restore,validateState,resumeView} from '../src/model.mjs';

const now=new Date(2026,9,21,12).getTime();
const views=['today','tasks','focus','pins','dump','reminders'];

test('first use and legacy saves open Menu without changing existing content',()=>{
 const state=initialState(now);assert.equal(state.lastView,'today');assert.equal(resumeView(state),'today');
 delete state.lastView;
 const restored=restore(state);
 assert.equal(restored.lastView,'today');assert.equal(resumeView(restored),'today');
 assert.deepEqual(restored.tasks,state.tasks);assert.deepEqual(restored.notes,state.notes);assert.deepEqual(restored.settings,state.settings);
 assert.equal(Object.hasOwn(state,'lastView'),false);
});

test('each feature and Menu survive save and restore as the next opening destination',()=>{
 let state=initialState(now);state.settings.notchSize={width:520,height:310};
 const tasks=structuredClone(state.tasks),timer=structuredClone(state.timer),settings=structuredClone(state.settings);
 for(const view of views){
  state=reduce(state,{type:'view',view},now);
  const restored=restore(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.lastView,view);assert.equal(resumeView(restored),view);
  assert.deepEqual(restored.tasks,tasks);assert.deepEqual(restored.timer,timer);assert.deepEqual(restored.settings,settings);
 }
});

test('Settings and unsupported destinations never overwrite the remembered feature',()=>{
 const state=reduce(initialState(now),{type:'view',view:'tasks'},now);
 for(const view of ['settings','unknown','',null,undefined,{},[]])assert.strictEqual(reduce(state,{type:'view',view},now),state);
 assert.strictEqual(reduce(state,{type:'view',view:'tasks'},now),state);
 assert.equal(resumeView(state),'tasks');
});

test('explicit capture destinations override the remembered view and invalid targets fall back safely',()=>{
 const state=reduce(initialState(now),{type:'view',view:'focus'},now);
 for(const view of views)assert.equal(resumeView(state,view),view);
 for(const view of [undefined,null,'settings','unknown'])assert.equal(resumeView(state,view),'focus');
 assert.equal(resumeView({lastView:'settings'}),'today');
});

test('malformed explicit last-view values reject a backup without changing the original data',()=>{
 const state=initialState(now),original=structuredClone(state);
 for(const lastView of ['settings','unknown','',null,42,{},[]])assert.throws(()=>validateState({...state,lastView}),/not a valid Panda file/);
 assert.deepEqual(state,original);
});
