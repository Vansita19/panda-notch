// Transitions.dev panel-reveal easing, adapted to a top-anchored notch.
// Emil Kowalski's guidance: interruptible, under 300 ms, no per-frame layout.
export const notchMotion = {open:260,close:200,tab:140,ease:'cubic-bezier(.22,1,.36,1)'};
export function createNotchMotion(surface,visual,resize,onRest,readStyle=getComputedStyle){
 let animation=null,revision=0,box=0,target=null,lastOpen=null;
 const clip=bottom=>`inset(0px 0px ${Math.max(0,bottom)}px round 0px 0px 14px 14px)`;
 function to(height,{open,duration}){
  height=Math.ceil(height);
  if(target===height&&lastOpen===open&&(!animation||duration))return;
  const token=++revision;
  const match=readStyle(visual).clipPath?.match(/^inset\(\S+\s+\S+\s+([\d.]+)px/);
  const visible=box-(match?Number(match[1]):0);
  animation?.cancel();animation=null;target=height;lastOpen=open;
  const reserved=Math.max(height,visible),from=clip(reserved-visible),end=clip(reserved-height);
  const finish=()=>{if(token!==revision)return;visual.style.clipPath=clip(0);visual.style.height=`${height}px`;surface.style.height=`${height}px`;box=height;delete surface.dataset.moving;animation?.cancel();animation=null;resize(height,open);onRest();};
  if(!box||!duration||Math.abs(visible-height)<.5){finish();return;}
  box=reserved;surface.style.height=`${reserved}px`;visual.style.height=`${reserved}px`;visual.style.clipPath=end;surface.dataset.moving='true';resize(reserved,open);
  animation=visual.animate([{clipPath:from},{clipPath:end}],{duration,easing:notchMotion.ease,fill:'both'});
  animation.onfinish=finish;
 }
 return {to,dispose(){revision++;animation?.cancel();}};
}
