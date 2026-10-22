import {useLayoutEffect,useRef,useState,type MutableRefObject,type RefObject} from 'react';

type Connection={taskId:string;d:string;targetX:number;targetY:number};
type ElementMap=MutableRefObject<Map<string,HTMLElement>>;
type Rect=Pick<DOMRect,'left'|'top'|'width'|'height'>;
type Geometry={d:string;hidden:boolean;targetX:number;targetY:number};
const rounded=(value:number)=>Math.round(value*100)/100;
const validRect=(rect:Rect)=>[rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)&&rect.width>0&&rect.height>0;
const visiblePart=(rect:Rect,viewport?:Rect)=>{
 if(!viewport)return rect;
 const left=Math.max(rect.left,viewport.left),top=Math.max(rect.top,viewport.top);
 const width=Math.min(rect.left+rect.width,viewport.left+viewport.width)-left;
 const height=Math.min(rect.top+rect.height,viewport.top+viewport.height)-top;
 return width>0&&height>0?{left,top,width,height}:null;
};

/** Keep offscreen cords mounted; clip their endpoints to the visible portions of each column. */
export function plannerConnectionGeometry(node:Rect,block:Rect,origin:Rect,viewport?:Rect,sourceViewport?:Rect):Geometry|null{
 if(!validRect(node)||!validRect(block)||![origin.left,origin.top].every(Number.isFinite))return null;
 const source=visiblePart(node,sourceViewport),target=visiblePart(block,viewport);
 const a=source??node,b=target??block;
 const ax=a.left+a.width/2-origin.left,ay=a.top+a.height/2-origin.top;
 const bx=b.left-origin.left,by=b.top+b.height/2-origin.top,dx=bx-ax,dy=by-ay;
 const sag=Math.min(60,Math.max(30,Math.abs(dx)*.18+Math.abs(dy)*.07));
 const points=[ax,ay,ax+dx*.33,ay+dy*.33+sag,ax+dx*.67,ay+dy*.67+sag,bx,by].map(rounded);
 if(points.some(value=>!Number.isFinite(value)))return null;
 const [x1,y1,c1x,c1y,c2x,c2y,x2,y2]=points;
 return {d:`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,hidden:!source||!target,targetX:x2,targetY:y2};
}

/** Hit-test a wider cord without taking pointer or wheel events from the calendar below it. */
export function plannerThreadAtPoint(paths:Iterable<SVGPathElement>,point:{x:number;y:number}):string|null{
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return null;
 for(const path of paths){
  if(path.getAttribute('display')==='none'||path.style.visibility==='hidden')continue;
  if(path.isPointInStroke?.(point))return path.dataset.taskId||null;
 }
 return null;
}

function applyPaths(root:HTMLElement,geometry:Map<string,Geometry>){
 for(const path of root.querySelectorAll<SVGPathElement>('path.saved-thread[data-task-id],path.saved-thread-hit[data-task-id]')){
  const next=geometry.get(path.dataset.taskId??'');
  if(!next)continue;
  if(path.getAttribute('d')!==next.d)path.setAttribute('d',next.d);
  // Docking owns inline visibility. Display independently clips scrolled-out cords.
  if(next.hidden){if(path.getAttribute('display')!=='none')path.setAttribute('display','none');}
  else if(path.hasAttribute('display'))path.removeAttribute('display');
 }
 for(const dot of root.querySelectorAll<SVGCircleElement>('circle.saved-thread-endpoint[data-task-id]')){
  const next=geometry.get(dot.dataset.taskId??'');if(!next)continue;
  dot.setAttribute('cx',String(next.targetX));dot.setAttribute('cy',String(next.targetY));
  if(next.hidden)dot.setAttribute('display','none');else dot.removeAttribute('display');
 }
}

/** Measure cords only when layout changes; follow the brief panel expansion, then rest. */
export function usePlannerConnections(rootRef:RefObject<HTMLElement|null>,nodeRefs:ElementMap,blockRefs:ElementMap,active:boolean,layoutKey:string,viewportRef?:RefObject<HTMLElement|null>){
 const [connections,setConnections]=useState<Connection[]>([]);
 const generation=useRef(0),identities=useRef<string[]>([]),geometry=useRef(new Map<string,Geometry>());
 useLayoutEffect(()=>{
  const token=++generation.current,root=rootRef.current;
  if(!active||!root){
   geometry.current.clear();
   if(identities.current.length){identities.current=[];setConnections([]);}
   return;
  }
  let frame=0,disposed=false;
  // Transform animations do not fire ResizeObserver. Follow those few frames explicitly.
  const followUntil=performance.now()+320;
  const measure=()=>{
   if(disposed||generation.current!==token)return;
   const origin=root.getBoundingClientRect(),viewport=viewportRef?.current?.getBoundingClientRect();
   const next=new Map<string,Geometry>(),sourceViewports=new Map<Element,DOMRect>();
   for(const [taskId,block] of blockRefs.current){
    const node=nodeRefs.current.get(taskId);
    if(!node||!node.isConnected||!block.isConnected)continue;
    const list=node.closest('.task-list');
    if(list&&!sourceViewports.has(list))sourceViewports.set(list,list.getBoundingClientRect());
    const cord=plannerConnectionGeometry(node.getBoundingClientRect(),block.getBoundingClientRect(),origin,viewport,list?sourceViewports.get(list):undefined);
    if(cord)next.set(taskId,cord);
   }
   geometry.current=next;
   applyPaths(root,next);
   const ids=[...next.keys()].sort((a,b)=>a.localeCompare(b));
   // Scrolling changes geometry, not React identities or parent task renders.
   if(ids.length!==identities.current.length||ids.some((id,i)=>id!==identities.current[i])){
    identities.current=ids;
    setConnections(ids.map(taskId=>{const cord=next.get(taskId)!;return {taskId,d:cord.d,targetX:cord.targetX,targetY:cord.targetY};}));
   }
  };
  const flush=(stamp:number)=>{frame=0;if(disposed)return;measure();if(stamp<followUntil)frame=requestAnimationFrame(flush);};
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(flush);};
  // The first measurement belongs to this commit, before the new block can paint unlinked.
  measure();schedule();
  const observer=new ResizeObserver(schedule);
  const elements=new Set<Element>([root,...nodeRefs.current.values(),...blockRefs.current.values()]);
  if(viewportRef?.current)elements.add(viewportRef.current);
  for(const node of nodeRefs.current.values()){const list=node.closest('.task-list');if(list)elements.add(list);}
  for(const element of elements)observer.observe(element);
  window.addEventListener('scroll',schedule,true);
  window.addEventListener('resize',schedule);
  return()=>{disposed=true;generation.current++;if(frame)cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);};
 },[rootRef,nodeRefs,blockRefs,active,layoutKey,viewportRef]);
 // A new identity mounts its path after measurement; apply clipping before its first paint.
 useLayoutEffect(()=>{if(active&&rootRef.current)applyPaths(rootRef.current,geometry.current);},[connections,active,rootRef]);
 return connections;
}
