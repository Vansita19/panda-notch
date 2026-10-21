import {useLayoutEffect,useRef,type RefObject} from 'react';
import {createNotchMotion,notchMotion} from './notch-motion.mjs';
import {host} from './bridge';
type NotchGeometry={width:number;view:string;navigation:boolean;toast?:boolean};
export function useNotchMotion(surface:RefObject<HTMLDivElement|null>,visual:RefObject<HTMLDivElement|null>,layout:RefObject<HTMLDivElement|null>,open:boolean,closing:boolean,reduced:boolean,onRest:()=>void,geometry?:NotchGeometry,overlay?:RefObject<HTMLDivElement|null>){
 const overlayHeight=useRef(0),overlayAnimation=useRef<Animation|null>(null);
 const controller=useRef<any>(null),latest=useRef({open,closing,reduced,onRest});latest.current={open,closing,reduced,onRest};
 useLayoutEffect(()=>{
  if(!surface.current||!visual.current||!layout.current)return;
  controller.current=createNotchMotion(surface.current,visual.current,(height:number,isOpen:boolean,width:number)=>{
   const safe=parseFloat(getComputedStyle(surface.current!).getPropertyValue('--safe-top'))||28;
   host('resize',{width:width+28,height:height+(height>safe?16:0)+(overlayHeight.current?overlayHeight.current+8:0),open:isOpen});
  },()=>latest.current.onRest(),getComputedStyle,layout.current,()=>performance.now(),({fromHeight,height,duration}:any)=>{
   const node=overlay?.current;if(!node)return;
   overlayAnimation.current?.cancel();node.style.transform=`translateY(${height+8}px)`;
   if(duration){const animation=node.animate([{transform:`translateY(${fromHeight+8}px)`},{transform:`translateY(${height+8}px)`}],{duration,easing:notchMotion.ease});overlayAnimation.current=animation;animation.onfinish=()=>{if(overlayAnimation.current===animation)overlayAnimation.current=null;};}
   else overlayAnimation.current=null;
  });
  return()=>{controller.current?.dispose();controller.current=null;overlayAnimation.current?.cancel();};
 },[]);
 useLayoutEffect(()=>{
  const node=layout.current;if(!node)return;
  const update=()=>{
   const state=latest.current,safe=parseFloat(getComputedStyle(node).getPropertyValue('--safe-top'))||28;
   const width=surface.current!.offsetWidth;
   if(node.style.width!==`${width}px`){node.style.width=`${width}px`;node.style.marginInline='auto';}
   const height=state.closing&&!state.open?safe:node.offsetHeight;
   const instant=!!node.closest('[data-resizing]')||state.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
   controller.current?.to(height,{width,open:state.open,duration:instant?0:state.open?notchMotion.open:notchMotion.close,transitionKey:`${geometry?.view??''}:${geometry?.navigation?'navigation':'home'}`});
  };
  // View and navigation changes must measure their final combined layout before paint.
  update();const observer=new ResizeObserver(update);observer.observe(node);if(surface.current)observer.observe(surface.current);
  return()=>observer.disconnect();
 },[open,closing,reduced,layout,geometry?.width,geometry?.view,geometry?.navigation]);
 useLayoutEffect(()=>{
  const node=overlay?.current;if(!node)return;
  const update=()=>{const height=Math.ceil(node.offsetHeight);if(height===overlayHeight.current)return;overlayHeight.current=height;controller.current?.refreshSize();};
  update();const observer=new ResizeObserver(update);observer.observe(node);
  return()=>observer.disconnect();
 },[overlay,geometry?.toast]);
}
