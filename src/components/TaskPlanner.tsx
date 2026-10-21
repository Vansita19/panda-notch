import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Maximize2,Minimize2,X,Unlink} from 'lucide-react';
import {Button} from '../arc/button/button';
import {host,native} from '../bridge';
import {writeCalendar} from '../calendar-write';
import {dayRange,timeAt,hoverHourAt,selectionRange,moveRange,layoutEvents,mergePlannerEvents,plannerColors,validSlot} from '../planner.mjs';
import {visibleTasks} from '../model.mjs';
import {notchMotion} from '../notch-motion.mjs';
import {usePlannerConnections} from './usePlannerConnections';
import './task-planner.css';
const clock=(ms:number)=>new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const inputTime=(ms:number)=>{const d=new Date(ms);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
export function TaskPlanner({s,info,dispatch,active,layoutActive,onToggle,renderTasks,notify,now}:any){
 const isLayoutActive=layoutActive??active;
 const [calendarId,setCalendarId]=useState(''),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<string|null>(null),[linking,setLinking]=useState<string|null>(null),[ghost,setGhost]=useState<any>(null),[preview,setPreview]=useState<any>(null),[hoveredTask,setHoveredTask]=useState<string|null>(null),[docking,setDocking]=useState<string|null>(null),[manipulating,setManipulating]=useState<string|null>(null);
 const root=useRef<HTMLDivElement>(null),column=useRef<HTMLElement>(null),day=useRef<HTMLElement>(null),grid=useRef<HTMLDivElement>(null),path=useRef<SVGPathElement>(null),tip=useRef<SVGGElement>(null);
 const interaction=useRef<any>(null),raf=useRef(0),spring=useRef<any>(null),keyboard=useRef<any>(null),latest=useRef<any>(null),previousActive=useRef(active),columnAnimation=useRef<Animation|null>(null),ignoreClick=useRef<string|null>(null);
 const nodeRefs=useRef(new Map<string,HTMLElement>()),blockRefs=useRef(new Map<string,HTMLElement>()),dockFrame=useRef(0),dockFrom=useRef<any>(null),requestVersion=useRef(0),busyRef=useRef<string|null>(null);
 const startHour=s.settings.plannerStart??7,endHour=s.settings.plannerEnd??23,range=dayRange(now,startHour,endHour);
 const writable=(info.calendars??[]).filter((c:any)=>c.writable&&s.calendar.selectedIds.includes(c.id));
 useEffect(()=>{if(!writable.some((c:any)=>c.id===calendarId))setCalendarId(writable.find((c:any)=>c.id===info.defaultCalendarId)?.id||writable[0]?.id||'');},[JSON.stringify(writable),info.defaultCalendarId,calendarId]);
 const tasks=visibleTasks(s,now),events=layoutEvents(mergePlannerEvents(s.events,tasks,preview),range),current=tasks.find((t:any)=>t.id===selected);
 const layoutKey=JSON.stringify([startHour,endHour,tasks.map((t:any)=>[t.id,t.title]),events.map((e:any)=>[e.taskId||e.id,e.top,e.height,e.lane,e.lanes])]);
 const connections=usePlannerConnections(root,nodeRefs,blockRefs,isLayoutActive,layoutKey);
 const highlightedTask=linking||manipulating||busy||docking||selected||hoveredTask;
 const canWrite=!native||s.calendar.mode==='connected'&&!!calendarId;
 const stopGesture=(keepPath=false)=>{if(raf.current)cancelAnimationFrame(raf.current);raf.current=0;interaction.current=null;spring.current=null;keyboard.current=null;if(!keepPath)path.current?.setAttribute('d','');tip.current?.setAttribute('visibility','hidden');setGhost(null);setLinking(null);setManipulating(null);};
 const clear=()=>{stopGesture();if(dockFrame.current)cancelAnimationFrame(dockFrame.current);dockFrame.current=0;dockFrom.current=null;setDocking(null);setPreview((p:any)=>p?.phase==='saving'||p?.phase==='committed'?p:null);};
 const submit=async(task:any,slot:any,operation='save')=>{
  if(busyRef.current)return;const version=++requestVersion.current;busyRef.current=task.id;setError('');setBusy(task.id);
  if(operation==='save'){
   const from=path.current?.getAttribute('d');dockFrom.current=from?{taskId:task.id,d:from}:null;
   stopGesture(!!from);setPreview({taskId:task.id,title:task.title,...slot,phase:'saving'});if(from)setDocking(task.id);
  }else clear();
  try{
   let acknowledged=slot;
   if(native){const result=await writeCalendar({operation,taskId:task.id,title:task.title,calendarId:task.calendarLink?.calendarId||calendarId,...slot});if(result.event)acknowledged={start:result.event.start,end:result.event.end};}
   else if(operation==='remove')dispatch({type:'taskCalendarUnlinked',id:task.id});
   else dispatch({type:'taskCalendarLinked',id:task.id,link:{eventId:task.calendarLink?.eventId||crypto.randomUUID(),calendarId:'preview',...slot,missing:false}});
   if(version!==requestVersion.current)return;
   if(operation==='save')setPreview({taskId:task.id,title:task.title,...acknowledged,phase:'committed'});
   else setSelected(null);
   if(operation==='remove')notify('Time unlinked. Your task is still here.');
  }catch(e:any){if(version===requestVersion.current){clear();setPreview(null);setError(e.message);}}
  finally{if(version===requestVersion.current){busyRef.current=null;setBusy(null);}}
 };
 // Acknowledgement replaces only the preview's data; the task-keyed block stays mounted.
 useLayoutEffect(()=>{if(preview?.phase!=='committed')return;const link=tasks.find((t:any)=>t.id===preview.taskId)?.calendarLink;if(link&&link.start===preview.start&&link.end===preview.end)setPreview(null);},[preview,s.tasks]);
 // Ease the loose end onto its block instead of dropping the cord at pointer-up.
 useLayoutEffect(()=>{
  if(!docking||!dockFrom.current||!root.current)return;
  const block=blockRefs.current.get(docking),node=nodeRefs.current.get(docking);if(!block||!node)return;
  const a=node.getBoundingClientRect(),b=block.getBoundingClientRect(),r=root.current.getBoundingClientRect(),ax=a.left+a.width/2-r.left,ay=a.top+a.height/2-r.top,bx=b.left-r.left,by=b.top+b.height/2-r.top,dx=bx-ax,dy=by-ay,sag=Math.min(60,Math.max(30,Math.abs(dx)*.18+Math.abs(dy)*.07));
  const target=[ax,ay,ax+dx*.33,ay+dy*.33+sag,ax+dx*.67,ay+dy*.67+sag,bx,by],from=(path.current?.getAttribute('d')||dockFrom.current.d).match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  const finish=()=>{root.current?.querySelectorAll<SVGPathElement>('.saved-thread').forEach(p=>{if(p.dataset.taskId===docking)p.style.visibility='visible';});path.current?.setAttribute('d','');dockFrom.current=null;dockFrame.current=0;setDocking(null);};
  if(!from||from.length!==8||s.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  const start=performance.now();
  const frame=(stamp:number)=>{const t=Math.min(1,(stamp-start)/220),ease=1-Math.pow(1-t,3),p=target.map((value,i)=>from[i]+(value-from[i])*ease);path.current?.setAttribute('d',`M ${p[0]} ${p[1]} C ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]}`);if(t<1)dockFrame.current=requestAnimationFrame(frame);else finish();};
  dockFrame.current=requestAnimationFrame(frame);return()=>{if(dockFrame.current)cancelAnimationFrame(dockFrame.current);};
 },[docking]);
 latest.current={range,canWrite,busy,tasks,reduced:s.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches,submit,clear,active};
 // Keep one task column mounted. Only its position changes as the calendar is revealed.
 useLayoutEffect(()=>{
  if(previousActive.current===active)return;const was=previousActive.current;previousActive.current=active;
  const node=column.current;if(!node)return;
  const reduce=s.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const taskWidth=parseFloat(getComputedStyle(root.current!).getPropertyValue('--task-column-width'))||364;
  const wide=Math.min(taskWidth+36+330,screen.availWidth-60),delta=(wide-(taskWidth+36))/2;
  const inFlight=columnAnimation.current?new DOMMatrixReadOnly(getComputedStyle(node).transform).m41:0;
  columnAnimation.current?.cancel();
  if(!reduce){const animation=node.animate([{transform:`translateX(${inFlight+(active?delta:-delta)}px)`},{transform:'translateX(0px)'}],{duration:notchMotion.open,easing:notchMotion.ease});columnAnimation.current=animation;animation.onfinish=()=>{if(columnAnimation.current===animation)columnAnimation.current=null;};}
  if(day.current&&!reduce)day.current.animate(active?[{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}]:[{opacity:1},{opacity:0}],{duration:active?220:130,easing:notchMotion.ease});
  if(was&&!active){clear();setSelected(null);}
 },[active,s.settings.reducedMotion]);
 useEffect(()=>()=>{if(raf.current)cancelAnimationFrame(raf.current);if(dockFrame.current)cancelAnimationFrame(dockFrame.current);columnAnimation.current?.cancel();},[]);
 const updateGhost=(value:any)=>setGhost((old:any)=>old?.start===value?.start&&old?.end===value?.end&&old?.selecting===value?.selecting?old:value);
 // The end follows the cursor precisely; only the middle of the cord has inertia.
 // This loop runs during a gesture and stops once the cord settles.
 const draw=(stamp:number)=>{
  raf.current=0;const d=interaction.current,r=root.current?.getBoundingClientRect();if(!d||!r)return;
  const rect=grid.current?.getBoundingClientRect(),p=d.pointer;
  if(rect&&p&&!keyboard.current){
   const inside=p.x>=rect.left+28&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom;
   if(d.mode==='armed')updateGhost(inside?{...hoverHourAt(p.y-rect.top,rect.height,latest.current.range),selecting:false}:null);
   else if(d.mode!=='move-pending'){const t=timeAt(p.y-rect.top,rect.height,latest.current.range);const slot=d.mode==='move'?moveRange(d.task.calendarLink.start,d.task.calendarLink.end,(p.y-d.originY)/rect.height*(latest.current.range.end-latest.current.range.start),latest.current.range):d.mode==='resize'?{start:d.task.calendarLink.start,end:Math.max(d.task.calendarLink.start+900000,t)}:selectionRange(d.anchor,t,latest.current.range);if(!slot)return;d.slot=slot;setGhost(null);setPreview((old:any)=>old?.taskId===d.task.id&&old?.start===slot.start&&old?.end===slot.end?old:{taskId:d.task.id,title:d.task.title,...slot,phase:d.mode==='move'?'moving':'selecting'});}
  }
  if(d.mode==='resize'||d.mode==='move'||d.mode==='move-pending')return;
  const origin=d.node.getBoundingClientRect(),ax=origin.left+origin.width/2-r.left,ay=origin.top+origin.height/2-r.top,x=p.x-r.left,y=p.y-r.top;
  const dx=x-ax,dy=y-ay,sag=latest.current.reduced?0:Math.min(64,Math.hypot(dx,dy)*.17+9),targetX=(ax+x)/2,targetY=(ay+y)/2+sag;
  let q=spring.current;
  if(!q)q=spring.current={x:targetX,y:targetY,vx:0,vy:0,time:stamp};
  const dt=Math.min(.032,Math.max(.001,(stamp-q.time)/1000));q.time=stamp;
  if(latest.current.reduced){q.x=targetX;q.y=targetY;q.vx=q.vy=0;}else{q.vx+=(170*(targetX-q.x)-15*q.vx)*dt;q.vy+=(170*(targetY-q.y)-15*q.vy)*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;}
  const lagX=q.x-targetX,lagY=q.y-targetY;
  path.current?.setAttribute('d',`M ${ax} ${ay} C ${ax+dx*.33+lagX} ${ay+dy*.33+sag+lagY}, ${ax+dx*.67+lagX} ${ay+dy*.67+sag+lagY}, ${x} ${y}`);
  tip.current?.setAttribute('visibility','visible');tip.current?.setAttribute('transform',`translate(${x} ${y})`);
  if(Math.abs(q.vx)+Math.abs(q.vy)+Math.abs(lagX)+Math.abs(lagY)>.3)raf.current=requestAnimationFrame(draw);
 };
 const schedule=()=>{if(!raf.current)raf.current=requestAnimationFrame(draw);};
 useEffect(()=>{
  const move=(e:PointerEvent)=>{const d=interaction.current;if(!d||d.pointerId!==undefined&&d.pointerId!==e.pointerId)return;keyboard.current=null;d.pointer={x:e.clientX,y:e.clientY};if(d.mode==='move-pending'){if(Math.hypot(e.clientX-d.originX,e.clientY-d.originY)<4)return;d.mode='move';ignoreClick.current=d.task.id;}schedule();};
  const finish=(e:PointerEvent)=>{const d=interaction.current;if(!d||d.mode==='armed'||d.pointerId!==undefined&&d.pointerId!==e.pointerId)return;if(d.mode==='move-pending'){stopGesture();return;}const rect=grid.current?.getBoundingClientRect();if(!rect)return;const t=timeAt(e.clientY-rect.top,rect.height,latest.current.range);const slot=d.mode==='move'?moveRange(d.task.calendarLink.start,d.task.calendarLink.end,(e.clientY-d.originY)/rect.height*(latest.current.range.end-latest.current.range.start),latest.current.range):d.mode==='resize'?{start:d.task.calendarLink.start,end:Math.max(d.task.calendarLink.start+900000,t)}:selectionRange(d.anchor,t,latest.current.range);if(!slot||d.mode==='move'&&slot.start===d.task.calendarLink.start&&slot.end===d.task.calendarLink.end){latest.current.clear();return;}void latest.current.submit(d.task,slot);};
  const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'&&(interaction.current||selected)){e.preventDefault();e.stopImmediatePropagation();latest.current.clear();setSelected(null);}};
  const pointerCancel=()=>latest.current.clear();
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',pointerCancel);window.addEventListener('keydown',cancel,true);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',pointerCancel);window.removeEventListener('keydown',cancel,true);};
 },[selected]);
 const arm=(task:any,node:HTMLElement,x:number,y:number)=>{
  if(!canWrite||busy)return;if(interaction.current?.task.id===task.id){clear();return;}
  clear();setSelected(null);interaction.current={task,node,mode:'armed',pointer:{x,y}};setLinking(task.id);schedule();
 };
 const nodeForTask=(t:any)=><button type="button" className="thread-node" data-linked={!!t.calendarLink&&!t.calendarLink.missing} ref={el=>{if(el)nodeRefs.current.set(t.id,el);else nodeRefs.current.delete(t.id);}} hidden={!isLayoutActive} aria-label={`Link ${t.title} to calendar`} aria-pressed={linking===t.id} title="Click, then drag a time span on the calendar" disabled={!!busy||!canWrite} draggable={false} onDragStart={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();arm(t,e.currentTarget,e.clientX,e.clientY);}} onClick={e=>{if(e.detail!==0)return;const r=e.currentTarget.getBoundingClientRect();arm(t,e.currentTarget,r.right,r.top+r.height/2);grid.current?.focus();}}><span/></button>;
 const beginSelection=(e:React.PointerEvent)=>{
  const d=interaction.current;if(!d||d.mode!=='armed'||e.button!==0||!grid.current)return;
  const r=grid.current.getBoundingClientRect();if(e.clientX<r.left+28)return;
  e.preventDefault();e.stopPropagation();grid.current.setPointerCapture(e.pointerId);d.mode='select';d.pointerId=e.pointerId;d.anchor=timeAt(e.clientY-r.top,r.height,range);d.pointer={x:e.clientX,y:e.clientY};schedule();
 };
 const beginResize=(e:React.PointerEvent,t:any)=>{
  if(e.button!==0||busy||!canWrite)return;e.preventDefault();e.stopPropagation();clear();setSelected(null);setManipulating(t.id);e.currentTarget.setPointerCapture(e.pointerId);interaction.current={task:t,mode:'resize',pointerId:e.pointerId,pointer:{x:e.clientX,y:e.clientY}};schedule();
 };
 const beginMove=(e:React.PointerEvent,t:any)=>{
  if(e.button!==0||busy||linking||!canWrite||!t?.calendarLink||t.calendarLink.missing)return;
  e.preventDefault();e.stopPropagation();clear();setSelected(null);setManipulating(t.id);ignoreClick.current=null;e.currentTarget.setPointerCapture(e.pointerId);interaction.current={task:t,mode:'move-pending',pointerId:e.pointerId,originX:e.clientX,originY:e.clientY,pointer:{x:e.clientX,y:e.clientY}};
 };
 const keyboardSelection=(e:React.KeyboardEvent)=>{
  const d=interaction.current;if(!d||d.mode!=='armed')return;
  if(!['ArrowDown','ArrowUp','Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();
  const k=keyboard.current??{point:range.start,anchor:null};keyboard.current=k;
  if(e.key==='ArrowDown'||e.key==='ArrowUp')k.point=Math.max(range.start,Math.min(range.end,k.point+(e.key==='ArrowDown'?900000:-900000)));
  else if(k.anchor===null)k.anchor=k.point;else{void submit(d.task,selectionRange(k.anchor,k.point,range));return;}
  const slot=selectionRange(k.anchor??k.point,k.point,range);if(k.anchor!==null){setGhost(null);setPreview({taskId:d.task.id,title:d.task.title,...slot,phase:'selecting'});}else updateGhost({...slot,selecting:false});
  const r=grid.current!.getBoundingClientRect();d.pointer={x:r.left+r.width*.5,y:r.top+(k.point-range.start)/(range.end-range.start)*r.height};schedule();
 };
 const hours=Array.from({length:endHour-startHour+1},(_,i)=>startHour+i),allDay=s.events.filter((e:any)=>e.allDay&&e.start<range.end&&e.end>range.start);
 return <div className="task-workspace" data-active={isLayoutActive} data-connecting={linking||manipulating||busy||docking||undefined} ref={root} onPointerOver={e=>{const task=(e.target as HTMLElement).closest<HTMLElement>('[data-linked-task]');setHoveredTask(task?.dataset.linkedTask||null);}} onPointerLeave={()=>setHoveredTask(null)} onFocusCapture={e=>{const task=(e.target as HTMLElement).closest<HTMLElement>('[data-linked-task]');setHoveredTask(task?.dataset.linkedTask||null);}} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setHoveredTask(null);}}>
  <section className="task-checklist" ref={column}>
   <div className="todo-heading-row"><div className="todo-heading">To-do</div><Button variant="secondary" size="sm" aria-expanded={active} aria-controls="planner-calendar" onClick={onToggle}>{active?<Minimize2 size={12}/>:<Maximize2 size={12}/>} {active?'Compact':'Expand'}</Button></div>
   {renderTasks(nodeForTask,null,highlightedTask)}
  </section>
  <section id="planner-calendar" className="planner-day" ref={day} aria-label="Day calendar" inert={!isLayoutActive}>
   <div className="planner-hours"><select aria-label="Day starts" value={startHour} onChange={e=>dispatch({type:'settings',patch:{plannerStart:+e.target.value}})}>{Array.from({length:endHour},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select><span>–</span><select aria-label="Day ends" value={endHour} onChange={e=>dispatch({type:'settings',patch:{plannerEnd:+e.target.value}})}>{Array.from({length:24-startHour},(_,i)=>i+startHour+1).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></div>
   {allDay.length>0&&<div className="planner-all-day">{allDay.map((e:any)=><span key={e.id}>{e.title} · all day</span>)}</div>}
   <div className={`planner-grid ${linking?'accepting-thread':''}`} ref={grid} tabIndex={linking?0:-1} aria-label="Drag a time span. With the keyboard, use arrows, Enter to start and Enter to save." onKeyDown={keyboardSelection} onPointerDownCapture={beginSelection}>
    {hours.map((h,i)=><div className="planner-hour" style={{top:`${i/(hours.length-1)*100}%`}} key={h}><span>{h===24?'00':String(h).padStart(2,'0')}</span><i/></div>)}
    {events.map((e:any)=>{const t=tasks.find((t:any)=>t.id===e.taskId),color=t?.calendarLink?.color||'#62a8ff';return <div ref={el=>{if(!e.taskId)return;if(el)blockRefs.current.set(e.taskId,el);else blockRefs.current.delete(e.taskId);}} data-linked-task={e.taskId} data-phase={e.phase} className={`planner-event ${highlightedTask===e.taskId?'is-connection-active':''} ${t?'linked-event':''} ${t?.done?'completed-event':''}`} key={e.id} style={{top:`${e.top*100}%`,height:`${e.height*100}%`,left:`calc(30px + (100% - 30px) * ${e.lane/e.lanes})`,width:`calc((100% - 30px) / ${e.lanes} - 3px)`,'--event-color':color} as React.CSSProperties}><button title={`${e.title} · ${clock(e.start)} – ${clock(e.end)}`} aria-label={`${e.title}, ${clock(e.start)} to ${clock(e.end)}`} draggable={false} onDragStart={ev=>ev.preventDefault()} onPointerDown={ev=>beginMove(ev,t)} onClick={ev=>{if(ignoreClick.current===e.taskId&&ev.detail!==0){ignoreClick.current=null;return;}if(linking)return;t?setSelected(t.id):notify(`${e.title} · ${clock(e.start)}–${clock(e.end)}. Edit this event in Calendar.`);}}><strong>{t?.done?'✓ ':''}{e.title}</strong>{e.end-e.start>=3600000&&<span>{clock(e.start)} – {clock(e.end)}</span>}</button>{t&&!busy&&!linking&&<button className="planner-resize" aria-label={`Resize ${e.title}`} title="Drag to change duration" onPointerDown={ev=>beginResize(ev,t)}/>}</div>;})}
    {now>range.start&&now<range.end&&<div className="planner-now" style={{top:`${(now-range.start)/(range.end-range.start)*100}%`}}><i/></div>}
    {ghost&&<div className="planner-ghost" data-selecting={ghost.selecting} style={{top:`${(ghost.start-range.start)/(range.end-range.start)*100}%`,height:`${(ghost.end-ghost.start)/(range.end-range.start)*100}%`}}/>}
   </div>
   {!canWrite&&<div className="planner-connect"><p>{info.status==='authorized'?'Select a writable calendar in Preferences to start planning.':'Connect Mac Calendar to start planning.'}</p><Button size="sm" variant="secondary" onClick={()=>{host('calendarConnect');notify('Choose your calendar in Preferences.');}}>Connect calendar</Button></div>}

  </section>
  {error&&<div className="planner-error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={12}/></button></div>}
  <svg className="planner-thread" aria-hidden="true">{isLayoutActive&&connections.map(c=><path className={`saved-thread ${highlightedTask===c.taskId?'is-active':''}`} data-task-id={c.taskId} key={c.taskId} d={c.d} style={{visibility:linking===c.taskId||docking===c.taskId?'hidden':undefined}}/>)}<path className="loose-thread" ref={path}/><g ref={tip} visibility="hidden"><circle r="7"/><path d="M -3 0 H 3 M 0 -3 V 3"/></g></svg>
  {current?.calendarLink&&isLayoutActive&&<EventDetails key={`${current.id}:${current.calendarLink.start}:${current.calendarLink.end}`} task={current} busy={!!busy} onClose={()=>setSelected(null)} onSave={(slot:any)=>submit(current,slot)} onUnlink={()=>submit(current,{},'remove')} onColor={(color:string)=>dispatch({type:'taskCalendarColor',id:current.id,color})}/>}
 </div>;
}
function EventDetails({task,busy,onClose,onSave,onUnlink,onColor}:any){
 const link=task.calendarLink,[start,setStart]=useState(inputTime(link.start)),[end,setEnd]=useState(inputTime(link.end)),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
 const parse=(value:string,isEnd=false)=>{const [h,m]=value.split(':').map(Number);const date=new Date(link.start);date.setHours(h,m,0,0);if(isEnd&&h===0&&m===0&&+date<=link.start)date.setDate(date.getDate()+1);return +date;};
 return <div className="planner-popover" role="dialog" aria-label="Scheduled task"><header><strong>{task.title}</strong><button onClick={onClose} aria-label="Close event details"><X size={14}/></button></header>{link.missing?<p>This event is no longer available. Unlink it to schedule again.</p>:<form onSubmit={e=>{e.preventDefault();const a=parse(start),b=parse(end,true);if(!validSlot(a,b)){setError('End time must be after start time.');return;}onSave({start:a,end:b});}}><div className="event-time-fields"><label>Starts<input type="time" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>Ends<input type="time" required value={end} onChange={e=>setEnd(e.target.value)}/></label></div>{error&&<p role="alert">{error}</p>}<Button variant="secondary" size="sm" disabled={busy} type="submit">{busy?'Saving…':'Save time'}</Button></form>}<p className="event-color-label">Block color in Panda</p><div className="event-colors">{plannerColors.map(color=><button key={color} style={{background:color}} aria-label={`Use ${color} color`} aria-pressed={(link.color||plannerColors[0])===color} onClick={()=>onColor(color)}/>)}</div>{confirm?<div className="event-unlink-confirm"><p>Remove this event from Calendar? Your task stays here.</p><Button variant="ghost" size="sm" disabled={busy} onClick={()=>setConfirm(false)}>Keep event</Button><Button variant="secondary" size="sm" disabled={busy} onClick={onUnlink}>Remove event</Button></div>:<Button variant="ghost" size="sm" disabled={busy} onClick={()=>link.missing?onUnlink():setConfirm(true)}><Unlink size={12}/> Unlink time</Button>}</div>;
}
