import {localDayKey,dayFromKey} from './month-progress.mjs';
import {campaignActive,campaignDate} from './campaign.mjs';

export const trackerSlots=15,trackerSlotLimit=30,trackerLimit=100,trackerMinuteLimit=1440;
export const validTrackerSlots=value=>Number.isInteger(value)&&value>=1&&value<=trackerSlotLimit;
export const validTrackerMinutes=value=>Number.isInteger(value)&&value>=0&&value<=trackerMinuteLimit;
export const validTrackerGoalMinutes=value=>validTrackerMinutes(value)&&value>0;
export const trackerToday=(now=Date.now())=>campaignActive(now)?campaignDate(now).split('-').map(Number).join('-'):localDayKey(now);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
export const trackerTitle=value=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=100?value.trim():null;
export const initialTrackers=(now=Date.now())=>[{id:'job-applications',title:'Job applications',slots:trackerSlots,created:now,days:{}}];
export function validTrackers(trackers){
 if(!Array.isArray(trackers)||trackers.length>trackerLimit)return false;
 const ids=new Set();
 for(const tracker of trackers){
  if(!record(tracker)||typeof tracker.id!=='string'||!tracker.id.trim()||tracker.id.length>100||ids.has(tracker.id)||trackerTitle(tracker.title)!==tracker.title||!Number.isFinite(tracker.created)||!record(tracker.days)||Object.keys(tracker.days).length>4000)return false;
  const duration=tracker.kind==='duration';
  if(duration){
   if(tracker.id==='job-applications'||!validTrackerGoalMinutes(tracker.goalMinutes)||Object.hasOwn(tracker,'slots'))return false;
  }else if((tracker.kind!==undefined&&tracker.kind!=='count')||!validTrackerSlots(tracker.slots)||Object.hasOwn(tracker,'goalMinutes'))return false;

  ids.add(tracker.id);
  for(const [day,value] of Object.entries(tracker.days)){
   if(dayFromKey(day)===null)return false;
   if(duration ? !validTrackerMinutes(value) : !Number.isInteger(value)||value<0||value>=2**tracker.slots)return false;
  }
 }
 return true;
}
export const trackerMask=(tracker,day)=>tracker.kind==='duration'?0:tracker.days?.[day]??0;
export function trackerCount(tracker,day){
 let mask=trackerMask(tracker,day),count=0;
 while(mask){mask&=mask-1;count++;}return count;
}
export function shiftTrackerDay(day,delta){
 const stamp=dayFromKey(day);if(stamp===null||!Number.isInteger(delta))return null;
 const date=new Date(stamp);date.setHours(12);date.setDate(date.getDate()+delta);
 const next=localDayKey(date);return dayFromKey(next)===null?null:next;
}
export function recordedTrackerDays(trackers){
 return [...new Set(trackers.flatMap(tracker=>Object.keys(tracker.days)))].sort((a,b)=>dayFromKey(b)-dayFromKey(a));
}
