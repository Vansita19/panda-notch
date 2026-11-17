import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {initialState,openingView,reduce,restore} from '../src/model.mjs';
import {reconcileCampaign} from '../src/campaign.mjs';
const root=new URL('..',import.meta.url).pathname;
const bundle=await build({stdin:{contents:`
 import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
 import {MenuHome} from './src/components/MenuHome';
 import {EventDetails} from './src/components/TaskPlanner';
 export const renderDetails=props=>renderToStaticMarkup(React.createElement(EventDetails,props));
 export const renderHome=props=>renderToStaticMarkup(React.createElement(MenuHome,{onNavigate(){},events:[],onOpenCalendar(){},now:props.now}));
 `,sourcefile:'campaign-ui-fixture.tsx',loader:'tsx',resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',banner:{js:`const require=(await import('node:module')).createRequire(${JSON.stringify(import.meta.url)});`},plugins:[{name:'test-components',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onLoad({filter:/[\\/]src[\\/]bridge\.ts$/},()=>({contents:'export const native=false;export function host(){}',loader:'ts'}));b.onLoad({filter:/[\\/]components[\\/]TaskPlanner\.tsx$/},async({path})=>({contents:await readFile(path,'utf8')+'\nexport {EventDetails};',loader:'tsx'}));}}]});
const ui=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const at=date=>Date.parse(`${date}T08:00:00+05:30`),day1=at('2026-11-01'),day2=at('2026-11-02');

test('Home starts with Menu cards without a daily banner',()=>{
 const now=day1,html=ui.renderHome({now});
 assert.match(html,/aria-label="Panda tools"/);assert.match(html,/class="menu-home-scroll"/);
 for(const label of ['To-Do','Tracker','Focus','All links','Ideas','Notes','Reminders'])assert.ok(html.includes(`aria-label="${label}"`));
 assert.doesNotMatch(html,/Today’s campaign note|campaign-today|One block at a time|Open today’s tasks|Daily brief|Preview routine|Save review/);
});
test('optional references and self-review remain available from the actual carried task details',()=>{
 let state=initialState(day1),task=state.tasks.find(item=>item.campaign?.slot==='project');
 state=reduce(state,{type:'edit',id:task.id,title:'My continuing project'},day1);state=reconcileCampaign(state,day2);
 const carried=state.tasks.find(item=>item.id===task.id),html=ui.renderDetails({task:carried,now:day2,root:{current:null},anchor:()=>null,onSaveEvidence(){return true;}});
 assert.match(html,/My continuing project/);assert.match(html,/Review or reference/);assert.match(html,/Files aren’t opened or uploaded/);assert.match(html,/Self-review/);assert.match(html,/Save review/);
 assert.equal((html.match(/<form(?:\s|>)/g)||[]).length,1,'The optional review form is not nested inside an event form');
 assert.doesNotMatch(ui.renderHome({now:day2}),/Review or reference/);
 const manual=ui.renderDetails({task:{id:'manual',title:'My own task'},now:day2,root:{current:null},anchor:()=>null,onSaveEvidence(){return true;}});assert.doesNotMatch(manual,/Review or reference|Save review/);
});
test('a first ordinary daily opening visits Menu once while explicit destinations retain intent',()=>{
 let state=initialState(day1);state.lastView='focus';assert.equal(openingView(state,day1),'today');
 assert.equal(openingView(state,day1,'focus'),'focus');assert.equal(openingView(state,day1,'tasks'),'tasks');
 state=reduce(state,{type:'campaignHomeSeen'},day1);assert.equal(openingView(state,day1),'focus');
 state=restore(JSON.parse(JSON.stringify(state)),day1);assert.equal(openingView(state,day1),'focus');assert.equal(openingView(state,day2),'today');assert.equal(state.lastView,'focus','Polling does not navigate an active view');
});
