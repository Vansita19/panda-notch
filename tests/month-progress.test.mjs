import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialState,reduce,advance,restore,validateState,dayKey} from '../src/model.mjs';
const at=(day,hour=9)=>new Date(2026,9,day,hour).getTime();
const quietState=(now=at(21))=>{const s=initialState(now);s.settings.quiet=true;return s;};

test('Today snapshots follow complete, reopen, add, delete, and Undo without changing other days',async()=>{
 const {getTaskDayProgress}=await import('../src/month-progress.mjs');let s=quietState(),id=s.tasks[0].id;
 assert.deepEqual(getTaskDayProgress(s,dayKey(at(21)),at(21)),{done:0,total:2});
 s=reduce(s,{type:'toggle',id},at(21));assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:1,total:2});
 s=reduce(s,{type:'toggle',id},at(21));assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:0,total:2});
 s=reduce(s,{type:'add',title:'Third'},at(21));const third=s.tasks.at(-1);
 assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:0,total:3});
 s=reduce(s,{type:'delete',id:third.id},at(21));assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:0,total:2});
 s=reduce(s,{type:'restoreTask',task:third,index:2},at(21));assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:0,total:3});
});
test('rollover freezes yesterday, carries unfinished work, and does not invent offline days',async()=>{
 const {getTaskDayProgress}=await import('../src/month-progress.mjs');let s=quietState(),id=s.tasks[0].id;
 s=reduce(s,{type:'toggle',id},at(21));s=advance(s,at(22));
 assert.deepEqual(getTaskDayProgress(s,at(21),at(22)),{done:1,total:2});
 assert.deepEqual(getTaskDayProgress(s,at(22),at(22)),{done:0,total:1});
 s=reduce(s,{type:'toggle',id},at(22));s=reduce(s,{type:'delete',id},at(22));
 assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:1,total:2});
 s=advance(s,at(25));assert.equal(s.taskHistory[dayKey(at(23))],undefined);assert.equal(s.taskHistory[dayKey(at(24))],undefined);
 assert.equal(getTaskDayProgress(s,at(26),at(25)),null);
});
test('the first action after midnight records the new day before its task change',()=>{
 let s=quietState();s=reduce(s,{type:'toggle',id:s.tasks[0].id},at(21));s=reduce(s,{type:'toggle',id:s.tasks[1].id},at(22));
 assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:1,total:2});
 assert.deepEqual(s.taskHistory[dayKey(at(22))],{done:1,total:1});
});
test('unchanged ticks and no-op actions keep state identity and do not rewrite history',()=>{
 const s=quietState();assert.strictEqual(advance(s,at(21,10)),s);
 assert.strictEqual(reduce(s,{type:'checkpoint'},at(21,10)),s);
 assert.strictEqual(reduce(s,{type:'taskPriority',id:s.tasks[0].id,priority:'medium'},at(21,10)),s);
});
test('a no-op action still records a new observed day exactly once',()=>{
 const s=quietState(),next=reduce(s,{type:'checkpoint'},at(22));
 assert.notStrictEqual(next,s);assert.equal(next.taskHistoryDay,dayKey(at(22)));
 assert.deepEqual(next.taskHistory[dayKey(at(21))],{done:0,total:2});
 assert.deepEqual(next.taskHistory[dayKey(at(22))],{done:0,total:2});
 assert.strictEqual(reduce(next,{type:'checkpoint'},at(22,10)),next);
 assert.strictEqual(advance(next,at(22,10)),next);
});
test('deleting a completed task and undoing it changes Today but leaves its frozen prior day intact',()=>{
 let s=quietState();const task=s.tasks[0];s=reduce(s,{type:'toggle',id:task.id},at(21));const completed=s.tasks[0];
 s=reduce(s,{type:'delete',id:task.id},at(21));assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:0,total:1});
 s=reduce(s,{type:'restoreTask',task:completed,index:0},at(21));assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:1,total:2});
 s=advance(s,at(22));s=reduce(s,{type:'delete',id:task.id},at(22));
 assert.deepEqual(s.taskHistory[dayKey(at(21))],{done:1,total:2});assert.deepEqual(s.taskHistory[dayKey(at(22))],{done:0,total:1});
});
test('linking, unlinking, priority, and renaming preserve the recorded daily counts',()=>{
 const s=quietState(),id=s.tasks[0].id;
 const link={eventId:'test-event',calendarId:'test-calendar',start:at(21,10),end:at(21,11)};
 let next=reduce(s,{type:'taskCalendarLinked',id,link},at(21));assert.deepEqual(next.taskHistory,s.taskHistory);
 next=reduce(next,{type:'taskCalendarUnlinked',id},at(21));next=reduce(next,{type:'taskPriority',id,priority:'high'},at(21));
 next=reduce(next,{type:'edit',id,title:'Renamed'},at(21));assert.deepEqual(next.taskHistory,s.taskHistory);
});
test('legacy restore records only evidenced past additions/completions, leaving denominators unknown',async()=>{
 const {getTaskDayProgress}=await import('../src/month-progress.mjs');const old=quietState();delete old.taskHistory;delete old.taskHistoryDay;
 old.tasks[0].created=at(20);old.tasks[0].done=true;old.tasks[0].completedDay=dayKey(at(20));old.tasks[1].created=at(19);
 const before=structuredClone(old.tasks),s=restore(old,at(21));
 assert.deepEqual(s.tasks,before);assert.deepEqual(getTaskDayProgress(s,at(20),at(21)),{done:1,total:null,created:1});
 assert.deepEqual(getTaskDayProgress(s,at(19),at(21)),{done:0,total:null,created:1});
 assert.equal(getTaskDayProgress(s,at(18),at(21)),null);assert.deepEqual(getTaskDayProgress(s,at(21),at(21)),{done:0,total:1});
 assert.equal(s.timer.seconds,old.timer.seconds);assert.equal(s.timer.sessions,old.timer.sessions);
});
test('history persists through export/import and rejects corrupt dates or counts without replacing tasks',()=>{
 let s=quietState();s=reduce(s,{type:'toggle',id:s.tasks[0].id},at(21));s=advance(s,at(22));
 const restored=restore(JSON.parse(JSON.stringify(s)),at(22));assert.deepEqual(restored.taskHistory,s.taskHistory);
 const invalidEntries=[['2026-2-30',{done:0,total:2}],['2026-10-20',{done:3,total:2}],['2026-10-20',{done:-1,total:2}],['2026-10-20',{done:1,total:null}],['2026-10-20',{done:1.5,total:2}],['2026-10-20',{done:0,total:5001}]];
 for(const [key,entry] of invalidEntries){const invalid=structuredClone(s);invalid.taskHistory[key]=entry;assert.throws(()=>validateState(invalid),/not a valid Panda file/);}
 const invalid=structuredClone(s);invalid.taskHistoryDay='2026-13-1';assert.throws(()=>validateState(invalid),/not a valid Panda file/);
 const array=structuredClone(s);array.taskHistory=[];assert.throws(()=>validateState(array),/not a valid Panda file/);
 const payload=structuredClone(s);payload.taskHistory[dayKey(at(21))].payload='unrelated';assert.throws(()=>validateState(payload),/not a valid Panda file/);
 assert.equal(s.tasks.length,2);
});
test('history retains recent observed dates within a bounded backup size and rejects oversized maps',()=>{
 const s=quietState(),today=new Date(at(21));s.taskHistory={};
 for(let ago=3999;ago>=0;ago--){const d=new Date(today);d.setDate(today.getDate()-ago);s.taskHistory[dayKey(d)]={done:0,total:2};}
 assert.doesNotThrow(()=>validateState(s));const oldest=Object.keys(s.taskHistory)[0],next=advance(s,at(22));
 assert.equal(Object.keys(next.taskHistory).length,3660);assert.equal(next.taskHistory[oldest],undefined);
 assert.deepEqual(next.taskHistory[dayKey(at(21))],{done:0,total:2});assert.deepEqual(next.taskHistory[dayKey(at(22))],{done:0,total:2});
 assert.ok(JSON.stringify(next.taskHistory).length<5*1024*1024);
 const d=new Date(today);d.setDate(today.getDate()+1);s.taskHistory[dayKey(d)]={done:0,total:2};
 assert.throws(()=>validateState(s),/not a valid Panda file/);
});
test('empty days stay quiet and the month grid runs Monday to Sunday across neighboring months',async()=>{
 const {getTaskDayProgress,monthGrid}=await import('../src/month-progress.mjs');const s=quietState();s.tasks=[];
 assert.equal(getTaskDayProgress(s,at(21),at(21)),null);
 const grid=monthGrid(2026,10);assert.equal(grid.length,42);assert.equal(new Date(grid[0].date).getDay(),1);assert.equal(grid[0].key,'2026-10-26');assert.equal(grid[6].key,'2026-11-1');assert.equal(new Date(grid.at(-1).date).getDay(),0);assert.equal(grid.filter(day=>day.inMonth).length,30);
});
test('month dates use local calendar steps through a daylight-saving transition',()=>{
 const moduleURL=new URL('../src/month-progress.mjs',import.meta.url).href;
 const script=`import {monthGrid} from ${JSON.stringify(moduleURL)};const days=monthGrid(2026,2);process.stdout.write(JSON.stringify({hours:days.map(d=>new Date(d.date).getHours()),gaps:days.slice(1).map((d,i)=>(d.date-days[i].date)/3600000),count:days.filter(d=>d.inMonth).length}));`;
 const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8'}));
 assert.ok(result.hours.every(hour=>hour===0));assert.ok(result.gaps.includes(23));assert.equal(result.count,31);
});
