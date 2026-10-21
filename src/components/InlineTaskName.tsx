import {useLayoutEffect,useRef,useState} from 'react';
import './inline-task-name.css';

type InlineTaskNameProps={title:string;onSave:(title:string)=>Promise<unknown>;onDone:()=>void;onError:(message:string)=>void};

/** Explicit blur/Enter commit keeps compact renaming local to the name field. */
export function InlineTaskName({title,onSave,onDone,onError}:InlineTaskNameProps){
 const [value,setValue]=useState(title),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null),pending=useRef(false),cancelled=useRef(false),mounted=useRef(true),latestSave=useRef<()=>Promise<void>>(async()=>{});
 useLayoutEffect(()=>{mounted.current=true;input.current?.focus();input.current?.select();return()=>{mounted.current=false;void latestSave.current();};},[]);
 const save=async()=>{
  if(pending.current||cancelled.current)return;
  const next=value.trim();if(!next||next===title){if(mounted.current)onDone();return;}
  pending.current=true;if(mounted.current){setSaving(true);setError('');}
  try{await onSave(next);if(mounted.current)onDone();}
  catch(reason:any){const message=reason?.message||'Could not rename this task.';if(mounted.current)setError(message);onError(message);}
  finally{pending.current=false;if(mounted.current)setSaving(false);}
 };
 latestSave.current=save;
 return <input ref={input} className="task-title task-inline-name" aria-label={`Rename ${title}`} aria-busy={saving||undefined} aria-invalid={!!error||undefined} title={error||undefined} value={value} disabled={saving} maxLength={500} draggable={false} onDragStart={event=>{event.preventDefault();event.stopPropagation();}} onClick={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()} onChange={event=>{setValue(event.target.value);setError('');}} onBlur={()=>void save()} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void save();}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelled.current=true;onDone();}}}/>;
}
