// Calendar geometry is local-time based. No timers or physics run in this module.
export const plannerColors=['#62a8ff','#b698ff','#efab78','#7bc6a4','#ef8fa4'];
export function dayRange(now=Date.now(),startHour=7,endHour=23){
 const start=new Date(now),end=new Date(now);start.setHours(startHour,0,0,0);end.setHours(endHour,0,0,0);return {start:+start,end:+end};
}
export function slotAt(y,height,range,duration=30*60000){
 const span=range.end-range.start;if(!Number.isFinite(y)||height<=0||span<=0)return null;
 const start=Math.max(range.start,Math.min(range.end-Math.min(duration,span),range.start+Math.round(y/height*span/900000)*900000));
 return {start,end:Math.min(range.end,start+duration)};
}
const QUARTER_HOUR=15*60000,HOUR=60*60000;
const usableRange=range=>range&&Number.isFinite(range.start)&&Number.isFinite(range.end)&&range.end>range.start;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const snapTime=(value,range)=>clamp(range.start+Math.round((value-range.start)/QUARTER_HOUR)*QUARTER_HOUR,range.start,range.end);
// Pointer coordinates map to boundaries, including the end of the working day.
export function timeAt(y,height,range){
 if(!Number.isFinite(y)||!Number.isFinite(height)||height<=0||!usableRange(range))return null;
 return snapTime(range.start+clamp(y/height,0,1)*(range.end-range.start),range);
}
// Hover shows available space for the hour; duration is decided by the subsequent drag.
export function hoverHourAt(y,height,range){
 if(!Number.isFinite(y)||!Number.isFinite(height)||height<=0||!usableRange(range))return null;
 const span=range.end-range.start,offset=clamp(y/height,0,1)*span;
 const start=range.start+Math.min(Math.floor(offset/HOUR)*HOUR,Math.max(0,span-HOUR));
 return {start,end:Math.min(range.end,start+HOUR)};
}
export function selectionRange(anchor,current,range){
 if(!Number.isFinite(anchor)||!Number.isFinite(current)||!usableRange(range))return null;
 const a=snapTime(anchor,range),b=snapTime(current,range),minimum=Math.min(QUARTER_HOUR,range.end-range.start);
 let start=Math.min(a,b),end=Math.max(a,b);
 if(end-start<minimum){end=Math.min(range.end,start+minimum);start=Math.max(range.start,end-minimum);}
 return {start,end};
}
export function validSlot(start,end){return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000;}
// Keep one rendered identity from the first dragged selection through Calendar's acknowledgement.
export function mergePlannerEvents(events=[],tasks=[],preview=null){
 const result=[],byTask=new Map(),visibleTask=new Map(tasks.map(task=>[task.id,task]));
 for(const event of events){
  if(!event.taskId){result.push(event);continue;}
  if(byTask.has(event.taskId))continue;
  const task=visibleTask.get(event.taskId),link=task?.calendarLink;
  // A write acknowledgement updates the task before EventKit's next snapshot arrives.
  if(task&&(!link||link.missing||!validSlot(link.start,link.end)))continue;
  const canonical=task?{start:link.start,end:link.end,title:task.title,allDay:false}:{};
  byTask.set(event.taskId,result.length);result.push({...event,...canonical,id:'task:'+event.taskId});
 }
 for(const task of tasks){
  const link=task.calendarLink;
  if(!link||link.missing||byTask.has(task.id)||!validSlot(link.start,link.end))continue;
  byTask.set(task.id,result.length);result.push({...link,id:'task:'+task.id,taskId:task.id,title:task.title,allDay:false});
 }
 if(preview?.taskId&&validSlot(preview.start,preview.end)){
  const index=byTask.get(preview.taskId),existing=index===undefined?{}:result[index];
  const task=tasks.find(task=>task.id===preview.taskId);
  const event={...existing,id:'task:'+preview.taskId,taskId:preview.taskId,start:preview.start,end:preview.end,title:task?.title??preview.title??existing.title??'',allDay:false,phase:preview.phase};
  if(index===undefined)result.push(event);else result[index]=event;
 }
 return result;
}
export function layoutEvents(events,range){
 const sorted=events.filter(e=>!e.allDay&&e.end>range.start&&e.start<range.end).map(e=>({...e,top:Math.max(e.start,range.start),bottom:Math.min(e.end,range.end)})).sort((a,b)=>a.top-b.top||b.bottom-a.bottom);
 const groups=[];let group=[],until=-Infinity;
 for(const e of sorted){if(e.top>=until&&group.length){groups.push(group);group=[];until=-Infinity;}group.push(e);until=Math.max(until,e.bottom);}if(group.length)groups.push(group);
 return groups.flatMap(group=>{const lanes=[];for(const e of group){let lane=lanes.findIndex(end=>end<=e.top);if(lane<0)lane=lanes.length;lanes[lane]=e.bottom;e.lane=lane;}return group.map(e=>({...e,lanes:lanes.length,top:(e.top-range.start)/(range.end-range.start),height:(e.bottom-e.top)/(range.end-range.start)}));});
}
export function reconcileTaskLinks(tasks,events){
 return tasks.map(task=>{const e=events.find(e=>e.taskId===task.id)||events.find(e=>e.eventId&&e.eventId===task.calendarLink?.eventId);if(!e)return task;
 return {...task,title:e.title,calendarLink:{...task.calendarLink,eventId:e.eventId,calendarId:e.calendarId,start:e.start,end:e.end,missing:false}};});
}
