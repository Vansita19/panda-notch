import {useLayoutEffect,useRef,type KeyboardEvent} from 'react';
import {featureViews} from '../navigation';
import {createMenuCardMotion} from './menu-card-motion';
import './menu-home.css';

type MenuHomeProps={onNavigate:(id:string)=>void};
const asset=(name:string,className:string)=><img className={className} src={`menu/${name}.svg`} alt="" draggable={false}/>;
const updateScrollEdges=(node:HTMLDivElement)=>{
 const maximum=Math.max(0,node.scrollWidth-node.clientWidth);
 const start=node.scrollLeft>.5,end=node.scrollLeft<maximum-.5;
 if(node.hasAttribute('data-fade-start')!==start)node.toggleAttribute('data-fade-start',start);
 if(node.hasAttribute('data-fade-end')!==end)node.toggleAttribute('data-fade-end',end);
};

/** Figma artwork scales as a unit: 200px at Retina resolution, 100 native points. */
function CardArtwork({id,label}:{id:string;label:string}){
 return <span className={`menu-card-art menu-card-art-${id}`} aria-hidden="true">
  {id==='tasks'&&<>
   {asset('imgEllipse1','menu-layer menu-task-glow-one')}
   {asset('imgEllipse2','menu-layer menu-task-glow-two')}
   {asset('imgEllipse3','menu-layer menu-task-glow-three')}
   <span className="menu-card-label">{label}</span>
   {asset('imgFluentMdl2TaskList','menu-layer menu-card-icon')}
  </>}
  {id==='focus'&&<>
   {asset('imgEllipse4','menu-layer menu-focus-glow')}
   <span className="menu-layer menu-focus-core"/>
   <span className="menu-card-label">{label}</span>
   <span className="menu-icon-clip">{asset('imgGroup1','menu-layer menu-focus-icon')}</span>
  </>}
  {id==='pins'&&<>
   {asset('imgVector4','menu-layer menu-links-glow')}
   {asset('imgBiPinAngle','menu-layer menu-card-icon')}
   {asset('imgMaskGroup','menu-layer menu-links-mask')}
   <span className="menu-layer menu-links-wave" style={{maskImage:'url("menu/imgMaskGroup.svg")',WebkitMaskImage:'url("menu/imgMaskGroup.svg")'}}>{Array.from({length:25},(_,i)=><span className="menu-wave-bar" key={i} style={{left:`${i*6.51078}px`,backgroundImage:'url("menu/imgMaskGroup.svg")'}}/>)}</span>
   <span className="menu-card-label">{label}</span>
  </>}
  {id==='dump'&&<>
   {asset('imgVector5','menu-layer menu-ideas-glow')}
   <span className="menu-icon-clip">{asset('imgGroup2','menu-layer menu-ideas-icon')}</span>
   <span className="menu-card-label">{label}</span>
  </>}
  {id==='reminders'&&<>
   {asset('imgClarityBellOutlineBadged','menu-layer menu-card-icon')}
   <span className="menu-card-label">{label}</span>
   {asset('imgEllipse5','menu-layer menu-reminders-ring-one')}
   {asset('imgEllipse6','menu-layer menu-reminders-ring-two')}
   {asset('imgEllipse7','menu-layer menu-reminders-ring-three')}
  </>}
 </span>;
}

export function MenuHome({onNavigate}:MenuHomeProps){
 const viewport=useRef<HTMLDivElement>(null);
 const ambient=useRef<ReturnType<typeof createMenuCardMotion>|null>(null);
 useLayoutEffect(()=>{ambient.current=createMenuCardMotion();return()=>{ambient.current?.dispose();ambient.current=null;};},[]);
 useLayoutEffect(()=>{
  const node=viewport.current;if(!node)return;
  const updateEdges=()=>updateScrollEdges(node);
  const wheel=(event:WheelEvent)=>{
   if(event.ctrlKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
   const unit=event.deltaMode===1?16:event.deltaMode===2?node.clientWidth:1;
   const next=Math.max(0,Math.min(node.scrollWidth-node.clientWidth,node.scrollLeft+event.deltaY*unit));
   if(Math.abs(next-node.scrollLeft)<.5)return;
   event.preventDefault();node.scrollLeft=next;updateEdges();
  };
  updateEdges();
  const observer=new ResizeObserver(updateEdges);observer.observe(node);
  node.addEventListener('scroll',updateEdges,{passive:true});
  node.addEventListener('wheel',wheel,{passive:false});
  return()=>{observer.disconnect();node.removeEventListener('scroll',updateEdges);node.removeEventListener('wheel',wheel);};
 },[]);
 const reveal=(button:HTMLButtonElement)=>{
  const node=viewport.current;if(!node)return;
  const left=button.offsetLeft,right=left+button.offsetWidth;
  if(left<node.scrollLeft)node.scrollLeft=left;
  else if(right>node.scrollLeft+node.clientWidth)node.scrollLeft=right-node.clientWidth;
  updateScrollEdges(node);
 };
 const navigateCards=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.menu-card'));
  const index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowRight'?1:-1)));
  buttons[next]?.focus({preventScroll:true});if(buttons[next])reveal(buttons[next]);
 };
 return <nav className="menu-home" aria-label="Panda tools">
  <div className="menu-home-scroll" ref={viewport} onKeyDown={navigateCards} onFocusCapture={event=>{if(event.target instanceof HTMLButtonElement)reveal(event.target);}}>
   {featureViews.map(card=><button className="menu-card" type="button" key={card.id} aria-label={card.title} onPointerEnter={e=>{if(e.pointerType==='mouse')ambient.current?.enter(e.currentTarget);}} onPointerMove={e=>{if(e.pointerType==='mouse')ambient.current?.enter(e.currentTarget);}} onPointerLeave={e=>ambient.current?.leave(e.currentTarget)} onClick={()=>onNavigate(card.id)}><CardArtwork id={card.id} label={card.title}/></button>)}
  </div>
 </nav>;
}
