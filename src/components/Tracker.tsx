import React,{useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,ChevronLeft,ChevronRight,Pencil,Plus,X} from 'lucide-react';
import {Checkbox} from '../arc/checkbox/checkbox';
import {dayFromKey,localDayKey} from '../month-progress.mjs';
import {recordedTrackerDays,shiftTrackerDay,trackerCount,trackerLimit,trackerMask,trackerTitle} from '../tracker.mjs';
import './tracker.css';

type Habit={id:string;title:string;slots:number;created:number;days:Record<string,number>};
type Dispatch=(action:any)=>void;
const dateLabel=(day:string,withWeekday=false)=>new Date(dayFromKey(day)).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',...(withWeekday?{weekday:'short'}:{})});

export function TrackerDateNavigation({day,today,onChange}:{day:string;today:string;onChange:(day:string|null)=>void}){
 return <div className="tracker-date-navigation" role="group" aria-label="Tracker date">
  <button type="button" aria-label="Previous day" onClick={()=>onChange(shiftTrackerDay(day,-1))}><ChevronLeft size={15}/></button>
  <button type="button" className="tracker-date-label" title="Return to Today" aria-label={day===today?'Today':`${dateLabel(day)}. Return to Today`} onClick={()=>onChange(null)}><time dateTime={day.split('-').map((part,index)=>index?part.padStart(2,'0'):part).join('-')}>{day===today?'Today':dateLabel(day)}</time></button>
  <button type="button" aria-label="Next day" disabled={dayFromKey(day)>=dayFromKey(today)} onClick={()=>onChange(shiftTrackerDay(day,1))}><ChevronRight size={15}/></button>
 </div>;
}

export function TrackerRow({tracker,day,dispatch,onRename,onRemove,editor}:{tracker:Habit;day:string;dispatch:Dispatch;onRename:()=>void;onRemove:()=>void;editor?:React.ReactNode}){
 const mask=trackerMask(tracker,day),count=trackerCount(tracker,day);
 const moveFocus=(event:React.KeyboardEvent<HTMLDivElement>)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const boxes=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=checkbox]')),index=boxes.indexOf(event.target as HTMLButtonElement);if(index<0)return;
  event.preventDefault();event.stopPropagation();
  boxes[event.key==='Home'?0:event.key==='End'?boxes.length-1:Math.max(0,Math.min(boxes.length-1,index+(event.key==='ArrowRight'?1:-1)))]?.focus();
 };
 return <div className="tracker-row">
  <div className="tracker-row-heading">{editor||<><span className="tracker-name">{tracker.title}</span><div className="tracker-row-actions"><button type="button" aria-label={`Rename ${tracker.title}`} onClick={onRename}><Pencil size={12}/></button><button type="button" aria-label={`Remove ${tracker.title}`} onClick={onRemove}><X size={13}/></button></div></>}
   <output className="tracker-count" aria-label={`${tracker.title}, ${count} of ${tracker.slots} on ${dateLabel(day)}`}>{count}/{tracker.slots}</output>
  </div>
  <div className="tracker-boxes" role="group" aria-label={`${tracker.title} on ${dateLabel(day)}`} onKeyDown={moveFocus}>
   {Array.from({length:tracker.slots},(_,slot)=><Checkbox key={slot} className="tracker-checkbox" checked={!!(mask&(1<<slot))} aria-label={`${tracker.title}, slot ${slot+1} of ${tracker.slots}, ${dateLabel(day)}`} onCheckedChange={checked=>dispatch({type:'trackerCheck',id:tracker.id,day,slot,checked:checked===true})}/>)}
  </div>
 </div>;
}

function TrackerNameForm({initial='',label,onSave,onCancel}:{initial?:string;label:string;onSave:(title:string)=>void;onCancel:()=>void}){
 const [value,setValue]=useState(initial),[error,setError]=useState('');
 return <form className="tracker-name-form" onSubmit={event=>{event.preventDefault();const title=trackerTitle(value);if(!title){setError('Enter a tracker name.');return;}onSave(title);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel();}}}>
  <input autoFocus aria-label={label} aria-invalid={!!error||undefined} aria-describedby={error?'tracker-name-error':undefined} value={value} maxLength={100} placeholder="Tracker name" onChange={event=>{setValue(event.target.value);setError('');}}/>
  <button type="submit" aria-label="Save tracker name"><Check size={13}/></button><button type="button" aria-label="Cancel tracker name" onClick={onCancel}><X size={13}/></button>
  {error&&<span id="tracker-name-error" className="tracker-name-error" role="alert">{error}</span>}
 </form>;
}

export function Tracker({trackers,now,dispatch,notify}:{trackers:Habit[];now:number;dispatch:Dispatch;notify:(message:string,undo?:()=>void)=>void}){
 const today=localDayKey(now),[selected,setSelected]=useState<string|null>(null),[history,setHistory]=useState(false),[editing,setEditing]=useState<string|null>(null),[adding,setAdding]=useState(false);
 const addButton=useRef<HTMLButtonElement>(null),day=selected??today;
 const formOpen=adding||editing!==null,hadForm=useRef(formOpen);
 useLayoutEffect(()=>{if(hadForm.current&&!formOpen)addButton.current?.focus();hadForm.current=formOpen;},[formOpen]);
 const chooseDay=(value:string|null)=>{setSelected(value===today?null:value);setHistory(false);setEditing(null);setAdding(false);};
 const finishForm=()=>{setAdding(false);setEditing(null);};
 const remove=(tracker:Habit,index:number)=>{dispatch({type:'deleteTracker',id:tracker.id});setEditing(null);addButton.current?.focus();notify('Tracker removed',()=>dispatch({type:'restoreTracker',tracker,index}));};
 const days=history?recordedTrackerDays(trackers).filter(value=>dayFromKey(value)<=dayFromKey(today)):[];
 return <section className="tracker-view" aria-label="Daily habit Tracker">
  <header className="tracker-heading"><TrackerDateNavigation day={day} today={today} onChange={chooseDay}/><button className="tracker-history-toggle" type="button" aria-pressed={history} onClick={()=>{setHistory(value=>!value);setAdding(false);setEditing(null);}}>{history?<><ArrowLeft size={12}/> Back</>:<>History <ArrowUpRight size={12}/></>}</button></header>
  {history?<div className="tracker-history" aria-label="Recorded tracker dates"><h2>Recorded days</h2>{!days.length?<p className="tracker-empty-history">No history yet.</p>:days.map(value=>{const count=trackers.reduce((sum,tracker)=>sum+trackerCount(tracker,value),0);return <button className="tracker-history-day" type="button" key={value} onClick={()=>chooseDay(value)}><span>{value===today?'Today':dateLabel(value,true)}</span><span>{count} {count===1?'check':'checks'} <ChevronRight size={12}/></span></button>;})}</div>:
  <><div className="tracker-list">{trackers.map((tracker,index)=><TrackerRow key={tracker.id} tracker={tracker} day={day} dispatch={dispatch} onRename={()=>{setAdding(false);setEditing(tracker.id);}} onRemove={()=>remove(tracker,index)} editor={editing===tracker.id?<TrackerNameForm key={tracker.id} initial={tracker.title} label={`Rename ${tracker.title}`} onCancel={finishForm} onSave={title=>{dispatch({type:'renameTracker',id:tracker.id,title});finishForm();}}/>:undefined}/>)}</div>
  {adding?<TrackerNameForm label="New tracker name" onCancel={finishForm} onSave={title=>{dispatch({type:'addTracker',title});finishForm();}}/>:<button className="tracker-add" ref={addButton} type="button" disabled={trackers.length>=trackerLimit} onClick={()=>{setEditing(null);setAdding(true);}}><Plus size={14}/> Add tracker</button>}</>}
 </section>;
}
