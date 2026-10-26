import {reconcileTaskLinks,validSlot,plannerColors} from './planner.mjs';
import {localDayKey,dayFromKey,liveTaskProgress,validTaskHistory,updateTaskHistory} from './month-progress.mjs';
import {initialTrackers,validTrackers,trackerSlots,trackerLimit,trackerTitle,trackerMask} from './tracker.mjs';
export function normalizePinURL(value){
 const raw=String(value).trim();if(!raw||/[\x00-\x1f]/.test(raw))throw Error('Enter a link or an absolute file path.');
 const path=raw.startsWith('/')&&!raw.startsWith('//');
 if(!path&&!raw.startsWith('file:')&&/\s/.test(raw))throw Error('Enter a valid link.');
 const u=new URL(path?'file://'+raw:/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:'https://'+raw);
 if(u.username||u.password)throw Error('Links with embedded passwords are not supported.');
 if(u.protocol==='file:'){if(u.hostname&&u.hostname!=='localhost')throw Error('Use a local file on this Mac.');if(!u.pathname||u.pathname==='/')throw Error('Include the file path.');}
 else if(!['https:','http:'].includes(u.protocol)||!u.hostname)throw Error('Use an http, https, or file link.');
 return u.href;
}
export function pinLinkLabel(value){const u=new URL(value);if(u.protocol!=='file:')return u.hostname;try{return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'Local file');}catch{return 'Local file';}}

export function validPin(p){try{return !!p&&/^[0-9a-f-]{36}$/i.test(p.id)&&typeof p.title==='string'&&!!p.title.trim()&&p.title.length<=120&&Number.isFinite(p.created)&&(p.kind==='link'?typeof p.url==='string'&&p.url.length<=4000&&normalizePinURL(p.url)===p.url:p.kind==='file'&&typeof p.fileName==='string'&&!!p.fileName&&!/[\/\\]/.test(p.fileName)&&!['.','..'].includes(p.fileName)&&Number.isFinite(p.size)&&p.size>=0);}catch{return false;}}
export const taskPriorityValues=['low','medium','high'];
const viewValues=['today','tasks','tracker','focus','pins','dump','reminders'];
export function resumeView(state,target){return viewValues.includes(target)?target:viewValues.includes(state?.lastView)?state.lastView:'today';}
const minute=60000;
export const stepTimerMinutes=(value,direction)=>Math.max(1,Math.min(120,(direction>0?Math.floor(value/5)+1:Math.ceil(value/5)-1)*5));
export const dayKey=localDayKey;
export const visibleTasks=(s,now=Date.now())=>s.tasks.filter(t=>!t.done||t.completedDay===dayKey(now));
export function taskProgress(s,now=Date.now()){return liveTaskProgress(s.tasks,now);}
const uid=()=>globalThis.crypto.randomUUID();
export const messages=[{title:'Drink water, buddy.',sub:'A little sip. A little reset.',kind:'water'},{title:'Stretch your paws.',sub:'Your shoulders deserve a tiny break.',kind:'stretch'},{title:'Look up. Look far.',sub:'Give those lovely eyes a moment.',kind:'eyes'},{title:'One small thing at a time.',sub:'You’re doing better than you think.',kind:'kind'}];
export const durations=(s,mode)=>({focus:s.settings.focusMinutes,short:s.settings.shortMinutes,long:s.settings.longMinutes}[mode]*60);
const timerNotice=(mode,now)=>({kind:'timer',id:uid(),at:now,title:mode==='focus'?'Ready for a fresh start?':'You did it. Take a break.',sub:mode==='focus'?'Your next focus session is ready.':'Your break is ready when you are.'});
export function initialState(now=Date.now()){
 return updateTaskHistory({version:1,lastView:'today',trackers:initialTrackers(now),calendar:{mode:'sample',selectedIds:[]},pins:[],notes:[],brainDump:'',brainDumpTitle:'',activeNoteId:null,reminders:[{id:'water',title:'Drink water, buddy.',intervalMinutes:60,enabled:true,sound:true,lastFired:now}],tasks:[{id:uid(),title:'Make something I’m proud of',section:'today',done:false,pinned:true,created:now,due:null,priority:'medium'},{id:uid(),title:'Take a little walk outside',section:'today',done:false,pinned:false,created:now,due:null,priority:'medium'}],draft:'',events:sampleEvents(now),settings:{mascotName:'Bubu',mascotSounds:true,reminderDisplaySeconds:5,focusMinutes:25,shortMinutes:5,longMinutes:15,nudgeMinutes:60,startHour:9,endHour:22,quiet:false,pausedUntil:0,reducedMotion:false,sound:true,categories:{water:true,stretch:true,eyes:true,kind:true},leadMinutes:5},timer:{mode:'focus',seconds:1500,running:false,startedAt:null,sessions:0,taskId:null},alert:null,seen:{},snoozed:{},lastNudge:now,nudgeIndex:0,welcomed:false},now);
}
export function sampleEvents(now){return [{id:uid(),title:'A little planning time',start:now+20*minute,end:now+50*minute,color:'blue'},{id:uid(),title:'Make room for creative work',start:now+90*minute,end:now+150*minute,color:'peach'}];}
export function remaining(t,now=Date.now()){return Math.max(0,Math.ceil(t.seconds-(t.running?Math.max(0,now-t.startedAt)/1000:0)));}
export function validateState(x){
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const fail=()=>{throw Error('This backup is not a valid Panda file. Your current data is safe.');};
 if(!x||x.version!==1||!Array.isArray(x.tasks)||x.tasks.length>5000||!Array.isArray(x.events)||x.events.length>1000)fail();
 if(x.lastView!==undefined&&!viewValues.includes(x.lastView))fail();
 if(x.trackers!==undefined&&!validTrackers(x.trackers))fail();
 if((x.taskHistory!==undefined||x.taskHistoryDay!==undefined)&&!validTaskHistory(x.taskHistory,x.taskHistoryDay))fail();
 if(x.lastGreetingDay!=null&&(typeof x.lastGreetingDay!=='string'||!/^\d{4}-\d{1,2}-\d{1,2}$/.test(x.lastGreetingDay)))fail();
 if(x.pins!==undefined&&(!Array.isArray(x.pins)||x.pins.length>200||x.pins.some(p=>!validPin(p))||new Set(x.pins.map(p=>p.id)).size!==x.pins.length))fail();
 if(x.brainDump!==undefined&&(typeof x.brainDump!=='string'||x.brainDump.length>100000))fail();
 if(x.brainDumpTitle!==undefined&&(typeof x.brainDumpTitle!=='string'||x.brainDumpTitle.length>200))fail();
 if(x.calendar!==undefined&&(!record(x.calendar)||!['sample','connected','off'].includes(x.calendar.mode)||!Array.isArray(x.calendar.selectedIds)||x.calendar.selectedIds.length>100||x.calendar.selectedIds.some(id=>typeof id!=='string'||id.length>500)))fail();
 if(x.notes!==undefined){if(!Array.isArray(x.notes)||x.notes.length>5000)fail();const ids=new Set();for(const n of x.notes){if(!record(n)||typeof n.id!=='string'||ids.has(n.id)||typeof n.body!=='string'||(n.title===undefined&&!n.body.trim())||n.body.length>100000||('title' in n&&(typeof n.title!=='string'||n.title.length>200))||!Number.isFinite(n.created))fail();ids.add(n.id);}}
 if(x.activeNoteId!==undefined&&x.activeNoteId!==null&&(typeof x.activeNoteId!=='string'||!x.notes?.some(note=>note.id===x.activeNoteId)))fail();
 if(x.reminders!==undefined){if(!Array.isArray(x.reminders)||x.reminders.length>100)fail();const ids=new Set();for(const r of x.reminders){if(typeof r.id!=='string'||ids.has(r.id)||typeof r.title!=='string'||!r.title.trim()||r.title.length>100||typeof r.enabled!=='boolean'||!Number.isFinite(r.intervalMinutes)||r.intervalMinutes<1||r.intervalMinutes>1440||!Number.isFinite(r.lastFired)||(r.sound!==undefined&&typeof r.sound!=='boolean'))fail();ids.add(r.id);}}
 for(const t of x.tasks){const l=t.calendarLink;if(l!=null&&(!record(l)||typeof l.eventId!=='string'||l.eventId.length>1000||typeof l.calendarId!=='string'||l.calendarId.length>1000||!validSlot(l.start,l.end)||(l.color!==undefined&&!plannerColors.includes(l.color))))fail();}
 if(x.settings?.plannerStart!==undefined&&(!Number.isInteger(x.settings.plannerStart)||x.settings.plannerStart<0||x.settings.plannerStart>22))fail();
 if(x.settings?.plannerEnd!==undefined&&(!Number.isInteger(x.settings.plannerEnd)||x.settings.plannerEnd<1||x.settings.plannerEnd>24||x.settings.plannerEnd<=(x.settings.plannerStart??7)))fail();
 const ids=new Set();for(const t of x.tasks){if(typeof t.id!=='string'||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>500||!['today','later'].includes(t.section)||typeof t.done!=='boolean'||typeof t.pinned!=='boolean'||!Number.isFinite(t.created)||(t.due!==null&&!Number.isFinite(t.due))||(t.priority!==undefined&&!taskPriorityValues.includes(t.priority)))fail();ids.add(t.id);}
 const eids=new Set();for(const e of x.events){if(typeof e.id!=='string'||eids.has(e.id)||typeof e.title!=='string'||!e.title.trim()||e.title.length>500||!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.end<=e.start)fail();eids.add(e.id);}
 if(x.timer?.completedAt!=null&&(!Number.isFinite(x.timer.completedAt)||x.timer.completedAt<0))fail();
 if(x.pendingTimerMode!=null&&!['focus','short','long'].includes(x.pendingTimerMode))fail();
 if(x.settings?.notchSize!=null&&(!record(x.settings.notchSize)||!Number.isFinite(x.settings.notchSize.width)||x.settings.notchSize.width<300||x.settings.notchSize.width>720||!Number.isFinite(x.settings.notchSize.height)||x.settings.notchSize.height<100||x.settings.notchSize.height>3000))fail();
 if(x.settings?.musicEnabled!==undefined&&typeof x.settings.musicEnabled!=='boolean')fail();
 if(x.settings?.mascotSounds!==undefined&&typeof x.settings.mascotSounds!=='boolean')fail();
 if(x.settings?.reminderDisplaySeconds!==undefined&&(!Number.isInteger(x.settings.reminderDisplaySeconds)||x.settings.reminderDisplaySeconds<3||x.settings.reminderDisplaySeconds>60))fail();
 if(x.settings?.mascotName!==undefined&&(typeof x.settings.mascotName!=='string'||x.settings.mascotName.length>24))fail();
 const s=x.settings,t=x.timer;if(!s||!t||!['focus','short','long'].includes(t.mode)||typeof t.running!=='boolean'||!Number.isFinite(t.seconds)||t.seconds<0||t.seconds>7200||!Number.isInteger(t.sessions)||t.sessions<0||(t.running&&!Number.isFinite(t.startedAt)))fail();
 for(const k of ['focusMinutes','shortMinutes','longMinutes'])if(!Number.isFinite(s[k])||s[k]<1||s[k]>120)fail();
 for(const k of ['nudgeMinutes','leadMinutes'])if(!Number.isFinite(s[k])||s[k]<1||s[k]>240)fail();
 for(const k of ['startHour','endHour'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>23)fail();
 if(typeof s.quiet!=='boolean'||typeof s.sound!=='boolean'||typeof s.reducedMotion!=='boolean'||!Number.isFinite(s.pausedUntil)||!s.categories||messages.some(m=>typeof s.categories[m.kind]!=='boolean'))fail();
 if(typeof x.draft!=='string'||x.draft.length>500||!Number.isFinite(x.lastNudge)||!Number.isInteger(x.nudgeIndex)||x.nudgeIndex<0||!record(x.seen)||!record(x.snoozed))fail();
 for(const value of Object.values(x.seen))if(typeof value!=='boolean')fail();
 if(x.nudgeSnooze!=null&&(!Number.isFinite(x.nudgeSnooze)||x.nudgeSnooze<0))fail();
 for(const value of Object.values(x.snoozed))if(!Number.isFinite(value))fail();
 return structuredClone(x);
}
export function restore(x,now=Date.now()){const s=validateState(x);s.lastView??='today';s.trackers??=initialTrackers(now);s.pins??=[];s.brainDump??='';s.brainDumpTitle??='';s.activeNoteId??=null;s.notes??=[];s.settings.mascotName??='Bubu';s.settings.mascotSounds??=true;s.settings.reminderDisplaySeconds??=5;for(const task of s.tasks)task.priority??='medium';s.calendar??={mode:'sample',selectedIds:[]};s.reminders??=[{id:'water',title:'Drink water, buddy.',intervalMinutes:60,enabled:true,sound:true,lastFired:now}];for(const r of s.reminders)r.sound??=true;s.timer.running=false;s.timer.startedAt=null;if(s.alert?.key)delete s.seen[s.alert.key];s.alert=null;return updateTaskHistory(s,now);}
export function reduce(state,a,now=Date.now()){
 const base=updateTaskHistory(state,now);
 if(a.type==='checkpoint'&&!state.timer.running)return base;
 const s=structuredClone(base),t=s.timer;
 switch(a.type){
 case 'view':if(!viewValues.includes(a.view)||s.lastView===a.view)return base;s.lastView=a.view;break;
 case 'trackerCheck':{
  const tracker=s.trackers?.find(value=>value.id===a.id),stamp=dayFromKey(a.day);
  if(!tracker||stamp===null||stamp>dayFromKey(dayKey(now))||!Number.isInteger(a.slot)||a.slot<0||a.slot>=trackerSlots||typeof a.checked!=='boolean')return base;
  const mask=trackerMask(tracker,a.day),bit=1<<a.slot,next=a.checked?mask|bit:mask&~bit;
  if(mask===next)return base;
  if(!Object.hasOwn(tracker.days,a.day)&&Object.keys(tracker.days).length>=4000)return base;
  tracker.days[a.day]=next;break;
 }
 case 'addTracker':{
  const title=trackerTitle(a.title);if(!title||(s.trackers?.length??0)>=trackerLimit)return base;
  (s.trackers??=[]).push({id:uid(),title,slots:trackerSlots,created:now,days:{}});break;
 }
 case 'renameTracker':{
  const title=trackerTitle(a.title),tracker=s.trackers?.find(value=>value.id===a.id);if(!tracker||!title||tracker.title===title)return base;tracker.title=title;break;
 }
 case 'deleteTracker':if(!s.trackers?.some(value=>value.id===a.id))return base;s.trackers=s.trackers.filter(value=>value.id!==a.id);break;
 case 'restoreTracker':{
  if(!validTrackers([a.tracker])||(s.trackers?.length??0)>=trackerLimit||s.trackers?.some(value=>value.id===a.tracker.id))return base;
  (s.trackers??=[]).splice(Number.isInteger(a.index)?Math.max(0,Math.min(a.index,s.trackers.length)):s.trackers.length,0,structuredClone(a.tracker));break;
 }
 case 'calendarLinks':{const entries=a.links??[];s.tasks=reconcileTaskLinks(s.tasks,entries.filter(v=>v.event).map(v=>v.event)).map(t=>entries.some(v=>v.taskId===t.id&&v.missing)&&t.calendarLink?{...t,calendarLink:{...t.calendarLink,missing:true}}:t);if(JSON.stringify(s.tasks)===JSON.stringify(state.tasks))return base;break;}
 case 'taskCalendarLinked':s.tasks=s.tasks.map(v=>v.id===a.id?{...v,calendarLink:{...v.calendarLink,...a.link}}:v);break;
 case 'taskCalendarUnlinked':s.tasks=s.tasks.map(v=>{if(v.id!==a.id)return v;const {calendarLink,...task}=v;return task;});break;
 case 'taskPriority':{if(!taskPriorityValues.includes(a.priority))return base;const task=s.tasks.find(v=>v.id===a.id);if(!task||task.priority===a.priority)return base;task.priority=a.priority;break;}
 case 'taskCalendarColor':if(plannerColors.includes(a.color))s.tasks=s.tasks.map(v=>v.id===a.id&&v.calendarLink?{...v,calendarLink:{...v.calendarLink,color:a.color}}:v);break;
 case 'add':{const title=a.title.trim().slice(0,500);if(!title)return base;s.tasks.push({id:uid(),title,section:a.section==='later'?'later':'today',done:false,pinned:false,created:now,due:null,priority:'medium'});s.draft='';break;}
 case 'addPins':for(const p of a.pins??[])if(validPin(p)&&s.pins.length<200&&!s.pins.some(v=>v.id===p.id))s.pins.push(p);break;
 case 'deletePin':s.pins=s.pins.filter(p=>p.id!==a.id);break;
 case 'saveNote':{const explicit=a.id!==undefined,body=explicit?s.brainDump:s.brainDump.trim(),title=s.brainDumpTitle??'';if((!body.trim()&&!title.trim())||s.notes.length>=5000||(explicit&&(typeof a.id!=='string'||!a.id.trim()||a.id.length>500||s.notes.some(n=>n.id===a.id))))return base;const id=explicit?a.id:uid();s.notes.unshift({id,...(explicit||title?{title}:{}),body,created:now});s.brainDump='';s.brainDumpTitle='';s.activeNoteId=id;break;}
 case 'editNote':{const body=String(a.body??'').trim().slice(0,100000),note=s.notes.find(n=>n.id===a.id);if(!body||!note||note.body===body)return base;note.body=body;note.updated=now;break;}
 case 'updateNote':{const note=s.notes.find(n=>n.id===a.id);if(!note||(a.title!==undefined&&typeof a.title!=='string')||(a.body!==undefined&&typeof a.body!=='string'))return base;const title=a.title===undefined?note.title:a.title.slice(0,200),body=a.body===undefined?note.body:a.body.slice(0,100000);if(title===note.title&&body===note.body)return base;note.title=title??'';note.body=body;note.updated=now;break;}
 case 'focusNote':if((a.id!==null&&!s.notes.some(n=>n.id===a.id))||s.activeNoteId===a.id)return base;s.activeNoteId=a.id;break;
 case 'noteDraftTitle':{if(typeof a.value!=='string')return base;const title=a.value.slice(0,200);if(s.brainDumpTitle===title)return base;s.brainDumpTitle=title;break;}
 case 'deleteNote':if(!s.notes.some(n=>n.id===a.id))return base;s.notes=s.notes.filter(n=>n.id!==a.id);if(s.activeNoteId===a.id)s.activeNoteId=null;break;
 case 'restoreNote':if(s.notes.some(n=>n.id===a.note.id)||s.notes.length>=5000)return base;s.notes.splice(Math.min(a.index,s.notes.length),0,a.note);break;
 case 'brainDump':{const body=a.value.slice(0,100000);if(s.brainDump===body)return base;s.brainDump=body;break;}
 case 'addReminder':if(a.title.trim())s.reminders.push({id:uid(),title:a.title.trim().slice(0,100),intervalMinutes:Math.min(1440,Math.max(1,Number(a.intervalMinutes)||60)),enabled:true,sound:a.sound!==false,lastFired:now});break;
 case 'toggleReminder':s.reminders=s.reminders.map(r=>r.id===a.id?{...r,enabled:!r.enabled,lastFired:now}:r);break;
 case 'deleteReminder':s.reminders=s.reminders.filter(r=>r.id!==a.id);break;
 case 'editReminder':s.reminders=s.reminders.map(r=>r.id===a.id?{...r,...(a.intervalMinutes!==undefined?{intervalMinutes:Math.min(1440,Math.max(1,Number(a.intervalMinutes)||60)),lastFired:now}:{}),...(typeof a.sound==='boolean'?{sound:a.sound}:{})}:r);break;
 case 'draft':s.draft=a.value.slice(0,500);break;
 case 'toggle':s.tasks=s.tasks.map(v=>v.id===a.id?{...v,done:!v.done,completedDay:v.done?null:dayKey(now),pinned:false}:v);break;
 case 'edit':s.tasks=s.tasks.map(v=>v.id===a.id?{...v,title:a.title?.trim().slice(0,500)||v.title,section:a.section??v.section,due:a.due===undefined?v.due:a.due}:v);break;
 case 'pin':s.tasks=s.tasks.map(v=>({...v,pinned:v.id===a.id&&!v.pinned&&!v.done}));break;
 case 'delete':s.tasks=s.tasks.filter(v=>v.id!==a.id);break;
 case 'restoreTask':s.tasks.splice(Math.min(a.index,s.tasks.length),0,a.task);break;
 case 'move':{const i=s.tasks.findIndex(v=>v.id===a.id),j=i+a.delta;if(i>=0&&j>=0&&j<s.tasks.length)[s.tasks[i],s.tasks[j]]=[s.tasks[j],s.tasks[i]];break;}
 case 'reorder':s.tasks=a.ids.map(id=>s.tasks.find(v=>v.id===id)).filter(Boolean);break;
 case 'settings':{const before=durations(s,t.mode);Object.assign(s.settings,a.patch);if(!t.running&&durations(s,t.mode)!==before)t.seconds=durations(s,t.mode);if(a.patch.quiet)s.alert=null;break;}
 case 'timerStart':s.pendingTimerMode=null;t.running=true;t.startedAt=now;break;
 case 'checkpoint':if(t.running){t.seconds=remaining(t,now);t.startedAt=now;}break;
 case 'timerPause':case 'sleep':t.seconds=remaining(t,now);t.running=false;t.startedAt=null;if(a.type==='sleep')s.lastNudge=now;break;
 // Give the user a minute after waking, without resetting every reminder's cadence.
 case 'wake':s.lastNudge=now;break;
 case 'timerReset':s.pendingTimerMode=null;t.running=false;t.startedAt=null;t.seconds=durations(s,t.mode);break;
 case 'timerMode':s.pendingTimerMode=null;t.mode=a.mode;t.running=false;t.startedAt=null;t.seconds=durations(s,t.mode);break;
 case 'timerTask':t.taskId=a.id||null;break;
 case 'addEvent':s.events.push({id:uid(),title:a.title.trim().slice(0,500),start:a.start,end:a.end,color:'blue'});break;
 case 'deleteEvent':s.events=s.events.filter(e=>e.id!==a.id);break;
 case 'calendarSelect':s.calendar={mode:'connected',selectedIds:[...new Set(a.ids)]};s.events=[];s.seen={};s.snoozed={};if(s.alert?.kind==='event')s.alert=null;break;
 case 'calendarDisconnect':s.calendar={mode:'off',selectedIds:[]};s.events=[];s.seen={};s.snoozed={};if(s.alert?.kind==='event')s.alert=null;break;
 case 'calendarSnapshot':if(s.calendar.mode!=='connected'||JSON.stringify(s.events)===JSON.stringify(a.events))return base;s.events=a.events;s.tasks=reconcileTaskLinks(s.tasks,s.events);{const keys=new Set(s.events.map(e=>`${e.id}:${e.start}`));for(const key of Object.keys(s.seen))if(!keys.has(key)&&!s.tasks.some(t=>`${t.id}:${t.due}`===key))delete s.seen[key];}break;
 case 'sampleEvents':s.calendar={mode:'sample',selectedIds:[]};s.events=sampleEvents(now);s.seen={};s.snoozed={};break;
 case 'dismissAlert':case 'snoozeAlert':{
  const al=s.alert;if(a.id&&al?.id!==a.id)break;if(al){if(a.type==='snoozeAlert'&&(al.kind==='event'||al.kind==='task')){s.snoozed[al.key]=now+5*minute;delete s.seen[al.key];}else if(a.type==='snoozeAlert'&&al.kind==='wellness'){s.nudgeSnooze=now+15*minute;s.snoozedCategory=al.category;s.snoozedTitle=al.title;}}s.alert=null;break;
 }
 case 'nudge':{const r=s.reminders.find(r=>r.id===a.reminderId);const m={kind:r?.id||'water',title:r?.title||a.title||'Drink water, buddy.',sub:'A little sip. A little reset.'};s.alert={...m,kind:'wellness',displayMs:reminderDisplayMs(s,null),sound:r?.sound!==false,category:m.kind,id:uid(),at:now};s.nudgeIndex++;s.lastNudge=now;break;}
 case 'welcome':s.welcomed=true;break;
 default:return base;
 }
 return updateTaskHistory(s,now);
}
export function canNudge(s,now){const h=new Date(now).getHours(),c=s.settings;const inHours=c.startHour===c.endHour?true:c.startHour<c.endHour?h>=c.startHour&&h<c.endHour:h>=c.startHour||h<c.endHour;return inHours&&!c.quiet&&now>=c.pausedUntil&&!(s.timer.running&&s.timer.mode==='focus')&&(s.nudgeSnooze?now>=s.nudgeSnooze:now-s.lastNudge>=minute&&(s.reminders?.some(r=>r.enabled&&now-r.lastFired>=r.intervalMinutes*minute)||now-s.lastNudge>=c.nudgeMinutes*minute&&s.reminders===undefined))&&(s.reminders?.some(r=>r.enabled)??messages.some(m=>c.categories[m.kind]));}
export function advance(state,now=Date.now()){
 let s=state;const mutate=()=>{if(s===state)s=structuredClone(state);};
 const observed=updateTaskHistory(state,now);if(observed!==state)s=structuredClone(observed);
 if(s.timer.running&&remaining(s.timer,now)===0){mutate();const t=s.timer;t.completedAt=now;if(t.mode==='focus'){t.sessions++;t.mode=t.sessions%4===0?'long':'short';}else t.mode='focus';t.seconds=durations(s,t.mode);t.running=false;t.startedAt=null;if(!s.alert)s.alert=timerNotice(t.mode,now);else s.pendingTimerMode=t.mode;}
 if(s.alert?.kind==='event'&&(now-s.alert.at>=3000||!s.events.some(e=>`${e.id}:${e.start}`===s.alert.key&&e.end>now))){mutate();s.alert=null;}
 if(s.alert?.kind==='task'&&!s.tasks.some(t=>`${t.id}:${t.due}`===s.alert.key&&!t.done)){mutate();s.alert=null;}
 if((s.alert?.kind==='wellness'&&now-s.alert.at>=reminderDisplayMs(s))||(s.alert?.kind==='timer'&&now-s.alert.at>18000)){mutate();s.alert=null;}
 if(!s.settings.quiet){
  const candidates=s.events.filter(e=>!e.allDay&&now>=e.start-s.settings.leadMinutes*minute&&now<e.end).sort((a,b)=>a.start-b.start).map(e=>({kind:'event',key:`${e.id}:${e.start}`,title:e.title,sub:'Your next little commitment',start:e.start}));
  for(const t of s.tasks.filter(t=>!t.done&&t.due&&now>=t.due))candidates.push({kind:'task',key:`${t.id}:${t.due}`,title:t.title,sub:'A task you wanted to remember'});
  const next=candidates.find(a=>!s.seen[a.key]&&!(s.snoozed[a.key]>now));
  if(next&&(!s.alert||['wellness','timer'].includes(s.alert.kind))){mutate();if(s.alert?.kind==='timer')s.pendingTimerMode=s.timer.mode;s.alert={...next,id:uid(),at:now};s.seen[next.key]=true;}
 }
 if(!s.alert&&s.pendingTimerMode){mutate();s.alert=timerNotice(s.pendingTimerMode,now);s.pendingTimerMode=null;}
 if(!s.alert&&canNudge(s,now)){mutate();const due=s.reminders?.filter(r=>r.enabled&&now-r.lastFired>=r.intervalMinutes*minute).sort((a,b)=>(a.lastFired+a.intervalMinutes*minute)-(b.lastFired+b.intervalMinutes*minute))[0];const title=s.nudgeSnooze?s.snoozedTitle:due?.title||'Drink water, buddy.';s.alert={kind:'wellness',displayMs:reminderDisplayMs(s,null),title,sub:'A little moment for you.',category:due?.id||'water',sound:due?.sound!==false,id:uid(),at:now};if(due)due.lastFired=now;s.nudgeIndex++;s.lastNudge=now;s.nudgeSnooze=null;s.snoozedCategory=null;s.snoozedTitle=null;}
 return s;
}

export function shouldPlayReminder(s,alert){return !!alert&&alert.kind!=='timer'&&alert.sound!==false&&s.settings.mascotSounds&&!s.settings.quiet;}

export function reminderDisplayMs(s,alert=s.alert){return alert?.displayMs??(s.settings.reminderDisplaySeconds??5)*1000;}
