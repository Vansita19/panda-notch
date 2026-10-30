import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Maximize2,Minimize2,X,Unlink,ChevronUp,ChevronDown,Plus} from 'lucide-react';
import {Button} from '../arc/button/button';
import {host,native} from '../bridge';
import {writeCalendar} from '../calendar-write';
import {dayRange,timeAt,hoverHourAt,selectionRange,moveRange,layoutEvents,mergePlannerEvents,plannerColors,validSlot} from '../planner.mjs';
import {visibleTasks} from '../model.mjs';
import {taskSchedule} from '../task-schedule.mjs';
import {isDeleteKeyEvent} from '../task-delete-key.mjs';
import {plannerMoveDelta,plannerHourLabel} from '../planner-viewport.mjs';
import {usePlannerConnections,plannerThreadAtPoint} from './usePlannerConnections';
import {TaskPriorityChoices} from './TaskPriority';
import {CampaignEvidence} from './CampaignToday';
import {NewEventComposer} from './NewEventComposer';
import {eventDraftUpdate,stepEventTime,anchoredPosition} from '../event-details.mjs';
import './task-planner.css';
const formatClock=(ms:number,timezone?:string)=>new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',hour12:true,...(timezone?{timeZone:timezone}:{})});
const inputTime=(ms:number,timezone?:string)=>{if(timezone)return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(ms);const d=new Date(ms);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
const usesLocalTime=(task:any)=>!!taskSchedule(task)?.local||!task?.calendarLink&&task?.campaign?.campaign_id==='november-2026';
export function TaskPlanner({s,info,dispatch,active,layoutActive,onToggle,renderTasks,notify,now,heading='Today',onCreateTask,onDeleteTask,onDeleteCalendarTime,editingTask,onSaveEvidence}:any){
 const isLayoutActive=layoutActive??active;
 const [calendarId,setCalendarId]=useState(''),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<string|null>(null),[selectedAnchor,setSelectedAnchor]=useState<'task'|'calendar'>('calendar'),[editorFloor,setEditorFloor]=useState(0),[linking,setLinking]=useState<string|null>(null),[ghost,setGhost]=useState<any>(null),[preview,setPreview]=useState<any>(null),[hoveredTask,setHoveredTask]=useState<string|null>(null),[docking,setDocking]=useState<string|null>(null),[manipulating,setManipulating]=useState<string|null>(null);
 const root=useRef<HTMLDivElement>(null),column=useRef<HTMLElement>(null),day=useRef<HTMLElement>(null),grid=useRef<HTMLDivElement>(null),calendarViewport=useRef<HTMLDivElement>(null),path=useRef<SVGPathElement>(null),tip=useRef<SVGGElement>(null);
 const interaction=useRef<any>(null),raf=useRef(0),spring=useRef<any>(null),keyboard=useRef<any>(null),latest=useRef<any>(null),previousActive=useRef(active),ignoreClick=useRef<string|null>(null);
 const nodeRefs=useRef(new Map<string,HTMLElement>()),blockRefs=useRef(new Map<string,HTMLElement>()),dockFrame=useRef(0),dockFrom=useRef<any>(null),requestVersion=useRef(0),busyRef=useRef<string|null>(null);
 const hoveredTaskRef=useRef<string|null>(null),removalGuard=useRef<{invalidate:()=>boolean;restore:()=>void}|null>(null);
 const [creating,setCreating]=useState<{start:number;end:number}|null>(null),ghostAnchor=useRef<HTMLDivElement>(null),calendarPoint=useRef<number|null>(null);
 const tasks=visibleTasks(s,now),timezone=tasks.some((task:any)=>usesLocalTime(task))?'Asia/Kolkata':undefined;
 const startHour=s.settings.plannerStart??7,endHour=s.settings.plannerEnd??23,range=dayRange(now,startHour,endHour,timezone);
 const clock=(ms:number)=>formatClock(ms,timezone);
 const writable=(info.calendars??[]).filter((c:any)=>c.writable&&s.calendar.selectedIds.includes(c.id));
 useEffect(()=>{if(!writable.some((c:any)=>c.id===calendarId))setCalendarId(writable.find((c:any)=>c.id===info.defaultCalendarId)?.id||writable[0]?.id||'');},[JSON.stringify(writable),info.defaultCalendarId,calendarId]);
 const events=layoutEvents(mergePlannerEvents(s.events,tasks,preview),range),current=tasks.find((t:any)=>t.id===selected);
 const layoutKey=JSON.stringify([active,startHour,endHour,tasks.map((t:any)=>[t.id,t.title]),events.map((e:any)=>[e.taskId||e.id,e.top,e.height,e.lane,e.lanes])]);
 const connections=usePlannerConnections(root,nodeRefs,blockRefs,isLayoutActive,layoutKey,calendarViewport);
 const highlightedTask=linking||manipulating||busy||docking||hoveredTask||selected;
 const hoverTask=(id:string|null)=>{if(hoveredTaskRef.current===id)return;hoveredTaskRef.current=id;setHoveredTask(id);};
 const pointerHover=(event:React.PointerEvent)=>{
  const linked=(event.target as Element).closest<HTMLElement>('[data-linked-task]');
  if(linked){hoverTask(linked.dataset.linkedTask||null);return;}
  const workspace=root.current;
  if(!workspace||!active||interaction.current||busyRef.current){hoverTask(null);return;}
  const rect=(workspace.querySelector<SVGSVGElement>('.planner-thread')??workspace).getBoundingClientRect();
  hoverTask(plannerThreadAtPoint(workspace.querySelectorAll<SVGPathElement>('path.saved-thread-hit'),{x:event.clientX-rect.left,y:event.clientY-rect.top}));
 };
 const canWrite=!native||s.calendar.mode==='connected'&&!!calendarId;
 const canEditTime=(task:any)=>canWrite||usesLocalTime(task);
 const stopGesture=(keepPath=false)=>{if(raf.current)cancelAnimationFrame(raf.current);raf.current=0;interaction.current=null;spring.current=null;keyboard.current=null;if(!keepPath)path.current?.setAttribute('d','');tip.current?.setAttribute('visibility','hidden');setGhost(null);setLinking(null);setManipulating(null);};
 const clear=()=>{stopGesture();setCreating(null);if(dockFrame.current)cancelAnimationFrame(dockFrame.current);dockFrame.current=0;dockFrom.current=null;setDocking(null);setPreview((p:any)=>p?.phase==='saving'||p?.phase==='committed'?p:null);};
 const closeCreation=()=>{clear();grid.current?.focus({preventScroll:true});};
 const openCreation=(slot:{start:number;end:number})=>{if(!canWrite||busyRef.current||!onCreateTask)return;clear();setSelected(null);setCreating(slot);setGhost({...slot,selecting:true});};
 const createCalendarTask=async(title:string)=>{
  if(!creating||busyRef.current)return {ok:false,error:'Calendar is still saving the previous change.'};
  busyRef.current='new-calendar-task';setBusy('new-calendar-task');
  try{const result=await onCreateTask({title,...creating,calendarId});if(result.task&&!result.ok)notify(result.error||'Task added, but Calendar could not save its time.');return result;}
  catch(reason:any){return {ok:false,error:reason?.message||'Could not add this event. Try again.'};}
  finally{busyRef.current=null;setBusy(null);}
 };
 const submit=async(task:any,slot:any,operation='save')=>{
  if(busyRef.current)return {ok:false,error:'Calendar is still saving the previous change.'};const version=++requestVersion.current;busyRef.current=task.id;setError('');setBusy(task.id);
  if(operation==='save'){
   const from=path.current?.getAttribute('d');dockFrom.current=from?{taskId:task.id,d:from}:null;
   stopGesture(!!from);setPreview({taskId:task.id,title:task.title,...slot,phase:'saving'});if(from)setDocking(task.id);
  }else clear();
  try{
   let acknowledged=slot;
   const local=usesLocalTime(task);
   if(local){
    if(operation==='remove'&&onDeleteCalendarTime){const result=await onDeleteCalendarTime(task);if(result?.ok===false)return result;}
    else dispatch({type:'taskPlannedTime',id:task.id,time:operation==='remove'?null:{start:slot.start,end:slot.end,timezone:'Asia/Kolkata',...(task.plannedTime?.color?{color:task.plannedTime.color}:{})}});
   }
   else if(native){const result=await writeCalendar({operation,taskId:task.id,title:task.title,calendarId:task.calendarLink?.calendarId||calendarId,...slot});if(result.event)acknowledged={start:result.event.start,end:result.event.end};}
   else if(operation==='remove')dispatch({type:'taskCalendarUnlinked',id:task.id});
   else dispatch({type:'taskCalendarLinked',id:task.id,link:{eventId:task.calendarLink?.eventId||crypto.randomUUID(),calendarId:'preview',...slot,missing:false}});
   if(version!==requestVersion.current)return;
   if(operation==='save')setPreview({taskId:task.id,title:task.title,...acknowledged,phase:'committed'});
   else setSelected(null);
   if(operation==='remove'&&!(local&&onDeleteCalendarTime))notify('Time unlinked. Your task is still here.');
   return {ok:true,slot:acknowledged,title:task.title};
  }catch(e:any){if(version===requestVersion.current){clear();setPreview(null);setError(e.message);}return {ok:false,error:e.message};}
  finally{if(version===requestVersion.current){busyRef.current=null;setBusy(null);}}
 };
 // Acknowledgement replaces only the preview's data; the task-keyed block stays mounted.
 useLayoutEffect(()=>{if(preview?.phase!=='committed')return;const link=taskSchedule(tasks.find((t:any)=>t.id===preview.taskId));if(link&&link.start===preview.start&&link.end===preview.end)setPreview(null);},[preview,s.tasks]);
 // Ease the loose end onto its block instead of dropping the cord at pointer-up.
 useLayoutEffect(()=>{
  if(!docking||!dockFrom.current||!root.current)return;
  const block=blockRefs.current.get(docking),node=nodeRefs.current.get(docking);if(!block||!node)return;
  const a=node.getBoundingClientRect(),b=block.getBoundingClientRect(),r=root.current.getBoundingClientRect(),ax=a.left+a.width/2-r.left,ay=a.top+a.height/2-r.top,bx=b.left-r.left,by=b.top+b.height/2-r.top,dx=bx-ax,dy=by-ay,sag=Math.min(60,Math.max(30,Math.abs(dx)*.18+Math.abs(dy)*.07));
  const target=[ax,ay,ax+dx*.33,ay+dy*.33+sag,ax+dx*.67,ay+dy*.67+sag,bx,by],from=(path.current?.getAttribute('d')||dockFrom.current.d).match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  const finish=()=>{root.current?.querySelectorAll<SVGElement>('.saved-thread,.saved-thread-hit,.saved-thread-endpoint').forEach(p=>{if(p.dataset.taskId===docking)p.style.visibility='visible';});path.current?.setAttribute('d','');dockFrom.current=null;dockFrame.current=0;setDocking(null);};
  if(!from||from.length!==8||s.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  const start=performance.now();
  const frame=(stamp:number)=>{const t=Math.min(1,(stamp-start)/220),ease=1-Math.pow(1-t,3),p=target.map((value,i)=>from[i]+(value-from[i])*ease);path.current?.setAttribute('d',`M ${p[0]} ${p[1]} C ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]}`);if(t<1)dockFrame.current=requestAnimationFrame(frame);else finish();};
  dockFrame.current=requestAnimationFrame(frame);return()=>{if(dockFrame.current)cancelAnimationFrame(dockFrame.current);};
 },[docking]);
 latest.current={range,canWrite,busy,tasks,reduced:s.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches,submit,clear,active,creating,openCreation,closeCreation};
 // Geometry and calendar visibility share the shell's one interruptible transition.
 useLayoutEffect(()=>{const was=previousActive.current;previousActive.current=active;if(was&&!active){clear();setSelected(null);}},[active]);
 useEffect(()=>()=>{if(raf.current)cancelAnimationFrame(raf.current);if(dockFrame.current)cancelAnimationFrame(dockFrame.current);},[]);
 const updateGhost=(value:any)=>setGhost((old:any)=>old?.start===value?.start&&old?.end===value?.end&&old?.selecting===value?.selecting?old:value);
 // The end follows the cursor precisely; only the middle of the cord has inertia.
 // This loop runs during a gesture and stops once the cord settles.
 const draw=(stamp:number)=>{
  raf.current=0;const d=interaction.current,r=root.current?.getBoundingClientRect();if(!d||!r)return;
  const rect=grid.current?.getBoundingClientRect(),p=d.pointer;
  if(d.mode==='create'){if(rect&&p){const slot=selectionRange(d.anchor,timeAt(p.y-rect.top,rect.height,latest.current.range),latest.current.range);if(slot)updateGhost({...slot,selecting:true});}return;}
  if(rect&&p&&!keyboard.current){
   const viewport=calendarViewport.current?.getBoundingClientRect()||rect;
   const inside=p.x>=rect.left+40&&p.x<=rect.right&&p.y>=Math.max(rect.top,viewport.top)&&p.y<=Math.min(rect.bottom,viewport.bottom);
   if(d.mode==='armed')updateGhost(inside?{...hoverHourAt(p.y-rect.top,rect.height,latest.current.range),selecting:false}:null);
   else if(d.mode!=='move-pending'){const t=timeAt(p.y-rect.top,rect.height,latest.current.range);const slot=d.mode==='move'?moveRange(d.time.start,d.time.end,plannerMoveDelta(p.y,rect.top,d.originGridY,rect.height,latest.current.range.end-latest.current.range.start),latest.current.range):d.mode==='resize'?{start:d.time.start,end:Math.max(d.time.start+900000,t)}:selectionRange(d.anchor,t,latest.current.range);if(!slot)return;d.slot=slot;setGhost(null);setPreview((old:any)=>old?.taskId===d.task.id&&old?.start===slot.start&&old?.end===slot.end?old:{taskId:d.task.id,title:d.task.title,...slot,phase:d.mode==='move'?'moving':'selecting'});}
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
  const finish=(e:PointerEvent)=>{const d=interaction.current;if(!d||d.mode==='armed'||d.pointerId!==undefined&&d.pointerId!==e.pointerId)return;if(d.mode==='move-pending'){stopGesture();return;}const rect=grid.current?.getBoundingClientRect();if(!rect)return;const t=timeAt(e.clientY-rect.top,rect.height,latest.current.range);const slot=d.mode==='move'?moveRange(d.time.start,d.time.end,plannerMoveDelta(e.clientY,rect.top,d.originGridY,rect.height,latest.current.range.end-latest.current.range.start),latest.current.range):d.mode==='resize'?{start:d.time.start,end:Math.max(d.time.start+900000,t)}:selectionRange(d.anchor,t,latest.current.range);if(!slot||d.mode==='move'&&slot.start===d.time.start&&slot.end===d.time.end){latest.current.clear();return;}if(d.mode==='create'){stopGesture();latest.current.openCreation(slot);return;}void latest.current.submit(d.task,slot);};
  const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'&&(interaction.current||selected||latest.current.creating)){e.preventDefault();e.stopImmediatePropagation();if(!busyRef.current){if(latest.current.creating)latest.current.closeCreation();else latest.current.clear();setSelected(null);}}};
  const pointerCancel=()=>latest.current.clear();
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',pointerCancel);window.addEventListener('keydown',cancel,true);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',pointerCancel);window.removeEventListener('keydown',cancel,true);};
 },[selected]);
 const arm=(task:any,node:HTMLElement,x:number,y:number)=>{
  if(!canEditTime(task)||busy||busyRef.current)return;if(interaction.current?.task?.id===task.id){clear();return;}
  clear();setSelected(null);interaction.current={task,node,mode:'armed',pointer:{x,y}};setLinking(task.id);schedule();
 };
 const nodeForTask=(t:any)=><button type="button" className="thread-node" data-linked={!!taskSchedule(t)} ref={el=>{if(el)nodeRefs.current.set(t.id,el);else nodeRefs.current.delete(t.id);}} hidden={!isLayoutActive} aria-label={`Link ${t.title} to ${usesLocalTime(t)?'planner':'calendar'}`} aria-pressed={linking===t.id} title="Click, then drag a time span on the calendar" disabled={!!busy||!canEditTime(t)} draggable={false} onDragStart={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();arm(t,e.currentTarget,e.clientX,e.clientY);}} onClick={e=>{if(e.detail!==0)return;const r=e.currentTarget.getBoundingClientRect();arm(t,e.currentTarget,r.right,r.top+r.height/2);grid.current?.focus();}}><span/></button>;
 const beginSelection=(e:React.PointerEvent)=>{
  const d=interaction.current;if(e.button!==0||!grid.current)return;
  const r=grid.current.getBoundingClientRect();if(e.clientX<r.left+40)return;
  if(!d){
   if(!active||!canWrite||busyRef.current||creating||!onCreateTask||(e.target as Element).closest('.planner-event,button,input,select,textarea,a,[role=button]'))return;
   e.preventDefault();e.stopPropagation();clear();setSelected(null);grid.current.setPointerCapture(e.pointerId);const anchor=timeAt(e.clientY-r.top,r.height,range);
   interaction.current={mode:'create',pointerId:e.pointerId,anchor,pointer:{x:e.clientX,y:e.clientY}};updateGhost({...selectionRange(anchor,anchor,range),selecting:true});return;
  }
  if(d.mode!=='armed')return;
  e.preventDefault();e.stopPropagation();grid.current.setPointerCapture(e.pointerId);d.mode='select';d.pointerId=e.pointerId;d.anchor=timeAt(e.clientY-r.top,r.height,range);d.pointer={x:e.clientX,y:e.clientY};schedule();
 };
 const beginResize=(e:React.PointerEvent,t:any)=>{
  const time=taskSchedule(t);if(e.button!==0||busy||busyRef.current||!canEditTime(t)||!time)return;e.preventDefault();e.stopPropagation();clear();setSelected(null);setManipulating(t.id);e.currentTarget.setPointerCapture(e.pointerId);interaction.current={task:t,time,mode:'resize',pointerId:e.pointerId,pointer:{x:e.clientX,y:e.clientY}};schedule();
 };
 const beginMove=(e:React.PointerEvent,t:any)=>{
  const time=taskSchedule(t);if(e.button!==0||busy||busyRef.current||linking||!canEditTime(t)||!time)return;
  e.preventDefault();e.stopPropagation();clear();setSelected(null);setManipulating(t.id);ignoreClick.current=null;e.currentTarget.setPointerCapture(e.pointerId);interaction.current={task:t,time,mode:'move-pending',pointerId:e.pointerId,originX:e.clientX,originY:e.clientY,originGridY:e.clientY-(grid.current?.getBoundingClientRect().top??0),pointer:{x:e.clientX,y:e.clientY}};
 };
 const keyboardSelection=(e:React.KeyboardEvent)=>{
  const d=interaction.current;
  if(!d){
   if(e.target!==grid.current||!canWrite||busyRef.current||creating||!onCreateTask||!['ArrowDown','ArrowUp','Enter',' '].includes(e.key))return;
   e.preventDefault();e.stopPropagation();const point=calendarPoint.current??range.start;
   if(e.key==='Enter'||e.key===' '){openCreation(selectionRange(point,point+1800000,range));return;}
   calendarPoint.current=Math.max(range.start,Math.min(range.end-900000,point+(e.key==='ArrowDown'?900000:-900000)));updateGhost({...selectionRange(calendarPoint.current,calendarPoint.current+1800000,range),selecting:false});
   const viewport=calendarViewport.current;if(viewport){const g=grid.current!.getBoundingClientRect(),v=viewport.getBoundingClientRect(),y=g.top+(calendarPoint.current-range.start)/(range.end-range.start)*g.height;if(y<v.top+12)viewport.scrollTop-=v.top+12-y;else if(y>v.bottom-12)viewport.scrollTop+=y-v.bottom+12;}return;
  }
  if(d.mode!=='armed')return;
  if(!['ArrowDown','ArrowUp','Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();
  const k=keyboard.current??{point:range.start,anchor:null};keyboard.current=k;
  if(e.key==='ArrowDown'||e.key==='ArrowUp')k.point=Math.max(range.start,Math.min(range.end,k.point+(e.key==='ArrowDown'?900000:-900000)));
  else if(k.anchor===null)k.anchor=k.point;else{void submit(d.task,selectionRange(k.anchor,k.point,range));return;}
  const slot=selectionRange(k.anchor??k.point,k.point,range);if(k.anchor!==null){setGhost(null);setPreview({taskId:d.task.id,title:d.task.title,...slot,phase:'selecting'});}else updateGhost({...slot,selecting:false});
  const viewport=calendarViewport.current;
  if(viewport){const g=grid.current!.getBoundingClientRect(),v=viewport.getBoundingClientRect(),point=g.top+(k.point-range.start)/(range.end-range.start)*g.height;if(point<v.top+12)viewport.scrollTop-=v.top+12-point;else if(point>v.bottom-12)viewport.scrollTop+=point-v.bottom+12;}
  const r=grid.current!.getBoundingClientRect();d.pointer={x:r.left+r.width*.5,y:r.top+(k.point-range.start)/(range.end-range.start)*r.height};schedule();
 };
 const calendarScrolled=()=>{
  if(interaction.current)schedule();
  if(dockFrame.current){cancelAnimationFrame(dockFrame.current);dockFrame.current=0;dockFrom.current=null;path.current?.setAttribute('d','');setDocking(null);}
  if(selected&&selectedAnchor==='calendar')setSelected(null);
 };
 const calendarHover=(e:React.PointerEvent)=>{
  if(interaction.current||creating||!canWrite||busyRef.current||!onCreateTask||!active)return;
  if((e.target as Element).closest('.planner-slot-add'))return;
  if((e.target as Element).closest('.planner-event,button,input,select,textarea,a')){updateGhost(null);return;}
  const rect=grid.current?.getBoundingClientRect();if(!rect)return;if(e.clientX<rect.left+40){updateGhost(null);return;}
  const slot=hoverHourAt(e.clientY-rect.top,rect.height,range);calendarPoint.current=slot.start;updateGhost({...slot,selecting:false});
 };
 // A keyboard target is the focused item, never a row that is merely hovered.
 const deleteFocused=async(event:React.KeyboardEvent)=>{
  if(!isDeleteKeyEvent(event.nativeEvent??event))return;
  const item=(event.target as HTMLElement).closest?.<HTMLElement>('[data-delete-task]');
  if(!item||!root.current?.contains(item))return;
  const task=latest.current.tasks.find((task:any)=>task.id===item.dataset.deleteTask),kind=item.dataset.deleteKind;
  if(!task||!['task','event'].includes(kind||''))return;
  const remove=kind==='event'?onDeleteCalendarTime:onDeleteTask;
  if(!remove||kind==='event'&&(!canEditTime(task)||!taskSchedule(task)))return;
  event.preventDefault();event.stopPropagation();
  if(busyRef.current||interaction.current||creating||editingTask)return;
  const guard=removalGuard.current;if(guard&&!guard.invalidate())return;
  busyRef.current=task.id;setBusy(task.id);
  try{
   const result=await remove(task);
   if(result?.ok===false){guard?.restore();return;}
   clear();setSelected(null);hoverTask(null);
   if(kind==='event')grid.current?.focus({preventScroll:true});
   else root.current?.querySelector<HTMLElement>('.add-todo-placeholder,.add-todo-row input,.todo-heading-row>button')?.focus({preventScroll:true});
  }catch(reason:any){guard?.restore();notify(reason?.message||'Could not remove this item.');}
  finally{busyRef.current=null;setBusy(null);}
 };
 const focusClickedTask=(event:React.MouseEvent)=>{
  const target=event.target as HTMLElement,item=target.closest?.<HTMLElement>('[data-delete-task][data-delete-kind="task"]');
  if(!item||target.closest('input,textarea,select,[role=checkbox],.row-actions,.task-priority,.thread-node'))return;
  host('focus');item.querySelector<HTMLElement>('.task-title')?.focus({preventScroll:true});
 };
 const hours=Array.from({length:endHour-startHour+1},(_,i)=>startHour+i),allDay=s.events.filter((e:any)=>e.allDay&&e.start<range.end&&e.end>range.start);
 return <div className="task-workspace" onKeyDownCapture={deleteFocused} onClickCapture={focusClickedTask} data-active={isLayoutActive} data-connecting={linking||manipulating||busy||docking||undefined} ref={root} style={current&&!isLayoutActive?{minHeight:editorFloor}:undefined} onScrollCapture={e=>{if(e.target!==calendarViewport.current&&interaction.current)schedule();if(selected&&selectedAnchor==='task'&&(e.target as HTMLElement).classList.contains('task-list'))setSelected(null);}} onPointerOver={pointerHover} onPointerMove={pointerHover} onPointerLeave={()=>hoverTask(null)} onFocusCapture={e=>{const task=(e.target as HTMLElement).closest<HTMLElement>('[data-linked-task]');hoverTask(task?.dataset.linkedTask||null);}} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))hoverTask(null);}}>
  <section className="task-checklist" ref={column}>
   <div className="todo-heading-row"><div className="todo-heading">{heading}</div><Button variant="secondary" size="sm" aria-expanded={active} aria-controls="planner-calendar" onClick={onToggle}>{active?<Minimize2 size={12}/>:<Maximize2 size={12}/>} {active?'Compact':'Expand'}</Button></div>
   {renderTasks(nodeForTask,(task:any)=>{clear();setSelectedAnchor('task');setSelected(task.id);},highlightedTask)}
  </section>
  <section id="planner-calendar" className="planner-day" ref={day} aria-label="Day calendar" inert={!isLayoutActive}>
   <div className="planner-hours"><select aria-label="Day starts" value={startHour} onChange={e=>dispatch({type:'settings',patch:{plannerStart:+e.target.value}})}>{Array.from({length:endHour},(_,h)=><option key={h} value={h}>{plannerHourLabel(h,true)}</option>)}</select><span>–</span><select aria-label="Day ends" value={endHour} onChange={e=>dispatch({type:'settings',patch:{plannerEnd:+e.target.value}})}>{Array.from({length:24-startHour},(_,i)=>i+startHour+1).map(h=><option key={h} value={h}>{plannerHourLabel(h,true)}</option>)}</select></div>
   <div className="planner-calendar-scroll" ref={calendarViewport} tabIndex={0} role="region" aria-label="Scrollable day calendar" onScroll={calendarScrolled}>
   {allDay.length>0&&<div className="planner-all-day">{allDay.map((e:any)=><span key={e.id}>{e.title} · all day</span>)}</div>}
   <div className={`planner-grid ${linking?'accepting-thread':''}`} ref={grid} tabIndex={canWrite||timezone?0:-1} aria-label="Day calendar. Drag empty space to add an event. Use arrows to choose a time and Enter to name it. When linking a task, Enter starts and saves the span." onKeyDown={keyboardSelection} onPointerDownCapture={beginSelection} onPointerMove={calendarHover} onPointerLeave={()=>{if(!interaction.current&&!creating)updateGhost(null);}}>
    {hours.map((h,i)=><div className="planner-hour" style={{top:`${i/(hours.length-1)*100}%`}} key={h}><span>{plannerHourLabel(h)}</span><i/></div>)}
    {events.map((e:any)=>{const t=tasks.find((t:any)=>t.id===e.taskId),color=taskSchedule(t)?.color||'#62a8ff';return <div ref={el=>{if(!e.taskId)return;if(el)blockRefs.current.set(e.taskId,el);else blockRefs.current.delete(e.taskId);}} data-linked-task={e.taskId} data-delete-task={t?.id} data-delete-kind={t?'event':undefined} data-phase={e.phase} className={`planner-event ${highlightedTask===e.taskId?'is-connection-active':''} ${t?'linked-event':''} ${t?.done?'completed-event':''}`} key={e.id} style={{top:`${e.top*100}%`,height:`calc(${e.height*100}% - 1px)`,left:`calc(40px + (100% - 40px) * ${e.lane/e.lanes})`,width:`calc((100% - 40px) / ${e.lanes} - 3px)`,'--event-color':color} as React.CSSProperties}><button tabIndex={0} aria-keyshortcuts={t?'Delete Backspace':undefined} title={`${e.title} · ${clock(e.start)} – ${clock(e.end)}`} aria-label={`${e.title}, ${clock(e.start)} to ${clock(e.end)}`} draggable={false} onDragStart={ev=>ev.preventDefault()} onPointerDown={ev=>beginMove(ev,t)} onClick={ev=>{if(ignoreClick.current===e.taskId&&ev.detail!==0){ignoreClick.current=null;return;}if(linking)return;if(t){host('focus');ev.currentTarget.focus({preventScroll:true});setSelectedAnchor('calendar');setSelected(t.id);}else notify(`${e.title} · ${clock(e.start)}–${clock(e.end)}. Edit this event in Calendar.`);}}><strong>{t?.done?'✓ ':''}{e.title}</strong>{e.end-e.start>=3600000&&<span>{clock(e.start)} – {clock(e.end)}</span>}</button>{t&&!busy&&!linking&&<button className="planner-resize" aria-label={`Resize ${e.title}`} title="Drag to change duration" onPointerDown={ev=>beginResize(ev,t)}/>}</div>;})}
    {now>range.start&&now<range.end&&<div className="planner-now" style={{top:`${(now-range.start)/(range.end-range.start)*100}%`}}><i/></div>}
    {ghost&&<div className="planner-ghost" ref={ghostAnchor} data-selecting={ghost.selecting} style={{top:`${(ghost.start-range.start)/(range.end-range.start)*100}%`,height:`${(ghost.end-ghost.start)/(range.end-range.start)*100}%`}}>{!ghost.selecting&&!linking&&onCreateTask&&<button type="button" className="planner-slot-add" aria-label={`Add event at ${clock(ghost.start)}`} title="Add event" onClick={()=>openCreation({start:ghost.start,end:ghost.end})}><Plus size={13}/></button>}</div>}
   </div>
   {!canWrite&&<div className="planner-connect"><p>{timezone?'Your routine is planned in Panda. Connect Mac Calendar to add calendar events.':info.status==='authorized'?'Select a writable calendar in Preferences to start planning.':'Connect Mac Calendar to start planning.'}</p><Button size="sm" variant="secondary" onClick={()=>{host('calendarConnect');notify('Choose your calendar in Preferences.');}}>Connect calendar</Button></div>}
   </div>
  </section>
  {error&&<div className="planner-error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={12}/></button></div>}
  <svg className="planner-thread" aria-hidden="true">{isLayoutActive&&connections.map(c=>{const hidden=linking===c.taskId||docking===c.taskId?'hidden':undefined;return <React.Fragment key={c.taskId}><path className={`saved-thread ${highlightedTask===c.taskId?'is-active':''}`} data-task-id={c.taskId} d={c.d} style={{visibility:hidden}}/><path className="saved-thread-hit" data-task-id={c.taskId} d={c.d} style={{visibility:hidden}}/><circle className={`saved-thread-endpoint ${highlightedTask===c.taskId?'is-active':''}`} data-task-id={c.taskId} cx={c.targetX} cy={c.targetY} r="3" style={{visibility:hidden}}/></React.Fragment>;})}<path className="loose-thread" ref={path}/><g ref={tip} visibility="hidden"><circle r="7"/><path d="M -3 0 H 3 M 0 -3 V 3"/></g></svg>
  {creating&&isLayoutActive&&<NewEventComposer slot={creating} root={root} anchor={()=>ghostAnchor.current} onCreate={createCalendarTask} onClose={closeCreation}/>}
  {current&&(isLayoutActive||selectedAnchor==='task')&&<EventDetails key={current.id} onSaveEvidence={onSaveEvidence} removalGuard={removalGuard} focusTitle={selectedAnchor==='task'} task={current} now={now} busy={!!busy} root={root} constrainToPanel={isLayoutActive} anchor={()=>selectedAnchor==='task'?nodeRefs.current.get(current.id)?.closest<HTMLElement>('.task-row'):blockRefs.current.get(current.id)} onReserveHeight={(height:number)=>{if(!isLayoutActive)setEditorFloor(height);}} isTaskPresent={()=>latest.current.tasks.some((task:any)=>task.id===current.id)} onClose={()=>setSelected(null)} onSave={async(values:any)=>{if(validSlot(values.start,values.end)){const result=await submit({...current,title:values.title},values);if(result?.ok)dispatch({type:'edit',id:current.id,title:values.title});return result;}dispatch({type:'edit',id:current.id,title:values.title});return {ok:true,title:values.title};}} onUnlink={()=>submit(current,{},'remove')} onColor={(color:string)=>usesLocalTime(current)?dispatch({type:'taskPlannedTime',id:current.id,time:{...current.plannedTime,color}}):dispatch({type:'taskCalendarColor',id:current.id,color})} onPriority={(priority:string)=>dispatch({type:'taskPriority',id:current.id,priority})}/>}
 </div>;
}
function EventDetails({task,now,busy,root,removalGuard,focusTitle=true,constrainToPanel=false,anchor,onReserveHeight,isTaskPresent,onClose,onSave,onUnlink,onColor,onPriority,onSaveEvidence}:any){
 const link=taskSchedule(task)||task.calendarLink,timezone=usesLocalTime(task)?'Asia/Kolkata':undefined;
 const initial=()=>({title:task.title,start:link?inputTime(link.start,timezone):'',end:link?inputTime(link.end,timezone):''});
 const [draft,setDraft]=useState(initial),[confirm,setConfirm]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const titleInput=useRef<HTMLInputElement>(null);
 useLayoutEffect(()=>{if(focusTitle)titleInput.current?.focus();},[focusTitle]);
 const layer=useRef<HTMLDivElement>(null),draftRef=useRef(draft),saved=useRef(initial()),timer=useRef<ReturnType<typeof setTimeout>|null>(null),pending=useRef(false),queued=useRef(false),invalidated=useRef(false),mounted=useRef(true),latestDetails=useRef<any>(null),anchorRef=useRef(anchor);
 draftRef.current=draft;anchorRef.current=anchor;latestDetails.current={task,now,busy,onSave,isTaskPresent};
 useEffect(()=>{const next=initial(),previous=saved.current;saved.current=next;if(!pending.current&&draftRef.current.title===previous.title&&draftRef.current.start===previous.start&&draftRef.current.end===previous.end){draftRef.current=next;setDraft(next);}},[task.title,link?.start,link?.end]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);void commit(draftRef.current);};},[]);
 useLayoutEffect(()=>{
  const node=layer.current,workspace=root.current,target=anchorRef.current();if(!node||!workspace||!target)return;
  const measure=()=>{
   if(!node.isConnected||!target.isConnected)return;
   const a=target.getBoundingClientRect(),r=workspace.getBoundingClientRect(),shell=workspace.closest('.notch-layout')?.getBoundingClientRect()||{left:0,right:window.innerWidth,top:0,bottom:window.innerHeight},availableHeight=parseFloat(getComputedStyle(workspace).getPropertyValue('--screen-height'))||window.innerHeight;
   const heightLimit=constrainToPanel?Math.min(availableHeight,shell.bottom-shell.top):availableHeight;
   node.style.maxHeight=`${Math.max(100,heightLimit-24)}px`;
   const size=node.getBoundingClientRect();
   const position=anchoredPosition(a,size,{left:Math.max(0,shell.left),right:Math.min(window.innerWidth,shell.right),top:Math.max(0,shell.top),bottom:shell.top+heightLimit});
   onReserveHeight(Math.max(0,Math.ceil(position.top-r.top+size.height)));
   node.style.left=`${position.left-r.left}px`;node.style.top=`${position.top-r.top}px`;node.style.visibility='visible';
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(node);observer.observe(target);observer.observe(workspace);
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[root,task.id,anchor,constrainToPanel]);
 const commit=async(values=draftRef.current,reportInvalid=false)=>{
  if(timer.current)clearTimeout(timer.current);timer.current=null;
  const current=latestDetails.current.task,schedule=taskSchedule(current),timezone=usesLocalTime(current)?'Asia/Kolkata':undefined,result=eventDraftUpdate(values,saved.current,schedule?.start??latestDetails.current.now,latestDetails.current.isTaskPresent(),!!schedule,invalidated.current,timezone);
  if(!result){queued.current=false;if(mounted.current)setError('');return;}
  if(result.error){if(reportInvalid&&mounted.current)setError(result.error);return;}
  if(pending.current){queued.current=true;return;}
  pending.current=true;if(mounted.current){setSaving(true);setError('');}
  try{
   const response=await latestDetails.current.onSave(result);
   if(!response?.ok){if(mounted.current)setError(response?.error||'Calendar could not save this change. Try again.');return;}
   const next={title:response.title||result.title,start:response.slot?inputTime(response.slot.start,timezone):values.start,end:response.slot?inputTime(response.slot.end,timezone):values.end};
   saved.current=next;
   if(draftRef.current.title===values.title&&draftRef.current.start===values.start&&draftRef.current.end===values.end){draftRef.current=next;if(mounted.current)setDraft(next);}
  }catch(e:any){if(mounted.current)setError(e.message);}
  finally{pending.current=false;if(mounted.current)setSaving(false);if(queued.current){queued.current=false;timer.current=setTimeout(()=>{timer.current=null;void commit(draftRef.current);},100);}}
 };
 const invalidate=()=>{
  if(pending.current||latestDetails.current.busy)return false;
  invalidated.current=true;queued.current=false;if(timer.current)clearTimeout(timer.current);timer.current=null;return true;
 };
 useLayoutEffect(()=>{
  if(!removalGuard)return;
  const guard={invalidate,restore:()=>{invalidated.current=false;}};removalGuard.current=guard;
  return()=>{if(removalGuard.current===guard)removalGuard.current=null;};
 },[removalGuard,task.id]);
 const unlink=async()=>{
  if(!invalidate())return;
  try{const response=await onUnlink();if(!response?.ok){invalidated.current=false;if(mounted.current)setError(response?.error||'Calendar could not remove this time. Try again.');}}
  catch(e:any){invalidated.current=false;if(mounted.current)setError(e.message);}
 };
 const change=(patch:any,immediate=false)=>{
  const next={...draftRef.current,...patch};draftRef.current=next;setDraft(next);setError('');if(timer.current)clearTimeout(timer.current);
  if(immediate)void commit(next,true);else timer.current=setTimeout(()=>{timer.current=null;void commit(draftRef.current);},550);
 };
 const timeField=(field:'start'|'end',label:string)=><label className="event-time-label"><span>{label}</span><div className="event-time-input"><input type="time" step="900" aria-label={label} value={draft[field]} onChange={e=>change({[field]:e.target.value})} onBlur={()=>void commit(draftRef.current,true)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void commit(draftRef.current,true);}}}/><span className="event-time-steppers"><button type="button" aria-label={`${label} 15 minutes later`} disabled={busy||saving} onPointerDown={e=>e.preventDefault()} onClick={()=>change({[field]:stepEventTime(draftRef.current[field]||(field==='start'?'09:00':'09:30'),15,field==='end')},true)}><ChevronUp size={11}/></button><button type="button" aria-label={`${label} 15 minutes earlier`} disabled={busy||saving} onPointerDown={e=>e.preventDefault()} onClick={()=>change({[field]:stepEventTime(draftRef.current[field]||(field==='start'?'09:00':'09:30'),-15,field==='end')},true)}><ChevronDown size={11}/></button></span></div></label>;
 return <div className="planner-popover" ref={layer} style={{visibility:'hidden'}} role="dialog" aria-label="Edit task" onPointerDown={e=>e.stopPropagation()}>
  <header><label className="event-title-field"><span className="sr-only">Task name</span><input ref={titleInput} autoFocus={focusTitle} aria-label="Task name" maxLength={500} value={draft.title} onChange={e=>change({title:e.target.value})} onBlur={()=>void commit(draftRef.current,true)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void commit(draftRef.current,true);}}}/></label><button onClick={()=>{void commit(draftRef.current,true);onClose();}} aria-label="Close event details"><X size={14}/></button></header>
  {link?.missing?<p>This event is no longer available. Unlink it to schedule again.</p>:<div className="event-time-fields">{timeField('start','Starts')}{timeField('end','Ends')}</div>}
  <TaskPriorityChoices priority={task.priority||'medium'} onChange={onPriority}/>
  {task.campaign?.campaign_id==='november-2026'&&onSaveEvidence&&<CampaignEvidence key={task.id} task={task} onSave={onSaveEvidence}/>}
  <div className="event-save-status" role="status">{saving||busy?'Saving…':error?<span role="alert">{error}</span>:null}</div>
  {link&&<><p className="event-color-label">Block color in Panda</p><div className="event-colors">{plannerColors.map(color=><button key={color} style={{background:color}} aria-label={`Use ${color} color`} aria-pressed={(link.color||plannerColors[0])===color} onClick={()=>onColor(color)}/>)}</div>{confirm?<div className="event-unlink-confirm"><p>{link.local?'Remove this planned time? Your task stays here.':'Remove this event from Calendar? Your task stays here.'}</p><Button variant="ghost" size="sm" disabled={busy||saving} onClick={()=>setConfirm(false)}>{link.local?'Keep time':'Keep event'}</Button><Button variant="secondary" size="sm" disabled={busy||saving} onClick={unlink}>{link.local?'Remove time':'Remove event'}</Button></div>:<Button variant="ghost" size="sm" disabled={busy||saving} onClick={()=>link.missing?void unlink():setConfirm(true)}><Unlink size={12}/> Unlink time</Button>}</>}
 </div>;
}
