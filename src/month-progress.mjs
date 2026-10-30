import {campaignDate,campaignTaskVisible} from './campaign.mjs';
const historyLimit=3660;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
export function localDayKey(now=Date.now()){
 const d=new Date(now);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
export function dayFromKey(key){
 if(typeof key!=='string'||!/^\d{4}-\d{1,2}-\d{1,2}$/.test(key))return null;
 const [year,month,day]=key.split('-').map(Number),date=new Date(0);
 date.setFullYear(year,month-1,day);date.setHours(0,0,0,0);
 return year>=1&&date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day&&localDayKey(date)===key?date.getTime():null;
}
export function liveTaskProgress(tasks,now=Date.now()){
 const today=localDayKey(now);let done=0,total=0;
 for(const task of tasks){if(campaignTaskVisible(task,now)&&(!task.done||(task.campaign?.campaign_id==='november-2026'?task.campaign.date===campaignDate(now):task.completedDay===today))){total++;if(task.done)done++;}}
 return {done,total};
}
export function validTaskHistory(history,day){
 if(!record(history)||dayFromKey(day)===null||Object.keys(history).length>4000)return false;
 const count=value=>Number.isInteger(value)&&value>=0&&value<=5000;
 for(const [key,value] of Object.entries(history)){
  if(dayFromKey(key)===null||!record(value)||!count(value.done))return false;
  const fields=Object.keys(value);
  if(value.total===null){if(!count(value.created)||fields.length!==3||fields.some(key=>!['done','total','created'].includes(key)))return false;}
  else if(!count(value.total)||value.done>value.total||fields.length!==2||fields.some(key=>!['done','total'].includes(key)))return false;
 }
 return record(history[day])&&history[day].total!==null;
}
function trimHistory(history,current){
 const keys=Object.keys(history);if(keys.length<=historyLimit)return history;
 const kept=keys.filter(key=>key!==current).map(key=>({key,date:dayFromKey(key)})).sort((a,b)=>b.date-a.date).slice(0,historyLimit-1).map(entry=>entry.key);
 return Object.fromEntries([...kept,current].map(key=>[key,history[key]]));
}
function legacyHistory(tasks,today){
 const history={},before=dayFromKey(today);
 const entry=key=>history[key]??={done:0,total:null,created:0};
 for(const task of tasks){
  const created=localDayKey(task.created),createdDate=dayFromKey(created),completedDate=dayFromKey(task.completedDay);
  if(createdDate!==null&&createdDate<before)entry(created).created++;
  if(task.done&&completedDate!==null&&completedDate<before)entry(task.completedDay).done++;
 }
 return history;
}
// Called on observed days only. Missing days are unknown, rather than assumed empty.
export function updateTaskHistory(state,now=Date.now()){
 const day=localDayKey(now),progress=liveTaskProgress(state.tasks,now),existing=state.taskHistory?.[day];
 if(state.taskHistoryDay===day&&existing?.done===progress.done&&existing?.total===progress.total)return state;
 const history={...(state.taskHistory??legacyHistory(state.tasks,day)),[day]:progress};
 return {...state,taskHistory:trimHistory(history,day),taskHistoryDay:day};
}
export function getTaskDayProgress(state,day,now=Date.now()){
 const key=typeof day==='string'?day:localDayKey(day),stamp=dayFromKey(key),today=dayFromKey(localDayKey(now));
 if(stamp===null||stamp>today)return null;
 const progress=stamp===today?liveTaskProgress(state.tasks,now):state.taskHistory?.[key];
 if(!progress||(!progress.total&&!progress.done&&!progress.created))return null;
 return progress.total===null?{done:progress.done,total:null,created:progress.created}:{done:progress.done,total:progress.total};
}
export function monthGrid(year,monthIndex){
 const first=new Date(0);first.setFullYear(year,monthIndex,1);first.setHours(0,0,0,0);
 first.setDate(first.getDate()-(first.getDay()+6)%7);
 return Array.from({length:42},(_,index)=>{
  const date=new Date(first);date.setDate(first.getDate()+index);
  return {date:date.getTime(),key:localDayKey(date),day:date.getDate(),inMonth:date.getFullYear()===year&&date.getMonth()===monthIndex};
 });
}
