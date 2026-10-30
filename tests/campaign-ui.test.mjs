import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialState,openingView,reduce,restore} from '../src/model.mjs';
import {campaignNote,reconcileCampaign} from '../src/campaign.mjs';
const root=new URL('..',import.meta.url).pathname;
const bundle=await build({stdin:{contents:`
 import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
 import {CampaignToday} from './src/components/CampaignToday';import {MenuHome} from './src/components/MenuHome';
 export const render=props=>renderToStaticMarkup(React.createElement(CampaignToday,props));
 export const renderHome=props=>renderToStaticMarkup(React.createElement(MenuHome,{onNavigate(){},events:[],onOpenCalendar(){},now:props.now,todayNote:React.createElement(CampaignToday,props)}));
 `,sourcefile:'campaign-ui-fixture.tsx',loader:'tsx',resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',banner:{js:`const require=(await import('node:module')).createRequire(${JSON.stringify(import.meta.url)});`},plugins:[{name:'omit-styles',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
const ui=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const at=date=>Date.parse(`${date}T08:00:00+05:30`),day1=at('2026-11-01'),day2=at('2026-11-02');
const props=(state,now)=>({state,now,onOpenTasks(){},onSaveEvidence(){return true;}});

test('the compact Today note precedes the actual Menu artwork and shows all six routine details',()=>{
 const state=initialState(day1),html=ui.renderHome(props(state,day1));
 assert.ok(html.indexOf('Today’s campaign note')<html.indexOf('menu-home-scroll'));
 for(const label of ['15 company applications','Creative idea + post','Portfolio improvement','Main brand/website project','Applied learning','Interview readiness','7–10 AM','11 AM–12 PM','12–2 PM','3–5 PM','5:30–8 PM','8–10 PM'])assert.ok(html.includes(label),label);
 assert.equal((html.match(/class="campaign-block"/g)||[]).length,6);assert.match(html,/Built-in routine/);assert.match(html,/Open today’s tasks/);assert.match(html,/Working toward/);
});
test('pre-campaign preview is honest, does not create early tasks, and contains no evidence forms',()=>{
 const now=at('2026-10-30'),state=initialState(now),before=state.tasks.length,html=ui.render(props(state,now));
 assert.match(html,/Starts 1 November/);assert.match(html,/Tasks activate on this date/);assert.doesNotMatch(html,/Open today’s tasks|Save review/);assert.equal(state.tasks.length,before);assert.equal(state.campaign,undefined);
});
test('a staged coach brief can be previewed without applying it or using a misleading fallback focus',()=>{
 const now=at('2026-10-30'),base=initialState(now),routine=campaignNote(base,now).brief;
 const brief={...routine,schema_version:1,campaign_id:'november-2026',timezone:'Asia/Kolkata',revision:1,issued_at:new Date(now).toISOString(),main_focus:'Prepared specific focus',goal:'My privately configured stable-work goal'};
 const state=reconcileCampaign(base,now,brief),html=ui.render(props(state,now));
 assert.match(html,/First brief prepared/);assert.match(html,/Prepared specific focus/);assert.match(html,/My privately configured stable-work goal/);assert.equal(state.tasks.length,base.tasks.length);
});
test('brief details reflect the actual carried task and explicit edits, not a conflicting coach suggestion',()=>{
 let state=initialState(day1),task=state.tasks.find(item=>item.campaign?.slot==='project');
 state=reduce(state,{type:'edit',id:task.id,title:'My continuing project'},day1);state=reconcileCampaign(state,day2);
 const html=ui.render(props(state,day2));assert.match(html,/My continuing project/);assert.match(html,/Continuing work/);assert.match(html,/Review or reference/);assert.match(html,/Files aren’t opened or uploaded/);
});
test('a first ordinary daily opening visits the note once while explicit destinations retain intent',()=>{
 let state=initialState(day1);state.lastView='focus';assert.equal(openingView(state,day1),'today');
 assert.equal(openingView(state,day1,'focus'),'focus');assert.equal(openingView(state,day1,'tasks'),'tasks');
 state=reduce(state,{type:'campaignHomeSeen'},day1);assert.equal(openingView(state,day1),'focus');
 state=restore(JSON.parse(JSON.stringify(state)),day1);assert.equal(openingView(state,day1),'focus');assert.equal(openingView(state,day2),'today');assert.equal(state.lastView,'focus','Polling does not navigate an active view');
});
test('bridge errors are explained without hiding the saved note or routine',()=>{
 const state=initialState(day1),html=ui.render({...props(state,day1),bridgeMessage:'Progress could not be shared with your coach.'});
 assert.match(html,/Progress could not be shared/);assert.match(html,/Daily brief/);assert.match(html,/15 company applications/);
});
test('the actual brief reports done, continuing and removed work without contradictory pending labels',()=>{
 let state=initialState(day1),project=state.tasks.find(item=>item.campaign?.slot==='project'),portfolio=state.tasks.find(item=>item.campaign?.slot==='portfolio');
 state=reduce(state,{type:'toggle',id:project.id},day1);state=reduce(state,{type:'delete',id:portfolio.id},day1);
 let html=ui.render(props(state,day1));assert.equal((html.match(/campaign-block-status">Done</g)||[]).length,1);assert.equal((html.match(/campaign-block-status">Removed</g)||[]).length,1);
 state=reconcileCampaign(state,day2);html=ui.render(props(state,day2));assert.match(html,/campaign-block-status">Done</);assert.match(html,/campaign-block-status">Continuing work</);
});
