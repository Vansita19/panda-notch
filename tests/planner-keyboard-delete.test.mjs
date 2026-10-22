import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialState} from '../src/model.mjs';

// Exercise the real workspace capture handler; Calendar is represented only by explicit callbacks.
const bundled=await build({entryPoints:['src/components/TaskPlanner.tsx'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'},plugins:[{
 name:'planner-keyboard-delete',setup(builder){
  builder.onResolve({filter:/^(react|react\/jsx-runtime|lucide-react)$/},({path})=>({path,namespace:'fixture'}));
  builder.onResolve({filter:/^\.\.\/arc\/button\/button$/},()=>({path:'button',namespace:'fixture'}));
  builder.onResolve({filter:/^\.{1,2}\/bridge$/},()=>({path:'bridge',namespace:'fixture'}));
  builder.onResolve({filter:/^\.\/usePlannerConnections$/},()=>({path:'connections',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='react'?'export default {Fragment:"fragment"};export const useRef=value=>globalThis.__pandaDeleteHarness.ref(value);export const useState=value=>globalThis.__pandaDeleteHarness.state(value);export const useEffect=(fn,deps)=>globalThis.__pandaDeleteHarness.effect(fn,deps);export const useLayoutEffect=useEffect;':path==='react/jsx-runtime'?'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";':path==='lucide-react'?'export const Maximize2=()=>null,Minimize2=()=>null,X=()=>null,Unlink=()=>null,ChevronUp=()=>null,ChevronDown=()=>null,Plus=()=>null;':path==='button'?'export const Button=props=>({type:"button",props});':path==='bridge'?'export const native=true;export const host=()=>{};':'export const usePlannerConnections=()=>[];export const plannerThreadAtPoint=()=>null;'}));
 }
}]});
const {TaskPlanner}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const walk=(node,predicate)=>{if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=walk(child,predicate);if(found)return found;}return null;}if(predicate(node))return node;return walk(node.props?.children,predicate);};
const now=new Date(2026,9,22,12).getTime();
function fixture(t){
 const hooks=[],effects=[],listeners=new Map(),taskNodes=new Map(),deletedTasks=[],deletedTimes=[];let cursor=0,dirty=false,tree;
 const bounds={left:400,right:764,top:100,bottom:540,width:364,height:440};
 const rootNode={getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null,contains(node){return node===this||node?.scope===this;}};
 const gridNode={scope:rootNode,getBoundingClientRect:()=>bounds,setPointerCapture(){},focus(){}};
 const harness={ref(value){const index=cursor++;return hooks[index]??(hooks[index]={current:value});},state(value){const index=cursor++,entry=hooks[index]??(hooks[index]={value:typeof value==='function'?value():value});return [entry.value,next=>{const value=typeof next==='function'?next(entry.value):next;if(!Object.is(value,entry.value)){entry.value=value;dirty=true;}}];},effect(fn,deps){const index=cursor++,old=hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))effects.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:fn()};});}};
 t.after(()=>{for(const hook of hooks)hook?.cleanup?.();});
 for(const [name,value] of Object.entries({__pandaDeleteHarness:harness,matchMedia:()=>({matches:false}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},window:{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}}})){
  const old=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);
 }
 const state=initialState(now);state.calendar={mode:'connected',selectedIds:['work']};state.tasks[0].calendarLink={eventId:'owned-event',calendarId:'work',start:now,end:now+3600000};
 const props={editingTask:null,onDeleteTask:async task=>{deletedTasks.push(task);return {ok:true};},onDeleteCalendarTime:async task=>{deletedTimes.push(task);return {ok:true};}};
 const render=()=>{do{dirty=false;cursor=0;tree=TaskPlanner({s:state,info:{calendars:[{id:'work',writable:true}]},dispatch(){},active:true,layoutActive:true,onToggle(){},renderTasks(nodeForTask){for(const task of state.tasks)taskNodes.set(task.id,nodeForTask(task));return null;},notify(){},now,onCreateTask:async()=>({ok:true}),...props});tree.props.ref.current=rootNode;walk(tree,node=>node.props?.className?.split(' ').includes('planner-grid')).props.ref.current=gridNode;walk(tree,node=>node.props?.className==='planner-calendar-scroll').props.ref.current={getBoundingClientRect:()=>bounds,scrollTop:0};while(effects.length)effects.shift()();}while(dirty);return tree;};
 const target=(id,kind='task',{outside=false,editable=false}={})=>{
  const wrapper={dataset:{deleteTask:id,deleteKind:kind,linkedTask:id},scope:outside?{}:rootNode,isConnected:true,closest(selector){if(selector==='[data-delete-task]'||selector==='[data-linked-task]')return this;return null;}};
  const child={scope:wrapper.scope,ownerDocument:{activeElement:null},closest(selector){if(selector==='[data-delete-task]'||selector==='[data-linked-task]')return wrapper;if(editable&&selector.includes('input'))return this;return null;}};
  child.ownerDocument.activeElement=child;return child;
 };
 const event=(node,key='Delete',patch={})=>({key,target:node,currentTarget:rootNode,defaultPrevented:false,repeat:false,isComposing:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...patch});
 const press=async e=>{assert.equal(typeof tree.props.onKeyDownCapture,'function','TaskPlanner needs a workspace keyboard-deletion capture handler');await tree.props.onKeyDownCapture(e);};
 const pointer=hour=>({button:0,pointerId:1,clientX:500,clientY:100+(hour-7)/16*440,target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
 const fire=(type,event)=>{for(const fn of listeners.get(type)??[])fn(event);};
 return {state,props,render,target,event,press,pointer,fire,taskNodes,deletedTasks,deletedTimes,rootNode,get tree(){return tree;},grid:()=>walk(tree,node=>node.props?.className?.split(' ').includes('planner-grid'))};
}

test('focused task Delete and calendar Backspace use their distinct deletion callbacks once',async t=>{
 const f=fixture(t);f.render();const task=f.state.tasks[0],left=f.event(f.target(task.id)),right=f.event(f.target(task.id,'event'),'Backspace');
 await f.press(left);f.render();await f.press(right);
 assert.deepEqual(f.deletedTasks.map(task=>task.id),[task.id]);assert.deepEqual(f.deletedTimes.map(task=>task.id),[task.id]);assert.equal(left.defaultPrevented,true);assert.equal(right.defaultPrevented,true);
});
test('hover alone, stale selection, foreign workspace, and editing targets never delete',async t=>{
 const f=fixture(t);f.render();const id=f.state.tasks[0].id;
 f.tree.props.onPointerOver({target:f.target(id),clientX:500,clientY:200});f.render();
 for(const node of [f.rootNode,f.target('stale-id'),f.target(id,'task',{outside:true}),f.target(id,'task',{editable:true})])await f.press(f.event(node));
 assert.deepEqual(f.deletedTasks,[]);assert.deepEqual(f.deletedTimes,[]);
});
test('a completed task hidden after rollover is not a live keyboard target',async t=>{
 const f=fixture(t),task=f.state.tasks[0];task.done=true;task.completedDay='2026-10-21';f.render();await f.press(f.event(f.target(task.id)));
 assert.deepEqual(f.deletedTasks,[]);assert.deepEqual(f.deletedTimes,[]);
});
test('pending deletion rejects a second keypress before the first callback settles',async t=>{
 const f=fixture(t);let finish;const pending=new Promise(resolve=>finish=resolve);
 f.props.onDeleteTask=async task=>{f.deletedTasks.push(task);await pending;return {ok:true};};f.render();const id=f.state.tasks[0].id;
 assert.equal(typeof f.tree.props.onKeyDownCapture,'function');
 const first=f.press(f.event(f.target(id)));try{await f.press(f.event(f.target(id)));assert.equal(f.deletedTasks.length,1);}finally{finish();await first;}
});
test('renaming, task linking, and naming a new event guard keyboard deletion',async t=>{
 const f=fixture(t);f.render();const task=f.state.tasks[0],key=()=>f.event(f.target(task.id));
 f.props.editingTask=task.id;f.render();await f.press(key());f.props.editingTask=null;f.render();
 f.taskNodes.get(task.id).props.onPointerDown({...f.pointer(8),currentTarget:{getBoundingClientRect:()=>({left:350,top:150,width:20,height:20})}});f.render();await f.press(key());
 f.fire('keydown',{key:'Escape',preventDefault(){},stopImmediatePropagation(){}});f.render();
 f.grid().props.onPointerDownCapture(f.pointer(9));f.fire('pointerup',f.pointer(10));f.render();await f.press(key());
 assert.deepEqual(f.deletedTasks,[]);assert.deepEqual(f.deletedTimes,[]);
});
test('disconnected Calendar prevents event-time removal while ordinary task deletion stays available',async t=>{
 const f=fixture(t);f.state.calendar.mode='off';f.render();const id=f.state.tasks[0].id;
 await f.press(f.event(f.target(id,'event')));await f.press(f.event(f.target(id)));
 assert.deepEqual(f.deletedTimes,[]);assert.deepEqual(f.deletedTasks.map(task=>task.id),[id]);
});

test('linked calendar blocks explicitly join Mac keyboard navigation',t=>{
 const f=fixture(t);f.render();const task=f.state.tasks[0];
 const button=walk(f.tree,node=>node.type==='button'&&node.props?.['aria-label']?.startsWith(`${task.title}, `));
 assert.ok(button);assert.equal(button.props.tabIndex,0);assert.equal(button.props['aria-keyshortcuts'],'Delete Backspace');
});
