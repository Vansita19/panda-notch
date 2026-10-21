import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CalendarDays,Clock3,X,Unlink} from 'lucide-react';
import {Button} from '../arc/button/button';
import {host,native} from '../bridge';
import {writeCalendar} from '../calendar-write';
import {dayRange,timeAt,hoverHourAt,selectionRange,layoutEvents,plannerColors,validSlot} from '../planner.mjs';
import {visibleTasks} from '../model.mjs';
import {notchMotion} from '../notch-motion.mjs';
import './task-planner.css';
const clock=(ms:number)=>new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const inputTime=(ms:number)=>{const d=new Date(ms);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
export function TaskPlanner({s,info,dispatch,active,onToggle,renderTasks,notify,now}:any){
 const [calendarId,setCalendarId]=useState(''),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<string|null>(null),[linking,setLinking]=useState<string|null>(null),[ghost,setGhost]=useState<any>(null);
 const root=useRef<HTMLDivElement>(null),column=useRef<HTMLElement>(null),day=useRef<HTMLElement>(null),grid=useRef<HTMLDivElement>(null),path=useRef<SVGPathElement>(null),tip=useRef<SVGGElement>(null);
 const interaction=useRef<any>(null),raf=useRef(0),spring=useRef<any>(null),keyboard=useRef<any>(null),latest=useRef<any>(null),previousActive=useRef(active),columnAnimation=useRef<Animation|null>(null);
 const startHour=s.settings.plannerStart??7,endHour=s.settings.plannerEnd??23,range=dayRange(now,startHour,endHour);
 const writable=(info.calendars??[]).filter((c:any)=>c.writable&&s.calendar.selectedIds.includes(c.id));
 useEffect(()=>{if(!writable.some((c:any)=>c.id===calendarId))setCalendarId(writable.find((c:any)=>c.id===info.defaultCalendarId)?.id||writable[0]?.id||'');},[JSON.stringify(writable),info.defaultCalendarId,calendarId]);
 const tasks=visibleTasks(s,now),eventByTask=new Map(s.events.filter((e:any)=>e.taskId).map((e:any)=>[e.taskId,e]));
 const linked=tasks.filter((t:any)=>t.calendarLink&&!t.calendarLink.missing&&!eventByTask.has(t.id)).map((t:any)=>({...t.calendarLink,id:'linked-'+t.id,taskId:t.id,title:t.title}));
 const events=layoutEvents([...s.events,...linked],range),current=tasks.find((t:any)=>t.id===selected);
 const canWrite=!native||s.calendar.mode==='connected'&&!!calendarId;
 const clear=()=>{if(raf.current)cancelAnimationFrame(raf.current);raf.current=0;interaction.current=null;spring.current=null;keyboard.current=null;path.current?.setAttribute('d','');tip.current?.setAttribute('visibility','hidden');setGhost(null);setLinking(null);};
 const submit=async(task:any,slot:any,operation='save')=>{
  if(busy)return;clear();setError('');setBusy(task.id);
  try{
   if(native)await writeCalendar({operation,taskId:task.id,title:task.title,calendarId:task.calendarLink?.calendarId||calendarId,...slot});
   else if(operation==='remove')dispatch({type:'taskCalendarUnlinked',id:task.id});
   else dispatch({type:'taskCalendarLinked',id:task.id,link:{eventId:task.calendarLink?.eventId||crypto.randomUUID(),calendarId:'preview',...slot,missing:false}});
   notify(operation==='remove'?'Time unlinked. Your task is still here.':native?'Saved to Mac Calendar.':'Preview scheduled. Calendar sync works in the Mac app.');
   if(operation==='remove')setSelected(null);
  }catch(e:any){setError(e.message);}finally{setBusy(null);}
 };
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
 useEffect(()=>()=>{if(raf.current)cancelAnimationFrame(raf.current);columnAnimation.current?.cancel();},[]);
 const updateGhost=(value:any)=>setGhost((old:any)=>old?.start===value?.start&&old?.end===value?.end&&old?.selecting===value?.selecting?old:value);
 // The end follows the cursor precisely; only the middle of the cord has inertia.
 // This loop runs during a gesture and stops once the cord settles.
 const draw=(stamp:number)=>{
  raf.current=0;const d=interaction.current,r=root.current?.getBoundingClientRect();if(!d||!r)return;
  const rect=grid.current?.getBoundingClientRect(),p=d.pointer;
  if(rect&&p&&!keyboard.current){
   const inside=p.x>=rect.left+28&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom;
   if(d.mode==='armed')updateGhost(inside?{...hoverHourAt(p.y-rect.top,rect.height,latest.current.range),selecting:false}:null);
   else {const t=timeAt(p.y-rect.top,rect.height,latest.current.range);const slot=d.mode==='resize'?{start:d.task.calendarLink.start,end:Math.max(d.task.calendarLink.start+900000,t)}:selectionRange(d.anchor,t,latest.current.range);d.slot=slot;updateGhost({...slot,selecting:true});}
  }
  if(d.mode==='resize')return;
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
  const move=(e:PointerEvent)=>{const d=interaction.current;if(!d)return;keyboard.current=null;d.pointer={x:e.clientX,y:e.clientY};schedule();};
  const finish=(e:PointerEvent)=>{const d=interaction.current;if(!d||d.mode==='armed')return;const rect=grid.current?.getBoundingClientRect();if(!rect)return;const t=timeAt(e.clientY-rect.top,rect.height,latest.current.range);const slot=d.mode==='resize'?{start:d.task.calendarLink.start,end:Math.max(d.task.calendarLink.start+900000,t)}:selectionRange(d.anchor,t,latest.current.range);void latest.current.submit(d.task,slot);};
  const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'&&(interaction.current||selected)){e.preventDefault();e.stopImmediatePropagation();latest.current.clear();setSelected(null);}};
  const pointerCancel=()=>latest.current.clear();
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',pointerCancel);window.addEventListener('keydown',cancel,true);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',pointerCancel);window.removeEventListener('keydown',cancel,true);};
 },[selected]);
 const arm=(task:any,node:HTMLElement,x:number,y:number)=>{
  if(!canWrite||busy)return;if(interaction.current?.task.id===task.id){clear();return;}
  clear();setSelected(null);interaction.current={task,node,mode:'armed',pointer:{x,y}};setLinking(task.id);schedule();
 };
 const nodeForTask=(t:any)=><button type="button" className="thread-node" hidden={!active} aria-label={`Link ${t.title} to calendar`} aria-pressed={linking===t.id} title="Click, then drag a time span on the calendar" disabled={!!busy||!canWrite} draggable={false} onDragStart={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();arm(t,e.currentTarget,e.clientX,e.clientY);}} onClick={e=>{if(e.detail!==0)return;const r=e.currentTarget.getBoundingClientRect();arm(t,e.currentTarget,r.right,r.top+r.height/2);grid.current?.focus();}}><span/></button>;
 const beginSelection=(e:React.PointerEvent)=>{
  const d=interaction.current;if(!d||d.mode!=='armed'||e.button!==0||!grid.current)return;
  const r=grid.current.getBoundingClientRect();if(e.clientX<r.left+28)return;
  e.preventDefault();e.stopPropagation();grid.current.setPointerCapture(e.pointerId);d.mode='select';d.anchor=timeAt(e.clientY-r.top,r.height,range);d.pointer={x:e.clientX,y:e.clientY};schedule();
 };
 const beginResize=(e:React.PointerEvent,t:any)=>{
  if(e.button!==0||busy)return;e.preventDefault();e.stopPropagation();clear();e.currentTarget.setPointerCapture(e.pointerId);interaction.current={task:t,mode:'resize',pointer:{x:e.clientX,y:e.clientY}};schedule();
 };
 const keyboardSelection=(e:React.KeyboardEvent)=>{
  const d=interaction.current;if(!d||d.mode!=='armed')return;
  if(!['ArrowDown','ArrowUp','Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();
  const k=keyboard.current??{point:range.start,anchor:null};keyboard.current=k;
  if(e.key==='ArrowDown'||e.key==='ArrowUp')k.point=Math.max(range.start,Math.min(range.end,k.point+(e.key==='ArrowDown'?900000:-900000)));
  else if(k.anchor===null)k.anchor=k.point;else{void submit(d.task,selectionRange(k.anchor,k.point,range));return;}
  updateGhost({...selectionRange(k.anchor??k.point,k.point,range),selecting:k.anchor!==null});
  const r=grid.current!.getBoundingClientRect();d.pointer={x:r.left+r.width*.5,y:r.top+(k.point-range.start)/(range.end-range.start)*r.height};schedule();
 };
 const hours=Array.from({length:endHour-startHour+1},(_,i)=>startHour+i),allDay=s.events.filter((e:any)=>e.allDay&&e.start<range.end&&e.end>range.start);
 return <div className="task-workspace" data-active={active} ref={root}>
  <section className="task-checklist" ref={column}>
   <div className="todo-heading-row"><div className="todo-heading">To-do</div><Button variant="secondary" size="sm" aria-expanded={active} aria-controls="planner-calendar" onClick={onToggle}><CalendarDays size={12}/> Plan my day</Button></div>
   {renderTasks(nodeForTask,(t:any)=>t.calendarLink?<button type="button" aria-label={`Edit scheduled time for ${t.title}`} title={t.calendarLink.missing?'Event unavailable · manage scheduled time':'Edit scheduled time'} onClick={()=>{if(!active)onToggle();clear();setSelected(t.id);}}><Clock3 size={12}/></button>:null)}
  </section>
  <section id="planner-calendar" className="planner-day" ref={day} aria-label="Day calendar" inert={!active}>
   <div className="planner-hours"><select aria-label="Day starts" value={startHour} onChange={e=>dispatch({type:'settings',patch:{plannerStart:+e.target.value}})}>{Array.from({length:endHour},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select><span>–</span><select aria-label="Day ends" value={endHour} onChange={e=>dispatch({type:'settings',patch:{plannerEnd:+e.target.value}})}>{Array.from({length:24-startHour},(_,i)=>i+startHour+1).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></div>
   {allDay.length>0&&<div className="planner-all-day">{allDay.map((e:any)=><span key={e.id}>{e.title} · all day</span>)}</div>}
   <div className={`planner-grid ${linking?'accepting-thread':''}`} ref={grid} tabIndex={linking?0:-1} aria-label="Drag a time span. With the keyboard, use arrows, Enter to start and Enter to save." onKeyDown={keyboardSelection} onPointerDownCapture={beginSelection}>
    {hours.map((h,i)=><div className="planner-hour" style={{top:`${i/(hours.length-1)*100}%`}} key={h}><span>{h===24?'00':String(h).padStart(2,'0')}</span><i/></div>)}
    {events.map((e:any)=>{const t=tasks.find((t:any)=>t.id===e.taskId),color=t?.calendarLink?.color||'#62a8ff';return <div className={`planner-event ${t?'linked-event':''} ${t?.done?'completed-event':''}`} key={e.id} style={{top:`${e.top*100}%`,height:`${e.height*100}%`,left:`calc(30px + (100% - 30px) * ${e.lane/e.lanes})`,width:`calc((100% - 30px) / ${e.lanes} - 3px)`,'--event-color':color} as React.CSSProperties}><button title={`${e.title} · ${clock(e.start)} – ${clock(e.end)}`} aria-label={`${e.title}, ${clock(e.start)} to ${clock(e.end)}`} onClick={()=>{if(linking)return;t?setSelected(t.id):notify(`${e.title} · ${clock(e.start)}–${clock(e.end)}. Edit this event in Calendar.`);}}><strong>{t?.done?'✓ ':''}{e.title}</strong>{e.end-e.start>=3600000&&<span>{clock(e.start)} – {clock(e.end)}</span>}</button>{t&&!busy&&!linking&&<button className="planner-resize" aria-label={`Resize ${e.title}`} title="Drag to change duration" onPointerDown={ev=>beginResize(ev,t)}/>}</div>;})}
    {now>range.start&&now<range.end&&<div className="planner-now" style={{top:`${(now-range.start)/(range.end-range.start)*100}%`}}><i/></div>}
    {ghost&&<div className="planner-ghost" data-selecting={ghost.selecting} style={{top:`${(ghost.start-range.start)/(range.end-range.start)*100}%`,height:`${(ghost.end-ghost.start)/(range.end-range.start)*100}%`}}/>}
   </div>
   <div className="planner-calendar-choice"><CalendarDays size={12}/>{native?<select aria-label="Calendar for new tasks" value={calendarId} onChange={e=>setCalendarId(e.target.value)} disabled={!writable.length}>{!writable.length&&<option value="">No writable calendar selected</option>}{writable.map((c:any)=><option value={c.id} key={c.id}>{c.title} · {c.source}</option>)}</select>:<span>Sample calendar · preview</span>}</div>
   {!canWrite&&<div className="planner-connect"><p>{info.status==='authorized'?'Select a writable calendar in Preferences to start planning.':'Connect Mac Calendar to start planning.'}</p><Button size="sm" variant="secondary" onClick={()=>{host('calendarConnect');notify('Choose your calendar in Preferences.');}}>Connect calendar</Button></div>}
   <p className="planner-hint" role="status">{linking?'Click and drag to choose a time span. Esc cancels.':'Click a task’s dot, then drag a time span here.'}</p>
  </section>
  {error&&<div className="planner-error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={12}/></button></div>}
  <svg className="planner-thread" aria-hidden="true"><path ref={path}/><g ref={tip} visibility="hidden"><circle r="7"/><path d="M -3 0 H 3 M 0 -3 V 3"/></g></svg>
  {current?.calendarLink&&active&&<EventDetails key={`${current.id}:${current.calendarLink.start}:${current.calendarLink.end}`} task={current} busy={!!busy} onClose={()=>setSelected(null)} onSave={(slot:any)=>submit(current,slot)} onUnlink={()=>submit(current,{},'remove')} onColor={(color:string)=>dispatch({type:'taskCalendarColor',id:current.id,color})}/>}
 </div>;
}
function EventDetails({task,busy,onClose,onSave,onUnlink,onColor}:any){
 const link=task.calendarLink,[start,setStart]=useState(inputTime(link.start)),[end,setEnd]=useState(inputTime(link.end)),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
 const parse=(value:string,isEnd=false)=>{const [h,m]=value.split(':').map(Number);const date=new Date(link.start);date.setHours(h,m,0,0);if(isEnd&&h===0&&m===0&&+date<=link.start)date.setDate(date.getDate()+1);return +date;};
 return <div className="planner-popover" role="dialog" aria-label="Scheduled task"><header><strong>{task.title}</strong><button onClick={onClose} aria-label="Close event details"><X size={14}/></button></header>{link.missing?<p>This event is no longer available. Unlink it to schedule again.</p>:<form onSubmit={e=>{e.preventDefault();const a=parse(start),b=parse(end,true);if(!validSlot(a,b)){setError('End time must be after start time.');return;}onSave({start:a,end:b});}}><div className="event-time-fields"><label>Starts<input type="time" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>Ends<input type="time" required value={end} onChange={e=>setEnd(e.target.value)}/></label></div>{error&&<p role="alert">{error}</p>}<Button variant="secondary" size="sm" disabled={busy} type="submit">{busy?'Saving…':'Save time'}</Button></form>}<p className="event-color-label">Block color in Panda</p><div className="event-colors">{plannerColors.map(color=><button key={color} style={{background:color}} aria-label={`Use ${color} color`} aria-pressed={(link.color||plannerColors[0])===color} onClick={()=>onColor(color)}/>)}</div>{confirm?<div className="event-unlink-confirm"><p>Remove this event from Calendar? Your task stays here.</p><Button variant="ghost" size="sm" disabled={busy} onClick={()=>setConfirm(false)}>Keep event</Button><Button variant="secondary" size="sm" disabled={busy} onClick={onUnlink}>Remove event</Button></div>:<Button variant="ghost" size="sm" disabled={busy} onClick={()=>link.missing?onUnlink():setConfirm(true)}><Unlink size={12}/> Unlink time</Button>}</div>;
}
