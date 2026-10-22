import {validSlot} from './planner.mjs';

/** Remove owned time after provider confirmation, keeping the task and returning one-shot Undo.
 * @param {any} task
 * @param {{native?:boolean,writeCalendar?:(request:any)=>Promise<any>,dispatch:(action:any)=>void,getTask:(id:string)=>any}} options
 * @returns {Promise<()=>Promise<void>>}
 */
export async function unlinkCalendarTaskTime(task,{native=false,writeCalendar,dispatch,getTask}){
 if(!task?.calendarLink)throw new Error('This task has no scheduled time to remove.');
 const id=task.id,link={...task.calendarLink};
 if(native){const result=await writeCalendar?.({operation:'remove',taskId:id});if(!result?.removed)throw new Error('Calendar did not confirm removal. Your task and time are unchanged.');}
 dispatch({type:'taskCalendarUnlinked',id});
 let used=false;
 return async()=>{
  if(used)return;used=true;
  const current=getTask(id);
  if(!current)throw new Error('This task no longer exists. Its time cannot be restored.');
  if(current.calendarLink)throw new Error('This task is already scheduled. Its current time was kept.');
  let restored={...link};
  if(native){
   try{
    const result=await writeCalendar?.({operation:'save',taskId:id,title:current.title,calendarId:link.calendarId,start:link.start,end:link.end}),event=result?.event;
    if(typeof event?.eventId!=='string'||!event.eventId.trim()||typeof event.calendarId!=='string'||!event.calendarId.trim()||!validSlot(event.start,event.end))throw new Error('Calendar did not confirm a restored event.');
    restored={...link,eventId:event.eventId,calendarId:event.calendarId,start:event.start,end:event.end,missing:false};
   }catch(error){throw new Error('Calendar time could not be restored. Your task is still here; schedule its time again.',{cause:error});}
  }
  const latest=getTask(id),scheduled=latest?.calendarLink;
  // The native bridge can apply this acknowledgement before the promise resumes.
  const acknowledged=native&&scheduled&&['eventId','calendarId','start','end'].every(key=>scheduled[key]===restored[key]);
  if(!latest||scheduled&&!acknowledged)throw new Error('The task changed while Calendar restored its time. Check Calendar before retrying.');
  dispatch({type:'taskCalendarLinked',id,link:restored});
 };
}
