// Both sides expand equally around the notch; height is independent and grows down.
export function resizeNotch(start,dx,dy){
 const clamp=(value,min,max)=>Math.round(Math.min(max,Math.max(Math.min(min,max),value)));
 return {
  width:clamp(start.width+dx*(start.side==='left'?-1:1)*2,start.minWidth??400,start.maxWidth),
  height:clamp(start.height+dy,260,start.maxHeight),
 };
}
// Expanded width is a presentation of the compact preference, not a new base size.
export function savedResizeSize(start,size){
 const width=start.expanded?(size.width===start.width?start.compactWidth:size.width/2):size.width;
 return {width:Math.round(Math.max(300,Math.min(720,width))),height:size.height};
}
