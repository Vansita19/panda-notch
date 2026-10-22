import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type FormEvent} from 'react';
import {Button} from '../arc/button/button';
import {anchoredPosition} from '../event-details.mjs';
import './task-planner.css';

type Slot={start:number;end:number};
type Result={ok:boolean;task?:unknown;error?:string};
type Props={slot:Slot;root:RefObject<HTMLElement|null>;anchor:()=>HTMLElement|null;onCreate:(title:string)=>Promise<Result>;onClose:()=>void};
const clock=(time:number)=>new Date(time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',hour12:true});

/** Naming a new time slot never rewrites or duplicates an existing task. */
export function NewEventComposer({slot,root,anchor,onCreate,onClose}:Props){
 const [title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const layer=useRef<HTMLFormElement>(null),input=useRef<HTMLInputElement>(null),titleRef=useRef(''),pending=useRef(false),mounted=useRef(true),anchorRef=useRef(anchor);
 anchorRef.current=anchor;
 useEffect(()=>{mounted.current=true;input.current?.focus();return()=>{mounted.current=false;};},[]);
 useLayoutEffect(()=>{
  const node=layer.current,workspace=root.current;if(!node||!workspace)return;
  const measure=()=>{
   const target=anchorRef.current();if(!target||!target.isConnected||!node.isConnected)return;
   const bounds=workspace.closest('.notch-layout')?.getBoundingClientRect()||{left:0,right:window.innerWidth,top:0,bottom:window.innerHeight};
   const origin=workspace.getBoundingClientRect(),position=anchoredPosition(target.getBoundingClientRect(),node.getBoundingClientRect(),{left:Math.max(0,bounds.left),right:Math.min(window.innerWidth,bounds.right),top:Math.max(0,bounds.top),bottom:Math.min(window.innerHeight,bounds.bottom)});
   node.style.left=`${position.left-origin.left}px`;node.style.top=`${position.top-origin.top}px`;node.style.visibility='visible';
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(node);observer.observe(workspace);const target=anchorRef.current();if(target)observer.observe(target);
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[root,slot.start,slot.end]);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(pending.current)return;const name=titleRef.current.trim();if(!name){setError('Give this event a name.');input.current?.focus();return;}
  pending.current=true;setBusy(true);setError('');
  try{const result=await onCreate(name);if(!mounted.current)return;if(result.ok||result.task)onClose();else setError(result.error||'Could not add this event. Try again.');}
  catch(reason:any){if(mounted.current)setError(reason?.message||'Could not add this event. Try again.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 return <form className="planner-create-popover" ref={layer} style={{visibility:'hidden'}} role="dialog" aria-label="New calendar event" onPointerDown={event=>event.stopPropagation()} onSubmit={submit}>
  <input ref={input} autoFocus aria-label="Event name" placeholder="Event name" value={title} maxLength={500} disabled={busy} onChange={event=>{titleRef.current=event.target.value;setTitle(event.target.value);if(error)setError('');}}/>
  <span className="planner-create-time">{clock(slot.start)} – {clock(slot.end)}</span>
  {error&&<span className="planner-create-error" role="alert">{error}</span>}
  <div className="planner-create-actions"><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" size="sm" disabled={busy||!title.trim()}>{busy?'Adding…':'Add'}</Button></div>
 </form>;
}
