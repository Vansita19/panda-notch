import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialState} from '../src/model.mjs';

const bundled=await build({entryPoints:['src/components/TaskPlanner.tsx'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'},plugins:[{
 name:'planner-gesture',setup(builder){
  builder.onResolve({filter:/^(react|react\/jsx-runtime|lucide-react)$/},({path})=>({path,namespace:'fixture'}));
  builder.onResolve({filter:/^\.\.\/arc\/button\/button$/},()=>({path:'button',namespace:'fixture'}));
  builder.onResolve({filter:/^\.{1,2}\/bridge$/},()=>({path:'bridge',namespace:'fixture'}));
  builder.onResolve({filter:/^\.\/usePlannerConnections$/},()=>({path:'connections',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='react'?'export default {Fragment:"fragment"};export const useRef=value=>globalThis.__pandaCreateHarness.ref(value);export const useState=value=>globalThis.__pandaCreateHarness.state(value);export const useEffect=(fn,deps)=>globalThis.__pandaCreateHarness.effect(fn,deps);export const useLayoutEffect=useEffect;':path==='react/jsx-runtime'?'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";':path==='lucide-react'?'export const Maximize2=()=>null,Minimize2=()=>null,X=()=>null,Unlink=()=>null,ChevronUp=()=>null,ChevronDown=()=>null,Plus=()=>null;':path==='button'?'export const Button=props=>({type:"button",props});':path==='bridge'?'export const native=false;export const host=()=>{};':'export const usePlannerConnections=()=>[];export const plannerThreadAtPoint=()=>null;'}));
 }
}]});
const {TaskPlanner}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const walk=(node,predicate)=>{if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=walk(child,predicate);if(found)return found;}return null;}if(predicate(node))return node;return walk(node.props?.children,predicate);};
const now=new Date(2026,9,22,12).getTime(),at=hour=>new Date(2026,9,22,hour).getTime();
function fixture(t){
 const hooks=[],effects=[],listeners=new Map(),frames=new Map(),created=[],actions=[],taskNodes=new Map();let cursor=0,dirty=false,frame=0,tree;
 const bounds={left:400,right:764,top:100,bottom:540,width:364,height:440};
 const gridNode={getBoundingClientRect:()=>bounds,setPointerCapture(){},focus(){}};
 const rootNode={getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),querySelector:()=>null,querySelectorAll:()=>[]};
 const harness={ref(value){const i=cursor++;return hooks[i]??(hooks[i]={current:value});},state(value){const i=cursor++,entry=hooks[i]??(hooks[i]={value:typeof value==='function'?value():value});return [entry.value,next=>{const value=typeof next==='function'?next(entry.value):next;if(!Object.is(value,entry.value)){entry.value=value;dirty=true;}}];},effect(fn,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,j)=>value!==old.deps[j]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}};
 t.after(()=>{for(const hook of hooks)hook?.cleanup?.();});
 for(const [name,value] of Object.entries({__pandaCreateHarness:harness,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frames.set(++frame,fn);return frame;},cancelAnimationFrame:id=>frames.delete(id),window:{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}}})){
  const old=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);
 }
 const state=initialState(now);state.settings.plannerStart=7;state.settings.plannerEnd=23;
 const render=()=>{do{dirty=false;cursor=0;tree=TaskPlanner({s:state,info:{calendars:[]},dispatch:action=>actions.push(action),active:true,layoutActive:true,onToggle(){},renderTasks(nodeForTask){for(const task of state.tasks)taskNodes.set(task.id,nodeForTask(task));return null;},notify(){},now,onCreateTask:async values=>{created.push(values);return {ok:true,task:{id:'new'}};}});tree.props.ref.current=rootNode;walk(tree,node=>node.props?.className?.split(' ').includes('planner-grid')).props.ref.current=gridNode;walk(tree,node=>node.props?.className==='planner-calendar-scroll').props.ref.current={getBoundingClientRect:()=>bounds,scrollTop:0};while(effects.length)effects.shift()();}while(dirty);return tree;};
 const grid=()=>walk(tree,node=>node.props?.className?.split(' ').includes('planner-grid'));
 const event=(hour,control=false)=>({button:0,pointerId:1,clientX:500,clientY:100+(hour-7)/16*440,target:{closest:()=>control?{}:null},preventDefault(){this.prevented=true;},stopPropagation(){}});
 const fire=(type,event)=>{for(const fn of listeners.get(type)??[])fn(event);};
 return {render,grid,event,fire,created,actions,taskNodes,state,composer:()=>walk(tree,node=>node.type?.name==='NewEventComposer')};
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
