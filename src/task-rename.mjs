/** Rename only: linked Calendar time stays exactly as saved, and local state waits for acknowledgement. */
export async function renameTaskWithCalendar(task,value,{native=false,writeCalendar,dispatch}){
 const title=value.trim().slice(0,500);
 if(!title||title===task.title)return {changed:false,title:task.title};
 if(native&&task.calendarLink){
  const {calendarId,start,end}=task.calendarLink;
  await writeCalendar({operation:'save',taskId:task.id,title,calendarId,start,end});
 }
 dispatch({type:'edit',id:task.id,title});
 return {changed:true,title};
}
