import {CalendarDays,X} from 'lucide-react';
import './calendar-notice.css';

export type CalendarNoticeAlert={kind:'event'|'task';title:string;start?:number};
type CalendarNoticeProps={alert:CalendarNoticeAlert;now:number;onDismiss:()=>void;onSnooze:()=>void};
const clock=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',hour12:true});

/** A passive status pill; its actions never open or expand the notch. */
export function CalendarNotice({alert,now,onDismiss,onSnooze}:CalendarNoticeProps){
 const future=Number.isFinite(alert.start)&&Number(alert.start)>now;
 const time=future?clock.format(alert.start):'Now';
 return <div className="calendar-notice" role="status" aria-live="polite" aria-atomic="true">
  <CalendarDays className="calendar-notice-icon" size={16} strokeWidth={1.7} aria-hidden="true"/>
  <span className="calendar-notice-title" title={alert.title}>{alert.title}</span>
  <span className="calendar-notice-time">{time}</span>
  <button type="button" tabIndex={0} className="calendar-notice-snooze" onClick={event=>{event.stopPropagation();onSnooze();}} aria-label="Snooze reminder for 5 minutes">Snooze 5 min</button>
  <button type="button" tabIndex={0} className="calendar-notice-dismiss" onClick={event=>{event.stopPropagation();onDismiss();}} aria-label={`Dismiss ${alert.kind==='task'?'task':'calendar'} reminder`}><X size={13} strokeWidth={1.8} aria-hidden="true"/></button>
 </div>;
}
