import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const at=(day,hour=0,minute=0)=>new Date(2026,9,day,hour,minute).getTime();
const event=(id,day,start,end,extra={})=>({id,title:id,start:at(day,start),end:at(day,end),...extra});

test('an ongoing event from yesterday chooses today and counts every overlapping entry',async()=>{
 const {deriveMenuUpcoming}=await import('../src/menu-upcoming.mjs');
 const ongoing={id:'overnight',title:'Overnight',start:at(20,23),end:at(21,10)};
 const allDay={id:'all-day',title:'All day',start:at(21),end:at(22),allDay:true};
 const future=event('Review',21,12,13),past=event('Finished',21,7,8),tomorrow=event('Tomorrow',22,9,10);
 const events=[future,tomorrow,past,ongoing,allDay],before=events.slice();
 const result=deriveMenuUpcoming(events,at(21,9));
 assert.equal(result.date,at(21));assert.equal(result.eventCount,4);
 assert.deepEqual(result.events,[ongoing,allDay,future]);
 assert.equal(result.events[0],ongoing);assert.deepEqual(events,before);
});
test('the next available day is selected without borrowing a later day count or rows',async()=>{
 const {deriveMenuUpcoming}=await import('../src/menu-upcoming.mjs');
 const next=event('Next',22,9,10),later=event('Later',23,8,9);
 const result=deriveMenuUpcoming([later,event('Past',21,7,8),next],at(21,12));
 assert.equal(result.date,at(22));assert.equal(result.eventCount,1);assert.deepEqual(result.events,[next]);
});
test('midnight endpoints are exclusive and an overnight event moves to the current day after midnight',async()=>{
 const {deriveMenuUpcoming}=await import('../src/menu-upcoming.mjs');
 const overnight={id:'night',title:'Night',start:at(21,23,30),end:at(22,2)};
 const previous={id:'previous',title:'Previous',start:at(20,23),end:at(21)};
 const next=event('Morning',22,6,7);
 const first=deriveMenuUpcoming([next,previous,overnight],at(21,23));
 assert.equal(first.date,at(21));assert.equal(first.eventCount,1);assert.deepEqual(first.events,[overnight]);
 const after=deriveMenuUpcoming([next,previous,overnight],at(22,0,30));
 assert.equal(after.date,at(22));assert.equal(after.eventCount,2);assert.deepEqual(after.events,[overnight,next]);
});
test('row limits do not reduce the full-day count, and malformed or ended-only collections stay empty',async()=>{
 const {deriveMenuUpcoming}=await import('../src/menu-upcoming.mjs');
 const entries=Array.from({length:5},(_,i)=>event('Event '+i,21,10+i,11+i));
 assert.equal(deriveMenuUpcoming(entries,at(21,9),{limit:1}).events.length,1);
 assert.equal(deriveMenuUpcoming(entries,at(21,9),{limit:1}).eventCount,5);
 assert.equal(deriveMenuUpcoming(entries,at(21,9),{limit:10}).events.length,3);
 const invalid=[null,{},event('',21,10,11),{title:'Bad',start:NaN,end:at(21,20)},{title:'Inverted',start:at(21,12),end:at(21,11)}];
 assert.equal(deriveMenuUpcoming(invalid,at(21,9)),null);
 assert.equal(deriveMenuUpcoming([event('Ended',21,8,9)],at(21,9)),null);
 assert.equal(deriveMenuUpcoming(null,at(21,9)),null);
});
test('a daylight-saving day stops at local midnight rather than a fixed 24-hour boundary',()=>{
 const moduleURL=new URL('../src/menu-upcoming.mjs',import.meta.url).href;
 const script=`import {deriveMenuUpcoming} from ${JSON.stringify(moduleURL)};const d=(day,hour=0,minute=0)=>new Date(2026,2,day,hour,minute).getTime();const events=[{title:'All day',start:d(8),end:d(9),allDay:true},{title:'Past',start:d(8,1),end:d(8,3)},{title:'Evening',start:d(8,18),end:d(8,19)},{title:'Late',start:d(8,23,30),end:d(9)},{title:'Tomorrow',start:d(9,0,30),end:d(9,1)}];const result=deriveMenuUpcoming(events,d(8,12));process.stdout.write(JSON.stringify({count:result.eventCount,date:result.date,day:d(8),titles:result.events.map(e=>e.title)}));`;
 const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8'}));
 assert.equal(result.date,result.day);assert.equal(result.count,4);assert.deepEqual(result.titles,['All day','Evening','Late']);
});
