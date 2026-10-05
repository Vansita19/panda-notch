import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, reduce, remaining, validateState, advance, canNudge, restore, visibleTasks} from '../src/model.mjs';
const now = new Date(2026,9,4,11).getTime();
const fresh = () => initialState(now);
test('blank tasks are ignored and trimmed captures survive serialization',()=>{let s=fresh();s.tasks=[];s=reduce(s,{type:'add',title:'   '},now);assert.equal(s.tasks.length,0);s=reduce(s,{type:'add',title:'  Call mum  '},now);assert.equal(s.tasks[0].title,'Call mum');assert.equal(validateState(JSON.parse(JSON.stringify(s))).tasks[0].title,'Call mum');});
test('only one task is pinned and completion clears the pin',()=>{let s=fresh();s=reduce(s,{type:'pin',id:s.tasks[0].id},now);s=reduce(s,{type:'pin',id:s.tasks[1].id},now);assert.equal(s.tasks.filter(t=>t.pinned).length,1);s=reduce(s,{type:'toggle',id:s.tasks[1].id},now);assert.equal(s.tasks.filter(t=>t.pinned).length,0);});
test('malformed imports reject completely rather than erase tasks',()=>{assert.throws(()=>validateState({version:1,tasks:[{title:42}]}));const s=fresh();s.tasks[0].title='';assert.throws(()=>validateState(s));});
test('focus pause and resume preserve elapsed time',()=>{let s=fresh();s=reduce(s,{type:'timerStart'},now);assert.equal(remaining(s.timer,now+10000),1490);s=reduce(s,{type:'timerPause'},now+10000);assert.equal(remaining(s.timer,now+90000),1490);s=reduce(s,{type:'timerStart'},now+90000);assert.equal(remaining(s.timer,now+100000),1480);});
test('four completed focus sessions select long break without auto-start',()=>{let s=fresh();for(let i=0;i<4;i++){s=reduce(s,{type:'timerMode',mode:'focus'},now);s=reduce(s,{type:'timerStart'},now);s=advance(s,now+1500001);assert.equal(s.timer.running,false);}assert.equal(s.timer.sessions,4);assert.equal(s.timer.mode,'long');assert.equal(s.timer.seconds,900);});
test('early end never counts as completed and sleep pauses',()=>{let s=reduce(fresh(),{type:'timerStart'},now);s=reduce(s,{type:'sleep'},now+20000);assert.equal(s.timer.running,false);assert.equal(s.timer.seconds,1480);s=reduce(s,{type:'timerReset'},now+30000);assert.equal(s.timer.sessions,0);});
test('wellness respects quiet hours and focus without blocking the whole calendar event',()=>{let s=fresh();s.settings.quiet=false;s.lastNudge=0;s.reminders[0].lastFired=0;s.events=[];assert.equal(canNudge(s,now),true);s.timer.running=true;assert.equal(canNudge(s,now),false);s.timer.running=false;s.events=[{id:'e',title:'Meet',start:now+60000,end:now+3600000}];assert.equal(canNudge(s,now),true);s.events=[];s.settings.quiet=true;assert.equal(canNudge(s,now),false);});
test('calendar reminder persists and acknowledges per occurrence',()=>{let s=fresh();s.events=[{id:'e',title:'Meet',start:now+60000,end:now+3600000}];s=advance(s,now);assert.equal(s.alert?.kind,'event');s=reduce(s,{type:'dismissAlert'},now);s=advance(s,now+1000);assert.equal(s.alert,null);});
test('snoozed event returns once, cancelled event clears its cue',()=>{let s=fresh();s.events=[{id:'e',title:'Meet',start:now+60000,end:now+3600000}];s=advance(s,now);s=reduce(s,{type:'snoozeAlert'},now);assert.equal(advance(s,now+1000).alert,null);s=advance(s,now+300001);assert.equal(s.alert?.kind,'event');s.events=[];s=advance(s,now+300002);assert.equal(s.alert,null);});
test('changing quiet mode does not reset a paused focus session',()=>{let s=reduce(fresh(),{type:'timerStart'},now);s=reduce(s,{type:'timerPause'},now+60000);s=reduce(s,{type:'settings',patch:{quiet:true}},now+61000);assert.equal(s.timer.seconds,1440);});
test('calendar alerts preempt wellness banners',()=>{let s=fresh();s.events=[{id:'e',title:'Meet',start:now+60000,end:now+3600000}];s=reduce(s,{type:'nudge'},now);s=advance(s,now);assert.equal(s.alert.kind,'event');});
test('quiet mode dismisses unsolicited cues already on screen',()=>{let s=reduce(fresh(),{type:'nudge'},now);s=reduce(s,{type:'settings',patch:{quiet:true}},now);assert.equal(s.alert,null);});
test('snoozed wellness returns in fifteen minutes even with an hourly cadence',()=>{let s=fresh();s.events=[];s=reduce(s,{type:'nudge'},now);s=reduce(s,{type:'snoozeAlert'},now);assert.equal(advance(s,now+14*60000).alert,null);s=advance(s,now+15*60000);assert.equal(s.alert?.title,'Drink water, buddy.');});
test('backup validation rejects primitive reminder maps',()=>{let s=fresh();s.seen=true;assert.throws(()=>validateState(s));s=fresh();s.snoozed=[];assert.throws(()=>validateState(s));});
test('custom reminder repeats at its own interval and can be disabled',()=>{let s=fresh();s.events=[];s=reduce(s,{type:'addReminder',title:'Stretch your paws',intervalMinutes:20},now);assert.equal(s.reminders.length,2);s=advance(s,now+20*60000);assert.equal(s.alert?.title,'Stretch your paws');s=reduce(s,{type:'dismissAlert'},now+20*60000);s=reduce(s,{type:'toggleReminder',id:s.reminders[1].id},now+21*60000);assert.equal(advance(s,now+40*60000).alert,null);});

test('daily list clears completed items at local midnight and carries unfinished ones',()=>{let s=fresh();s=reduce(s,{type:'toggle',id:s.tasks[0].id},now);assert.equal(visibleTasks(s,now).length,2);const tomorrow=new Date(2026,9,5,0,1).getTime();assert.deepEqual(visibleTasks(s,tomorrow).map(t=>t.id),[s.tasks[1].id]);assert.equal(visibleTasks(restore(JSON.parse(JSON.stringify(s))),tomorrow).length,1);});
test('brain dump persists line breaks and selected thoughts become tasks',()=>{let s=reduce(fresh(),{type:'brainDump',value:'A small idea\nCall mum'},now);s=reduce(s,{type:'add',title:'Call mum'},now);s=restore(JSON.parse(JSON.stringify(s)));assert.equal(s.brainDump,'A small idea\nCall mum');assert.equal(s.tasks.at(-1).title,'Call mum');s.brainDump=42;assert.throws(()=>validateState(s));});
test('wake preserves reminder cadence with a one-minute grace, without a backlog',()=>{
 let s=fresh();s.events=[];
 s=reduce(s,{type:'wake'},now+90*60000);
 assert.equal(advance(s,now+90*60000+59000).alert,null);
 s=advance(s,now+91*60000);assert.equal(s.alert?.kind,'wellness');
 s=reduce(s,{type:'dismissAlert'},now+91*60000+1);
 assert.equal(advance(s,now+92*60000).alert,null);
});
test('restart does not lose an unacknowledged calendar cue',()=>{let s=fresh();s.events=[{id:'e',title:'Meet',start:now+60000,end:now+3600000}];s=advance(s,now);s=restore(JSON.parse(JSON.stringify(s)));assert.equal(advance(s,now+1000).alert?.title,'Meet');});
test('a display tick just before Start never adds an extra second',()=>{const s=reduce(fresh(),{type:'timerStart'},now+500);assert.equal(remaining(s.timer,now),1500);});
test('focus completion waits behind a calendar cue instead of disappearing',()=>{let s=fresh();s.events=[{id:'e',title:'Meet',start:now+60000,end:now+3600000}];s.timer.seconds=1;s=reduce(s,{type:'timerStart'},now);s=advance(s,now);s=advance(s,now+1000);assert.equal(s.alert.kind,'event');s=reduce(s,{type:'dismissAlert'},now+1001);s=advance(s,now+1002);assert.equal(s.alert?.kind,'timer');assert.equal(s.timer.mode,'short');});
test('saved notes keep line breaks, newest first, and survive restart without creating tasks',()=>{let s=fresh();const count=s.tasks.length;s=reduce(s,{type:'brainDump',value:'First thought\nKeep this detail'},now);s=reduce(s,{type:'saveNote'},now);assert.equal(s.brainDump,'');s=reduce(s,{type:'brainDump',value:'Second thought'},now+1);s=reduce(s,{type:'saveNote'},now+1);s=restore(JSON.parse(JSON.stringify(s)));assert.deepEqual(s.notes.map(n=>n.body),['Second thought','First thought\nKeep this detail']);assert.equal(s.tasks.length,count);assert.equal(s.notes[1].created,now);});
test('blank notes do not save and old drafts migrate without loss',()=>{let old=fresh();delete old.notes;old.brainDump='Unfinished thought';let s=restore(old);assert.deepEqual(s.notes,[]);assert.equal(s.brainDump,old.brainDump);s=reduce(s,{type:'brainDump',value:'  \n  '},now);assert.strictEqual(reduce(s,{type:'saveNote'},now),s);});
test('removing a note supports undo and invalid note backups are rejected',()=>{let s=reduce(reduce(fresh(),{type:'brainDump',value:'Keep me'},now),{type:'saveNote'},now);const note=s.notes[0];s=reduce(s,{type:'deleteNote',id:note.id},now);assert.equal(s.notes.length,0);s=reduce(s,{type:'restoreNote',note,index:0},now);assert.deepEqual(s.notes,[note]);for(const invalid of [null,{},[{...note,body:''}],[note,note],[{...note,created:'yesterday'}]]){assert.throws(()=>validateState({...s,notes:invalid}));}});
test('mascot name defaults for existing saves and persists a personal name',()=>{let s=fresh();delete s.settings.mascotName;s=restore(s);assert.equal(s.settings.mascotName,'Bubu');s=reduce(s,{type:'settings',patch:{mascotName:'Mochi'}},now);assert.equal(restore(JSON.parse(JSON.stringify(s))).settings.mascotName,'Mochi');for(const value of [42,'x'.repeat(25)])assert.throws(()=>validateState({...s,settings:{...s.settings,mascotName:value}}));});
test('connecting calendars replaces samples and disconnecting removes real events',()=>{let s=reduce(fresh(),{type:'calendarSelect',ids:['google-main']},now);assert.equal(s.calendar.mode,'connected');assert.deepEqual(s.events,[]);const events=[{id:'meeting',title:'Design review',start:now+60000,end:now+3600000}];s=reduce(s,{type:'calendarSnapshot',events},now);assert.deepEqual(s.events,events);s=restore(JSON.parse(JSON.stringify(s)));assert.deepEqual(s.calendar.selectedIds,['google-main']);s=reduce(s,{type:'calendarDisconnect'},now);assert.equal(s.calendar.mode,'off');assert.deepEqual(s.events,[]);assert.deepEqual(reduce(s,{type:'calendarSnapshot',events},now).events,[]);});
test('all-day calendar entries do not suppress wellness or produce timed alerts',()=>{let s=fresh();s.events=[{id:'all-day',title:'Birthday',start:now-3600000,end:now+12*3600000,allDay:true}];s.lastNudge=0;s.reminders[0].lastFired=0;assert.equal(canNudge(s,now),true);assert.equal(advance(s,now).alert.kind,'wellness');});
test('idle checkpoints do not rewrite unchanged data',()=>{const s=fresh();assert.strictEqual(reduce(s,{type:'checkpoint'},now),s);});
test('calendar import rejects malformed selections and stale snapshots are ignored after disconnect',()=>{const s=fresh();for(const calendar of [null,{mode:'connected',selectedIds:'all'},{mode:'connected',selectedIds:[42]},{mode:'unknown',selectedIds:[]}])assert.throws(()=>validateState({...s,calendar}));});

test('mascot sounds migrate on, persist off, and reject malformed settings',()=>{let old=fresh();delete old.settings.mascotSounds;let s=restore(old);assert.equal(s.settings.mascotSounds,true);s=reduce(s,{type:'settings',patch:{mascotSounds:false}},now);assert.equal(restore(JSON.parse(JSON.stringify(s))).settings.mascotSounds,false);assert.throws(()=>validateState({...s,settings:{...s.settings,mascotSounds:'yes'}}));});
test('calendar pop-ups close after three seconds without repeating the same occurrence',()=>{let s=fresh();s.events=[{id:'first',title:'Planning',start:now+60000,end:now+3600000}];s=advance(s,now);assert.equal(s.alert?.kind,'event');assert.equal(advance(s,now+2999).alert?.kind,'event');s=advance(s,now+3000);assert.equal(s.alert,null);assert.equal(advance(s,now+4000).alert,null);assert.equal(advance(restore(JSON.parse(JSON.stringify(s))),now+5000).alert,null);s.events.push({id:'next',title:'Design time',start:now+10*60000,end:now+3600000});s=advance(s,now+5*60000);assert.equal(s.alert?.title,'Design time');assert.equal(advance(s,now+5*60000+3000).alert,null);});

test('timer stepper snaps every starting minute onto the five-minute grid in every mode',async()=>{
 const {stepTimerMinutes}=await import('../src/model.mjs');
 for(const [mode,pref] of [['focus','focusMinutes'],['short','shortMinutes'],['long','longMinutes']]){
  for(let value=1;value<=120;value++)for(const direction of [-1,1]){
   const expected=direction>0?Math.min(120,(Math.floor(value/5)+1)*5):Math.max(1,(Math.ceil(value/5)-1)*5);
   const result=stepTimerMinutes(value,direction);
   assert.equal(result,expected,`${mode}: ${value}, direction ${direction}`);
   let s=reduce(fresh(),{type:'timerMode',mode},now);
   s=reduce(s,{type:'settings',patch:{[pref]:result}},now);
   assert.equal(s.timer.seconds,result*60);
   s=reduce(s,{type:'timerStart'},now);
   assert.equal(remaining(s.timer,now+1000),result*60-1);
  }
 }
});
test('timer completion produces a sound cue even behind another alert, only once',()=>{
 for(const mode of ['focus','short','long']){
  let s=reduce(fresh(),{type:'timerMode',mode},now);s.timer.seconds=1;
  s=reduce(s,{type:'timerStart'},now);s.alert={kind:'task',key:`${s.tasks[0].id}:1`,title:'Task',id:'task-cue',at:now};s.tasks[0].due=1;
  assert.equal(s.timer.completedAt??null,null);
  s=advance(s,now+1000);assert.equal(s.timer.completedAt,now+1000);assert.equal(s.alert.kind,'task');
  const stamp=s.timer.completedAt;s=advance(s,now+2000);assert.equal(s.timer.completedAt,stamp);
  s=reduce(s,{type:'timerReset'},now+3000);assert.equal(s.timer.completedAt,stamp);
 }
});

// Calendar blocks used as a daily planner must not starve hourly water reminders.
test('automatic water reminder follows the short event heads-up during long planning blocks',()=>{
 let s=fresh();s.events=[{id:'planning',title:'Creative work',start:now,end:now+3*3600000}];
 s.reminders[0].lastFired=now-3600000;s.lastNudge=now-3600000;
 s=advance(s,now);assert.equal(s.alert?.kind,'event');
 s=advance(s,now+3000);assert.equal(s.alert?.kind,'wellness');
 assert.equal(s.alert.title,'Drink water, buddy.');
 s=advance(s,now+22000);assert.equal(s.alert,null);
 assert.equal(advance(s,now+3599000).alert,null);
 assert.equal(advance(s,now+3603000).alert?.kind,'wellness');
});
test('repeated unlocks do not restart the full water reminder interval',()=>{
 let s=fresh();s.events=[];
 s=reduce(s,{type:'wake'},now+20*60000);s=reduce(s,{type:'wake'},now+40*60000);
 assert.equal(advance(s,now+60*60000).alert?.kind,'wellness');
});
test('an unattended completion notice does not block every later reminder',()=>{
 let s=fresh();s.events=[];s.timer.seconds=1;s=reduce(s,{type:'timerStart'},now);
 s=advance(s,now+1000);assert.equal(s.alert?.kind,'timer');
 assert.equal(advance(s,now+5000).alert?.kind,'timer');
 s=advance(s,now+20000);assert.equal(s.alert,null);
 assert.equal(advance(s,now+3600000).alert?.kind,'wellness');
});
