import {validSlot} from './planner.mjs';
const timeMinutes=value=>/^\d{2}:\d{2}$/.test(value)&&+value.slice(0,2)<24&&+value.slice(3)<60?+value.slice(0,2)*60+ +value.slice(3):null;
export function eventDraft(draft,base){
 const title=draft.title.trim();
 if(!title)return {error:'Give this task a name.'};
 if(!draft.start&&!draft.end)return {title};
 const a=timeMinutes(draft.start),b=timeMinutes(draft.end);
 if(a===null||b===null)return {error:'Enter both start and end times.'};
 const start=new Date(base),end=new Date(base);start.setHours(Math.floor(a/60),a%60,0,0);end.setHours(Math.floor(b/60),b%60,0,0);
 if(b===0&&+end<=+start)end.setDate(end.getDate()+1);
 if(!validSlot(+start,+end))return {error:'End time must be after start time.'};
 return {title,start:+start,end:+end};
}
// Used by debounce, blur, and dismissal; a deleted or acknowledged task never writes again.
export function eventDraftUpdate(draft,saved,base,present=true,requiresTime=false,invalidated=false){
 if(!present||invalidated||draft.title.trim()===saved.title&&draft.start===saved.start&&draft.end===saved.end)return null;
 const update=eventDraft(draft,base);
 if(!update.error&&requiresTime&&update.start===undefined)return {error:'Enter both start and end times.'};
 return update;
}
export function stepEventTime(value,minutes,isEnd=false){
 const previous=timeMinutes(value);if(previous===null)return value;
 let next=(isEnd&&previous===0?1440:previous)+minutes;
 if(isEnd&&next>=1440)next=0;else next=Math.max(0,Math.min(1439,next));
 return `${String(Math.floor(next/60)).padStart(2,'0')}:${String(next%60).padStart(2,'0')}`;
}
export function anchoredPosition(anchor,layer,bounds,gap=8){
 const left=Math.max(bounds.left+gap,Math.min(bounds.right-layer.width-gap,anchor.left));
 const below=anchor.bottom+gap,above=anchor.top-layer.height-gap;
 const preferred=below+layer.height<=bounds.bottom-gap?below:above>=bounds.top+gap?above:below;
 return {left,top:Math.max(bounds.top+gap,Math.min(bounds.bottom-layer.height-gap,preferred))};
}
