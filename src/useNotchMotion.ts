import {useLayoutEffect,useRef,type RefObject} from 'react';
import {createNotchMotion,notchMotion} from './notch-motion.mjs';
import {host} from './bridge';
export function useNotchMotion(surface:RefObject<HTMLDivElement|null>,visual:RefObject<HTMLDivElement|null>,layout:RefObject<HTMLDivElement|null>,open:boolean,closing:boolean,reduced:boolean,onRest:()=>void){
 const controller=useRef<any>(null),latest=useRef({open,closing,reduced,onRest});latest.current={open,closing,reduced,onRest};
 useLayoutEffect(()=>{
  if(!surface.current||!visual.current||!layout.current)return;
  controller.current=createNotchMotion(surface.current,visual.current,(height:number,isOpen:boolean)=>host('resize',{width:428,height:height+(height>parseFloat(getComputedStyle(surface.current!).getPropertyValue('--safe-top'))?16:0),open:isOpen}),()=>latest.current.onRest());
  return()=>{controller.current?.dispose();controller.current=null;};
 },[]);
 useLayoutEffect(()=>{
  const node=layout.current;if(!node)return;
  const update=()=>{
   const state=latest.current;
   const safe=parseFloat(getComputedStyle(node).getPropertyValue('--safe-top'))||28;
   const height=state.closing&&!state.open?safe:node.offsetHeight;
   const instant=state.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.inputModality==='keyboard';
   controller.current?.to(height,{open:state.open,duration:instant?0:state.open?notchMotion.open:notchMotion.close});
  };
  update();const observer=new ResizeObserver(update);observer.observe(node);
  return()=>observer.disconnect();
 },[open,closing,reduced,layout]);
}
