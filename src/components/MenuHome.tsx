import {useLayoutEffect,useRef,type KeyboardEvent,type ReactNode} from 'react';
import {ListChecks} from 'lucide-react';
import {featureViews} from '../navigation';
import {deriveMenuUpcoming} from '../menu-upcoming.mjs';
import {createMenuCardMotion} from './menu-card-motion';
import './menu-home.css';

type MenuEvent={id:string;eventId?:string;calendarId?:string;title:string;start:number;end:number;allDay?:boolean;color?:string};
type MenuHomeProps={onNavigate:(id:string)=>void;events:MenuEvent[];now:number;onOpenCalendar:()=>void;eventColor?:(event:MenuEvent)=>string|undefined;todayNote?:ReactNode};
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
  {id==='tracker'&&<><span className="menu-layer menu-tracker-glow"/><ListChecks className="menu-layer menu-card-icon" size={34}/><span className="menu-tracker-boxes">{Array.from({length:12},(_,index)=><i key={index} className={index<5?'is-checked':''}/>)}</span><span className="menu-card-label">{label}</span></>}
  {id==='pins'&&<>
   {asset('imgVector4','menu-layer menu-links-glow')}
   {asset('imgBiPinAngle','menu-layer menu-card-icon')}
   {asset('imgMaskGroup','menu-layer menu-links-mask')}
   <span className="menu-layer menu-links-wave" style={{maskImage:'url("menu/imgMaskGroup.svg")',WebkitMaskImage:'url("menu/imgMaskGroup.svg")'}}>{Array.from({length:25},(_,i)=><span className="menu-wave-bar" key={i} style={{left:`${i*6.51078}px`,backgroundImage:'url("menu/imgMaskGroup.svg")'}}/>)}</span>
   <span className="menu-card-label">{label}</span>
  </>}
  {id==='dump'&&<>
   <span className="menu-layer menu-ideas-aura"/>
   <span className="menu-layer menu-ideas-heart"/>
   <span className="menu-icon-clip">{asset('imgGroup2','menu-layer menu-ideas-icon')}</span>
   <span className="menu-card-label">{label}</span>
  </>}
  {id==='reminders'&&<>
   {asset('imgClarityBellOutlineBadged','menu-layer menu-card-icon')}
   <span className="menu-card-label">{label}</span>
   <span className="menu-layer menu-reminders-rest">
    {asset('imgEllipse5','menu-layer menu-reminders-ring-one')}
    {asset('imgEllipse6','menu-layer menu-reminders-ring-two')}
    {asset('imgEllipse7','menu-layer menu-reminders-ring-three')}
   </span>
   {Array.from({length:3},(_,i)=><span key={i} className="menu-layer menu-reminders-ripple"/>)}
  </>}
 </span>;
}

export function MenuHome({onNavigate,events,now,onOpenCalendar,eventColor,todayNote}:MenuHomeProps){
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
 const upcoming=deriveMenuUpcoming(events,now,{limit:2});
 const futureDay=upcoming&&new Date(upcoming.date).toDateString()!==new Date(now).toDateString()?new Date(upcoming.date).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}):'';
 const eventTime=(event:MenuEvent)=>event.allDay?'All day':`${new Date(event.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',hour12:true})} – ${new Date(event.end).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',hour12:true})}`;
 const accents=['#62a8ff','#b698ff','#34c4d8'];
 return <nav className="menu-home" aria-label="Panda tools">
  {todayNote}
  <div className="menu-home-scroll" ref={viewport} onKeyDown={navigateCards} onFocusCapture={event=>{if(event.target instanceof HTMLButtonElement)reveal(event.target);}}>
   {featureViews.map(card=><button className="menu-card" type="button" tabIndex={0} key={card.id} aria-label={card.title} onPointerEnter={e=>{if(e.pointerType==='mouse')ambient.current?.enter(e.currentTarget);}} onPointerMove={e=>{if(e.pointerType==='mouse')ambient.current?.enter(e.currentTarget);}} onPointerLeave={e=>ambient.current?.leave(e.currentTarget)} onClick={()=>onNavigate(card.id)}><CardArtwork id={card.id} label={card.title}/></button>)}
  </div>
  {upcoming&&<section className="menu-upcoming-section" aria-label="Upcoming calendar events">
   <div className="menu-calendar-widget">
    <div className="menu-calendar-agenda"><h2>Upcoming{futureDay&&<span>{futureDay}</span>}</h2><ul>
     {upcoming.events.map((event:MenuEvent,index:number)=>{const ongoing=event.start<=now&&now<event.end,color=eventColor?.(event)||event.color;return <li key={event.id}><button type="button" tabIndex={0} className={`menu-upcoming-event ${index===0?'is-primary':'is-secondary'}`} onClick={onOpenCalendar} aria-label={`Open Calendar: ${event.title}, ${ongoing?'now, ':''}${eventTime(event)}`} style={{'--upcoming-accent':color&&/^#[\da-f]{6}$/i.test(color)?color:accents[index%accents.length]} as React.CSSProperties}>
      <span className="menu-upcoming-marker" aria-hidden="true"/><span className="menu-upcoming-copy"><strong title={event.title}>{event.title}</strong><span className="menu-upcoming-time">{ongoing&&<b>Now · </b>}{eventTime(event)}</span></span>
     </button></li>;})}
    </ul></div>
   </div>
  </section>}
 </nav>;
}
