import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,restore,validateState,reduce,advance,visibleTasks,taskProgress} from '../src/model.mjs';
import {campaignProgress} from '../src/campaign.mjs';
import {trackerToday} from '../src/tracker.mjs';
const first=Date.parse('2026-11-01T01:00:00Z'),second=Date.parse('2026-11-02T01:00:00Z');
const owned=state=>state.tasks.filter(task=>task.campaign?.campaign_id==='november-2026');

test('native alphabetically sorted JSON restores staged guidance, owned work and reviews',()=>{
 const sortedJSON=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
 const early=Date.parse('2026-10-30T08:00:00+05:30');let active=initialState(first),task=owned(active)[0];
 active=reduce(active,{type:'campaignEvidence',id:task.id,evidence:[{ref:'https://example.com/work',self_review:'A clear first action.'}]},first);
 const roundTrip=restore(JSON.parse(sortedJSON(active)),first);assert.equal(owned(roundTrip).length,6);assert.deepEqual(roundTrip.tasks,active.tasks);assert.deepEqual(roundTrip.campaign,active.campaign);
 const brief={schema_version:1,campaign_id:'november-2026',timezone:'Asia/Kolkata',date:'2026-11-01',revision:3,issued_at:new Date(early).toISOString(),goal:'A privately configured stable-work goal',opening:'One block at a time.',main_focus:'One clear deliverable.',project_id:'main-project',blocks:owned(active).map(value=>({slot:value.campaign.slot,work_id:value.campaign.work_id,title:value.title,deliverable:value.campaign.deliverable,done_when:value.campaign.done_when,first_action:value.campaign.first_action,...(value.campaign.subject?{subject:value.campaign.subject}:{})}))};
 const preview=reduce(initialState(early),{type:'campaignBrief',brief},early),restored=restore(JSON.parse(sortedJSON(preview)),early);assert.deepEqual(restored.campaign,preview.campaign);assert.equal(restored.tasks.length,preview.tasks.length);
});

test('campaign completions and Tracker Today stay on IST dates when the Mac timezone differs',()=>{
 const previous=process.env.TZ;process.env.TZ='America/Los_Angeles';
 try{
  const early=Date.parse('2026-11-01T00:30:00+05:30'),late=Date.parse('2026-11-01T23:30:00+05:30'),next=Date.parse('2026-11-02T00:30:00+05:30');
  let state=initialState(early);state.tasks=owned(state);const task=state.tasks.find(task=>task.campaign.slot==='project');
  state=reduce(state,{type:'toggle',id:task.id},early);assert.ok(visibleTasks(state,late).some(value=>value.id===task.id));assert.deepEqual(taskProgress(state,late),{done:1,total:6});
  assert.equal(trackerToday(early),'2026-11-1');for(let slot=0;slot<15;slot++)state=reduce(state,{type:'trackerCheck',id:'job-applications',day:trackerToday(early),slot,checked:true},early);
  assert.equal(campaignProgress(state,early).applications.count,15);assert.equal(campaignProgress(state,late).applications.count,15);assert.equal(campaignProgress(state,next).applications.count,0);
  state=advance(state,next);assert.ok(!visibleTasks(state,next).some(value=>value.id===task.id));
  const afterTime=Date.parse('2026-12-01T08:00:00+05:30'),after=advance(state,afterTime);assert.ok(visibleTasks(after,afterTime).some(value=>value.campaign?.slot==='portfolio'),'unfinished continuing work remains available after the campaign');
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('startup prepares six exact owned work blocks additively without claiming manual tasks',()=>{
 const state=initialState(first);assert.equal(owned(state).length,6);assert.equal(state.tasks.filter(task=>!task.campaign).length,2);
 assert.deepEqual(owned(state).map(task=>task.title).slice(0,2),['15 company applications','Creative idea + post']);
 assert.deepEqual(owned(state).map(task=>[new Date(task.plannedTime.start).toISOString().slice(11,16),new Date(task.plannedTime.end).toISOString().slice(11,16)]),[['01:30','04:30'],['05:30','06:30'],['06:30','08:30'],['09:30','11:30'],['12:00','14:30'],['14:30','16:30']]);
 const before=initialState(Date.parse('2026-10-30T00:00:00Z'));before.tasks[0].title='15 company applications';const migrated=restore(before,first);
 assert.equal(migrated.tasks[0].campaign,undefined);assert.equal(migrated.tasks[0].id,before.tasks[0].id);assert.equal(owned(migrated).length,6);
});
test('deletion and explicit schedule/name edits survive model polling and JSON reload',()=>{
 let state=initialState(first),task=owned(state).find(task=>task.campaign.slot==='project');
 state=reduce(state,{type:'edit',id:task.id,title:'My explicit project title'},first);
 state=reduce(state,{type:'taskPlannedTime',id:task.id,time:null},first);
 state=advance(state,first+60000);assert.equal(state.tasks.find(value=>value.id===task.id).title,'My explicit project title');assert.equal(state.tasks.find(value=>value.id===task.id).plannedTime,null);
 state=reduce(state,{type:'delete',id:task.id},first+60000);state=restore(JSON.parse(JSON.stringify(state)),first+120000);
 assert.equal(state.tasks.some(value=>value.id===task.id),false);assert.equal(state.campaign.days['2026-11-01'].tasks.find(value=>value.task_id===task.id).status,'deleted');
});
test('renamed unfinished blocks keep their task and work identities through refresh, restart and next-day carryover',()=>{
 let state=initialState(first);const manual=structuredClone(state.tasks.filter(task=>!task.campaign)),originals=owned(state).filter(task=>['portfolio','project','learning','interview'].includes(task.campaign.slot));
 for(const task of originals)state=reduce(state,{type:'edit',id:task.id,title:`My chosen ${task.campaign.slot} work`},first);
 state=advance(state,first+60000);state=restore(JSON.parse(JSON.stringify(state)),first+120000);state=advance(state,second);state=restore(JSON.parse(JSON.stringify(state)),second+60000);
 for(const original of originals){const current=state.tasks.find(task=>task.id===original.id);assert.equal(current.title,`My chosen ${original.campaign.slot} work`);assert.equal(current.campaign.work_id,original.campaign.work_id);assert.equal(current.campaign.date,'2026-11-02');assert.equal(current.campaign.carried_from,'2026-11-01');assert.equal(owned(state).filter(task=>task.campaign.slot===original.campaign.slot).length,1);}
 assert.deepEqual(state.tasks.filter(task=>!task.campaign),manual);
});
test('ordinary native ticks prepare a new campaign day without old recurring backlog',()=>{
 const start=initialState(first),oldApplication=owned(start).find(task=>task.campaign.slot==='applications');
 const next=advance(start,second);assert.equal(visibleTasks(next,second).filter(task=>task.campaign).length,6);
 assert.equal(visibleTasks(next,second).some(task=>task.id===oldApplication.id),false);
 assert.equal(taskProgress(next,second).total,8);assert.equal(start.campaign.current_day,'2026-11-01');
 const offline=advance(next,Date.parse('2026-11-20T01:00:00Z'));assert.equal(visibleTasks(offline,Date.parse('2026-11-20T01:00:00Z')).filter(task=>task.campaign).length,6);
 assert.equal(offline.campaign.days['2026-11-19'],undefined);
});
test('evidence and home acknowledgement use additive actions and survive reload',()=>{
 let state=initialState(first);const task=owned(state)[0],manual=structuredClone(state.tasks.filter(task=>!task.campaign));
 state=reduce(state,{type:'campaignHomeSeen'},first);assert.equal(state.campaign.home_seen_day,'2026-11-01');
 state=reduce(state,{type:'campaignEvidence',id:task.id,evidence:[{ref:'/tmp/explicit-interview.txt',self_review:'Clearer explanation of my role.'}]},first);
 assert.equal(state.tasks.find(value=>value.id===task.id).campaign.evidence[0].ref,'/tmp/explicit-interview.txt');assert.deepEqual(state.tasks.filter(task=>!task.campaign),manual);
 assert.doesNotThrow(()=>validateState(JSON.parse(JSON.stringify(state))));assert.equal(restore(state,first).campaign.home_seen_day,'2026-11-01');
});
test('malformed campaign metadata cannot enter a whole-app backup',()=>{
 const state=initialState(first),task=owned(state)[0];
 assert.throws(()=>validateState({...state,campaign:{}}),/not a valid Panda file/);
 assert.throws(()=>validateState({...state,tasks:state.tasks.map(value=>value.id===task.id?{...value,campaign:{...value.campaign,slot:'night-work'}}:value)}),/not a valid Panda file/);
 assert.throws(()=>validateState({...state,tasks:state.tasks.map(value=>value.id===task.id?{...value,plannedTime:{start:0,end:Infinity,timezone:'Asia/Kolkata'}}:value)}),/not a valid Panda file/);
});
