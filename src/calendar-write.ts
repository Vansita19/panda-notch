import {host,native} from './bridge';
const pendingTasks=new Set<string>();
export function isCalendarWritePending(taskId:string){return pendingTasks.has(taskId);}
export function writeCalendar(request:any):Promise<any>{
 if(!native)return Promise.reject(new Error('Calendar writes are available in the Mac app.'));
 const taskId=request.taskId;
 if(isCalendarWritePending(taskId))return Promise.reject(new Error('Calendar is already saving this task. Try again when it finishes.'));
 return new Promise((resolve,reject)=>{
  const requestId=crypto.randomUUID();
  const finish=(e:Event)=>{const data=(e as CustomEvent).detail;if(data.requestId!==requestId)return;cleanup();data.error?reject(new Error(data.error)):resolve(data);};
  const timeout=setTimeout(()=>{cleanup();reject(new Error('Calendar has not confirmed the change. Check Calendar before retrying.'));},15000);
  const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('panda-calendar-result',finish);pendingTasks.delete(taskId);};
  pendingTasks.add(taskId);window.addEventListener('panda-calendar-result',finish);
  try{host('calendarWrite',{...request,requestId});}catch(error){cleanup();reject(error);}
 });
}
