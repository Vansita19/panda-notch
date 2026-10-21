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
export function focusModeOnEntry(timer,seconds,total){return timer.running||seconds<total?timer.mode:'focus';}
export function focusElapsed(seconds,total){return Number.isFinite(seconds)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(1,1-seconds/total)):0;}
