// One interruptible clip reveal keeps text at its real layout size.
// The native window reserves the painted extent until contraction finishes.
export const notchMotion = {open:280,close:240,tab:140,ease:'cubic-bezier(.22,1,.36,1)'};
export function createNotchMotion(surface,visual,resize,onRest,readStyle=getComputedStyle,layout=visual.firstElementChild){
 let animation=null,revision=0,box=0,boxWidth=0,target=null,lastOpen=null,lastWidth=null;
 const cancel=()=>{animation?.cancel();animation=null;};
 const clip=(bottom,side=0)=>`inset(0px ${Math.max(0,side)}px ${Math.max(0,bottom)}px ${Math.max(0,side)}px round 0px 0px 14px 14px)`;
 const insets=value=>{
  const parts=value?.match(/^inset\(([^)]*?)(?:\s+round\s|\))/)?.[1].trim().split(/\s+/).map(parseFloat);
  if(!parts?.length||parts.some(n=>!Number.isFinite(n)))return [0,0,0,0];
  return [parts[0],parts[1]??parts[0],parts[2]??parts[0],parts[3]??parts[1]??parts[0]];
 };
 function to(height,{open,duration,width=400}){
  height=Math.ceil(height);width=Math.ceil(width);
  if(target===height&&lastOpen===open&&lastWidth===width&&(!animation||duration))return;
  const token=++revision,[top,right,bottom,left]=insets(readStyle(visual).clipPath);
  const visible=Math.max(0,box-top-bottom),visibleWidth=Math.max(0,boxWidth-left-right);
  cancel();target=height;lastOpen=open;lastWidth=width;
  const reserved=Math.max(box,height,visible),reservedWidth=Math.max(boxWidth,width,visibleWidth);
  const from=clip(reserved-visible,(reservedWidth-visibleWidth)/2),end=clip(reserved-height,(reservedWidth-width)/2);
  visual.style.width=`${reservedWidth}px`;visual.style.position='relative';visual.style.left=`${(width-reservedWidth)/2}px`;
  // The canvas can retain its old dimensions without stretching its contents.
  if(layout){layout.style.width=`${width}px`;layout.style.marginInline='auto';}
  const finish=()=>{if(token!==revision)return;visual.style.clipPath=end;visual.style.height=`${reserved}px`;surface.style.height=`${reserved}px`;box=reserved;boxWidth=reservedWidth;delete surface.dataset.moving;cancel();resize(height,open,width);onRest();};
  if(!box||!duration||(Math.abs(visible-height)<.5&&Math.abs(visibleWidth-width)<.5)){finish();return;}
  box=reserved;boxWidth=reservedWidth;surface.style.height=`${reserved}px`;visual.style.height=`${reserved}px`;visual.style.clipPath=end;surface.dataset.moving='true';
  resize(reserved,open,Math.max(width,visibleWidth));
  animation=visual.animate([{clipPath:from},{clipPath:end}],{duration,easing:notchMotion.ease,fill:'both'});
  animation.onfinish=finish;
 }
 return {to,dispose(){revision++;cancel();}};
}
