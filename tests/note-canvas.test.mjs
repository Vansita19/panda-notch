import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,restore,validateState} from '../src/model.mjs';
const now=new Date(2026,9,21,12).getTime();
const fresh=()=>initialState(now);

test('legacy notes migrate with their original bodies intact and an empty current draft title',()=>{
 const old=fresh();delete old.brainDumpTitle;delete old.activeNoteId;
 old.notes=[{id:'legacy',body:'  First line\nSecond line  ',created:now-1000}];old.brainDump='Unfinished draft\n';
 const s=restore(old,now);assert.equal(s.brainDumpTitle,'');assert.equal(s.activeNoteId,null);
 assert.deepEqual(s.notes,old.notes);assert.equal(s.brainDump,old.brainDump);
});
test('an explicitly identified draft saves its title and exact body, then selects the saved note',()=>{
 let s=fresh();s=reduce(s,{type:'noteDraftTitle',value:'Design ideas'},now);
 s=reduce(s,{type:'brainDump',value:'  Keep this spacing\n\n'},now);
 s=reduce(s,{type:'saveNote',id:'note-one'},now);
 assert.deepEqual(s.notes[0],{id:'note-one',title:'Design ideas',body:'  Keep this spacing\n\n',created:now});
 assert.equal(s.activeNoteId,'note-one');assert.equal(s.brainDump,'');assert.equal(s.brainDumpTitle,'');
 const restored=restore(JSON.parse(JSON.stringify(s)),now);assert.deepEqual(restored.notes,s.notes);assert.equal(restored.activeNoteId,'note-one');
});
test('a title alone can create a note and a wholly empty new draft stays unsaved',()=>{
 const empty=fresh();assert.strictEqual(reduce(empty,{type:'saveNote',id:'empty'},now),empty);
 let s=reduce(empty,{type:'noteDraftTitle',value:'A new idea'},now);s=reduce(s,{type:'saveNote',id:'title-only'},now);
 assert.equal(s.notes[0].body,'');assert.equal(s.notes[0].title,'A new idea');assert.doesNotThrow(()=>validateState(s));
});
test('existing-note autosave preserves whitespace, supports clearing, and ignores unchanged edits',()=>{
 let s=fresh();s.notes=[{id:'legacy',body:'Original',created:now-1000}];
 s=reduce(s,{type:'updateNote',id:'legacy',title:'Renamed',body:'  A line\n\n'},now+1);
 assert.equal(s.notes[0].title,'Renamed');assert.equal(s.notes[0].body,'  A line\n\n');assert.equal(s.notes[0].updated,now+1);
 assert.strictEqual(reduce(s,{type:'updateNote',id:'legacy',title:'Renamed',body:'  A line\n\n'},now+2),s);
 s=reduce(s,{type:'updateNote',id:'legacy',title:'',body:''},now+3);
 assert.equal(s.notes[0].title,'');assert.equal(s.notes[0].body,'');assert.doesNotThrow(()=>validateState(s));
 const legacy=fresh();legacy.notes=[{id:'old',body:'Keep me',created:now}];
 const cleared=reduce(legacy,{type:'updateNote',id:'old',body:''},now);
 assert.equal(cleared.notes[0].title,'');assert.equal(cleared.notes[0].body,'');assert.doesNotThrow(()=>validateState(cleared));
});
test('changing focused notes keeps an unfinished draft and deleting the selected note returns to it',()=>{
 let s=fresh();s.notes=[{id:'one',title:'One',body:'First',created:now},{id:'two',title:'Two',body:'Second',created:now}];
 s=reduce(s,{type:'brainDump',value:'Unfinished'},now);s=reduce(s,{type:'noteDraftTitle',value:'Draft'},now);
 s=reduce(s,{type:'focusNote',id:'two'},now);assert.equal(s.activeNoteId,'two');
 assert.strictEqual(reduce(s,{type:'focusNote',id:'missing'},now),s);assert.strictEqual(reduce(s,{type:'focusNote',id:'two'},now),s);
 const removed=s.notes[1];s=reduce(s,{type:'deleteNote',id:'two'},now);assert.equal(s.activeNoteId,null);
 assert.equal(s.brainDump,'Unfinished');assert.equal(s.brainDumpTitle,'Draft');
 s=reduce(s,{type:'restoreNote',note:removed,index:1},now);assert.deepEqual(s.notes[1],removed);
 s=reduce(s,{type:'focusNote',id:'one'},now);s=reduce(s,{type:'focusNote',id:null},now);assert.equal(s.activeNoteId,null);
});
test('caps and duplicate ids never discard a draft or introduce duplicate notes',()=>{
 let s=reduce(fresh(),{type:'noteDraftTitle',value:'x'.repeat(250)},now);assert.equal(s.brainDumpTitle.length,200);
 s=reduce(s,{type:'saveNote',id:'one'},now);s=reduce(s,{type:'brainDump',value:'Second draft'},now);
 assert.strictEqual(reduce(s,{type:'saveNote',id:'one'},now),s);assert.equal(s.brainDump,'Second draft');
 const full=fresh();full.notes=Array.from({length:5000},(_,i)=>({id:String(i),body:'Kept',created:now}));full.brainDump='Keep this draft';
 assert.strictEqual(reduce(full,{type:'saveNote',id:'overflow'},now),full);assert.equal(full.brainDump,'Keep this draft');
 s=reduce(s,{type:'updateNote',id:'one',title:'y'.repeat(250),body:'z'.repeat(100001)},now);
 assert.equal(s.notes[0].title.length,200);assert.equal(s.notes[0].body.length,100000);
});
test('unchanged draft edits preserve state identity and legacy saveNote keeps its trim behavior',()=>{
 const empty=fresh();assert.strictEqual(reduce(empty,{type:'noteDraftTitle',value:''},now),empty);assert.strictEqual(reduce(empty,{type:'brainDump',value:''},now),empty);
 let s=reduce(empty,{type:'brainDump',value:'  Legacy draft\n  '},now);s=reduce(s,{type:'saveNote'},now);
 assert.equal(s.notes[0].body,'Legacy draft');assert.equal(s.activeNoteId,s.notes[0].id);
});
test('imports reject corrupt note fields and invalid focus ids without changing the source',()=>{
 const s=fresh(),before=structuredClone(s);
 for(const patch of [{brainDumpTitle:42},{brainDumpTitle:'x'.repeat(201)},{activeNoteId:'missing'},{activeNoteId:7},{notes:[{id:'legacy',body:'',created:now}]},{notes:[{id:'typed',title:42,body:'Hello',created:now}]},{notes:[{id:'typed',title:'x'.repeat(201),body:'Hello',created:now}]}])assert.throws(()=>validateState({...s,...patch}),/not a valid Panda file/);
 assert.deepEqual(s,before);
});
