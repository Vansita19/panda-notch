// Both sides expand equally around the notch; height is independent and grows down.
export function resizeNotch(start,dx,dy){
 const clamp=(value,min,max)=>Math.round(Math.min(max,Math.max(Math.min(min,max),value)));
 return {
  width:clamp(start.width+dx*(start.side==='left'?-1:1)*2,400,start.maxWidth),
  height:clamp(start.height+dy,260,start.maxHeight),
 };
}
