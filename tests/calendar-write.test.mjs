import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

const bundled=await build({entryPoints:['src/calendar-write.ts'],bundle:true,write:false,platform:'node',format:'cjs'});
function fixture(onPost){
 const window=new EventTarget(),messages=[],timers=new Map();let nextTimer=0;
 window.webkit={messageHandlers:{panda:{postMessage(message){messages.push(message);onPost?.(message);}}}};
 const module={exports:{}};
 runInNewContext(bundled.outputFiles[0].text,{module,exports:module.exports,window,crypto:{randomUUID},setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id);}});
 const acknowledge=(request,data={})=>{const event=new Event('panda-calendar-result');event.detail={requestId:request.requestId,taskId:request.taskId,...data};window.dispatchEvent(event);};
 return {...module.exports,window,messages,timers,acknowledge,expire(){for(const fn of [...timers.values()])fn();}};
}
const save=taskId=>({operation:'save',taskId,title:'Plan',calendarId:'work',start:1000,end:2000});

test('a second write for one task is rejected without reaching the native host',async()=>{
 const f=fixture(),first=f.writeCalendar(save('one')),second=f.writeCalendar(save('one'));
 first.catch(()=>{});second.catch(()=>{});
 assert.equal(f.messages.length,1);
 await assert.rejects(second,/saving|pending|progress/i);
 assert.equal(f.isCalendarWritePending('one'),true);
 f.acknowledge(f.messages[0],{event:{eventId:'saved'}});await first;
 assert.equal(f.isCalendarWritePending('one'),false);
});

test('the task lock is acquired before posting and only its matching acknowledgement releases it',async()=>{
 let f,wasPending=false;
 f=fixture(()=>{wasPending=f.isCalendarWritePending('one');});
 const first=f.writeCalendar(save('one'));
 assert.equal(wasPending,true);
 f.acknowledge({requestId:'unrelated',taskId:'one'},{removed:true});
 assert.equal(f.isCalendarWritePending('one'),true);
 f.acknowledge(f.messages[0],{removed:true});await first;
 const retry=f.writeCalendar(save('one'));assert.equal(f.messages.length,2);
 f.acknowledge(f.messages[1],{removed:true});await retry;
 assert.equal(f.isCalendarWritePending('one'),false);assert.equal(f.timers.size,0);
});

test('native errors release the task so a retry can reach the host',async()=>{
 const f=fixture(),first=f.writeCalendar(save('one')),rejected=assert.rejects(first,/Permission denied/);
 f.acknowledge(f.messages[0],{error:'Permission denied'});await rejected;
 assert.equal(f.isCalendarWritePending('one'),false);
 const retry=f.writeCalendar(save('one'));assert.equal(f.messages.length,2);
 f.acknowledge(f.messages[1],{removed:true});await retry;
});

test('timeout releases the task and a late acknowledgement cannot release the replacement write',async()=>{
 const f=fixture(),first=f.writeCalendar(save('one')),rejected=assert.rejects(first,/not confirmed/);
 f.expire();await rejected;assert.equal(f.isCalendarWritePending('one'),false);
 const retry=f.writeCalendar(save('one'));
 f.acknowledge(f.messages[0],{removed:true});assert.equal(f.isCalendarWritePending('one'),true);
 f.acknowledge(f.messages[1],{removed:true});await retry;
 assert.equal(f.isCalendarWritePending('one'),false);assert.equal(f.timers.size,0);
});

test('writes for different tasks remain independent',async()=>{
 const f=fixture(),one=f.writeCalendar(save('one')),two=f.writeCalendar(save('two'));
 assert.equal(f.messages.length,2);
 assert.equal(f.isCalendarWritePending('one'),true);assert.equal(f.isCalendarWritePending('two'),true);
 f.acknowledge(f.messages[0],{removed:true});await one;
 assert.equal(f.isCalendarWritePending('one'),false);assert.equal(f.isCalendarWritePending('two'),true);
 f.acknowledge(f.messages[1],{removed:true});await two;
 assert.equal(f.isCalendarWritePending('two'),false);
});

test('a host posting failure releases the task and clears its timeout',async()=>{
 const f=fixture(()=>{throw new Error('Bridge closed');});
 await assert.rejects(f.writeCalendar(save('one')),/Bridge closed/);
 assert.equal(f.isCalendarWritePending('one'),false);assert.equal(f.timers.size,0);
});
