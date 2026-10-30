const validTime=time=>time&&Number.isFinite(time.start)&&Number.isFinite(time.end)&&time.end>time.start&&time.end-time.start<=86400000;

/** Read a task's displayed time without inventing a Calendar link or changing the task. */
export function taskSchedule(task){
 const link=task?.calendarLink;
 if(link&&!link.missing&&validTime(link))return {...link,local:false};
 const time=task?.plannedTime;
 if(!validTime(time)||time.timezone!=='Asia/Kolkata')return null;
 return {start:time.start,end:time.end,timezone:time.timezone,...(time.color?{color:time.color}:{}),local:true};
}
