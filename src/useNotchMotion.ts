import {useLayoutEffect,useRef,type RefObject} from 'react';
import {createNotchMotion,notchMotion} from './notch-motion.mjs';
import {host} from './bridge';
type NotchGeometry={width:number;view:string;navigation:boolean;toast?:boolean;measureHeight?:()=>number;availableHeight?:number};
export function useNotchMotion(surface:RefObject<HTMLDivElement|null>,visual:RefObject<HTMLDivElement|null>,layout:RefObject<HTMLDivElement|null>,open:boolean,closing:boolean,reduced:boolean,onRest:()=>void,geometry?:NotchGeometry,overlay?:RefObject<HTMLDivElement|null>){
 const overlayHeight=useRef(0),overlayAnimation=useRef<Animation|null>(null);
 const recompute=useRef<(()=>void)|null>(null);
 const controller=useRef<any>(null),latest=useRef({open,closing,reduced,onRest,measureHeight:geometry?.measureHeight,availableHeight:geometry?.availableHeight});latest.current={open,closing,reduced,onRest,measureHeight:geometry?.measureHeight,availableHeight:geometry?.availableHeight};
 useLayoutEffect(()=>{
  if(!surface.current||!visual.current||!layout.current)return;
  controller.current=createNotchMotion(surface.current,visual.current,(height:number,isOpen:boolean,width:number)=>{
   const safe=parseFloat(getComputedStyle(surface.current!).getPropertyValue('--safe-top'))||28;
   const frameHeight=height+(height>safe?16:0)+(overlayHeight.current?overlayHeight.current+8:0),available=latest.current.availableHeight;
   host('resize',{width:width+28,height:available!==undefined&&Number.isFinite(available)&&available>0?Math.min(frameHeight,available+15):frameHeight,open:isOpen});
  },()=>latest.current.onRest(),getComputedStyle,layout.current,()=>performance.now(),({fromHeight,height,duration}:any)=>{
   const node=overlay?.current;if(!node)return;
   overlayAnimation.current?.cancel();node.style.transform=`translateY(${height+8}px)`;
   if(duration){const animation=node.animate([{transform:`translateY(${fromHeight+8}px)`},{transform:`translateY(${height+8}px)`}],{duration,easing:notchMotion.ease});overlayAnimation.current=animation;animation.onfinish=()=>{if(overlayAnimation.current===animation)overlayAnimation.current=null;};}
   else overlayAnimation.current=null;
  });
  return()=>{controller.current?.dispose();controller.current=null;overlayAnimation.current?.cancel();surface.current?.style.removeProperty('--screen-height');};
 },[]);
 useLayoutEffect(()=>{
  const node=layout.current;if(!node)return;
  const update=()=>{
   const state=latest.current,safe=parseFloat(getComputedStyle(node).getPropertyValue('--safe-top'))||28;
   const previousOverlay=overlayHeight.current;
   overlayHeight.current=Math.ceil(overlay?.current?.offsetHeight||0);
   const available=state.availableHeight,hasLimit=available!==undefined&&Number.isFinite(available)&&available>0;
   // The native frame has 15 extra pixels, while its lower padding consumes 16.
   const limit=hasLimit?Math.max(safe,available-(overlayHeight.current?overlayHeight.current+9:0)):Infinity;
   if(hasLimit)surface.current!.style.setProperty('--screen-height',`${limit}px`);
   else surface.current!.style.removeProperty('--screen-height');
   const width=surface.current!.offsetWidth;
   if(node.style.width!==`${width}px`){node.style.width=`${width}px`;node.style.marginInline='auto';}
   const height=state.closing&&!state.open?safe:Math.min(state.measureHeight?.()??node.offsetHeight,limit);
   // A newly visible pill cannot animate upward from below the physical display.
   const reserveAtEdge=overlayHeight.current>previousOverlay&&height>=limit;
   const instant=reserveAtEdge||!!node.closest('[data-resizing]')||state.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
   controller.current?.to(height,{width,open:state.open,duration:instant?0:state.open?notchMotion.open:notchMotion.close,transitionKey:`${geometry?.view??''}:${geometry?.navigation?'navigation':'home'}`});
   if(overlayHeight.current!==previousOverlay)controller.current?.refreshSize();
  };
  // View and navigation changes must measure their final combined layout before paint.
  recompute.current=update;update();const observer=new ResizeObserver(update);observer.observe(node);if(surface.current)observer.observe(surface.current);
  return()=>{observer.disconnect();if(recompute.current===update)recompute.current=null;};
 },[open,closing,reduced,layout,geometry?.width,geometry?.view,geometry?.navigation,geometry?.measureHeight,geometry?.availableHeight,geometry?.toast]);
 useLayoutEffect(()=>{
  const node=overlay?.current;if(!node)return;
  const update=()=>{if(Math.ceil(node.offsetHeight)!==overlayHeight.current)recompute.current?.();};
  update();const observer=new ResizeObserver(update);observer.observe(node);
  return()=>observer.disconnect();
 },[overlay,geometry?.toast]);
}
