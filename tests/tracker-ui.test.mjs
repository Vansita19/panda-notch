import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialState,reduce} from '../src/model.mjs';
const bundled=await build({stdin:{contents:`
 import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
 import {Tracker,TrackerRow,TrackerDateNavigation} from './src/components/Tracker';
 export {TrackerRow,TrackerDateNavigation};export {featureViews,navigationOptions} from './src/navigation';
 export const render=props=>renderToStaticMarkup(React.createElement(Tracker,props));
 `,sourcefile:'tracker-ui-fixture.tsx',loader:'tsx',resolveDir:new URL('..',import.meta.url).pathname},bundle:true,write:false,platform:'node',format:'esm',banner:{js:`const require=(await import('node:module')).createRequire(${JSON.stringify(import.meta.url)});`},plugins:[{name:'omit-styles',setup(builder){builder.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
const ui=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const now=new Date(2026,9,26,12).getTime(),today='2026-10-26';
function collect(node,predicate,out=[]){if(!node||typeof node!=='object')return out;if(predicate(node))out.push(node);for(const child of [node.props?.children].flat(Infinity))collect(child,predicate,out);return out;}

test('Tracker is reachable immediately after To-Do from Menu and main navigation',()=>{
 assert.deepEqual(ui.featureViews.slice(0,3).map(view=>view.id),['tasks','tracker','focus']);
 assert.deepEqual(ui.navigationOptions.slice(0,4).map(view=>view.label),['Menu','To-Do','Tracker','Focus']);
});
test('the actual Tracker renders exactly fifteen empty named checkboxes and a zero count',()=>{
 const html=ui.render({trackers:initialState(now).trackers,now,dispatch(){},notify(){}});
 assert.equal((html.match(/role="checkbox"/g)||[]).length,15);assert.equal((html.match(/aria-checked="false"/g)||[]).length,15);
 assert.match(html,/0\/15/);assert.match(html,/Job applications/);assert.match(html,/Previous day/);assert.match(html,/Next day/);
});
test('a three-bottle habit renders three boxes beside its own count while applications retains fifteen',()=>{
 const state=reduce(initialState(now),{type:'addTracker',title:'Drinking water',slots:3},now),html=ui.render({trackers:state.trackers,now,dispatch(){},notify(){}});
 assert.equal((html.match(/role="checkbox"/g)||[]).length,18);assert.match(html,/0\/3/);assert.match(html,/0\/15/);
 const actions=[],row=ui.TrackerRow({tracker:state.trackers[1],day:today,dispatch:action=>actions.push(action),onRename(){},onRemove(){}}),boxes=collect(row,node=>typeof node.props?.onCheckedChange==='function');
 assert.equal(boxes.length,3);boxes[2].props.onCheckedChange(true);assert.deepEqual(actions,[{type:'trackerCheck',id:state.trackers[1].id,day:today,slot:2,checked:true}]);
});
test('slot interactions dispatch the selected date and explicit checked state',()=>{
 const tracker=initialState(now).trackers[0],actions=[];tracker.days[today]=5;
 const row=ui.TrackerRow({tracker,day:today,dispatch:action=>actions.push(action),onRename(){},onRemove(){}});
 const boxes=collect(row,node=>typeof node.props?.['aria-label']==='string'&&node.props['aria-label'].startsWith('Job applications, slot '));
 assert.equal(boxes.length,15);assert.equal(boxes[0].props.checked,true);assert.equal(boxes[1].props.checked,false);assert.equal(boxes[2].props.checked,true);
 boxes[1].props.onCheckedChange(true);boxes[0].props.onCheckedChange(false);
 assert.deepEqual(actions,[{type:'trackerCheck',id:tracker.id,day:today,slot:1,checked:true},{type:'trackerCheck',id:tracker.id,day:today,slot:0,checked:false}]);
 const past=ui.TrackerRow({tracker,day:'2026-10-25',dispatch:action=>actions.push(action),onRename(){},onRemove(){}});
 const pastBoxes=collect(past,node=>typeof node.props?.onCheckedChange==='function');assert.ok(pastBoxes.every(box=>box.props.checked===false));
 pastBoxes[14].props.onCheckedChange(true);assert.equal(actions.at(-1).day,'2026-10-25');assert.equal(actions.at(-1).slot,14);
});
test('date arrows traverse local dates, stop at Today, and the label jumps back to Today',()=>{
 const changes=[],render=day=>ui.TrackerDateNavigation({day,today,onChange:value=>changes.push(value)});
 const buttons=day=>collect(render(day),node=>node.type==='button');
 let controls=buttons(today);assert.equal(controls[2].props.disabled,true);controls[0].props.onClick();assert.equal(changes.at(-1),'2026-10-25');
 controls=buttons('2026-10-25');assert.equal(controls[2].props.disabled,false);controls[2].props.onClick();assert.equal(changes.at(-1),'2026-10-26');
 controls[1].props.onClick();assert.equal(changes.at(-1),null);
});
