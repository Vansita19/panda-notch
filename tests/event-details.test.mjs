import test from 'node:test';
import assert from 'node:assert/strict';
const base=new Date(2026,9,21,9).getTime();
test('event drafts accept complete valid times and reject partial or inverted input',async()=>{
 const {eventDraft}=await import('../src/event-details.mjs');
 assert.deepEqual(eventDraft({title:'  Prepare review ',start:'09:15',end:'10:45'},base),{title:'Prepare review',start:new Date(2026,9,21,9,15).getTime(),end:new Date(2026,9,21,10,45).getTime()});
 assert.ok(eventDraft({title:'Review',start:'09:15',end:'09:00'},base).error);
 assert.ok(eventDraft({title:'Review',start:'09:15',end:''},base).error);
 assert.ok(eventDraft({title:'Review',start:'25:15',end:'26:00'},base).error);
 assert.deepEqual(eventDraft({title:'Review',start:'',end:''},base),{title:'Review'});
 const midnight=eventDraft({title:'Late task',start:'23:00',end:'00:00'},base);
 assert.equal(midnight.end-midnight.start,3600000);
});
test('time steppers move fifteen minutes and keep valid input boundaries',async()=>{
 const {stepEventTime}=await import('../src/event-details.mjs');
 assert.equal(stepEventTime('09:15',15),'09:30');
 assert.equal(stepEventTime('09:15',-15),'09:00');
 assert.equal(stepEventTime('00:00',-15),'00:00');
 assert.equal(stepEventTime('23:45',15,true),'00:00');
 assert.equal(stepEventTime('00:00',-15,true),'23:45');
 assert.equal(stepEventTime('00:00',15,true),'00:00');
 assert.equal(stepEventTime('23:50',15),'23:59');
});
test('editor anchors below a block, above near the bottom, and clamps horizontally',async()=>{
 const {anchoredPosition}=await import('../src/event-details.mjs');
 const bounds={left:0,top:0,right:700,bottom:600},layer={width:240,height:220};
 assert.deepEqual(anchoredPosition({left:400,top:100,right:650,bottom:140},layer,bounds),{left:400,top:148});
 assert.deepEqual(anchoredPosition({left:600,top:500,right:680,bottom:540},layer,bounds),{left:452,top:272});
 assert.deepEqual(anchoredPosition({left:-20,top:100,right:100,bottom:140},layer,bounds),{left:8,top:148});
});
test('dismissal flushes a valid dirty draft once while deletion or acknowledgement skips it',async()=>{
 const {eventDraftUpdate}=await import('../src/event-details.mjs');
 assert.equal(typeof eventDraftUpdate,'function');
 const saved={title:'Review',start:'09:00',end:'10:00'},draft={...saved,end:'10:15'};
 assert.deepEqual(eventDraftUpdate(draft,saved,base,true,true),{title:'Review',start:base,end:base+75*60000});
 assert.equal(eventDraftUpdate(draft,saved,base,false,true),null);
 assert.equal(eventDraftUpdate(draft,draft,base,true,true),null);
 assert.ok(eventDraftUpdate({...saved,end:''},saved,base,true,true).error);
 assert.ok(eventDraftUpdate({...saved,start:'11:00'},saved,base,true,true).error);
});
test('explicit unlink invalidates a dirty draft even while its task remains, and failure can restore autosave',async()=>{
 const {eventDraftUpdate}=await import('../src/event-details.mjs');
 const saved={title:'Review',start:'09:00',end:'10:00'},draft={...saved,title:'Updated review',end:'10:30'};
 const writes=[];
 const flush=invalidated=>{const update=eventDraftUpdate(draft,saved,base,true,true,invalidated);if(update&&!update.error)writes.push(update);};
 // Unlink confirmation, a queued save, and component cleanup all share this decision.
 flush(true);flush(true);flush(true);
 assert.equal(writes.length,0);
 // A failed removal keeps its event; the same draft becomes eligible again.
 flush(false);
 assert.deepEqual(writes,[{title:'Updated review',start:base,end:base+90*60000}]);
});

test('local campaign draft times stay on the IST day independently of the host timezone',async()=>{
 const {eventDraft,eventDraftUpdate}=await import('../src/event-details.mjs');
 const base=Date.parse('2026-10-31T20:00:00Z'),saved={title:'Review',start:'12:00',end:'14:00'},draft={...saved,end:'14:15'};
 assert.deepEqual(eventDraft(draft,base,'Asia/Kolkata'),{title:'Review',start:Date.parse('2026-11-01T06:30:00Z'),end:Date.parse('2026-11-01T08:45:00Z')});
 assert.deepEqual(eventDraftUpdate(draft,saved,base,true,true,false,'Asia/Kolkata'),{title:'Review',start:Date.parse('2026-11-01T06:30:00Z'),end:Date.parse('2026-11-01T08:45:00Z')});
 const midnight=eventDraft({title:'Late practice',start:'23:00',end:'00:00'},base,'Asia/Kolkata');
 assert.deepEqual(midnight,{title:'Late practice',start:Date.parse('2026-11-01T17:30:00Z'),end:Date.parse('2026-11-01T18:30:00Z')});
});
