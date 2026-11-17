import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,ChevronLeft,ChevronRight,Pencil,Plus,X} from 'lucide-react';
import {Checkbox} from '../arc/checkbox/checkbox';
import {dayFromKey} from '../month-progress.mjs';
import {shiftTrackerDay,trackerCount,trackerLimit,trackerMask,trackerTitle,trackerToday,trackerSlotLimit,trackerMinuteLimit,validTrackerSlots,validTrackerGoalMinutes} from '../tracker.mjs';
import {TrackerHistory} from './TrackerHistory';
import type {TrackerHabit} from './tracker-types';
import './tracker.css';

type TrackerTarget={kind:'count';slots:number}|{kind:'duration';goalMinutes:number};
type DurationHabit=Extract<TrackerHabit,{kind:'duration'}>;
type Dispatch=(action:any)=>void;
const dateLabel=(day:string)=>new Date(dayFromKey(day)).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

export function TrackerDateNavigation({day,today,onChange}:{day:string;today:string;onChange:(day:string|null)=>void}){
 return <div className="tracker-date-navigation" role="group" aria-label="Tracker date">
  <button type="button" aria-label="Previous day" onClick={()=>onChange(shiftTrackerDay(day,-1))}><ChevronLeft size={15}/></button>
  <button type="button" className="tracker-date-label" title="Return to Today" aria-label={day===today?'Today':`${dateLabel(day)}. Return to Today`} onClick={()=>onChange(null)}><time dateTime={day.split('-').map((part,index)=>index?part.padStart(2,'0'):part).join('-')}>{day===today?'Today':dateLabel(day)}</time></button>
  <button type="button" aria-label="Next day" disabled={dayFromKey(day)>=dayFromKey(today)} onClick={()=>onChange(shiftTrackerDay(day,1))}><ChevronRight size={15}/></button>
 </div>;
}

function TrackerDurationControls({tracker,day,dispatch}:{tracker:DurationHabit;day:string;dispatch:Dispatch}){
 const [draft,setDraft]=useState<string|null>(null);
 const [preview,setPreview]=useState<number|null>(null);
 const slider=useRef<HTMLInputElement>(null);
 const errorId=useId();
 const minutes=tracker.days[day]??0;
 const sliderValue=preview??Math.min(minutes,tracker.goalMinutes);
 const name=`${tracker.title} on ${dateLabel(day)}`;
 const changeMinutes=(value:number)=>{
  if(Number.isInteger(value)&&value>=0&&value<=trackerMinuteLimit){
   dispatch({type:'trackerDuration',id:tracker.id,day,minutes:value});
  }
 };
 // The native change event fires on a committed edit, unlike React's range onChange.
 useLayoutEffect(()=>{
  const input=slider.current;
  if(!input)return;
  const commit=()=>{
   const value=input.valueAsNumber;
   setPreview(null);
   if(Number.isInteger(value)&&value>=0&&value<=tracker.goalMinutes){
    dispatch({type:'trackerDuration',id:tracker.id,day,minutes:value});
   }
  };
  input.addEventListener('change',commit);
  return ()=>input.removeEventListener('change',commit);
 },[tracker.id,tracker.goalMinutes,day,dispatch]);
 const invalid=draft!==null&&draft!==''&&(!Number.isInteger(Number(draft))||Number(draft)<0||Number(draft)>trackerMinuteLimit);
 return <>
  <div className="tracker-duration" role="group" aria-label={name}>
   <input ref={slider} className="tracker-duration-slider" type="range" min={0} max={tracker.goalMinutes} step={1} value={sliderValue}
    style={{'--tracker-duration-percent':`${sliderValue/tracker.goalMinutes*100}%`} as React.CSSProperties}
    aria-label={`${name} progress slider`} aria-valuetext={`${sliderValue} minutes`}
    onInput={event=>{setDraft(null);setPreview(event.currentTarget.valueAsNumber);}}/>
   <label className="tracker-duration-entry">
    <input type="number" inputMode="numeric" min={0} max={trackerMinuteLimit} step={1} value={draft??preview??minutes}
     aria-label={`${name}, minutes completed`} aria-invalid={invalid||undefined} aria-describedby={invalid?errorId:undefined}
     onChange={event=>{setDraft(event.target.value);changeMinutes(event.target.valueAsNumber);}}
     onBlur={()=>{if(!invalid)setDraft(null);}}
     onKeyDown={event=>{if(event.key==='Enter'&&!invalid)event.currentTarget.blur();}}/>
    <span aria-hidden="true">min</span>
   </label>
  </div>
  {invalid&&<p className="tracker-duration-error" id={errorId} role="alert">Enter whole minutes from 0 to {trackerMinuteLimit}.</p>}
 </>;
}

export function TrackerRow({tracker,day,dispatch,onRename,onRemove,editor}:{tracker:TrackerHabit;day:string;dispatch:Dispatch;onRename:()=>void;onRemove:()=>void;editor?:React.ReactNode}){
 const duration=tracker.kind==='duration';
 const mask=duration?0:trackerMask(tracker,day);
 const count=duration?(tracker.days[day]??0):trackerCount(tracker,day);
 const goal=duration?tracker.goalMinutes:tracker.slots;
 const unit=duration?' minutes':'';
 const moveFocus=(event:React.KeyboardEvent<HTMLDivElement>)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const boxes=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=checkbox]')),index=boxes.indexOf(event.target as HTMLButtonElement);if(index<0)return;
  event.preventDefault();event.stopPropagation();
  boxes[event.key==='Home'?0:event.key==='End'?boxes.length-1:Math.max(0,Math.min(boxes.length-1,index+(event.key==='ArrowRight'?1:-1)))]?.focus();
 };
 return <div className="tracker-row">
  <div className="tracker-row-heading">{editor||<><span className="tracker-name">{tracker.title}</span><div className="tracker-row-actions"><button type="button" aria-label={`Rename ${tracker.title}`} onClick={onRename}><Pencil size={12}/></button><button type="button" aria-label={`Remove ${tracker.title}`} onClick={onRemove}><X size={13}/></button></div></>}
   <output className="tracker-count" aria-label={`${tracker.title}, ${count} of ${goal}${unit} on ${dateLabel(day)}`}>{count}/{goal}{duration?' min':''}</output>
  </div>
  {duration?<TrackerDurationControls key={day} tracker={tracker} day={day} dispatch={dispatch}/>:<div className="tracker-boxes" role="group" aria-label={`${tracker.title} on ${dateLabel(day)}`} onKeyDown={moveFocus}>
   {Array.from({length:tracker.slots},(_,slot)=><Checkbox key={slot} className="tracker-checkbox" checked={!!(mask&(1<<slot))} aria-label={`${tracker.title}, slot ${slot+1} of ${tracker.slots}, ${dateLabel(day)}`} onCheckedChange={checked=>dispatch({type:'trackerCheck',id:tracker.id,day,slot,checked:checked===true})}/>)}
  </div>}
 </div>;
}

function TrackerNameForm({initial='',label,chooseTarget=false,onSave,onCancel}:{initial?:string;label:string;chooseTarget?:boolean;onSave:(title:string,target?:TrackerTarget)=>void;onCancel:()=>void}){
 const [name,setName]=useState(initial);
 const [kind,setKind]=useState<TrackerTarget['kind']>('count');
 const [targets,setTargets]=useState({count:'3',duration:'30'});
 const [error,setError]=useState<{field:'name'|'target';message:string}|null>(null);
 const nameField=useRef<HTMLInputElement>(null);
 const targetField=useRef<HTMLInputElement>(null);
 const errorId=useId();
 const duration=kind==='duration';
 const targetLimit=duration?trackerMinuteLimit:trackerSlotLimit;
 const submit=(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const title=trackerTitle(name);
  if(!title){
   setError({field:'name',message:'Enter a tracker name.'});
   nameField.current?.focus();
   return;
  }
  if(!chooseTarget){
   onSave(title);
   return;
  }
  const value=Number(targets[kind]);
  if(!(duration?validTrackerGoalMinutes(value):validTrackerSlots(value))){
   const message=duration?`Enter a goal from 1 to ${targetLimit} minutes.`:`Choose a daily target from 1 to ${targetLimit}.`;
   setError({field:'target',message});
   targetField.current?.focus();
   return;
  }
  onSave(title,duration?{kind:'duration',goalMinutes:value}:{kind:'count',slots:value});
 };
 return <form className="tracker-name-form" data-choose-target={chooseTarget} noValidate onSubmit={submit} onKeyDown={event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel();}
 }}>
  <input ref={nameField} autoFocus aria-label={label} aria-invalid={error?.field==='name'||undefined}
   aria-describedby={error?.field==='name'?errorId:undefined} value={name} maxLength={100} placeholder="Tracker name"
   onChange={event=>{setName(event.target.value);setError(null);}}/>
  {chooseTarget&&<div className="tracker-goal-settings">
   <div className="tracker-goal-type" role="group" aria-label="Goal type">
    {(['count','duration'] as const).map(value=><button key={value} type="button" aria-pressed={kind===value}
     onClick={()=>{setKind(value);setError(null);}}>{value==='count'?'Count':'Duration'}</button>)}
   </div>
   <label className="tracker-target">{duration?'Minutes per day':'Daily target'}
    <input ref={targetField} type="number" min={1} max={targetLimit} step={1} inputMode="numeric"
     aria-invalid={error?.field==='target'||undefined} aria-describedby={error?.field==='target'?errorId:undefined}
     value={targets[kind]} onChange={event=>{setTargets({...targets,[kind]:event.target.value});setError(null);}}/>
   </label>
  </div>}
  <div className="tracker-form-actions">
   <button type="submit" aria-label={chooseTarget?'Create tracker':'Save tracker name'}><Check size={13}/></button>
   <button type="button" aria-label={chooseTarget?'Cancel new tracker':'Cancel tracker name'} onClick={onCancel}><X size={13}/></button>
  </div>
  {error&&<span id={errorId} className="tracker-name-error" role="alert">{error.message}</span>}
 </form>;
}

export function Tracker({trackers,now,dispatch,notify}:{trackers:TrackerHabit[];now:number;dispatch:Dispatch;notify:(message:string,undo?:()=>void)=>void}){
 const today=trackerToday(now),[selected,setSelected]=useState<string|null>(null),[history,setHistory]=useState(false),[editing,setEditing]=useState<string|null>(null),[adding,setAdding]=useState(false);
 const addButton=useRef<HTMLButtonElement>(null),day=selected??today;
 const formOpen=adding||editing!==null,hadForm=useRef(formOpen);
 useLayoutEffect(()=>{if(hadForm.current&&!formOpen)addButton.current?.focus();hadForm.current=formOpen;},[formOpen]);
 const chooseDay=(value:string|null)=>{setSelected(value===today?null:value);setHistory(false);setEditing(null);setAdding(false);};
 const finishForm=()=>{setAdding(false);setEditing(null);};
 const remove=(tracker:TrackerHabit,index:number)=>{dispatch({type:'deleteTracker',id:tracker.id});setEditing(null);addButton.current?.focus();notify('Tracker removed',()=>dispatch({type:'restoreTracker',tracker,index}));};
 return <section className="tracker-view" aria-label="Daily habit Tracker">
  <header className="tracker-heading" data-history={history}>{!history&&<TrackerDateNavigation day={day} today={today} onChange={chooseDay}/>}<button className="tracker-history-toggle" type="button" aria-pressed={history} onClick={()=>{setHistory(value=>!value);setAdding(false);setEditing(null);}}>{history?<><ArrowLeft size={12}/> Back</>:<>History <ArrowUpRight size={12}/></>}</button></header>
  {history?<TrackerHistory trackers={trackers} today={today} day={day} onSelectDay={chooseDay}/>:
  <><div className="tracker-list">{trackers.map((tracker,index)=><TrackerRow key={tracker.id} tracker={tracker} day={day} dispatch={dispatch} onRename={()=>{setAdding(false);setEditing(tracker.id);}} onRemove={()=>remove(tracker,index)} editor={editing===tracker.id?<TrackerNameForm key={tracker.id} initial={tracker.title} label={`Rename ${tracker.title}`} onCancel={finishForm} onSave={title=>{dispatch({type:'renameTracker',id:tracker.id,title});finishForm();}}/>:undefined}/>)}</div>
  {adding?<TrackerNameForm label="New tracker name" chooseTarget onCancel={finishForm} onSave={(title,target)=>{
   if(target?.kind==='duration')dispatch({type:'addTracker',title,kind:'duration',goalMinutes:target.goalMinutes});
   else dispatch({type:'addTracker',title,slots:target?.slots});
   finishForm();
  }}/>:<button className="tracker-add" ref={addButton} type="button" disabled={trackers.length>=trackerLimit} onClick={()=>{setEditing(null);setAdding(true);}}><Plus size={14}/> Add tracker</button>}</>}
 </section>;
}
