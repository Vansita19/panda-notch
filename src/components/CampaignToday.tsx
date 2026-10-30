import {useId,useState} from 'react';
import {ArrowUpRight,ChevronDown,Plus,X} from 'lucide-react';
import {campaignNote} from '../campaign.mjs';
import './campaign-today.css';

type Evidence={ref:string;self_review:string};
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

export function CampaignToday({state,now,onOpenTasks,bridgeMessage=''}:{state:any;now:number;onOpenTasks:()=>void;bridgeMessage?:string}){
 const note:any=campaignNote(state,now),text=note.opening.replace(/\s+/g,' ').trim(),sentence=text.match(/^.+?[.!?](?:\s|$)/)?.[0].trim()??text;
 const opening=sentence.length<=160?sentence:'One block at a time.';
 if(note.freshness==='concluded')return null;
 return <section className="campaign-today" aria-label="Today’s campaign note">
  <header><h2>Today</h2><time dateTime={note.date}>{dayLabel(note.date)}</time></header>
  <p className="campaign-opening">{opening}</p>
  {note.active&&<div className="campaign-note-footer"><button type="button" onClick={onOpenTasks}>Open today’s tasks <ArrowUpRight size={12}/></button></div>}
  {note.preparation_error&&<p className="campaign-bridge-message" role="status">{note.preparation_error}</p>}{bridgeMessage&&<p className="campaign-bridge-message" role="status">{bridgeMessage}</p>}
 </section>;
}
