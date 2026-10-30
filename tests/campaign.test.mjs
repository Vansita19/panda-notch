import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignDate,campaignActive,validateCampaignBrief,reconcileCampaign,campaignProgress,campaignEntry,campaignAcknowledgeHome,campaignNote,campaignSetEvidence,campaignTaskVisible,validCampaignState,validCampaignTaskMetadata} from '../src/campaign.mjs';

const at=date=>Date.parse(`${date}T06:00:00+05:30`);
const day1=at('2026-11-01'),day2=at('2026-11-02');
const slots=['applications','visibility','portfolio','project','learning','interview'];
const titles=['15 company applications','Creative idea + post','Portfolio improvement','Main brand/website project','Applied learning','Interview readiness'];
const work=['applications:2026-11-01','visibility:2026-11-01','portfolio-case-opening','website-project-brief','learning-brand-direction','interview-baseline-case'];
const brief=(date='2026-11-01',revision=1)=>({schema_version:1,campaign_id:'november-2026',timezone:'Asia/Kolkata',date,revision,issued_at:'2026-10-30T16:00:00Z',opening:'Start with one clear step.',main_focus:'Build clear proof and apply.',project_id:'brand-website-main',blocks:slots.map((slot,i)=>({slot,work_id:work[i],title:titles[i],deliverable:`Deliver ${slot}.`,done_when:`Finish ${slot}.`,first_action:`Open ${slot}.`,...(slot==='learning'?{subject:'Brand identity'}:{})}))});
const manual={id:'manual-task',title:'Keep my task',section:'later',done:false,pinned:true,created:1,due:null};
const fresh=()=>({version:1,tasks:[manual],events:[{id:'private-calendar',title:'Private calendar entry',start:1,end:2}],notes:[{body:'private-note'}],pins:[{title:'private-pin'}],timer:{seconds:1433},settings:{quiet:true},trackers:[{id:'job-applications',title:'Renamed habit',slots:15,days:{'2026-11-1':16389}}],nativeData:{keep:'private-native'}});
const task=(state,slot)=>state.tasks.find(t=>t.campaign?.slot===slot&&t.campaign.date===state.campaign.current_day);
const exported=(state,date='2026-11-01')=>campaignProgress(state,at(date)).days.find(d=>d.date===date)?.tasks;

test('campaign boundaries use midnight in IST regardless of the host timezone',()=>{
 for(const [iso,date,active] of [['2026-10-31T18:29:59.999Z','2026-10-31',false],['2026-10-31T18:30:00.000Z','2026-11-01',true],['2026-11-30T18:29:59.999Z','2026-11-30',true],['2026-11-30T18:30:00.000Z','2026-12-01',false]]){assert.equal(campaignDate(Date.parse(iso)),date);assert.equal(campaignActive(Date.parse(iso)),active);}
 assert.throws(()=>campaignDate(NaN));
});
test('brief validation normalizes recurring identities and binds all work to one project',()=>{
 const raw=brief();raw.opening='  Start gently.  ';raw.blocks[0].title='Other recurring title';raw.blocks[0].work_id='wrong-date';
 const normalized=validateCampaignBrief(raw,day1);assert.equal(normalized.opening,'Start gently.');assert.equal(normalized.blocks[0].title,'15 company applications');assert.equal(normalized.blocks[0].work_id,'applications:2026-11-01');assert.equal(normalized.blocks[1].title,'Creative idea + post');assert.equal(normalized.blocks[1].work_id,'visibility:2026-11-01');assert.equal(normalized.project_id,'brand-website-main');assert.equal(raw.opening,'  Start gently.  ');
});
test('malformed, wrong campaign, stale and future-issued guidance is rejected',()=>{
 const mutations=[b=>b.schema_version=2,b=>b.campaign_id='other',b=>b.timezone='UTC',b=>b.date='2026-11-1',b=>b.date='2026-11-31',b=>b.date='2026-12-01',b=>b.date='2026-10-31',b=>b.revision=0,b=>b.revision=1.5,b=>b.issued_at='tomorrow',b=>b.issued_at='2026-11-01T00:36:00Z',b=>b.opening='',b=>b.main_focus=42,b=>b.project_id='',b=>b.blocks.pop(),b=>b.blocks[5].slot='project',b=>delete b.blocks[4].subject,b=>b.blocks[2].done_when='',b=>b.blocks[3].work_id=b.blocks[2].work_id,b=>b.blocks[0].deliverable='x'.repeat(4001)];
 for(const mutate of mutations){const b=brief();mutate(b);assert.throws(()=>validateCampaignBrief(b,day1));}
 assert.throws(()=>validateCampaignBrief(brief('2026-11-01'),day2));
 assert.equal(validateCampaignBrief({...brief(),issued_at:'2026-11-01T00:35:00Z'},day1).revision,1);
});
test('reconciliation adds six real tasks and local IST blocks without touching unrelated data',()=>{
 const input=fresh(),before=structuredClone(input),state=reconcileCampaign(input,day1);
 assert.deepEqual(input,before);assert.equal(state.tasks.length,7);assert.strictEqual(state.tasks[0],manual);
 for(const key of ['events','notes','pins','timer','settings','trackers','nativeData'])assert.strictEqual(state[key],input[key]);
 const applications=task(state,'applications');assert.equal(applications.title,'15 company applications');assert.deepEqual(applications.plannedTime,{start:Date.parse('2026-11-01T01:30:00Z'),end:Date.parse('2026-11-01T04:30:00Z'),timezone:'Asia/Kolkata'});assert.equal(applications.calendarLink,undefined);
 assert.deepEqual(slots.map(slot=>task(state,slot)?.campaign.slot),slots);
 assert.equal(task(state,'learning').campaign.project_id,task(state,'project').campaign.project_id);assert.ok(task(state,'learning').campaign.subject);
 assert.strictEqual(reconcileCampaign(state,day1),state);assert.strictEqual(reconcileCampaign(state,day1+60000),state);
 assert.equal(validCampaignState(state.campaign),true);for(const t of state.tasks.slice(1))assert.equal(validCampaignTaskMetadata(t),true);
});
test('coach revisions update untouched content while title, timing and deliverable edits persist',()=>{
 let state=reconcileCampaign(fresh(),day1,brief());const original=task(state,'project'),customTime={start:day1+2e6,end:day1+3e6,timezone:'Asia/Kolkata'};
 state={...state,tasks:state.tasks.map(t=>t.id===original.id?{...t,title:'My project title',plannedTime:customTime,campaign:{...t.campaign,deliverable:'My bounded deliverable'}}:t)};
 const revised=brief('2026-11-01',2);revised.blocks[3].title='Coach revised project';revised.blocks[3].deliverable='Coach revised deliverable';revised.blocks[2].deliverable='A better case study opening';
 state=reconcileCampaign(state,day1+60000,revised);assert.equal(task(state,'project').title,'My project title');assert.deepEqual(task(state,'project').plannedTime,customTime);assert.equal(task(state,'project').campaign.deliverable,'My bounded deliverable');assert.equal(task(state,'portfolio').campaign.deliverable,'A better case study opening');
 const unchanged=reconcileCampaign(state,day1+120000,revised);assert.strictEqual(unchanged,state);assert.equal(campaignNote(state,day1).brief.revision,2);
 const removedTime={...state,tasks:state.tasks.map(t=>t.id===original.id?{...t,plannedTime:null}:t)};state=reconcileCampaign(removedTime,day1+180000);assert.equal(task(state,'project').plannedTime,null);
});
test('stale, invalid and rolled-back revisions cannot replace accepted guidance',()=>{
 let state=reconcileCampaign(fresh(),day1,brief('2026-11-01',3));
 for(const b of [brief('2026-11-01',1),brief('2026-11-01',3),{...brief('2026-11-01',4),blocks:[]},{...brief('2026-11-01',4),issued_at:'2026-11-02T00:00:00Z'}]){b.opening='Do not apply this';assert.strictEqual(reconcileCampaign(state,day1,b),state);}
 state=reconcileCampaign(state,day2,brief('2026-11-01',20));assert.equal(campaignNote(state,day2).source,'fallback');assert.equal(campaignNote(state,day2).freshness,'fallback');assert.equal(campaignProgress(state,day2).brief.revision,null);
});
test('a future brief stays staged until its date and never displaces today’s note',()=>{
 const future=brief('2026-11-02',2);future.opening='Tomorrow guidance';let state=reconcileCampaign(fresh(),day1,brief());state=reconcileCampaign(state,day1,future);assert.equal(campaignNote(state,day1).opening,'Start with one clear step.');
 assert.equal(task(state,'applications').campaign.date,'2026-11-01');state=reconcileCampaign(JSON.parse(JSON.stringify(state)),day2);assert.equal(campaignNote(state,day2).opening,'Tomorrow guidance');assert.equal(campaignProgress(state,day2).brief.revision,2);
});
test('unfinished continuing work advances with its task identity and a frozen prior-day snapshot',()=>{
 let state=reconcileCampaign(fresh(),day1,brief());const id=task(state,'project').id,workId=task(state,'project').campaign.work_id,previousStart=task(state,'project').plannedTime.start;
 const next=brief('2026-11-02');next.blocks[3].work_id='new-project';next.blocks[3].deliverable='Must wait for carryover';state=reconcileCampaign(state,day2,next);
 const carried=task(state,'project');assert.equal(carried.id,id);assert.equal(carried.campaign.work_id,workId);assert.notEqual(carried.campaign.deliverable,'Must wait for carryover');assert.equal(carried.plannedTime.start,Date.parse('2026-11-02T09:30:00Z'));assert.equal(carried.campaign.carried_from,'2026-11-01');
 const old=exported(state)[3];assert.equal(old.task_id,id);assert.equal(old.status,'pending');assert.equal(old.start,new Date(previousStart).toISOString());
 const edited={...state,tasks:state.tasks.map(t=>t.id===id?{...t,done:true,completedDay:'2026-11-2'}:t)};state=reconcileCampaign(edited,day2);assert.equal(exported(state)[3].status,'pending');assert.equal(exported(state,'2026-11-02')[3].status,'done');
});
test('completed fallback work waits for a genuinely new coach identity',()=>{
 let state=reconcileCampaign(fresh(),day1);const project=task(state,'project');state={...state,tasks:state.tasks.map(t=>t.id===project.id?{...t,done:true,completedDay:'2026-11-1'}:t)};state=reconcileCampaign(state,day1);state=reconcileCampaign(state,day2);assert.equal(task(state,'project'),undefined);assert.equal(state.tasks.filter(t=>t.id===project.id).length,1);assert.equal(state.tasks.find(t=>t.id===project.id).done,true);
 const next=brief('2026-11-02');next.blocks[3].work_id='genuinely-next-project';state=reconcileCampaign(state,day2,next);assert.equal(task(state,'project').campaign.work_id,'genuinely-next-project');assert.equal(task(state,'project').done,false);
});
test('explicit deletions survive polling, restart, revisions and recurring day changes',()=>{
 let state=reconcileCampaign(fresh(),day1,brief());const project=task(state,'project'),applications=task(state,'applications');state={...state,tasks:state.tasks.filter(t=>![project.id,applications.id].includes(t.id))};state=reconcileCampaign(state,day1);
 assert.equal(exported(state).find(t=>t.task_id===project.id).status,'deleted');assert.equal(exported(state).find(t=>t.task_id===applications.id).status,'deleted');assert.equal(task(state,'project'),undefined);assert.strictEqual(reconcileCampaign(state,day1,brief()),state);
 const revised=brief('2026-11-01',2);revised.blocks[3].work_id='replacement-same-day';state=reconcileCampaign(JSON.parse(JSON.stringify(state)),day1,revised);assert.equal(task(state,'project'),undefined);assert.equal(task(state,'applications'),undefined);
 state=reconcileCampaign(state,day2);assert.equal(task(state,'project'),undefined);assert.ok(task(state,'applications'));assert.notEqual(task(state,'applications').id,applications.id);assert.equal(state.tasks[0].id,'manual-task');
});
test('recurrences are dated while missed offline days never accumulate',()=>{
 let state=reconcileCampaign(fresh(),day1);const first=task(state,'applications');state=reconcileCampaign(state,at('2026-11-20'));
 assert.equal(state.tasks.filter(t=>t.campaign?.slot==='applications').length,2);assert.equal(state.tasks.filter(t=>t.campaign?.date==='2026-11-20').length,6);assert.equal(campaignTaskVisible(first,at('2026-11-20')),false);assert.equal(campaignTaskVisible(manual,at('2026-11-20')),true);
 assert.deepEqual(campaignProgress(state,at('2026-11-20')).days.map(d=>d.date),['2026-11-01','2026-11-20']);
});
test('thirty days produce bounded recurrences and no task outside the campaign',()=>{
 const original=fresh();assert.strictEqual(reconcileCampaign(original,at('2026-10-31')),original);let state=original;
 for(let day=1;day<=30;day++)state=reconcileCampaign(state,at(`2026-11-${String(day).padStart(2,'0')}`));assert.equal(state.tasks.length,65);assert.equal(campaignProgress(state,at('2026-11-30')).days.length,30);
 const after=reconcileCampaign(state,at('2026-12-01'));assert.strictEqual(after,state);assert.equal(campaignActive(at('2026-12-01')),false);assert.equal(campaignTaskVisible(task(state,'applications'),at('2026-12-01')),false);
});
test('only explicitly supplied evidence references are exported and bad evidence leaves state intact',()=>{
 let state=reconcileCampaign(fresh(),day1);const id=task(state,'interview').id;const evidence=[{ref:'/Users/me/Practice.mov',self_review:'I rushed the decision.'},{ref:'https://example.com/my-case',self_review:'Clearer second attempt.'}];const before=structuredClone(state);state=campaignSetEvidence(state,id,evidence,day1);
 assert.deepEqual(exported(state).find(t=>t.task_id===id).evidence,evidence);assert.deepEqual(before.tasks.find(t=>t.id===id).campaign.evidence,[]);assert.strictEqual(campaignSetEvidence(state,id,evidence,day1),state);
 for(const value of [[{ref:'relative.mov',self_review:'review'}],[{ref:'javascript:alert(1)',self_review:'review'}],[{ref:'http://example.com',self_review:'review'}],[{ref:'/tmp/a',self_review:42}],Array.from({length:4},()=>({ref:'/tmp/a',self_review:'r'})),[{ref:'/tmp/a',self_review:'r',secret:'do not export'}]])assert.throws(()=>campaignSetEvidence(state,id,value,day1));
 assert.strictEqual(campaignSetEvidence(state,'manual-task',[],day1),state);assert.strictEqual(campaignSetEvidence(state,'missing',[],day1),state);
});
test('progress obeys the exact private bridge contract and uses the existing tracker id',()=>{
 const state=reconcileCampaign(fresh(),day1,brief());const progress=campaignProgress(state,day1,'closing');
 assert.deepEqual(Object.keys(progress).sort(),['schema_version','campaign_id','timezone','checked_at','date','app_state','brief','days','applications'].sort());assert.equal(progress.checked_at,'2026-11-01T00:30:00.000Z');assert.equal(progress.app_state,'closing');assert.deepEqual(progress.brief,{source:'coach',date:'2026-11-01',revision:1,issued_at:'2026-10-30T16:00:00Z'});
 assert.deepEqual(progress.applications,{date:'2026-11-01',tracker_id:'job-applications',count:3,slots:15,source:'tracker'});assert.deepEqual(Object.keys(progress.days[0].tasks[0]).sort(),['task_id','slot','work_id','title','status','carried_from','start','end','evidence'].sort());
 for(const privateText of ['manual-task','private-calendar','private-note','private-pin','private-native'])assert.equal(JSON.stringify(progress).includes(privateText),false);
 assert.deepEqual(campaignProgress({...state,trackers:[{id:'other',title:'Job applications',days:{'2026-11-1':32767}}]},day1).applications,{date:'2026-11-01',tracker_id:'job-applications',count:null,slots:15,source:'unavailable'});
});
test('progress can reflect latest user changes without mutating or requiring a polling save',()=>{
 let state=reconcileCampaign(fresh(),day1);const project=task(state,'project');state={...state,tasks:state.tasks.map(t=>t.id===project.id?{...t,done:true,title:'Latest user title'}:t)};const before=structuredClone(state),p=campaignProgress(state,day1);
 assert.equal(p.days[0].tasks.find(t=>t.task_id===project.id).status,'done');assert.equal(p.days[0].tasks.find(t=>t.task_id===project.id).title,'Latest user title');assert.deepEqual(state,before);
});
test('campaign home is entered once per actual IST campaign day with honest preview and conclusion',()=>{
 const preview=fresh();assert.deepEqual(campaignEntry(preview,at('2026-10-31')),{showHome:false,date:null});assert.match(campaignNote(preview,at('2026-10-31')).opening,/November 1|Nov(?:ember)?\.? 1/);assert.equal(campaignNote(preview,at('2026-10-31')).active,false);
 let state=reconcileCampaign(preview,day1);assert.deepEqual(campaignEntry(state,day1),{showHome:true,date:'2026-11-01'});state=campaignAcknowledgeHome(state,day1);assert.deepEqual(campaignEntry(state,day1),{showHome:false,date:'2026-11-01'});assert.strictEqual(campaignAcknowledgeHome(state,day1),state);assert.equal(campaignEntry(state,day2).showHome,true);
 const note=campaignNote(state,day1);assert.equal(note.source,'fallback');assert.equal(note.freshness,'fallback');assert.match(note.goal,/Stable paid work/);assert.equal(note.active,true);assert.match(campaignNote(state,at('2026-12-01')).opening,/concluded|ended|complete/i);assert.deepEqual(campaignEntry(state,at('2026-12-01')),{showHome:false,date:null});
});
test('persisted campaign and task validation rejects malformed ownership and private payloads',()=>{
 const state=reconcileCampaign(fresh(),day1),owned=task(state,'project');assert.equal(validCampaignState(null),false);assert.equal(validCampaignState({...state.campaign,current_day:'2026-11-31'}),false);assert.equal(validCampaignTaskMetadata({...owned,campaign:{...owned.campaign,slot:'other'}}),false);assert.equal(validCampaignTaskMetadata({...owned,plannedTime:{start:2,end:1,timezone:'Asia/Kolkata'}}),false);
 assert.equal(validCampaignTaskMetadata({...owned,campaign:{...owned.campaign,evidence:[{ref:'/tmp/a',self_review:'fine',secret:'hidden'}]}}),false);
 const restored=JSON.parse(JSON.stringify(state));assert.equal(validCampaignState(restored.campaign),true);assert.strictEqual(reconcileCampaign(restored,day1),restored);
});

test('carried work enters its matching next-day block while edited content stays intact',()=>{
 let state=reconcileCampaign(fresh(),day1);const project=task(state,'project');state={...state,tasks:state.tasks.map(t=>t.id===project.id?{...t,title:'My project',plannedTime:null,campaign:{...t.campaign,first_action:'My first action'}}:t)};
 state=reconcileCampaign(state,day1);assert.equal(task(state,'project').plannedTime,null);state=reconcileCampaign(state,day2);assert.equal(task(state,'project').plannedTime.start,Date.parse('2026-11-02T09:30:00Z'));assert.equal(task(state,'project').title,'My project');assert.equal(task(state,'project').campaign.first_action,'My first action');
});
test('a new learning item binds to the carried project rather than switching the project underneath it',()=>{
 let state=reconcileCampaign(fresh(),day1,brief());const learning=task(state,'learning');state={...state,tasks:state.tasks.map(t=>t.id===learning.id?{...t,done:true}:t)};state=reconcileCampaign(state,day1);
 const next=brief('2026-11-02');next.project_id='unrelated-new-project';next.blocks[3].work_id='new-project-must-wait';next.blocks[4].work_id='new-learning-item';next.blocks[4].subject='Website navigation';state=reconcileCampaign(state,day2,next);
 assert.equal(task(state,'project').campaign.project_id,'brand-website-main');assert.equal(task(state,'learning').campaign.project_id,'brand-website-main');assert.equal(task(state,'learning').campaign.subject,'Website navigation');
});
test('unfinished applied learning retains its one subject when a new brief suggests a different item',()=>{
 let state=reconcileCampaign(fresh(),day1,brief());const id=task(state,'learning').id,next=brief('2026-11-02');next.blocks[4].work_id='new-learning';next.blocks[4].subject='Motion design';state=reconcileCampaign(state,day2,next);assert.equal(task(state,'learning').id,id);assert.equal(task(state,'learning').campaign.subject,'Brand identity');
});
test('undoing a task deletion restores the actual task without duplicating its work',()=>{
 let state=reconcileCampaign(fresh(),day1);const project=task(state,'project');state=reconcileCampaign({...state,tasks:state.tasks.filter(t=>t.id!==project.id)},day1);state=reconcileCampaign({...state,tasks:[...state.tasks,project]},day1);assert.equal(task(state,'project').id,project.id);assert.equal(exported(state).find(t=>t.task_id===project.id).status,'pending');assert.equal(state.tasks.filter(t=>t.id===project.id).length,1);
});
test('preparing a brief before November creates no early tasks and reconsidering it opens the right day',()=>{
 let state=reconcileCampaign(fresh(),at('2026-10-31'),brief());assert.equal(state.tasks.length,1);assert.equal(campaignNote(state,at('2026-10-30')).active,false);state=reconcileCampaign(state,day1);assert.equal(state.tasks.length,7);assert.equal(campaignNote(state,day1).source,'coach');
});
test('clock rollback cannot generate earlier recurring tasks after an observed later day',()=>{
 let state=reconcileCampaign(fresh(),at('2026-11-20'));const count=state.tasks.length;state=reconcileCampaign(state,day1,brief());assert.equal(state.tasks.length,count);assert.deepEqual(campaignProgress(state,day1).days.map(d=>d.date),['2026-11-20']);
});
test('invalid out-of-range planned timestamps cannot pass metadata validation and crash progress',()=>{
 const state=reconcileCampaign(fresh(),day1),project=task(state,'project');assert.equal(validCampaignTaskMetadata({...project,plannedTime:{start:1e100,end:2e100,timezone:'Asia/Kolkata'}}),false);
});

test('a brief revision cannot switch the subject of an unfinished learning work ID',()=>{
 let state=reconcileCampaign(fresh(),day1,brief()),next=brief('2026-11-01',2);next.blocks[4].subject='Unrelated new subject';state=reconcileCampaign(state,day1,next);assert.equal(task(state,'learning').campaign.subject,'Brand identity');
});

test('campaign task IDs are persistent ordinary UUIDs compatible with Calendar task ownership',()=>{
 const state=reconcileCampaign(fresh(),day1);for(const task of state.tasks.filter(t=>t.campaign))assert.match(task.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
 assert.strictEqual(reconcileCampaign(state,day1),state);const restored=JSON.parse(JSON.stringify(state));assert.strictEqual(reconcileCampaign(restored,day1),restored);
});
test('campaign preparation is atomic at the whole-app task capacity and resumes when space is free',()=>{
 const input={...fresh(),tasks:Array.from({length:4995},(_,i)=>({...manual,id:`manual-${i}`}))},before=structuredClone(input);let state=reconcileCampaign(input,day1);
 assert.deepEqual(input,before);assert.equal(state.tasks.length,4995);assert.deepEqual(state.tasks,input.tasks);assert.equal(state.campaign.current_day,null);assert.equal(validCampaignState(state.campaign),true);assert.equal(campaignNote(state,day1).freshness,'blocked');assert.match(campaignNote(state,day1).preparation_error,/space|capacity|5,000/i);assert.strictEqual(reconcileCampaign(state,day1),state);
 state=reconcileCampaign({...state,tasks:state.tasks.slice(1)},day1);assert.equal(state.tasks.length,5000);assert.equal(state.tasks.filter(t=>t.campaign).length,6);assert.equal(campaignNote(state,day1).preparation_error,undefined);assert.equal(campaignNote(state,day1).freshness,'fallback');assert.equal(validCampaignState(state.campaign),true);
});
test('UUID collisions retry without claiming or removing the existing task',t=>{
 const collision='cbdff9b0-3c53-4bb3-90b2-0f1234567890',ids=['cbdff9b0-3c53-4bb3-90b2-0f1234567891','cbdff9b0-3c53-4bb3-90b2-0f1234567892','cbdff9b0-3c53-4bb3-90b2-0f1234567893','cbdff9b0-3c53-4bb3-90b2-0f1234567894','cbdff9b0-3c53-4bb3-90b2-0f1234567895','cbdff9b0-3c53-4bb3-90b2-0f1234567896'];let calls=0;
 t.mock.method(globalThis.crypto,'randomUUID',()=>calls++===0?collision:ids[calls-2]);const existing={...manual,id:collision},state=reconcileCampaign({...fresh(),tasks:[existing]},day1);assert.strictEqual(state.tasks[0],existing);assert.deepEqual(state.tasks.slice(1).map(t=>t.id),ids);assert.equal(new Set(state.tasks.map(t=>t.id)).size,7);
});

test('the note exposes an honest six-block built-in preview and active fallback brief without creating early tasks',()=>{
 const preview=campaignNote(fresh(),at('2026-10-31'));assert.equal(preview.brief.date,'2026-11-01');assert.equal(preview.brief.blocks.length,6);assert.equal(preview.active,false);assert.equal(preview.freshness,'upcoming');
 const state=reconcileCampaign(fresh(),day1),note=campaignNote(state,day1);assert.equal(note.source,'fallback');assert.equal(note.brief.blocks.length,6);assert.equal(note.brief.blocks[0].title,'15 company applications');note.brief.blocks[0].title='Detached';assert.equal(task(state,'applications').title,'15 company applications');
 const staged=brief();staged.opening='A prepared preview';const prepared=reconcileCampaign(fresh(),at('2026-10-31'),staged);assert.equal(campaignNote(prepared,at('2026-10-31')).brief.opening,'A prepared preview');assert.equal(campaignNote(prepared,at('2026-10-31')).source,'coach');assert.equal(prepared.tasks.length,1);
});
