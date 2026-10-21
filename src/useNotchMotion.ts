import {useLayoutEffect,useRef,type RefObject} from 'react';
import {createNotchMotion,notchMotion} from './notch-motion.mjs';
import {host} from './bridge';
export function useNotchMotion(surface:RefObject<HTMLDivElement|null>,visual:RefObject<HTMLDivElement|null>,layout:RefObject<HTMLDivElement|null>,open:boolean,closing:boolean,reduced:boolean,onRest:()=>void,widthKey?:number){
 const controller=useRef<any>(null),latest=useRef({open,closing,reduced,onRest});latest.current={open,closing,reduced,onRest};
 useLayoutEffect(()=>{
  if(!surface.current||!visual.current||!layout.current)return;
  controller.current=createNotchMotion(surface.current,visual.current,(height:number,isOpen:boolean,width:number)=>{
   const safe=parseFloat(getComputedStyle(surface.current!).getPropertyValue('--safe-top'))||28;
   host('resize',{width:width+28,height:height+(height>safe?16:0),open:isOpen});
  },()=>latest.current.onRest(),getComputedStyle,layout.current);
  return()=>{controller.current?.dispose();controller.current=null;};
 },[]);
 useLayoutEffect(()=>{
  const node=layout.current;if(!node)return;
  const update=()=>{
   const state=latest.current,safe=parseFloat(getComputedStyle(node).getPropertyValue('--safe-top'))||28;
   const width=surface.current!.offsetWidth;
   if(node.style.width!==`${width}px`){node.style.width=`${width}px`;node.style.marginInline='auto';}
   const height=state.closing&&!state.open?safe:node.offsetHeight;
   const instant=!!node.closest('[data-resizing]')||state.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
   controller.current?.to(height,{width,open:state.open,duration:instant?0:state.open?notchMotion.open:notchMotion.close});
  };
  update();const observer=new ResizeObserver(update);observer.observe(node);if(surface.current)observer.observe(surface.current);
  return()=>observer.disconnect();
 },[open,closing,reduced,layout,widthKey]);
}
