export function durationParts(total){
 const value=Math.min(120,Math.max(1,Math.trunc(total)||1));
 return {hours:String(Math.floor(value/60)).padStart(2,'0'),minutes:String(value%60).padStart(2,'0')};
}
export function minutesFromDurationParts(hours,minutes){
 if(!/^\d{1,2}$/.test(String(hours))||!/^\d{1,2}$/.test(String(minutes)))return null;
 const h=Number(hours),m=Number(minutes),total=h*60+m;
 return h<=2&&m<60&&total>=1&&total<=120?total:null;
}
export function stepDurationPart(total,unit,direction){
 return Math.max(1,Math.min(120,Math.round(total)+(unit==='hours'?60:1)*Math.sign(direction)));
}
// A composed reel paints the full path once; no intermediate timer/model updates are needed.
export function durationReelSteps(fromMinutes,toMinutes){
 const clamp=value=>Math.min(120,Math.max(1,Math.trunc(value)||1));
 const from=clamp(fromMinutes),to=clamp(toMinutes),direction=Math.sign(to-from);
 return Array.from({length:Math.abs(to-from)},(_,index)=>from+direction*(index+1));
}
/** One wheel gesture owns its fractional painted index until the model commits on finish. */
export function createDurationWheelGesture(totalMinutes,unit,paintedIndex){
 const total=Math.min(120,Math.max(1,Math.trunc(totalMinutes)||1)),hours=unit==='hours';
 const base=hours?Math.floor(total/60):total,min=hours?0:1,max=hours?2:120;
 const clamp=value=>Math.max(min,Math.min(max,value));
 let position=clamp(Number.isFinite(paintedIndex)?paintedIndex:base),delta=0;
 return {
  move(deltaY,deltaMode=0){
   if(!Number.isFinite(deltaY))return position;
   const pixels=deltaY*(deltaMode===1?16:deltaMode===2?80:1);
   delta+=pixels;position=clamp(position+pixels/14);return position;
  },
  finish(){
   let index=Math.round(position);
   if(delta>0&&index<=base)index=base+1;else if(delta<0&&index>=base)index=base-1;
   index=clamp(index);
   return hours?Math.max(1,Math.min(120,index*60+total%60)):index;
  },
 };
}
export function focusModeOnEntry(timer,seconds,total){return timer.running||seconds<total?timer.mode:'focus';}
export function focusElapsed(seconds,total){return Number.isFinite(seconds)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(1,1-seconds/total)):0;}
