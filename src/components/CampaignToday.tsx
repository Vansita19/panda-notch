import {useId,useState} from 'react';
import {ArrowUpRight,ChevronDown,Plus,X} from 'lucide-react';
import {campaignNote} from '../campaign.mjs';
import './campaign-today.css';

type Evidence={ref:string;self_review:string};
const times:Record<string,string>={applications:'7–10 AM',visibility:'11 AM–12 PM',portfolio:'12–2 PM',project:'3–5 PM',learning:'5:30–8 PM',interview:'8–10 PM'};
const dayLabel=(date:string)=>new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-GB',{day:'numeric',month:'long',weekday:'long',timeZone:'Asia/Kolkata'});

export function CampaignEvidence({task,onSave}:{task:any;onSave:(id:string,evidence:Evidence[])=>boolean}){
 const prefix=useId(),[entries,setEntries]=useState<Evidence[]>(()=>task.campaign.evidence.length?structuredClone(task.campaign.evidence):[{ref:'',self_review:''}]),[saved,setSaved]=useState(false);
 const update=(index:number,field:keyof Evidence,value:string)=>{setSaved(false);setEntries(old=>old.map((entry,i)=>i===index?{...entry,[field]:value}:entry));};
 return <details className="campaign-evidence"><summary>Review or reference <ChevronDown size={11} aria-hidden="true"/></summary><form onSubmit={event=>{event.preventDefault();if(onSave(task.id,entries.filter(entry=>entry.ref.trim()||entry.self_review.trim())))setSaved(true);}}>
  <p>Optional. Add a link or file path and your own review. Files aren’t opened or uploaded.</p>
  {entries.map((entry,index)=><fieldset key={index}><legend>Reference {index+1}</legend><label htmlFor={`${prefix}-ref-${index}`}>HTTPS link or full file path</label><input id={`${prefix}-ref-${index}`} type="text" maxLength={4000} value={entry.ref} onChange={event=>update(index,'ref',event.target.value)}/><label htmlFor={`${prefix}-review-${index}`}>Self-review</label><textarea id={`${prefix}-review-${index}`} rows={3} maxLength={2000} value={entry.self_review} onChange={event=>update(index,'self_review',event.target.value)}/>{entries.length>1&&<button type="button" className="campaign-text-button" onClick={()=>{setEntries(old=>old.filter((_,i)=>i!==index));setSaved(false);}}><X size={11}/> Remove reference {index+1}</button>}</fieldset>)}
  <div className="campaign-review-actions">{entries.length<3&&<button type="button" className="campaign-text-button" onClick={()=>{setEntries(old=>[...old,{ref:'',self_review:''}]);setSaved(false);}}><Plus size={11}/> Add reference</button>}<button type="submit" className="campaign-review-save">Save review</button><span role="status">{saved?'Review saved':''}</span></div>
 </form></details>;
}

export function CampaignDailyBrief({state,note,onSaveEvidence}:{state:any;note:any;onSaveEvidence:(id:string,evidence:Evidence[])=>boolean}){
 if(!note.brief)return null;
 const preview=!note.active,brief=note.brief;
 return <details className="campaign-daily-brief"><summary>{preview?'Preview routine':'Daily brief'} <ChevronDown size={12} aria-hidden="true"/></summary><div className="campaign-blocks">
  {preview&&<p className="campaign-preview-label">{dayLabel(brief.date)} · Tasks activate on this date.</p>}
  {brief.blocks.map((block:any)=>{
   const task=state.tasks.find((item:any)=>item.campaign?.date===note.date&&item.campaign?.slot===block.slot),owned=Object.values(state.campaign?.owned??{}).find((item:any)=>item.work_id===block.work_id) as any;
   const content=task?.campaign??block,title=task?.title??block.title,status=task?(task.done?'done':'pending'):owned?.status;
   return <article className="campaign-block" key={block.slot}><header><h3>{title}</h3><span>{times[block.slot]}</span></header>{!preview&&status&&<span className="campaign-block-status">{status==='done'?'Done':status==='deleted'?'Removed':task?.campaign.carried_from?'Continuing work':'Pending'}</span>}{content.subject&&<p className="campaign-subject">{content.subject} · same project</p>}<p>{content.deliverable}</p><dl><dt>Done when</dt><dd>{content.done_when}</dd><dt>First action</dt><dd>{content.first_action}</dd></dl>{task&&<CampaignEvidence key={task.id} task={task} onSave={onSaveEvidence}/>}</article>;
  })}
 </div></details>;
}

export function CampaignToday({state,now,onOpenTasks,onSaveEvidence,bridgeMessage=''}:{state:any;now:number;onOpenTasks:()=>void;onSaveEvidence:(id:string,evidence:Evidence[])=>boolean;bridgeMessage?:string}){
 const note:any=campaignNote(state,now),upcoming=note.freshness==='upcoming';
 if(note.freshness==='concluded')return null;
 return <section className="campaign-today" aria-label="Today’s campaign note">
  <header><h2>{upcoming?'Starts 1 November':'Today'}</h2><time dateTime={note.date}>{dayLabel(note.date)}</time></header>
  <p className="campaign-opening">{note.opening}</p><strong className="campaign-main-focus">{note.main_focus}</strong>
  <p className="campaign-goal"><span>Working toward</span> {note.goal}</p>
  <div className="campaign-note-footer"><span className="campaign-freshness">{upcoming?(note.source==='coach'?'First brief prepared':'Routine preview'):note.source==='coach'?'Today’s guidance':'Built-in routine · awaiting today’s guidance'}</span>{note.active&&<button type="button" onClick={onOpenTasks}>Open today’s tasks <ArrowUpRight size={12}/></button>}</div>
  {note.preparation_error&&<p className="campaign-bridge-message" role="status">{note.preparation_error}</p>}{bridgeMessage&&<p className="campaign-bridge-message" role="status">{bridgeMessage}</p>}
  <CampaignDailyBrief key={`${note.date}-${note.brief?.date}`} state={state} note={note} onSaveEvidence={onSaveEvidence}/>
 </section>;
}
