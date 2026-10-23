import React,{memo,useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {Clock3,Leaf,Minus,Pause,Play,Plus,RotateCcw} from 'lucide-react';
import {Button} from '../arc/button/button';
import {durations,stepTimerMinutes} from '../model.mjs';
import {durationParts,minutesFromDurationParts,stepDurationPart,focusModeOnEntry,focusElapsed,durationReelSteps,createDurationWheelGesture} from '../focus-duration.mjs';
import './focus-timer.css';

type Unit='hours'|'minutes';
type InputSource='wheel'|'keyboard'|'pointer';
type WheelFlush=()=>number|null;
const modes=[{id:'focus',label:'Work',preference:'focusMinutes',Icon:Leaf},{id:'short',label:'Short break',preference:'shortMinutes',Icon:Clock3},{id:'long',label:'Long break',preference:'longMinutes',Icon:Clock3}];
const rowHeight=42,reelCenter=29;
const indexFor=(unit:Unit,total:number)=>unit==='hours'?Math.floor(total/60):total;
const reelTransform=(index:number)=>`translateY(${reelCenter-(index+2)*rowHeight}px)`;
const TickRim=memo(function TickRim(){return <svg className="focus-dial-ticks" viewBox="0 0 240 240" aria-hidden="true">{Array.from({length:60},(_,i)=><line key={i} x1="120" x2="120" y1="15" y2={i%5===0?'26':'21'} transform={`rotate(${i*6} 120 120)`} className={i%5===0?'is-major':undefined}/>)}</svg>;});
// A real strip keeps every intermediate number in the travel path, including 59 → 00.
const reelNumbers={hours:[-2,-1,0,1,2,3,4],minutes:[-2,-1,0,1,...durationReelSteps(1,120),121,122]};
const ReelRows=memo(function ReelRows({unit}:{unit:Unit}){return <>{reelNumbers[unit].map(number=><span className="focus-reel-row" key={number}>{unit==='hours'?(number>=0&&number<=2?String(number).padStart(2,'0'):''):String((number%60+60)%60).padStart(2,'0')}</span>)}</>;});

type RollerProps={unit:Unit;value:string;total:number;editing:boolean;animated:boolean;reducedMotion:boolean;invalid:boolean;onEdit:()=>void;onChange:(value:string)=>void;onCommit:()=>void;onCancel:()=>void;onStep:(direction:number,source:InputSource)=>void;onSelect:(total:number)=>void;registerFlush:(flush:WheelFlush)=>()=>void;onWheelStart:(except:WheelFlush)=>number|null};
function DurationRoller({unit,value,total,editing,animated,reducedMotion,invalid,onEdit,onChange,onCommit,onCancel,onStep,onSelect,registerFlush,onWheelStart}:RollerProps){
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),track=useRef<HTMLSpanElement>(null),animation=useRef<Animation|null>(null),destination=useRef<number|null>(null);
 const pointer=useRef<{id:number;originY:number;lastY:number;base:number;index:number;moved:boolean;node:HTMLButtonElement}|null>(null),ignoreClick=useRef(false);
 const latest=useRef({total,onSelect,onWheelStart,reducedMotion}),gesture=useRef<ReturnType<typeof createDurationWheelGesture>|null>(null),settle=useRef<ReturnType<typeof setTimeout>|null>(null),finishRef=useRef<WheelFlush>(()=>null);
 const [wheeling,setWheeling]=useState(false);latest.current={total,onSelect,onWheelStart,reducedMotion};
 const sampleIndex=()=>{const node=track.current;if(!node)return indexFor(unit,latest.current.total);const transform=getComputedStyle(node).transform;let y=0;if(transform.startsWith('matrix3d('))y=Number(transform.slice(9,-1).split(',')[13]);else if(transform.startsWith('matrix('))y=Number(transform.slice(7,-1).split(',')[5]);else{const translated=/translateY\(([-\d.]+)px\)/.exec(transform);if(!translated)return destination.current??indexFor(unit,latest.current.total);y=Number(translated[1]);}return (reelCenter-y)/rowHeight-2;};
 const moveTo=(index:number,animate:boolean)=>{const node=track.current;if(!node)return;const previous=destination.current;if(unit==='minutes'&&previous!==null&&index!==previous&&(index-previous)%60===0)animate=false;if(destination.current===index&&animation.current&&animate)return;const current=getComputedStyle(node).transform,from=sampleIndex();animation.current?.cancel();animation.current=null;destination.current=index;const target=reelTransform(index);node.style.transform=target;if(!animate||latest.current.reducedMotion||current==='none'||current===target)return;const distance=Math.abs(index-from);const next=node.animate([{transform:current},{transform:target}],{duration:Math.min(580,145+distance*35),easing:'cubic-bezier(.2,.65,.25,1)'});animation.current=next;next.onfinish=()=>{if(animation.current===next){next.cancel();animation.current=null;}};};
 const flush=useCallback<WheelFlush>(()=>finishRef.current(),[]);
 const releasePointer=()=>{const current=pointer.current;pointer.current=null;if(current?.node.hasPointerCapture(current.id))current.node.releasePointerCapture(current.id);};
 finishRef.current=()=>{const current=gesture.current;if(!current)return null;if(settle.current)clearTimeout(settle.current);settle.current=null;gesture.current=null;if(pointer.current?.moved)ignoreClick.current=true;releasePointer();const next=current.finish();moveTo(indexFor(unit,next),true);setWheeling(false);latest.current.onSelect(next);return next;};
 useLayoutEffect(()=>{if(!gesture.current)moveTo(indexFor(unit,total),animated);},[unit,total,animated,reducedMotion]);
 useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
 useEffect(()=>registerFlush(flush),[registerFlush,flush]);
 useEffect(()=>{const element=root.current;if(!element)return;const wheel=(event:WheelEvent)=>{if(event.ctrlKey||!Number.isFinite(event.deltaY)||event.deltaY===0||Math.abs(event.deltaX)>Math.abs(event.deltaY)*1.25)return;event.preventDefault();event.stopPropagation();if(!gesture.current){const pending=latest.current.onWheelStart(flush),base=pending??latest.current.total,position=pending===null?sampleIndex():indexFor(unit,base);animation.current?.cancel();animation.current=null;gesture.current=createDurationWheelGesture(base,unit,position);setWheeling(true);}const position=gesture.current.move(event.deltaY,event.deltaMode);destination.current=null;if(track.current)track.current.style.transform=reelTransform(position);if(settle.current)clearTimeout(settle.current);settle.current=setTimeout(flush,120);};element.addEventListener('wheel',wheel,{passive:false,capture:true});return()=>{element.removeEventListener('wheel',wheel,true);flush();if(settle.current)clearTimeout(settle.current);animation.current?.cancel();};},[unit,flush]);
 const number=Number(value)||0,max=unit==='hours'?2:59;
 const arrows=(event:React.KeyboardEvent)=>{if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return false;event.preventDefault();event.stopPropagation();onStep(event.key==='ArrowUp'?1:-1,'keyboard');return true;};
 const commit=()=>{if(flush()===null)onCommit();};
 const cancel=()=>{if(settle.current)clearTimeout(settle.current);settle.current=null;gesture.current=null;if(pointer.current?.moved)ignoreClick.current=true;releasePointer();setWheeling(false);moveTo(indexFor(unit,latest.current.total),true);onCancel();};
 const pointerDown=(event:React.PointerEvent<HTMLButtonElement>)=>{if(event.button!==0||event.isPrimary===false)return;event.preventDefault();event.stopPropagation();event.currentTarget.focus({preventScroll:true});ignoreClick.current=false;const own=flush(),pending=latest.current.onWheelStart(flush),base=own??pending??latest.current.total;pointer.current={id:event.pointerId,originY:event.clientY,lastY:event.clientY,base,index:own!==null||pending!==null?indexFor(unit,base):sampleIndex(),moved:false,node:event.currentTarget};event.currentTarget.setPointerCapture(event.pointerId);};
 const pointerMove=(event:React.PointerEvent<HTMLButtonElement>)=>{const current=pointer.current;if(!current||current.id!==event.pointerId)return;if(!current.moved){if(Math.abs(event.clientY-current.originY)<4)return;current.moved=true;animation.current?.cancel();animation.current=null;gesture.current=createDurationWheelGesture(current.base,unit,current.index);setWheeling(true);}event.preventDefault();event.stopPropagation();const position=gesture.current!.move((current.lastY-event.clientY)*14/rowHeight);current.lastY=event.clientY;destination.current=null;if(track.current)track.current.style.transform=reelTransform(position);};
 const pointerUp=(event:React.PointerEvent<HTMLButtonElement>)=>{const current=pointer.current;if(!current||current.id!==event.pointerId)return;pointerMove(event);if(current.moved)flush();else releasePointer();};
 const pointerCancel=(event:React.PointerEvent<HTMLButtonElement>)=>{if(pointer.current?.id===event.pointerId)cancel();};
 return <div ref={root} className={`focus-duration-unit ${editing?'is-editing':''}`} data-wheeling={wheeling||undefined}>
  <div className="focus-roller-track"><button type="button" className="focus-roller-number" role="spinbutton" aria-hidden={editing||undefined} tabIndex={editing?-1:0} aria-label={`Duration ${unit}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={number} aria-valuetext={`${number} ${unit}`} aria-invalid={invalid||undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onLostPointerCapture={pointerCancel} onDragStart={event=>event.preventDefault()} onClick={event=>{if(ignoreClick.current&&event.detail!==0){ignoreClick.current=false;return;}ignoreClick.current=false;flush();onEdit();}} onKeyDown={event=>{if(event.key==='Escape'&&pointer.current){event.preventDefault();event.stopPropagation();cancel();return;}arrows(event);}}><span className="focus-number-reel" ref={track} aria-hidden="true"><ReelRows unit={unit}/></span></button>
   {editing&&<input ref={input} className="focus-roller-input" aria-label={`Duration ${unit}`} aria-invalid={invalid||undefined} inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value} onChange={event=>onChange(event.target.value.replace(/\D/g,''))} onBlur={commit} onKeyDown={event=>{if(arrows(event))return;if(event.key==='Enter'){event.preventDefault();commit();}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}}}/>}
  </div><span className="focus-unit-label" aria-hidden="true">{unit==='hours'?'H':'M'}</span>
 </div>;
}

export function FocusTimer({s,seconds,dispatch,onStart}:any){
 const mode=modes.find(item=>item.id===s.timer.mode)||modes[0],total=durations(s,mode.id),configured=s.settings[mode.preference],active=s.timer.running||seconds<total;
 const systemReducedMotion=useReducedMotion(),reducedMotion=Boolean(systemReducedMotion||s.settings.reducedMotion),id=useId().replace(/:/g,'');
 const [parts,setParts]=useState(()=>durationParts(configured)),[editing,setEditing]=useState<Unit|null>(null),[dirty,setDirty]=useState(false),[touched,setTouched]=useState(false),[animated,setAnimated]=useState(false);
 const wheelFlushers=useRef(new Set<WheelFlush>());
 const registerFlush=useCallback((flush:WheelFlush)=>{wheelFlushers.current.add(flush);return()=>{wheelFlushers.current.delete(flush);};},[]);
 const flushWheels=useCallback((except?:WheelFlush)=>{let value:number|null=null;for(const flush of wheelFlushers.current)if(flush!==except)value=flush()??value;return value;},[]);
 const candidate=minutesFromDurationParts(parts.hours,parts.minutes),invalid=candidate===null,progress=focusElapsed(seconds,total);
 useLayoutEffect(()=>{const next=focusModeOnEntry(s.timer,seconds,total);if(next!==s.timer.mode)dispatch({type:'timerMode',mode:next});},[]);
 useLayoutEffect(()=>{setParts(durationParts(configured));setDirty(false);setTouched(false);setEditing(null);},[mode.id]);
 useEffect(()=>{if(!dirty&&!editing)setParts(durationParts(configured));},[configured,dirty,editing]);
 const applyMinutes=(value:number,source:InputSource,nextEditing:Unit|null=null)=>{if(active)return;setAnimated(source!=='keyboard'&&!reducedMotion);setParts(durationParts(value));setDirty(false);setTouched(false);setEditing(nextEditing);if(value!==configured)dispatch({type:'settings',patch:{[mode.preference]:value}});};
 const commit=()=>{if(active)return true;const value=minutesFromDurationParts(parts.hours,parts.minutes);setEditing(null);if(value===null){setTouched(true);return false;}applyMinutes(value,'keyboard');return true;};
 const resetDraft=()=>{setParts(durationParts(configured));setDirty(false);setTouched(false);setEditing(null);};
 const step=(unit:Unit,delta:number,source:InputSource)=>applyMinutes(stepDurationPart(flushWheels()??candidate??configured,unit,delta),source,editing);
 const adjust=(delta:number,source:InputSource)=>applyMinutes(stepTimerMinutes(flushWheels()??candidate??configured,delta),source);
 const start=()=>{if(s.timer.running){dispatch({type:'timerPause'});return;}const wheelValue=flushWheels();if(!active&&wheelValue===null&&!commit())return;dispatch({type:'timerStart'});onStart?.();};
 return <div className={`focus-view focus-dial-view ${s.timer.running?'is-running':''}`} data-focus-mode={mode.id} data-reduced-motion={reducedMotion||undefined}>
  <div className="focus-mode-options" role="group" aria-label="Timer mode">{modes.map(item=><button type="button" key={item.id} className="focus-mode-option" data-mode={item.id} aria-pressed={item.id===mode.id} onClick={()=>{flushWheels();if(item.id!==mode.id)dispatch({type:'timerMode',mode:item.id});}}><item.Icon size={15} strokeWidth={1.8}/><span>{item.label}</span></button>)}</div>
  <div className="focus-dial"><div className="focus-dial-well"/>
   <svg className="focus-dial-light" viewBox="0 0 240 240" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}>
    <defs><radialGradient id={`focus-glow-${id}`} gradientUnits="userSpaceOnUse" cx="120" cy="120" r="111"><stop offset="0" stopColor="var(--focus-accent)" stopOpacity="0"/><stop offset=".58" stopColor="var(--focus-accent)" stopOpacity=".035"/><stop offset="1" stopColor="var(--focus-accent)" stopOpacity=".34"/></radialGradient></defs>
    <circle className="focus-elapsed-fill" cx="120" cy="120" r="55" fill="none" stroke={`url(#focus-glow-${id})`} strokeWidth="110" pathLength="100" strokeDasharray="100" strokeDashoffset={100-progress*100} transform="rotate(-90 120 120)"/>
    <circle className="focus-elapsed-edge" cx="120" cy="120" r="109.5" fill="none" stroke="var(--focus-accent)" strokeWidth="1.5" strokeOpacity=".7" pathLength="100" strokeDasharray="100" strokeDashoffset={100-progress*100} transform="rotate(-90 120 120)"/>
   </svg><TickRim/>
   <div className="focus-dial-center">{active?<div className="focus-countdown" role="timer" aria-live="off" aria-label={`${Math.floor(seconds/60)} minutes ${seconds%60} seconds remaining`}><div className="focus-countdown-unit"><span>{String(Math.floor(seconds/60)).padStart(2,'0')}</span><small aria-hidden="true">M</small></div><b aria-hidden="true">:</b><div className="focus-countdown-unit"><span>{String(seconds%60).padStart(2,'0')}</span><small aria-hidden="true">S</small></div></div>:<div className="focus-duration-rollers">{(['hours','minutes'] as Unit[]).map((unit,index)=><React.Fragment key={unit}>{index===1&&<b className="focus-duration-colon" aria-hidden="true">:</b>}<DurationRoller unit={unit} value={parts[unit]} total={candidate??configured} editing={editing===unit} animated={animated} reducedMotion={reducedMotion} invalid={touched&&invalid} onEdit={()=>setEditing(unit)} onChange={value=>{setParts(previous=>({...previous,[unit]:value}));setDirty(true);setAnimated(false);}} onCommit={commit} onCancel={resetDraft} onStep={(delta,source)=>step(unit,delta,source)} onSelect={value=>applyMinutes(value,'wheel',editing)} registerFlush={registerFlush} onWheelStart={flushWheels}/></React.Fragment>)}</div>}
    {touched&&invalid&&<span className="sr-only" role="status">Choose a duration between one minute and two hours.</span>}
   </div>
  </div>
  <div className="focus-duration-stepper"><Button variant="ghost" size="sm" disabled={active||(candidate??configured)<=1} aria-label="Decrease timer duration by five minutes" onClick={event=>adjust(-5,event.detail===0?'keyboard':'pointer')}><Minus size={13}/></Button><span>{active?configured:candidate??configured} <small>min</small></span><Button variant="ghost" size="sm" disabled={active||(candidate??configured)>=120} aria-label="Increase timer duration by five minutes" onClick={event=>adjust(5,event.detail===0?'keyboard':'pointer')}><Plus size={13}/></Button></div>
  <Button className="focus-main-action" disabled={!active&&invalid} onClick={start}>{s.timer.running?<Pause size={15}/>:<Play size={15}/>} {s.timer.running?'Pause':active?'Resume':mode.id==='focus'?'Start work':'Start break'}</Button>
  {active&&<Button variant="ghost" size="sm" className="focus-reset-action" onClick={()=>dispatch({type:'timerReset'})}><RotateCcw size={12}/> Reset timer</Button>}
 </div>;
}
