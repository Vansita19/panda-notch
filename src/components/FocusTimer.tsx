import React,{memo,useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {Clock3,Leaf,Minus,Pause,Play,Plus,RotateCcw} from 'lucide-react';
import {Button} from '../arc/button/button';
import {durations,stepTimerMinutes} from '../model.mjs';
import {durationParts,minutesFromDurationParts,stepDurationPart,focusModeOnEntry,focusElapsed} from '../focus-duration.mjs';
import './focus-timer.css';

type Unit='hours'|'minutes';
type InputSource='wheel'|'keyboard'|'pointer';
const modes=[{id:'focus',label:'Work',preference:'focusMinutes',Icon:Leaf},{id:'short',label:'Short break',preference:'shortMinutes',Icon:Clock3},{id:'long',label:'Long break',preference:'longMinutes',Icon:Clock3}];
const TickRim=memo(function TickRim(){return <svg className="focus-dial-ticks" viewBox="0 0 240 240" aria-hidden="true">{Array.from({length:60},(_,i)=><line key={i} x1="120" x2="120" y1="15" y2={i%5===0?'26':'21'} transform={`rotate(${i*6} 120 120)`} className={i%5===0?'is-major':undefined}/>)}</svg>;});

function DurationRoller({unit,value,editing,direction,animated,reducedMotion,invalid,onEdit,onChange,onCommit,onCancel,onStep}:{unit:Unit;value:string;editing:boolean;direction:number;animated:boolean;reducedMotion:boolean;invalid:boolean;onEdit:()=>void;onChange:(value:string)=>void;onCommit:()=>void;onCancel:()=>void;onStep:(direction:number,source:InputSource)=>void}){
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),stepRef=useRef(onStep);
 stepRef.current=onStep;
 useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
 useEffect(()=>{const element=root.current;if(!element)return;let delta=0,last=0;const wheel=(event:WheelEvent)=>{if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;event.preventDefault();delta+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?80:1);const now=performance.now();if(Math.abs(delta)<18||now-last<65)return;stepRef.current(delta>0?1:-1,'wheel');delta=0;last=now;};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[]);
 const number=Number(value)||0,max=unit==='hours'?2:59,previous=unit==='minutes'?(number+59)%60:Math.max(0,number-1),next=unit==='minutes'?(number+1)%60:Math.min(2,number+1),display=value===''?'—':String(number).padStart(2,'0');
 const arrows=(event:React.KeyboardEvent)=>{if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return false;event.preventDefault();event.stopPropagation();onStep(event.key==='ArrowUp'?1:-1,'keyboard');return true;};
 return <div ref={root} className={`focus-duration-unit ${editing?'is-editing':''}`}>
  <div className="focus-roller-track">
   <span className="focus-roller-neighbor before" aria-hidden="true">{String(previous).padStart(2,'0')}</span>
   <span className="focus-roller-neighbor after" aria-hidden="true">{String(next).padStart(2,'0')}</span>
   {editing?<input ref={input} className="focus-roller-input" aria-label={`Duration ${unit}`} aria-invalid={invalid||undefined} inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value} onChange={event=>onChange(event.target.value.replace(/\D/g,''))} onBlur={onCommit} onKeyDown={event=>{if(arrows(event))return;if(event.key==='Enter'){event.preventDefault();onCommit();}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel();}}}/>:<button type="button" className="focus-roller-number" role="spinbutton" aria-label={`Duration ${unit}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={number} aria-valuetext={`${number} ${unit}`} aria-invalid={invalid||undefined} onClick={onEdit} onKeyDown={arrows}>
    <span className="focus-roller-window"><AnimatePresence initial={false} mode="popLayout" custom={direction}><motion.span key={display} custom={direction} initial={animated&&!reducedMotion?{y:direction*20,opacity:.35}:false} animate={{y:0,opacity:1}} exit={animated&&!reducedMotion?{y:-direction*20,opacity:0}:{opacity:0}} transition={animated&&!reducedMotion?{type:'spring',stiffness:480,damping:32,mass:.7}:{duration:0}}>{display}</motion.span></AnimatePresence></span>
   </button>}
  </div>
  <span className="focus-unit-label">{unit}</span>
 </div>;
}

export function FocusTimer({s,seconds,dispatch,onStart}:any){
 const mode=modes.find(item=>item.id===s.timer.mode)||modes[0],total=durations(s,mode.id),configured=s.settings[mode.preference],active=s.timer.running||seconds<total;
 const systemReducedMotion=useReducedMotion(),reducedMotion=Boolean(systemReducedMotion||s.settings.reducedMotion),id=useId().replace(/:/g,'');
 const [parts,setParts]=useState(()=>durationParts(configured)),[editing,setEditing]=useState<Unit|null>(null),[dirty,setDirty]=useState(false),[touched,setTouched]=useState(false),[direction,setDirection]=useState(1),[animated,setAnimated]=useState(false);
 const candidate=minutesFromDurationParts(parts.hours,parts.minutes),invalid=candidate===null,progress=focusElapsed(seconds,total);
 useLayoutEffect(()=>{const next=focusModeOnEntry(s.timer,seconds,total);if(next!==s.timer.mode)dispatch({type:'timerMode',mode:next});},[]);
 useLayoutEffect(()=>{setParts(durationParts(configured));setDirty(false);setTouched(false);setEditing(null);},[mode.id]);
 useEffect(()=>{if(!dirty&&!editing)setParts(durationParts(configured));},[configured,dirty,editing]);
 const applyMinutes=(value:number,source:InputSource,nextEditing:Unit|null=null)=>{if(active)return;setDirection(value>=configured?1:-1);setAnimated(source!=='keyboard'&&!reducedMotion);setParts(durationParts(value));setDirty(false);setTouched(false);setEditing(nextEditing);if(value!==configured)dispatch({type:'settings',patch:{[mode.preference]:value}});};
 const commit=()=>{if(active)return true;const value=minutesFromDurationParts(parts.hours,parts.minutes);setEditing(null);if(value===null){setTouched(true);return false;}applyMinutes(value,'keyboard');return true;};
 const resetDraft=()=>{setParts(durationParts(configured));setDirty(false);setTouched(false);setEditing(null);};
 // Stepping changes the value in place, so repeated arrows or wheel input retain the edited field.
 const step=(unit:Unit,delta:number,source:InputSource)=>applyMinutes(stepDurationPart(candidate??configured,unit,delta),source,editing);
 const adjust=(delta:number,source:InputSource)=>applyMinutes(stepTimerMinutes(candidate??configured,delta),source);
 const start=()=>{if(s.timer.running){dispatch({type:'timerPause'});return;}if(!active&&!commit())return;dispatch({type:'timerStart'});onStart?.();};
 return <div className={`focus-view focus-dial-view ${s.timer.running?'is-running':''}`} data-focus-mode={mode.id} data-reduced-motion={reducedMotion||undefined}>
  <div className="focus-mode-options" role="group" aria-label="Timer mode">{modes.map(item=><button type="button" key={item.id} className="focus-mode-option" data-mode={item.id} aria-pressed={item.id===mode.id} onClick={()=>{if(item.id!==mode.id)dispatch({type:'timerMode',mode:item.id});}}><item.Icon size={15} strokeWidth={1.8}/><span>{item.label}</span></button>)}</div>
  <div className="focus-dial">
   <div className="focus-dial-well"/>
   <svg className="focus-dial-light" viewBox="0 0 240 240" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}>
    <defs><radialGradient id={`focus-glow-${id}`} gradientUnits="userSpaceOnUse" cx="120" cy="120" r="111"><stop offset="0" stopColor="var(--focus-accent)" stopOpacity="0"/><stop offset=".58" stopColor="var(--focus-accent)" stopOpacity=".035"/><stop offset="1" stopColor="var(--focus-accent)" stopOpacity=".34"/></radialGradient></defs>
    <g style={{transform:`rotate(${135+progress*360}deg)`}}><path d="M120 120 L120 9 A111 111 0 0 1 198.489 41.511 Z" fill={`url(#focus-glow-${id})`}/><path d="M120 9 A111 111 0 0 1 198.489 41.511" fill="none" stroke="var(--focus-accent)" strokeWidth="1.5" strokeOpacity=".28"/></g>
    <circle cx="120" cy="120" r="109.5" fill="none" stroke="var(--focus-accent)" strokeWidth="1.5" strokeOpacity=".7" pathLength="100" strokeDasharray="100" strokeDashoffset={100-progress*100} transform="rotate(-90 120 120)"/>
   </svg>
   <TickRim/>
   <div className="focus-dial-center"><span className="focus-dial-caption">{active?mode.label:'Set duration'}</span>
    {active?<div className="focus-countdown" role="timer" aria-live="off" aria-label={`${Math.floor(seconds/60)} minutes ${seconds%60} seconds remaining`}><div className="focus-countdown-unit"><span>{String(Math.floor(seconds/60)).padStart(2,'0')}</span><small>Minutes</small></div><b aria-hidden="true">:</b><div className="focus-countdown-unit"><span>{String(seconds%60).padStart(2,'0')}</span><small>Seconds</small></div></div>:<div className="focus-duration-rollers">{(['hours','minutes'] as Unit[]).map((unit,index)=><React.Fragment key={unit}>{index===1&&<b className="focus-duration-colon" aria-hidden="true">:</b>}<DurationRoller unit={unit} value={parts[unit]} editing={editing===unit} direction={direction} animated={animated} reducedMotion={reducedMotion} invalid={touched&&invalid} onEdit={()=>setEditing(unit)} onChange={value=>{setParts(previous=>({...previous,[unit]:value}));setDirty(true);setAnimated(false);}} onCommit={commit} onCancel={resetDraft} onStep={(delta,source)=>step(unit,delta,source)}/></React.Fragment>)}</div>}
    <span className={`focus-dial-hint ${touched&&invalid?'is-invalid':''}`} role={touched&&invalid?'status':undefined}>{active?s.timer.running?'In progress':'Paused':touched&&invalid?'Choose 1 minute–2 hours':'Scroll or type · max 2 hr'}</span>
   </div>
  </div>
  <div className="focus-duration-stepper"><Button variant="ghost" size="sm" disabled={active||(candidate??configured)<=1} aria-label="Decrease timer duration by five minutes" onClick={event=>adjust(-5,event.detail===0?'keyboard':'pointer')}><Minus size={13}/></Button><span>{active?configured:candidate??configured} <small>min</small></span><Button variant="ghost" size="sm" disabled={active||(candidate??configured)>=120} aria-label="Increase timer duration by five minutes" onClick={event=>adjust(5,event.detail===0?'keyboard':'pointer')}><Plus size={13}/></Button></div>
  <Button className="focus-main-action" disabled={!active&&invalid} onClick={start}>{s.timer.running?<Pause size={15}/>:<Play size={15}/>} {s.timer.running?'Pause':active?'Resume':mode.id==='focus'?'Start work':'Start break'}</Button>
  {active&&<Button variant="ghost" size="sm" className="focus-reset-action" onClick={()=>dispatch({type:'timerReset'})}><RotateCcw size={12}/> Reset timer</Button>}
 </div>;
}
