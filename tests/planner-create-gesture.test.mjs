import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialState} from '../src/model.mjs';
import {unlinkCalendarTaskTime} from '../src/task-calendar-unlink.mjs';

const bundled=await build({entryPoints:['src/components/TaskPlanner.tsx'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'},plugins:[{
 name:'planner-gesture',setup(builder){
  builder.onResolve({filter:/^(react|react\/jsx-runtime|lucide-react)$/},({path})=>({path,namespace:'fixture'}));
  builder.onResolve({filter:/^\.\.\/arc\/button\/button$/},()=>({path:'button',namespace:'fixture'}));
  builder.onResolve({filter:/^\.{1,2}\/bridge$/},()=>({path:'bridge',namespace:'fixture'}));
  builder.onResolve({filter:/^\.\.\/calendar-write$/},()=>({path:'calendar-write',namespace:'fixture'}));
  builder.onResolve({filter:/^\.\/usePlannerConnections$/},()=>({path:'connections',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='react'?'export default {Fragment:"fragment"};export const useRef=value=>globalThis.__pandaCreateHarness.ref(value);export const useState=value=>globalThis.__pandaCreateHarness.state(value);export const useEffect=(fn,deps)=>globalThis.__pandaCreateHarness.effect(fn,deps);export const useLayoutEffect=useEffect;':path==='react/jsx-runtime'?'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";':path==='lucide-react'?'export const Maximize2=()=>null,Minimize2=()=>null,X=()=>null,Unlink=()=>null,ChevronUp=()=>null,ChevronDown=()=>null,Plus=()=>null;':path==='button'?'export const Button=props=>({type:"button",props});':path==='bridge'?'export let native=false;globalThis.__pandaCreateSetNative=value=>native=value;export const host=()=>{};':path==='calendar-write'?'export const writeCalendar=request=>globalThis.__pandaCreateHarness.write(request);':'export const usePlannerConnections=()=>[];export const plannerThreadAtPoint=()=>null;'}));
 }
}]});
const {TaskPlanner}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const walk=(node,predicate)=>{if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=walk(child,predicate);if(found)return found;}return null;}if(predicate(node))return node;return walk(node.props?.children,predicate);};
const now=new Date(2026,9,22,12).getTime(),at=hour=>new Date(2026,9,22,hour).getTime();
function fixture(t,options={}){
 const now=options.now??new Date(2026,9,22,12).getTime();globalThis.__pandaCreateSetNative(options.native??false);t.after(()=>globalThis.__pandaCreateSetNative(false));
 const hooks=[],effects=[],listeners=new Map(),frames=new Map(),created=[],actions=[],providerWrites=[],taskNodes=new Map();let cursor=0,dirty=false,frame=0,tree;
 const bounds={left:400,right:764,top:100,bottom:540,width:364,height:440};
 const gridNode={getBoundingClientRect:()=>bounds,setPointerCapture(){},focus(){}};
 const rootNode={getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),querySelector:()=>null,querySelectorAll:()=>[]};
 const harness={write(request){providerWrites.push(request);throw new Error('A local campaign change must not write to Calendar.');},ref(value){const i=cursor++;return hooks[i]??(hooks[i]={current:value});},state(value){const i=cursor++,entry=hooks[i]??(hooks[i]={value:typeof value==='function'?value():value});return [entry.value,next=>{const value=typeof next==='function'?next(entry.value):next;if(!Object.is(value,entry.value)){entry.value=value;dirty=true;}}];},effect(fn,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,j)=>value!==old.deps[j]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}};
 t.after(()=>{for(const hook of hooks)hook?.cleanup?.();});
 for(const [name,value] of Object.entries({__pandaCreateHarness:harness,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frames.set(++frame,fn);return frame;},cancelAnimationFrame:id=>frames.delete(id),window:{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}}})){
  const old=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);
 }
 const state=initialState(now);state.settings.plannerStart=7;state.settings.plannerEnd=23;
 const dispatch=action=>{actions.push(action);const task=state.tasks.find(task=>task.id===action.id);if(task&&action.type==='taskPlannedTime'){if(action.time)task.plannedTime=action.time;else delete task.plannedTime;}};
 const render=()=>{do{dirty=false;cursor=0;tree=TaskPlanner({s:state,info:options.info??{calendars:[]},dispatch,active:true,layoutActive:true,onToggle(){},renderTasks(nodeForTask){for(const task of state.tasks)taskNodes.set(task.id,nodeForTask(task));return null;},notify(){},now,onDeleteCalendarTime:options.onDeleteCalendarTime,onCreateTask:async values=>{created.push(values);return {ok:true,task:{id:'new'}};}});tree.props.ref.current=rootNode;walk(tree,node=>node.props?.className?.split(' ').includes('planner-grid')).props.ref.current=gridNode;walk(tree,node=>node.props?.className==='planner-calendar-scroll').props.ref.current={getBoundingClientRect:()=>bounds,scrollTop:0};while(effects.length)effects.shift()();}while(dirty);return tree;};
 const grid=()=>walk(tree,node=>node.props?.className?.split(' ').includes('planner-grid'));
 const event=(hour,control=false)=>({button:0,pointerId:1,clientX:500,clientY:100+(hour-7)/16*440,target:{closest:()=>control?{}:null},preventDefault(){this.prevented=true;},stopPropagation(){}});
 const fire=(type,event)=>{for(const fn of listeners.get(type)??[])fn(event);};
 return {render,grid,event,fire,created,actions,providerWrites,taskNodes,state,dispatch,get tree(){return tree;},find:predicate=>walk(tree,predicate),composer:()=>walk(tree,node=>node.type?.name==='NewEventComposer')};
}

test('dragging empty calendar space selects a free duration and names one reciprocal task',async t=>{
 const f=fixture(t);f.render();f.grid().props.onPointerDownCapture(f.event(7));f.fire('pointerup',f.event(9));f.render();
 const composer=f.composer();assert.ok(composer);assert.deepEqual(composer.props.slot,{start:at(7),end:at(9)});
 await composer.props.onCreate('Portfolio review');assert.deepEqual(f.created,[{title:'Portfolio review',start:at(7),end:at(9),calendarId:''}]);
 composer.props.onClose();f.render();assert.equal(f.composer(),null);
});

test('reverse calendar selection and Escape keep the unconfirmed span local',t=>{
 const f=fixture(t);f.render();f.grid().props.onPointerDownCapture(f.event(13));f.fire('pointerup',f.event(11));f.render();
 assert.deepEqual(f.composer().props.slot,{start:at(11),end:at(13)});
 const escape={key:'Escape',preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};f.fire('keydown',escape);f.render();
 assert.equal(f.composer(),null);assert.deepEqual(f.created,[]);assert.equal(escape.stopped,true);
});

test('event controls cannot start creation and an armed task still follows its existing linking path',async t=>{
 const f=fixture(t);f.render();f.grid().props.onPointerDownCapture(f.event(9,true));f.fire('pointerup',f.event(10));f.render();assert.equal(f.composer(),null);
 const task=f.state.tasks[0],node=f.taskNodes.get(task.id),source={getBoundingClientRect:()=>({left:350,top:150,width:20,height:20})};
 node.props.onPointerDown({...f.event(8),currentTarget:source});f.render();f.grid().props.onPointerDownCapture(f.event(9));f.fire('pointerup',f.event(11));await Promise.resolve();f.render();
 assert.equal(f.composer(),null);assert.deepEqual(f.created,[]);assert.ok(f.actions.some(action=>action.type==='taskCalendarLinked'&&action.id===task.id&&action.link.start===at(9)&&action.link.end===at(11)));
});

const campaignTask=()=>({id:'campaign-local',title:'Portfolio improvement',done:false,campaign:{campaign_id:'november-2026',date:'2026-11-01',slot:'portfolio'},plannedTime:{start:Date.parse('2026-11-01T06:30:00Z'),end:Date.parse('2026-11-01T08:30:00Z'),timezone:'Asia/Kolkata',color:'#b698ff'}});
const localFixture=(t,options={})=>{const f=fixture(t,{native:true,now:Date.parse('2026-11-01T06:00:00Z'),...options});f.state.tasks.unshift(campaignTask());return f;};

test('disconnected native planner displays local time and enables only the local task connection',t=>{
 const f=localFixture(t);f.render();const task=f.state.tasks[0],block=f.find(node=>node.props?.['data-delete-kind']==='event'&&node.props?.['data-delete-task']===task.id);
 assert.ok(block);const button=walk(block,node=>node.type==='button');assert.match(button.props['aria-label'],/12:00.*2:00/);
 assert.equal(f.taskNodes.get(task.id).props.disabled,false);assert.equal(f.taskNodes.get(task.id).props['data-linked'],true);assert.equal(f.taskNodes.get(f.state.tasks[1].id).props.disabled,true);
 assert.equal(task.calendarLink,undefined);assert.deepEqual(f.providerWrites,[]);
});

test('local task move, resize, details save and palette changes stay local while Calendar is disconnected',async t=>{
 const f=localFixture(t);f.render();const task=f.state.tasks[0];
 const block=()=>f.find(node=>node.props?.['data-delete-kind']==='event'&&node.props?.['data-delete-task']===task.id),control=()=>walk(block(),node=>node.type==='button');
 const pointer=(hour)=>({...f.event(hour),currentTarget:{setPointerCapture(){}}});
 control().props.onPointerDown(pointer(12));f.fire('pointermove',pointer(13));f.fire('pointerup',pointer(13));await Promise.resolve();f.render();
 assert.deepEqual(task.plannedTime,{start:Date.parse('2026-11-01T07:30:00Z'),end:Date.parse('2026-11-01T09:30:00Z'),timezone:'Asia/Kolkata',color:'#b698ff'});
 walk(block(),node=>node.props?.className==='planner-resize').props.onPointerDown(pointer(15));f.fire('pointerup',pointer(16));await Promise.resolve();f.render();
 assert.equal(task.plannedTime.end,Date.parse('2026-11-01T10:30:00Z'));
 control().props.onClick({detail:0,currentTarget:{focus(){}}});f.render();const details=f.find(node=>node.type?.name==='EventDetails');assert.ok(details);
 const result=await details.props.onSave({title:task.title,start:Date.parse('2026-11-01T08:30:00Z'),end:Date.parse('2026-11-01T11:30:00Z')});assert.equal(result.ok,true);f.render();
 f.find(node=>node.type?.name==='EventDetails').props.onColor('#efab78');f.render();assert.equal(task.plannedTime.color,'#efab78');assert.equal(task.calendarLink,undefined);assert.deepEqual(f.providerWrites,[]);
});

test('explicitly reconnecting a local campaign task keeps its new span out of Calendar',async t=>{
 const f=localFixture(t,{info:{calendars:[{id:'work',writable:true}]}});f.state.calendar={mode:'connected',selectedIds:['work']};delete f.state.tasks[0].plannedTime;f.render();const task=f.state.tasks[0],node=f.taskNodes.get(task.id);
 assert.equal(node.props.disabled,false);node.props.onPointerDown({...f.event(8),currentTarget:{getBoundingClientRect:()=>({left:350,top:150,width:20,height:20})}});f.render();
 f.grid().props.onPointerDownCapture(f.event(9));f.fire('pointerup',f.event(11));await Promise.resolve();f.render();
 assert.deepEqual(task.plannedTime,{start:Date.parse('2026-11-01T03:30:00Z'),end:Date.parse('2026-11-01T05:30:00Z'),timezone:'Asia/Kolkata'});assert.equal(task.calendarLink,undefined);assert.deepEqual(f.providerWrites,[]);
});

test('local details initialize with IST inputs and Unlink uses the shared local Undo path',async t=>{
 let undo,removedTask;
 const f=localFixture(t,{onDeleteCalendarTime:async task=>{removedTask=task;undo=await unlinkCalendarTaskTime(task,{native:true,writeCalendar:request=>{f.providerWrites.push(request);throw new Error('Must stay local');},dispatch:f.dispatch,getTask:id=>f.state.tasks.find(task=>task.id===id)});return {ok:true};}});f.render();const task=f.state.tasks[0],original=structuredClone(task);
 const block=f.find(node=>node.props?.['data-delete-kind']==='event'&&node.props?.['data-delete-task']===task.id);walk(block,node=>node.type==='button').props.onClick({detail:0,currentTarget:{focus(){}}});f.render();
 const details=f.find(node=>node.type?.name==='EventDetails'),parentHarness=globalThis.__pandaCreateHarness;
 let detailTree;
 try{globalThis.__pandaCreateHarness={ref:value=>({current:value}),state:value=>[typeof value==='function'?value():value,()=>{}],effect(){}};detailTree=details.type(details.props);}finally{globalThis.__pandaCreateHarness=parentHarness;}
 assert.equal(walk(detailTree,node=>node.type==='input'&&node.props['aria-label']==='Starts').props.value,'12:00');assert.equal(walk(detailTree,node=>node.type==='input'&&node.props['aria-label']==='Ends').props.value,'14:00');
 await details.props.onUnlink();f.render();assert.equal(removedTask,task);assert.equal(task.plannedTime,undefined);assert.equal(task.calendarLink,undefined);assert.equal(f.find(node=>node.props?.['data-delete-kind']==='event'&&node.props?.['data-delete-task']===task.id),null);
 await undo();f.render();assert.deepEqual(task,original);assert.deepEqual(f.providerWrites,[]);
});
