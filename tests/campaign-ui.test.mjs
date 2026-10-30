import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {initialState,openingView,reduce,restore} from '../src/model.mjs';
import {campaignNote,reconcileCampaign} from '../src/campaign.mjs';
const root=new URL('..',import.meta.url).pathname;
const bundle=await build({stdin:{contents:`
 import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
 import {CampaignToday} from './src/components/CampaignToday';import {MenuHome} from './src/components/MenuHome';
 import {EventDetails} from './src/components/TaskPlanner';
 export const render=props=>renderToStaticMarkup(React.createElement(CampaignToday,props));
 export const renderDetails=props=>renderToStaticMarkup(React.createElement(EventDetails,props));
 export const renderHome=props=>renderToStaticMarkup(React.createElement(MenuHome,{onNavigate(){},events:[],onOpenCalendar(){},now:props.now,todayNote:React.createElement(CampaignToday,props)}));
 `,sourcefile:'campaign-ui-fixture.tsx',loader:'tsx',resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',banner:{js:`const require=(await import('node:module')).createRequire(${JSON.stringify(import.meta.url)});`},plugins:[{name:'test-components',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onLoad({filter:/[\\/]src[\\/]bridge\.ts$/},()=>({contents:'export const native=false;export function host(){}',loader:'ts'}));b.onLoad({filter:/[\\/]components[\\/]TaskPlanner\.tsx$/},async({path})=>({contents:await readFile(path,'utf8')+'\nexport {EventDetails};',loader:'tsx'}));}}]});
const ui=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const at=date=>Date.parse(`${date}T08:00:00+05:30`),day1=at('2026-11-01'),day2=at('2026-11-02');
const props=(state,now)=>({state,now,onOpenTasks(){},onSaveEvidence(){return true;}});

test('Home shows one short Today note before the existing Menu artwork and links to the real tasks',()=>{
 const state=initialState(day1),html=ui.renderHome(props(state,day1));
 assert.ok(html.indexOf('Today’s campaign note')<html.indexOf('menu-home-scroll'));
 assert.match(html,/>Today<\/h2>/);assert.match(html,/Open today’s tasks/);
 assert.equal((html.match(/class="campaign-opening"/g)||[]).length,1);
 assert.doesNotMatch(html,/Daily brief|Preview routine|Working toward|campaign-main-focus|campaign-goal|campaign-block|Save review/);
});
test('the pre-campaign note is small and creates no early tasks or routine disclosure',()=>{
 const now=at('2026-10-30'),state=initialState(now),before=state.tasks.length,html=ui.render(props(state,now));
 assert.match(html,/>Today<\/h2>/);assert.match(html,/One block at a time\./);assert.doesNotMatch(html,/starts November 1|preview|Open today’s tasks|Save review|Preview routine|Daily brief|campaign-block/);assert.equal(state.tasks.length,before);assert.equal(state.campaign,undefined);
});
test('staged coaching keeps assigned focus and goals out of Home and limits encouragement to one sentence',()=>{
 const now=at('2026-10-30'),base=initialState(now),routine=campaignNote(base,now).brief;
 const brief={...routine,schema_version:1,campaign_id:'november-2026',timezone:'Asia/Kolkata',revision:1,issued_at:new Date(now).toISOString(),opening:'You can take one step today. A longer second sentence should stay out of the note.',main_focus:'Prepared specific focus',goal:'My privately configured stable-work goal'};
 const state=reconcileCampaign(base,now,brief),html=ui.render(props(state,now));
 assert.match(html,/You can take one step today\./);assert.doesNotMatch(html,/A longer second sentence|Prepared specific focus|My privately configured stable-work goal|First brief prepared/);assert.equal(state.tasks.length,base.tasks.length);
});
test('optional references and self-review remain available from the actual carried task details',()=>{
 let state=initialState(day1),task=state.tasks.find(item=>item.campaign?.slot==='project');
 state=reduce(state,{type:'edit',id:task.id,title:'My continuing project'},day1);state=reconcileCampaign(state,day2);
 const carried=state.tasks.find(item=>item.id===task.id),html=ui.renderDetails({task:carried,now:day2,root:{current:null},anchor:()=>null,onSaveEvidence(){return true;}});
 assert.match(html,/My continuing project/);assert.match(html,/Review or reference/);assert.match(html,/Files aren’t opened or uploaded/);assert.match(html,/Self-review/);assert.match(html,/Save review/);
 assert.equal((html.match(/<form(?:\s|>)/g)||[]).length,1,'The optional review form is not nested inside an event form');
 assert.doesNotMatch(ui.render(props(state,day2)),/Review or reference/);
 const manual=ui.renderDetails({task:{id:'manual',title:'My own task'},now:day2,root:{current:null},anchor:()=>null,onSaveEvidence(){return true;}});assert.doesNotMatch(manual,/Review or reference|Save review/);
});
test('a first ordinary daily opening visits the note once while explicit destinations retain intent',()=>{
 let state=initialState(day1);state.lastView='focus';assert.equal(openingView(state,day1),'today');
 assert.equal(openingView(state,day1,'focus'),'focus');assert.equal(openingView(state,day1,'tasks'),'tasks');
 state=reduce(state,{type:'campaignHomeSeen'},day1);assert.equal(openingView(state,day1),'focus');
 state=restore(JSON.parse(JSON.stringify(state)),day1);assert.equal(openingView(state,day1),'focus');assert.equal(openingView(state,day2),'today');assert.equal(state.lastView,'focus','Polling does not navigate an active view');
});
test('bridge errors remain visible beside the small saved note',()=>{
 const state=initialState(day1),html=ui.render({...props(state,day1),bridgeMessage:'Progress could not be shared with your coach.'});
 assert.match(html,/Progress could not be shared/);assert.match(html,/Open today’s tasks/);assert.doesNotMatch(html,/Daily brief|campaign-block/);
});
