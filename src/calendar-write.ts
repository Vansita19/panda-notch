import {host,native} from './bridge';
export function writeCalendar(request:any):Promise<any>{
 if(!native)return Promise.reject(new Error('Calendar writes are available in the Mac app.'));
 return new Promise((resolve,reject)=>{
  const requestId=crypto.randomUUID();
  const finish=(e:Event)=>{const data=(e as CustomEvent).detail;if(data.requestId!==requestId)return;cleanup();data.error?reject(new Error(data.error)):resolve(data);};
  const timeout=setTimeout(()=>{cleanup();reject(new Error('Calendar has not confirmed the change. Check Calendar before retrying.'));},15000);
  const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('panda-calendar-result',finish);};
  window.addEventListener('panda-calendar-result',finish);host('calendarWrite',{...request,requestId});
 });
}
