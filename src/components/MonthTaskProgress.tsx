import React,{memo,useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {Button} from '../arc/button/button';
import {dayKey} from '../model.mjs';
import {getTaskDayProgress,monthGrid} from '../month-progress.mjs';
import './month-progress.css';

const weekdays=[['Mon','Monday'],['Tue','Tuesday'],['Wed','Wednesday'],['Thu','Thursday'],['Fri','Friday'],['Sat','Saturday'],['Sun','Sunday']];
const monthLabel=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'});
const dateLabel=new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const circumference=2*Math.PI*13.5;
export type TodoPeriod='today'|'month';
export function TodoPeriodSwitch({value,onChange}:{value:TodoPeriod;onChange:(value:TodoPeriod)=>void}){return <div className="todo-period-switch" role="group" aria-label="Task period">{([['today','Today'],['month','This Month']] as const).map(([id,label])=><button key={id} type="button" tabIndex={0} aria-pressed={value===id} onClick={()=>onChange(id)}>{label}</button>)}</div>;}
const isoDay=(stamp:number)=>{const date=new Date(stamp);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
type DayProgress={done:number;total:number|null;created?:number}|null;
const DayTile=memo(function DayTile({cell,progress,today}:{cell:{date:number;key:string;day:number;inMonth:boolean};progress:DayProgress;today:boolean}){
 const known=!!progress&&Number.isFinite(progress.total)&&Number(progress.total)>0;
 const ratio=known?Math.max(0,Math.min(1,progress!.done/Number(progress!.total))):0;
 const evidence=progress&&!known?(progress.done>0?`${progress.done} done`:progress.created?`${progress.created} added`:''):'';
 const count=known?`${progress!.done}/${progress!.total}`:'';
 const summary=known?`${progress!.done} of ${progress!.total} tasks completed`:evidence||'No task history';
 return <td className={`month-progress-cell ${cell.inMonth?'':'is-outside'}`} aria-label={`${dateLabel.format(cell.date)}${today?', today':''}. ${summary}.`}>
  <div className={`month-progress-day ${today?'is-today':''} ${known&&ratio===1?'is-complete':''}`}>
   <time className="month-progress-date" dateTime={isoDay(cell.date)} aria-current={today?'date':undefined}>{cell.day}</time>
   <span className={`month-day-progress ${known?'has-progress':''}`} aria-hidden="true"><svg viewBox="0 0 32 32"><circle className="month-ring-track" cx="16" cy="16" r="13.5"/>{known&&<circle className="month-ring-fill" cx="16" cy="16" r="13.5" strokeDasharray={circumference} strokeDashoffset={circumference*(1-ratio)} transform="rotate(-90 16 16)"/>}</svg>{count&&<span className="month-progress-ratio">{count}</span>}</span>
   <span className="month-progress-evidence" aria-hidden="true">{evidence}</span>
  </div>
 </td>;
});

/** A read-only local calendar. Empty days stay empty; only recorded work earns a count. */
export function MonthTaskProgress({s,now=Date.now(),heading='This Month'}:{s:any;now?:number;heading?:React.ReactNode}){
 const current=new Date(now),today=dayKey(now);
 const [month,setMonth]=useState(()=>({year:current.getFullYear(),index:current.getMonth()}));
 const cells=useMemo(()=>{const grid=monthGrid(month.year,month.index);const last=grid.reduce((last,cell,index)=>cell.inMonth?index:last,-1);return grid.slice(0,Math.ceil((last+1)/7)*7);},[month.year,month.index]);
 const progress=useMemo(()=>cells.map(cell=>cell.inMonth?getTaskDayProgress(s,cell.key,now):null),[cells,s.tasks,s.taskHistory,s.taskHistoryDay,today]);
 const rows=useMemo(()=>Array.from({length:Math.ceil(cells.length/7)},(_,index)=>cells.slice(index*7,index*7+7)),[cells]);
 const label=monthLabel.format(new Date(month.year,month.index,1,12));
 const isCurrent=month.year===current.getFullYear()&&month.index===current.getMonth();
 const changeMonth=(delta:number)=>setMonth(value=>{const date=new Date(value.year,value.index+delta,1,12);return {year:date.getFullYear(),index:date.getMonth()};});
 return <section className="month-task-progress" aria-label="Monthly task progress">
  <div className="todo-heading-row month-period-heading"><div className="todo-heading">{heading}</div></div>
  <header className="month-progress-heading"><h2 aria-live="polite">{label}</h2><div className="month-progress-navigation"><Button variant="ghost" size="sm" aria-label="Previous month" onClick={()=>changeMonth(-1)}><ChevronLeft size={13}/></Button><Button variant="ghost" size="sm" className="month-jump-today" disabled={isCurrent} onClick={()=>setMonth({year:current.getFullYear(),index:current.getMonth()})}>Today</Button><Button variant="ghost" size="sm" aria-label="Next month" onClick={()=>changeMonth(1)}><ChevronRight size={13}/></Button></div></header>
  <table className="month-progress-table" aria-label={`${label} task progress`}><thead><tr>{weekdays.map(([short,long])=><th scope="col" key={short} abbr={long}><span>{short}</span></th>)}</tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={row[0].key}>{row.map((cell,columnIndex)=><DayTile key={cell.key} cell={cell} progress={progress[rowIndex*7+columnIndex]} today={cell.key===today}/>)}</tr>)}</tbody></table>
 </section>;
}
