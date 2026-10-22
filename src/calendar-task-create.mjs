import {validSlot} from './planner.mjs';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const calendarID=value=>typeof value==='string'&&!!value.trim()&&value.length<=1000;
const message=(error,fallback)=>typeof error?.message==='string'&&error.message?error.message:fallback;

/** A new Calendar slot becomes a durable local task before the native event can reference it.
 * @param {{title:string,start:number,end:number,calendarId?:string}} values
 * @param {{native?:boolean,writeCalendar?:(request:any)=>Promise<any>,persistTask?:(task:any)=>Promise<void>,dispatch?:(action:any)=>void,now?:number,id?:string}} [options]
 */
export async function createTaskFromCalendar({title,start,end,calendarId},{native=false,writeCalendar,persistTask,dispatch,now=Date.now(),id=crypto.randomUUID()}={}){
 const name=typeof title==='string'?title.trim():'';
 if(!name||name.length>500)return {ok:false,error:'Give this event a name of up to 500 characters.'};
 if(!validSlot(start,end))return {ok:false,error:'Choose a valid start and end time.'};
 if(native&&!calendarID(calendarId))return {ok:false,error:'Choose a writable connected calendar first.'};
 if(!uuid(id)||!Number.isFinite(now)||typeof persistTask!=='function'||typeof dispatch!=='function')return {ok:false,error:'This task could not be created. Please try again.'};
 const task={id,title:name,section:'today',done:false,pinned:false,created:now,due:null,priority:'medium'};
 try{await persistTask(task);}
 catch(error){return {ok:false,error:`Could not save this task. ${message(error,'Please try again.')}`};}
 try{
  let link;
  if(native){
   const result=await writeCalendar({operation:'save',taskId:id,title:name,calendarId,start,end}),event=result?.event;
   if(!event||!calendarID(event.eventId)||!calendarID(event.calendarId)||!validSlot(event.start,event.end))throw new Error('Calendar did not confirm a saved event. Check Calendar before trying again.');
   link={eventId:event.eventId,calendarId:event.calendarId,start:event.start,end:event.end,missing:false};
  }else link={eventId:crypto.randomUUID(),calendarId:'preview',start,end,missing:false};
  dispatch({type:'taskCalendarLinked',id,link});
  return {ok:true,task:{...task,calendarLink:link}};
 }catch(error){return {ok:false,task,error:`Task added, but Calendar could not save its time. ${message(error,'Schedule it again from the task.')}`};}
}
