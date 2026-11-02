import {useId,useState} from 'react';
import {ChevronDown,Plus,X} from 'lucide-react';
import './campaign-today.css';

type Evidence={ref:string;self_review:string};

export function CampaignEvidence({task,onSave}:{task:any;onSave:(id:string,evidence:Evidence[])=>boolean}){
 const prefix=useId(),[entries,setEntries]=useState<Evidence[]>(()=>task.campaign.evidence.length?structuredClone(task.campaign.evidence):[{ref:'',self_review:''}]),[saved,setSaved]=useState(false);
 const update=(index:number,field:keyof Evidence,value:string)=>{setSaved(false);setEntries(old=>old.map((entry,i)=>i===index?{...entry,[field]:value}:entry));};
 return <details className="campaign-evidence"><summary>Review or reference <ChevronDown size={11} aria-hidden="true"/></summary><form onSubmit={event=>{event.preventDefault();if(onSave(task.id,entries.filter(entry=>entry.ref.trim()||entry.self_review.trim())))setSaved(true);}}>
  <p>Optional. Add a link or file path and your own review. Files aren’t opened or uploaded.</p>
  {entries.map((entry,index)=><fieldset key={index}><legend>Reference {index+1}</legend><label htmlFor={`${prefix}-ref-${index}`}>HTTPS link or full file path</label><input id={`${prefix}-ref-${index}`} type="text" maxLength={4000} value={entry.ref} onChange={event=>update(index,'ref',event.target.value)}/><label htmlFor={`${prefix}-review-${index}`}>Self-review</label><textarea id={`${prefix}-review-${index}`} rows={3} maxLength={2000} value={entry.self_review} onChange={event=>update(index,'self_review',event.target.value)}/>{entries.length>1&&<button type="button" className="campaign-text-button" onClick={()=>{setEntries(old=>old.filter((_,i)=>i!==index));setSaved(false);}}><X size={11}/> Remove reference {index+1}</button>}</fieldset>)}
  <div className="campaign-review-actions">{entries.length<3&&<button type="button" className="campaign-text-button" onClick={()=>{setEntries(old=>[...old,{ref:'',self_review:''}]);setSaved(false);}}><Plus size={11}/> Add reference</button>}<button type="submit" className="campaign-review-save">Save review</button><span role="status">{saved?'Review saved':''}</span></div>
 </form></details>;
}
