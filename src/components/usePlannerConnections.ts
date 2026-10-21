import {useLayoutEffect,useRef,useState,type MutableRefObject,type RefObject} from 'react';

type Connection={taskId:string;d:string};
type ElementMap=MutableRefObject<Map<string,HTMLElement>>;
const rounded=(value:number)=>Math.round(value*100)/100;
const sameConnections=(a:Connection[],b:Connection[])=>a.length===b.length&&a.every((item,i)=>item.taskId===b[i].taskId&&item.d===b[i].d);

/** Measure cords only when layout changes; follow the brief panel expansion, then rest. */
export function usePlannerConnections(rootRef:RefObject<HTMLElement|null>,nodeRefs:ElementMap,blockRefs:ElementMap,active:boolean,layoutKey:string){
 const [connections,setConnections]=useState<Connection[]>([]);
 const generation=useRef(0);
 useLayoutEffect(()=>{
  const token=++generation.current,root=rootRef.current;
  if(!active||!root){setConnections(old=>old.length?[]:old);return;}
  let frame=0,disposed=false;
  // Transform animations do not fire ResizeObserver. Follow those few frames explicitly.
  const followUntil=performance.now()+320;
  const measure=()=>{
   if(disposed||generation.current!==token)return;
   const origin=root.getBoundingClientRect(),next:Connection[]=[];
   for(const [taskId,block] of blockRefs.current){
    const node=nodeRefs.current.get(taskId);
    if(!node||!node.isConnected||!block.isConnected)continue;
    const a=node.getBoundingClientRect(),b=block.getBoundingClientRect();
    if(!a.width||!a.height||!b.width||!b.height)continue;
    const ax=a.left+a.width/2-origin.left,ay=a.top+a.height/2-origin.top;
    const bx=b.left-origin.left,by=b.top+b.height/2-origin.top,dx=bx-ax,dy=by-ay;
    const sag=Math.min(60,Math.max(30,Math.abs(dx)*.18+Math.abs(dy)*.07));
    const points=[ax,ay,ax+dx*.33,ay+dy*.33+sag,ax+dx*.67,ay+dy*.67+sag,bx,by].map(rounded);
    if(points.some(value=>!Number.isFinite(value)))continue;
    const [x1,y1,c1x,c1y,c2x,c2y,x2,y2]=points;
    next.push({taskId,d:`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`});
   }
   next.sort((a,b)=>a.taskId.localeCompare(b.taskId));
   setConnections(old=>sameConnections(old,next)?old:next);
  };
  const flush=(stamp:number)=>{frame=0;if(disposed)return;measure();if(stamp<followUntil)frame=requestAnimationFrame(flush);};
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(flush);};
  // The first measurement belongs to this commit, before the new block can paint unlinked.
  measure();schedule();
  const observer=new ResizeObserver(schedule);
  const elements=new Set<HTMLElement>([root,...nodeRefs.current.values(),...blockRefs.current.values()]);
  for(const element of elements)observer.observe(element);
  window.addEventListener('scroll',schedule,true);
  window.addEventListener('resize',schedule);
  return()=>{disposed=true;generation.current++;if(frame)cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);};
 },[rootRef,nodeRefs,blockRefs,active,layoutKey]);
 return connections;
}
