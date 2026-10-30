// Pure local campaign bookkeeping. This module never opens evidence or writes calendars.
const campaignId='november-2026',timezone='Asia/Kolkata',firstDay='2026-11-01',lastDay='2026-11-30';
const slots=['applications','visibility','portfolio','project','learning','interview'];
const recurring=new Set(['applications','visibility']);
const titles={applications:'15 company applications',visibility:'Creative idea + post',portfolio:'Portfolio',project:'Main project',learning:'Applied learning',interview:'Interview practice'};
const hours={applications:['07:00','10:00'],visibility:['11:00','12:00'],portfolio:['12:00','14:00'],project:['15:00','17:00'],learning:['17:30','20:00'],interview:['20:00','22:00']};
const goal='Stable paid work through a full-time role, retainer, or substantial project. Full-time is preferred; project income covers confirmed project dates only.';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
// Native saves sort object keys; semantic equality must survive that round trip.
const equal=(a,b)=>{
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>equal(value,b[index]));
 if(!record(a)||!record(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equal(a[key],b[key]));
};
const cleanText=(value,max=4000,empty=false)=>typeof value==='string'&&value.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)&&(empty||!!value.trim());
const fail=()=>{throw Error('This campaign brief is not valid. Saved guidance and tasks are unchanged.');};
function milliseconds(now){const value=now instanceof Date?now.getTime():now;if(!Number.isFinite(value))throw Error('A valid campaign time is required.');return value;}
export function campaignDate(now=Date.now()){return new Date(milliseconds(now)+19800000).toISOString().slice(0,10);}
const campaignDay=value=>typeof value==='string'&&/^2026-11-(0[1-9]|[12]\d|30)$/.test(value);
export function campaignActive(now=Date.now()){const date=campaignDate(now);return date>=firstDay&&date<=lastDay;}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value))return false;
 const stamp=Date.parse(value),date=value.slice(0,10);return Number.isFinite(stamp)&&new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)===date;
}
function normalizeBrief(value,now,{allowPast=false,checkIssued=true}={}){
 if(!record(value)||value.schema_version!==1||value.campaign_id!==campaignId||value.timezone!==timezone||!campaignDay(value.date)||!Number.isSafeInteger(value.revision)||value.revision<1||!timestamp(value.issued_at)||!cleanText(value.opening,2000)||!cleanText(value.main_focus)||!cleanText(value.project_id,200)||!Array.isArray(value.blocks)||value.blocks.length!==6)fail();
 if(value.goal!==undefined&&!cleanText(value.goal,2000))fail();
 if(!allowPast&&value.date<campaignDate(now))fail();
 if(checkIssued&&Date.parse(value.issued_at)>milliseconds(now)+300000)fail();
 const usedSlots=new Set(),usedWork=new Set(),blocks=[];
 for(const block of value.blocks){
  if(!record(block)||!slots.includes(block.slot)||usedSlots.has(block.slot)||!cleanText(block.work_id,200)||!cleanText(block.title,500)||!cleanText(block.deliverable)||!cleanText(block.done_when)||!cleanText(block.first_action,2000)||(block.slot==='learning'&&!cleanText(block.subject,200)))fail();
  const slot=block.slot,work_id=recurring.has(slot)?`${slot}:${value.date}`:block.work_id.trim();if(usedWork.has(work_id))fail();usedSlots.add(slot);usedWork.add(work_id);
  blocks.push({slot,work_id,title:recurring.has(slot)?titles[slot]:block.title.trim(),deliverable:block.deliverable.trim(),done_when:block.done_when.trim(),first_action:block.first_action.trim(),...(slot==='learning'?{subject:block.subject.trim()}:{})});
 }
 blocks.sort((a,b)=>slots.indexOf(a.slot)-slots.indexOf(b.slot));
 return {schema_version:1,campaign_id:campaignId,timezone,date:value.date,revision:value.revision,issued_at:value.issued_at,opening:value.opening.trim(),main_focus:value.main_focus.trim(),...(value.goal!==undefined?{goal:value.goal.trim()}:{}),project_id:value.project_id.trim(),blocks};
}
export function validateCampaignBrief(value,now=Date.now()){return normalizeBrief(value,now);}
function fallback(date){
 const content={
  applications:['applications:'+date,'Submit 15 suitable company applications and record them in the existing dashboard.','15 company applications submitted; follow-ups are separate.','Open the prepared company-role queue.'],
  visibility:['visibility:'+date,'Develop one new creative idea and publish one clear post.','One new idea and its post are saved/published.','Choose one idea grounded in your work.'],
  portfolio:['portfolio:'+date,'Work on the portfolio item you choose.','Your chosen portfolio step is complete.','Choose what to work on in your portfolio.'],
  project:['project:'+date,'Work on your current project.','Your chosen project step is complete.','Choose the next step for your project.'],
  learning:['learning:'+date,'Apply learning of your choice to your current work.','Your chosen learning step is complete.','Choose what you want to learn and apply.'],
  interview:['interview:'+date,'Practice for interviews in the way you choose.','Your chosen practice is complete.','Choose what you want to practice.']
 };
 return {date,opening:'One block at a time.',main_focus:'Choose what to work on in each block.',project_id:'current-work',blocks:slots.map(slot=>{const [work_id,deliverable,done_when,first_action]=content[slot];return {slot,work_id,title:titles[slot],deliverable,done_when,first_action,...(slot==='learning'?{subject:'Your choice'}:{})};})};
}
// Only recognizable built-in defaults are retired; edits and coach-authored work stay owned.
const legacyFallback={
 portfolio:['portfolio-case-opening','Portfolio improvement','Improve the opening of one case study.','Problem, role, decisions and supporting evidence are clear.','Open that case study.'],
 project:['website-project-brief','Main brand/website project','Write one bounded brief for the same brand/website project.','Audience, purpose, page scope and primary action are written.','Choose the existing identity to build on.'],
 learning:['learning-brand-direction','Applied learning','Apply one brand-to-website lesson to the same project.','One implemented decision is saved with a short explanation.','Name the single design decision you need to resolve.'],
 interview:['interview-baseline-case','Interview readiness','Practice one baseline case walkthrough aloud and improve it.','Two attempts and a short self-review are saved.','Say the problem and your role aloud.']
};
function generalizeFallback(campaign,tasks,date){
 const generic=fallback(date);
 for(const entry of Object.values(campaign.owned)){
  const old=legacyFallback[entry.slot];if(!old||entry.work_id!==old[0]||entry.status!=='pending'||!['deliverable','done_when','first_action'].every((key,index)=>entry.last_applied[key]===old[index+2]))continue;
  const index=tasks.findIndex(task=>task.id===entry.task_id);if(index<0)continue;
  const task=tasks[index],next={...task,campaign:{...task.campaign}},[,title,deliverable,done_when,first_action]=old;
  const previous={title,deliverable,done_when,first_action,project_id:'brand-website-main',...(entry.slot==='learning'?{subject:'Brand identity'}:{})},applied=appliedFields(generic.blocks.find(block=>block.slot===entry.slot),entry.date,generic.project_id);
  for(const key of Object.keys(previous)){
   const value=key==='title'?task.title:task.campaign[key];
   if(equal(value,entry.last_applied[key])&&equal(value,previous[key])){if(key==='title')next.title=applied.title;else next.campaign[key]=applied[key];entry.last_applied[key]=applied[key];}
  }
  if(!equal(next,task))tasks[index]=next;
 }
}
function plannedTime(date,slot){const [start,end]=hours[slot];return {start:Date.parse(`${date}T${start}:00+05:30`),end:Date.parse(`${date}T${end}:00+05:30`),timezone};}
const validTime=value=>value===null||(record(value)&&Number.isFinite(value.start)&&Number.isFinite(value.end)&&Number.isFinite(new Date(value.start).getTime())&&Number.isFinite(new Date(value.end).getTime())&&value.end>value.start&&value.timezone===timezone);
function normalizeEvidence(value){
 if(!Array.isArray(value)||value.length>3)throw Error('Add up to three evidence references and short self-reviews.');
 return value.map(entry=>{
  if(!record(entry)||Object.keys(entry).length!==2||!Object.hasOwn(entry,'ref')||!Object.hasOwn(entry,'self_review')||!cleanText(entry.ref,4000)||!cleanText(entry.self_review,2000,true))throw Error('Evidence needs a local absolute path or an https link and a short written self-review.');
  const ref=entry.ref.trim();let valid=ref.startsWith('/')&&!ref.startsWith('//')&&!/[\r\n\t]/.test(ref);
  if(!valid){try{const url=new URL(ref);valid=url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password&&!/\s/.test(ref);}catch{}}
  if(!valid)throw Error('Use a local absolute path or an https link for evidence.');
  return {ref,self_review:entry.self_review.trim()};
 });
}
function validEvidence(value){try{return equal(normalizeEvidence(value),value);}catch{return false;}}
const metadataFields=['campaign_id','date','slot','work_id','deliverable','done_when','first_action','subject','project_id','carried_from','evidence'];
export function validCampaignTaskMetadata(task){
 const value=task?.campaign;
 return record(value)&&Object.keys(value).every(key=>metadataFields.includes(key))&&value.campaign_id===campaignId&&campaignDay(value.date)&&slots.includes(value.slot)&&cleanText(value.work_id,200)&&cleanText(value.deliverable)&&cleanText(value.done_when)&&cleanText(value.first_action,2000)&&cleanText(value.project_id,200)&&(value.slot==='learning'?cleanText(value.subject,200):value.subject===undefined)&&(value.carried_from===null||campaignDay(value.carried_from))&&validEvidence(value.evidence)&&(task.plannedTime===undefined||validTime(task.plannedTime));
}
function emptyCampaign(){return {schema_version:1,campaign_id:campaignId,timezone,current_day:null,home_seen_day:null,accepted_briefs:{},staged_brief:null,days:{},owned:{}};}
function snapshot(entry){return {task_id:entry.task_id,slot:entry.slot,work_id:entry.work_id,title:entry.title,status:entry.status,carried_from:entry.carried_from,start:entry.start,end:entry.end,evidence:entry.evidence.map(value=>({ref:value.ref,self_review:value.self_review}))};}
function publicTime(time){return validTime(time)&&time?{start:new Date(time.start).toISOString(),end:new Date(time.end).toISOString()}:{start:null,end:null};}
function writeDay(campaign,date){
 if(!date)return;
 campaign.days[date]={date,tasks:Object.values(campaign.owned).filter(entry=>entry.date===date).sort((a,b)=>slots.indexOf(a.slot)-slots.indexOf(b.slot)).map(snapshot)};
}
// Sync the observed day first, so advancing a continuing item cannot rewrite yesterday.
function synchronize(campaign,tasks){
 const byId=new Map(tasks.map(task=>[task.id,task]));
 for(const entry of Object.values(campaign.owned)){
  const task=byId.get(entry.task_id);
  if(!task||task.campaign?.campaign_id!==campaignId){entry.status='deleted';continue;}
  entry.title=task.title;entry.status=task.done?'done':'pending';entry.completed=task.done;Object.assign(entry,publicTime(task.plannedTime));entry.evidence=normalizeEvidence(task.campaign.evidence??[]);
 }
 writeDay(campaign,campaign.current_day);
}
function appliedFields(block,date,projectId){return {title:block.title,plannedTime:plannedTime(date,block.slot),deliverable:block.deliverable,done_when:block.done_when,first_action:block.first_action,...(block.subject?{subject:block.subject}:{}),project_id:projectId};}
function newTask(block,date,projectId,now,allTasks){
 let id;do{id=globalThis.crypto.randomUUID();}while(allTasks.some(task=>task.id===id));
 const applied=appliedFields(block,date,projectId);
 return {id,title:applied.title,section:'today',done:false,pinned:false,created:milliseconds(now),due:null,priority:'medium',plannedTime:applied.plannedTime,campaign:{campaign_id:campaignId,date,slot:block.slot,work_id:block.work_id,deliverable:block.deliverable,done_when:block.done_when,first_action:block.first_action,...(block.subject?{subject:block.subject}:{}),project_id:projectId,carried_from:null,evidence:[]}};
}
function register(task,applied){return {task_id:task.id,date:task.campaign.date,slot:task.campaign.slot,work_id:task.campaign.work_id,title:task.title,status:task.done?'done':'pending',completed:task.done,carried_from:task.campaign.carried_from,...publicTime(task.plannedTime),evidence:normalizeEvidence(task.campaign.evidence),last_applied:applied};}
function updateOwned(task,entry,block,date,projectId){
 const next={...task,campaign:{...task.campaign}},moving=entry.date!==date,applied=appliedFields(block,date,projectId);
 for(const key of ['title','plannedTime'])if(equal(task[key],entry.last_applied[key]))next[key]=applied[key];
 for(const key of ['deliverable','done_when','first_action','subject','project_id']){
  if(equal(task.campaign[key],entry.last_applied[key])){if(applied[key]===undefined)delete next.campaign[key];else next.campaign[key]=applied[key];}
 }
 if(moving){next.plannedTime=applied.plannedTime;next.campaign.date=date;next.campaign.carried_from=entry.date;}
 return {task:equal(task,next)?task:next,entry:register(next,applied)};
}
function stageGuidance(campaign,value,now){
 let brief;try{brief=validateCampaignBrief(value,now);}catch{return;}
 const today=campaignDate(now);
 if(brief.date===today){const accepted=campaign.accepted_briefs[today];if(!accepted||brief.revision>accepted.revision)campaign.accepted_briefs[today]=brief;}
 else if(brief.date>today){const staged=campaign.staged_brief;if(!staged||brief.date!==staged.date||brief.revision>staged.revision)campaign.staged_brief=brief;}
}
function preparationNeeds(campaign,date,blocks){
 let needed=0;
 for(const block of blocks){
  const records=Object.values(campaign.owned).filter(entry=>entry.slot===block.slot);
  if(records.some(entry=>entry.date===date))continue;
  if(!recurring.has(block.slot)&&records.some(entry=>entry.status==='pending'&&entry.date<date))continue;
  if(Object.values(campaign.owned).some(entry=>entry.work_id===block.work_id&&(entry.completed||entry.status==='deleted')))continue;
  needed++;
 }
 return needed;
}
export function reconcileCampaign(state,now=Date.now(),brief){
 const date=campaignDate(now),active=campaignActive(now);let incoming=null;
 if(brief!==undefined){try{incoming=validateCampaignBrief(brief,now);}catch{}}
 if(!state.campaign&&!active&&!incoming)return state;
 const campaign=structuredClone(state.campaign??emptyCampaign()),tasks=[...state.tasks];
 synchronize(campaign,tasks);
 if(campaign.staged_brief){if(campaign.staged_brief.date===date){stageGuidance(campaign,campaign.staged_brief,now);campaign.staged_brief=null;}else if(campaign.staged_brief.date<date)campaign.staged_brief=null;}
 if(incoming)stageGuidance(campaign,incoming,now);
 if(active&&(!campaign.current_day||date>=campaign.current_day)){
  const guidance=campaign.accepted_briefs[date]??fallback(date);
  if(tasks.length+preparationNeeds(campaign,date,guidance.blocks)>5000){
   campaign.preparation_error='Panda needs space for the complete daily routine. The 5,000-task capacity has been reached; remove a task you no longer need, then Panda will prepare this day.';
   if(equal(campaign,state.campaign))return state;
   return {...state,tasks:state.tasks,campaign};
  }
  delete campaign.preparation_error;campaign.current_day=date;generalizeFallback(campaign,tasks,date);
  const bound=Object.values(campaign.owned).find(entry=>entry.slot==='project'&&entry.status==='pending')??Object.values(campaign.owned).find(entry=>entry.slot==='learning'&&entry.status==='pending');
  const boundTask=bound&&tasks.find(task=>task.id===bound.task_id),projectId=boundTask?.campaign.project_id??guidance.project_id;
  for(const block of guidance.blocks){
   const records=Object.values(campaign.owned).filter(entry=>entry.slot===block.slot);
   // A deleted slot stays deleted for this day, including when a coach revises it.
   if(records.some(entry=>entry.date===date&&entry.status==='deleted'))continue;
   let entry=records.find(entry=>entry.date===date&&entry.status!=='deleted');
   if(!entry&&!recurring.has(block.slot))entry=records.find(entry=>entry.status==='pending'&&entry.date<date);
   if(entry){
    const index=tasks.findIndex(task=>task.id===entry.task_id);if(index<0)continue;
    // Existing unfinished deliverables take their slot before a new work suggestion.
    const sameWork=entry.work_id===block.work_id;
    const chosen=sameWork?{...block,...(entry.slot==='learning'?{subject:entry.last_applied.subject}:{})}:{slot:entry.slot,work_id:entry.work_id,title:entry.last_applied.title,deliverable:entry.last_applied.deliverable,done_when:entry.last_applied.done_when,first_action:entry.last_applied.first_action,...(entry.last_applied.subject?{subject:entry.last_applied.subject}:{})};
    const updated=updateOwned(tasks[index],entry,chosen,date,['project','learning'].includes(entry.slot)?projectId:(sameWork?guidance.project_id:entry.last_applied.project_id));tasks[index]=updated.task;campaign.owned[entry.task_id]=updated.entry;
    continue;
   }
   if(Object.values(campaign.owned).some(entry=>entry.work_id===block.work_id&&(entry.completed||entry.status==='deleted')))continue;
   const binding=['project','learning'].includes(block.slot)?projectId:guidance.project_id;
   const task=newTask(block,date,binding,now,tasks);tasks.push(task);campaign.owned[task.id]=register(task,appliedFields(block,date,binding));
  }
  synchronize(campaign,tasks);
 }
 if(equal(campaign,state.campaign)&&tasks.length===state.tasks.length&&tasks.every((task,index)=>task===state.tasks[index]))return state;
 return {...state,tasks,campaign};
}
export function campaignTaskVisible(task,now=Date.now()){return task?.campaign?.campaign_id!==campaignId||!recurring.has(task.campaign.slot)||task.campaign.date===campaignDate(now);}
function briefSummary(campaign,date){const brief=campaign?.accepted_briefs?.[date];return brief?{source:'coach',date,revision:brief.revision,issued_at:brief.issued_at}:{source:'fallback',date,revision:null,issued_at:null};}
export function campaignProgress(state,now=Date.now(),appState='running'){
 const date=campaignDate(now),campaign=structuredClone(state.campaign??emptyCampaign());synchronize(campaign,state.tasks??[]);
 const tracker=state.trackers?.find(value=>value.id==='job-applications'),key=date.split('-').map(Number).join('-');let count=null;
 if(tracker){const raw=tracker.days?.[key]??0,mask=Number.isInteger(raw)&&raw>=0?raw&32767:0;count=0;for(let bit=0;bit<15;bit++)if(mask&(1<<bit))count++;}
 return {schema_version:1,campaign_id:campaignId,timezone,checked_at:new Date(milliseconds(now)).toISOString(),date,app_state:appState,brief:briefSummary(campaign,date),days:Object.keys(campaign.days).sort().map(key=>({date:key,tasks:campaign.days[key].tasks.map(snapshot)})),applications:{date,tracker_id:'job-applications',count,slots:15,source:tracker?'tracker':'unavailable'}};
}
export function campaignEntry(state,now=Date.now()){const date=campaignActive(now)?campaignDate(now):null;return {showHome:date!==null&&state.campaign?.home_seen_day!==date,date};}
export function campaignAcknowledgeHome(state,now=Date.now()){
 const {date,showHome}=campaignEntry(state,now);if(!showHome)return state;
 const prepared=reconcileCampaign(state,now);return {...prepared,campaign:{...prepared.campaign,home_seen_day:date}};
}
export function campaignNote(state,now=Date.now()){
 const date=campaignDate(now),active=campaignActive(now),brief=state.campaign?.accepted_briefs?.[date],routine=fallback(date);
 const savedGoal=Object.entries(state.campaign?.accepted_briefs??{}).filter(([day,value])=>day<=date&&value.goal).sort(([a],[b])=>b.localeCompare(a))[0]?.[1]?.goal;
 if(date<firstDay)return {date,active:false,source:state.campaign?.staged_brief?'coach':'fallback',opening:state.campaign?.staged_brief?.opening??'One block at a time.',main_focus:state.campaign?.staged_brief?.main_focus??routine.main_focus,goal:state.campaign?.staged_brief?.goal??goal,brief:structuredClone(state.campaign?.staged_brief??fallback(firstDay)),freshness:'upcoming'};
 if(date>lastDay)return {date,active:false,source:'fallback',opening:'The November campaign has concluded. Your saved work and progress are still here.',main_focus:'Review the work you completed and choose the next step with your coach.',goal,freshness:'concluded'};
 return {date,active,source:brief?'coach':'fallback',opening:brief?.opening??routine.opening,main_focus:brief?.main_focus??routine.main_focus,goal:brief?.goal??savedGoal??goal,brief:structuredClone(brief??routine),freshness:state.campaign?.preparation_error?'blocked':brief?'current':'fallback',...(state.campaign?.preparation_error?{preparation_error:state.campaign.preparation_error}:{})};
}
export function campaignSetEvidence(state,taskId,evidence,now=Date.now()){
 const normalized=normalizeEvidence(evidence),task=state.tasks.find(task=>task.id===taskId&&task.campaign?.campaign_id===campaignId);
 if(!task||equal(task.campaign.evidence,normalized))return state;
 const updated={...state,tasks:state.tasks.map(value=>value===task?{...task,campaign:{...task.campaign,evidence:normalized}}:value)};return reconcileCampaign(updated,now);
}
function validSnapshot(value){return record(value)&&cleanText(value.task_id,2500)&&slots.includes(value.slot)&&cleanText(value.work_id,200)&&cleanText(value.title,500)&&['pending','done','deleted'].includes(value.status)&&(value.carried_from===null||campaignDay(value.carried_from))&&((value.start===null&&value.end===null)||(timestamp(value.start)&&timestamp(value.end)&&Date.parse(value.end)>Date.parse(value.start)))&&validEvidence(value.evidence);}
export function validCampaignState(value){
 try{
  if(!record(value)||value.schema_version!==1||value.campaign_id!==campaignId||value.timezone!==timezone||(value.current_day!==null&&!campaignDay(value.current_day))||(value.home_seen_day!==null&&!campaignDay(value.home_seen_day))||!record(value.accepted_briefs)||!record(value.days)||!record(value.owned)||Object.keys(value.accepted_briefs).length>30||Object.keys(value.days).length>30||Object.keys(value.owned).length>180)return false;
  if(value.preparation_error!==undefined&&!cleanText(value.preparation_error,500))return false;
  for(const [date,brief] of Object.entries(value.accepted_briefs))if(!campaignDay(date)||brief.date!==date||!equal(normalizeBrief(brief,0,{allowPast:true,checkIssued:false}),brief))return false;
  if(value.staged_brief!==null&&!equal(normalizeBrief(value.staged_brief,0,{allowPast:true,checkIssued:false}),value.staged_brief))return false;
  for(const [date,day] of Object.entries(value.days))if(!campaignDay(date)||!record(day)||day.date!==date||!Array.isArray(day.tasks)||day.tasks.length>6||day.tasks.some(task=>!validSnapshot(task))||new Set(day.tasks.map(task=>task.slot)).size!==day.tasks.length)return false;
  for(const [id,entry] of Object.entries(value.owned)){
   const applied=entry.last_applied;
   if(!validSnapshot(entry)||id!==entry.task_id||!campaignDay(entry.date)||typeof entry.completed!=='boolean'||!record(applied)||!cleanText(applied.title,500)||!validTime(applied.plannedTime)||!cleanText(applied.deliverable)||!cleanText(applied.done_when)||!cleanText(applied.first_action,2000)||!cleanText(applied.project_id,200)||(entry.slot==='learning'?!cleanText(applied.subject,200):applied.subject!==undefined))return false;
  }
  return true;
 }catch{return false;}
}
