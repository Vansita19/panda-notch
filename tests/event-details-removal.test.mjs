import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const reactPath=createRequire(import.meta.url).resolve('react');
// Export the private component only in this in-memory build. Production exports stay unchanged.
const bundled=await build({entryPoints:['src/components/TaskPlanner.tsx'],outfile:'/tmp/panda-event-details-removal-fixture.js',bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'},plugins:[{
 name:'event-details-removal-hooks',setup(builder){
  builder.onLoad({filter:/[\\/]components[\\/]TaskPlanner\.tsx$/},async({path})=>({contents:await readFile(path,'utf8')+'\nexport {EventDetails};',loader:'tsx'}));
  builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({resolveDir:process.cwd(),contents:`export * from ${JSON.stringify(reactPath)};export {default} from ${JSON.stringify(reactPath)};export const useRef=value=>globalThis.__pandaRemovalHarness.ref(value);export const useState=value=>globalThis.__pandaRemovalHarness.state(value);export const useEffect=(fn,deps)=>globalThis.__pandaRemovalHarness.effect(fn,deps);export const useLayoutEffect=useEffect;`}));
 }
}]});
const previousWindow=globalThis.window;globalThis.window??={};
const {EventDetails}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
const walk=(node,predicate)=>{if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=walk(child,predicate);if(found)return found;}return null;}if(predicate(node))return node;return walk(node.props?.children,predicate);};
const now=new Date(2026,9,22,9).getTime();
function fixture(t,{onSave,focusTitle=true,busy=false}={}){
 const hooks=[],effects=[],timers=new Map(),saves=[],removalGuard={current:null};let cursor=0,dirty=false,timerID=0,tree,unmounted=false;
 const harness={ref(value){const index=cursor++;return hooks[index]??(hooks[index]={current:value});},state(value){const index=cursor++,entry=hooks[index]??(hooks[index]={value:typeof value==='function'?value():value});return [entry.value,next=>{const value=typeof next==='function'?next(entry.value):next;if(!Object.is(value,entry.value)){entry.value=value;dirty=true;}}];},effect(fn,deps){const index=cursor++,old=hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))effects.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:fn()};});}};
 const task={id:'task',title:'Original title',priority:'medium',calendarLink:{eventId:'owned-event',calendarId:'work',start:now,end:now+3600000}};
 const props={task,now,busy,root:{current:null},anchor:()=>null,onReserveHeight(){},isTaskPresent:()=>true,onClose(){},onSave:async values=>{saves.push(values);return onSave?onSave(values):{ok:true,title:values.title,slot:{start:values.start,end:values.end}};},onUnlink:async()=>({ok:true}),onColor(){},onPriority(){},removalGuard,focusTitle};
 const unmount=()=>{if(unmounted)return;unmounted=true;for(const hook of hooks){const cleanup=hook?.cleanup;if(cleanup){hook.cleanup=null;cleanup();}}};
 t.after(unmount);
 for(const [name,value] of Object.entries({__pandaRemovalHarness:harness,setTimeout:(fn,delay)=>{timers.set(++timerID,{fn,delay});return timerID;},clearTimeout:id=>timers.delete(id)})){
  const old=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);
 }
 const render=()=>{do{dirty=false;cursor=0;tree=EventDetails(props);while(effects.length)effects.shift()();}while(dirty);return tree;};
 const title=()=>walk(tree,node=>node.type==='input'&&node.props['aria-label']==='Task name');
 const changeTitle=value=>{title().props.onChange({target:{value}});render();};
 const microtasks=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
 const drainTimers=async()=>{for(let round=0;round<10&&timers.size;round++){const scheduled=[...timers.values()];timers.clear();for(const {fn} of scheduled)fn();await microtasks();}assert.equal(timers.size,0,'autosave timer queue should settle');};
 return {render,title,changeTitle,unmount,drainTimers,microtasks,removalGuard,saves,props,timers};
}

test('approved removal invalidates a dirty draft before debounce and cleanup can save it',async t=>{
 const f=fixture(t);f.render();f.changeTitle('Dirty before delete');
 assert.equal(typeof f.removalGuard.current?.invalidate,'function');assert.equal(f.removalGuard.current.invalidate(),true);assert.equal(f.timers.size,0);
 f.unmount();await f.drainTimers();await f.microtasks();assert.deepEqual(f.saves,[]);
});
test('a failed removal restores normal dirty-draft autosave on cleanup',async t=>{
 const f=fixture(t);f.render();f.changeTitle('Keep this rename');
 assert.equal(typeof f.removalGuard.current?.invalidate,'function');assert.equal(f.removalGuard.current.invalidate(),true);
 f.removalGuard.current.restore();f.unmount();await f.drainTimers();await f.microtasks();
 assert.equal(f.saves.length,1);assert.equal(f.saves[0].title,'Keep this rename');
});
test('an already pending save refuses removal and repeated flushes never duplicate the write',async t=>{
 let acknowledge;const pending=new Promise(resolve=>acknowledge=resolve),f=fixture(t,{onSave:()=>pending});f.render();f.changeTitle('Saving now');f.title().props.onBlur();
 assert.equal(f.saves.length,1);assert.equal(typeof f.removalGuard.current?.invalidate,'function');assert.equal(f.removalGuard.current.invalidate(),false);
 f.title().props.onBlur();f.unmount();acknowledge({ok:true,title:'Saving now',slot:{start:now,end:now+3600000}});await f.microtasks();await f.drainTimers();
 assert.equal(f.saves.length,1);
});
test('a busy external Calendar operation refuses removal',t=>{
 const f=fixture(t,{busy:true});f.render();assert.equal(typeof f.removalGuard.current?.invalidate,'function');assert.equal(f.removalGuard.current.invalidate(),false);
});
test('calendar focus can leave title editing off while the pencil explicitly focuses it',t=>{
 const f=fixture(t,{focusTitle:false});f.render();assert.equal(f.title().props.autoFocus,false);
 f.props.focusTitle=true;f.render();assert.equal(f.title().props.autoFocus,true);
});
