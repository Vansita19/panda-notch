/** Delete only after Calendar confirms removal; Undo recreates owned time with a fresh event ID.
 * @param {any} task
 * @param {{native?:boolean,writeCalendar?:(request:any)=>Promise<any>,dispatch?:(action:any)=>void,index?:number,restoreTask?:(task:any,index:number)=>Promise<void>|void}} options
 */
export async function deleteTaskWithCalendar(task,{native=false,writeCalendar,dispatch,index=0,restoreTask}={}){
 const original={...task,...(task.calendarLink?{calendarLink:{...task.calendarLink}}:{})},link=original.calendarLink;
 if(native&&link)await writeCalendar({operation:'remove',taskId:task.id});
 if(link)dispatch({type:'taskCalendarUnlinked',id:task.id});
 dispatch({type:'delete',id:task.id});
 let restored=false;
 return async()=>{
  if(restored)return;restored=true;
  const {calendarLink,...localTask}=original;
  const record=native&&link?localTask:original;
  // Native writes require the restored task to reach the host before event recreation.
  if(restoreTask)await restoreTask(record,index);
  else dispatch({type:'restoreTask',task:record,index});
  if(!native||!link)return;
  try{
   const result=await writeCalendar({operation:'save',taskId:task.id,title:original.title,calendarId:link.calendarId,start:link.start,end:link.end});
   if(result?.event){const event=result.event;dispatch({type:'taskCalendarLinked',id:task.id,link:{...link,eventId:event.eventId,calendarId:event.calendarId,start:event.start,end:event.end,missing:false}});}
  }catch(error){throw new Error('Your task is restored. Calendar time could not be restored; schedule it again from the task.',{cause:error});}
 };
}
