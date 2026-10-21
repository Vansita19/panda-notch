// One interruptible clip reveal keeps text at its real layout size.
// The native window reserves the painted extent until contraction finishes.
export const notchMotion = {open:280,close:240,tab:140,ease:'cubic-bezier(.22,1,.36,1)'};
export function createNotchMotion(surface,visual,resize,onRest,readStyle=getComputedStyle,layout=visual.firstElementChild,now=()=>performance.now(),onGeometry=(_geometry)=>{}){
 let animation=null,revision=0,box=0,boxWidth=0,target=null,lastOpen=null,lastWidth=null,lastTransitionKey=null,deadline=0,hostFrame=null;
 const reportSize=(height,open,width)=>{hostFrame={height,open,width};resize(height,open,width);};
 const cancel=()=>{animation?.cancel();animation=null;};
 const clip=(bottom,side=0)=>`inset(0px ${Math.max(0,side)}px ${Math.max(0,bottom)}px ${Math.max(0,side)}px round 0px 0px 14px 14px)`;
 const insets=value=>{
  const parts=value?.match(/^inset\(([^)]*?)(?:\s+round\s|\))/)?.[1].trim().split(/\s+/).map(parseFloat);
  if(!parts?.length||parts.some(n=>!Number.isFinite(n)))return [0,0,0,0];
  return [parts[0],parts[1]??parts[0],parts[2]??parts[0],parts[3]??parts[1]??parts[0]];
 };
 function to(height,{open,duration,width=400,transitionKey}){
  height=Math.ceil(height);width=Math.ceil(width);
  if(target===height&&lastOpen===open&&lastWidth===width&&lastTransitionKey===transitionKey&&(!animation||duration))return;
  // Observer refinements share the original gesture's deadline; they never add another full reveal.
  const stamp=now();
  if(animation&&lastOpen===open&&lastWidth===width&&lastTransitionKey===transitionKey)duration=Math.min(duration,Math.max(0,deadline-stamp));
  deadline=stamp+duration;
  const token=++revision,[top,right,bottom,left]=insets(readStyle(visual).clipPath);
  const visible=Math.max(0,box-top-bottom),visibleWidth=Math.max(0,boxWidth-left-right);
  cancel();target=height;lastOpen=open;lastWidth=width;lastTransitionKey=transitionKey;
  const reserved=Math.max(box,height,visible),reservedWidth=Math.max(boxWidth,width,visibleWidth);
  const from=clip(reserved-visible,(reservedWidth-visibleWidth)/2),end=clip(reserved-height,(reservedWidth-width)/2);
  visual.style.width=`${reservedWidth}px`;visual.style.position='relative';visual.style.left=`${(width-reservedWidth)/2}px`;
  // The canvas can retain its old dimensions without stretching its contents.
  if(layout){layout.style.width=`${width}px`;layout.style.marginInline='auto';}
  const finish=()=>{if(token!==revision)return;visual.style.clipPath=end;visual.style.height=`${reserved}px`;surface.style.height=`${reserved}px`;box=reserved;boxWidth=reservedWidth;delete surface.dataset.moving;cancel();reportSize(height,open,width);onRest();};
  const animate=!!box&&!!duration&&(Math.abs(visible-height)>=.5||Math.abs(visibleWidth-width)>=.5);
  onGeometry({fromHeight:visible,height,duration:animate?duration:0,open});
  if(!animate){finish();return;}
  box=reserved;boxWidth=reservedWidth;surface.style.height=`${reserved}px`;visual.style.height=`${reserved}px`;visual.style.clipPath=end;surface.dataset.moving='true';
  reportSize(reserved,open,Math.max(width,visibleWidth));
  animation=visual.animate([{clipPath:from},{clipPath:end}],{duration,easing:notchMotion.ease,fill:'both'});
  animation.onfinish=finish;
 }
 return {to,refreshSize(){if(hostFrame)resize(hostFrame.height,hostFrame.open,hostFrame.width);},dispose(){revision++;cancel();}};
}
