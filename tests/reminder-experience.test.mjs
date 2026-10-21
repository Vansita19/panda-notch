import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,advance,restore,shouldPlayReminder} from '../src/model.mjs';
const at=new Date(2026,9,5,12).getTime();
function ready(){const s=initialState(at);s.events=[];s.settings.startHour=0;s.settings.endHour=0;return s;}
test('a reminder dismisses at five seconds without a click or rescheduling itself',()=>{
 let s=reduce(ready(),{type:'nudge'},at);assert.ok(advance(s,at+4999).alert);s=advance(s,at+5000);assert.equal(s.alert,null);assert.equal(s.lastNudge,at);
});
test('silent reminders persist, preview silently, and still fire automatically',()=>{
 let s=ready();s=reduce(s,{type:'editReminder',id:'water',sound:false},at);
 assert.equal(s.reminders[0].intervalMinutes,60);assert.equal(restore(s).reminders[0].sound,false);
 const live=advance(s,at+3600000);assert.equal(live.alert.sound,false);assert.equal(shouldPlayReminder(live,live.alert),false);
 const preview=reduce(s,{type:'nudge',reminderId:'water'},at);assert.equal(preview.alert.sound,false);
 s=reduce(s,{type:'editReminder',id:'water',sound:true},at);const audible=advance(s,at+3600000);assert.equal(shouldPlayReminder(audible,audible.alert),true);
 audible.settings.quiet=true;assert.equal(shouldPlayReminder(audible,audible.alert),false);
});
test('old reminders migrate with sound and invalid sound flags are rejected',()=>{
 const s=ready();delete s.reminders[0].sound;assert.equal(restore(s).reminders[0].sound,true);
 s.reminders[0].sound='no';assert.throws(()=>restore(s));
});
test('an expired banner cannot dismiss a newer calendar alert',()=>{
 let s=reduce(ready(),{type:'nudge'},at);const id=s.alert.id;s.alert={kind:'event',id:'new',at:at+1000,title:'Meeting'};
 assert.equal(reduce(s,{type:'dismissAlert',id},at+3000).alert.id,'new');
});
test('reminder display duration defaults to five seconds and supports a custom saved duration',()=>{
 let s=ready();assert.equal(s.settings.reminderDisplaySeconds,5);
 delete s.settings.reminderDisplaySeconds;assert.equal(restore(s).settings.reminderDisplaySeconds,5);
 s=reduce(s,{type:'settings',patch:{reminderDisplaySeconds:7}},at);s=reduce(s,{type:'nudge'},at);
 assert.ok(advance(s,at+6999).alert);assert.equal(advance(s,at+7000).alert,null);
 assert.equal(restore(s).settings.reminderDisplaySeconds,7);
 for(const invalid of [0,2,61,2.5,'5']){s.settings.reminderDisplaySeconds=invalid;assert.throws(()=>restore(s));}
});
