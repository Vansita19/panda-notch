import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundled=await build({entryPoints:['src/components/usePlannerConnections.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{
 name:'connection-geometry',setup(builder){
  builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRef=(value)=>globalThis.__pandaConnectionHarness.useRef(value);export const useState=(value)=>globalThis.__pandaConnectionHarness.useState(value);export const useLayoutEffect=(fn,deps)=>globalThis.__pandaConnectionHarness.useLayoutEffect(fn,deps);'}));
 }
}]});
const {plannerConnectionGeometry,plannerThreadAtPoint,usePlannerConnections}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const rect=(left,top,width,height)=>({left,top,width,height});
const origin=rect(100,50,800,600),node=rect(280,190,10,10),block=rect(550,150,250,100);
const endpoint=d=>d.match(/, ([\d.-]+) ([\d.-]+)$/)?.slice(1).map(Number);

test('unclipped cords retain left-center attachment in workspace coordinates',()=>{
 const result=plannerConnectionGeometry(node,block,origin);
 assert.equal(result.hidden,false);
 assert.match(result.d,/^M 185 145 C /);
 assert.deepEqual(endpoint(result.d),[450,150]);
});
test('a partially visible event attaches to the midpoint of its visible portion',()=>{
 const clippedAtTop=plannerConnectionGeometry(node,block,origin,rect(500,200,350,200));
 assert.equal(clippedAtTop.hidden,false);
 assert.deepEqual(endpoint(clippedAtTop.d),[450,175]);
 const clippedAtBottom=plannerConnectionGeometry(node,block,origin,rect(500,100,350,100));
 assert.equal(clippedAtBottom.hidden,false);
 assert.deepEqual(endpoint(clippedAtBottom.d),[450,125]);
 assert.deepEqual([clippedAtTop.targetX,clippedAtTop.targetY],[450,175]);
 assert.deepEqual([clippedAtBottom.targetX,clippedAtBottom.targetY],[450,125]);
});
test('fully clipped blocks retain usable geometry but hide their cord',()=>{
 for(const viewport of [rect(500,250,350,200),rect(500,0,350,150),rect(800,100,200,300)]){
  const result=plannerConnectionGeometry(node,block,origin,viewport);
  assert.equal(result.hidden,true);
  assert.deepEqual(endpoint(result.d),[450,150]);
 }
});
test('left task scrolling hides absent source dots and clamps partially visible dots',()=>{
 const partiallyVisible=plannerConnectionGeometry(node,block,origin,undefined,rect(100,195,300,300));
 assert.equal(partiallyVisible.hidden,false);
 assert.match(partiallyVisible.d,/^M 185 147\.5 C /);
 const absent=plannerConnectionGeometry(node,block,origin,undefined,rect(100,200,300,300));
 assert.equal(absent.hidden,true);
});
test('invalid or collapsed elements do not produce malformed SVG paths',()=>{
 assert.equal(plannerConnectionGeometry(rect(280,190,0,10),block,origin),null);
 assert.equal(plannerConnectionGeometry(node,rect(NaN,150,250,100),origin),null);
 assert.equal(plannerConnectionGeometry(node,block,rect(Infinity,50,800,600)),null);
});

function hookFixture(t){
 const hooks=[],pending=[],frames=new Map(),listeners=new Map(),paths=new Map(),hitPaths=new Map(),endpoints=new Map();
 let cursor=0,dirty=false,frameId=0,publications=0,result=[];
 const blockRect={...block},sourceRect={...node};
 const list={getBoundingClientRect:()=>rect(100,100,350,400)};
 const source={isConnected:true,getBoundingClientRect:()=>sourceRect,closest:()=>list};
 const target={isConnected:true,getBoundingClientRect:()=>blockRect};
 const root={getBoundingClientRect:()=>origin,querySelectorAll:selector=>selector.startsWith('circle')?endpoints.values():[...paths.values(),...hitPaths.values()]};
 const rootRef={current:root},nodes={current:new Map([['task',source]])},blocks={current:new Map([['task',target]])},viewport={current:{getBoundingClientRect:()=>rect(500,100,350,200)}};
 const harness={
  useRef(value){const index=cursor++;return hooks[index]??(hooks[index]={current:value});},
  useState(value){const index=cursor++;const entry=hooks[index]??(hooks[index]={value});return [entry.value,next=>{publications++;entry.value=typeof next==='function'?next(entry.value):next;dirty=true;}];},
  useLayoutEffect(fn,deps){const index=cursor++,old=hooks[index];if(!old||deps.some((dep,i)=>dep!==old.deps[i]))pending.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:fn()};});}
 };
 t.after(()=>{for(const entry of hooks)entry?.cleanup?.();});
 for(const [name,value] of Object.entries({__pandaConnectionHarness:harness,requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){}},window:{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}}})){
  const previous=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
  t.after(()=>previous?Object.defineProperty(globalThis,name,previous):delete globalThis[name]);
 }
 const render=(active=true,key='initial')=>{
  do{
   dirty=false;cursor=0;result=usePlannerConnections(rootRef,nodes,blocks,active,key,viewport);
   const ids=new Set(result.map(connection=>connection.taskId));for(const elements of [paths,hitPaths,endpoints])for(const id of elements.keys())if(!ids.has(id))elements.delete(id);
   for(const connection of result){
    for(const elements of [paths,hitPaths,endpoints]){
     let element=elements.get(connection.taskId);
     if(!element){const attrs=new Map();element={dataset:{taskId:connection.taskId},style:{visibility:'hidden'},attrs,getAttribute:name=>attrs.get(name)??null,hasAttribute:name=>attrs.has(name),setAttribute:(name,value)=>attrs.set(name,String(value)),removeAttribute:name=>attrs.delete(name)};elements.set(connection.taskId,element);}
     if(elements!==endpoints&&element.prop!==connection.d){element.setAttribute('d',connection.d);element.prop=connection.d;}
    }
   }
   while(pending.length)pending.shift()();
  }while(dirty);
  return result;
 };
 const flush=()=>{const queued=[...frames.values()];frames.clear();for(const callback of queued)callback(performance.now()+1000);};
 const scroll=()=>{for(const callback of listeners.get('scroll')??[])callback();};
 return {render,flush,scroll,paths,hitPaths,endpoints,frames,listeners,blockRect,sourceRect,get publications(){return publications;}};
}

test('scroll updates mounted paths without publishing React state or running at rest',t=>{
 const f=hookFixture(t),first=f.render(),path=f.paths.get('task');
 assert.equal(f.publications,1);assert.equal(f.frames.size,1);f.flush();assert.equal(f.frames.size,0);
 const original=path.getAttribute('d');f.blockRect.top=270;f.scroll();f.scroll();assert.equal(f.frames.size,1);f.flush();
 assert.equal(f.publications,1);assert.notEqual(path.getAttribute('d'),original);assert.deepEqual(endpoint(path.getAttribute('d')),[450,235]);
 assert.equal(path.style.visibility,'hidden');assert.equal(path.getAttribute('display'),null);assert.equal(f.frames.size,0);
 f.blockRect.top=320;f.scroll();f.flush();assert.equal(path.getAttribute('display'),'none');assert.equal(f.publications,1);
 f.blockRect.top=150;f.scroll();f.flush();assert.equal(path.getAttribute('display'),null);assert.strictEqual(f.render(),first);assert.equal(f.publications,1);
 // A layout-key change measures immediately without waiting for ResizeObserver or RAF.
 f.blockRect.top=180;f.render(true,'changed');assert.deepEqual(endpoint(path.getAttribute('d')),[450,180]);assert.equal(f.publications,1);
 f.render(false,'changed');assert.equal(f.publications,2);assert.equal(f.paths.size,0);assert.equal(f.frames.size,0);assert.equal(f.listeners.get('scroll').size,0);
});

test('right endpoint and geometric hover stroke follow the visible event without publishing on scroll',t=>{
 const f=hookFixture(t);f.render();f.flush();const path=f.paths.get('task'),hit=f.hitPaths.get('task'),dot=f.endpoints.get('task');
 const assertEndpoint=(x,y)=>{assert.equal(hit.getAttribute('d'),path.getAttribute('d'));assert.deepEqual([Number(dot.getAttribute('cx')),Number(dot.getAttribute('cy'))],[x,y]);};
 assertEndpoint(450,150);
 f.blockRect.top=270;f.scroll();f.flush();assertEndpoint(450,235);assert.equal(dot.getAttribute('display'),null);
 f.blockRect.top=320;f.scroll();f.flush();assert.equal(dot.getAttribute('display'),'none');assert.equal(hit.getAttribute('display'),'none');
 f.blockRect.top=150;f.scroll();f.flush();assertEndpoint(450,150);assert.equal(dot.getAttribute('display'),null);assert.equal(hit.getAttribute('display'),null);
 assert.equal(f.publications,1);assert.equal(f.frames.size,0);
});

test('cord hover resolves each task and ignores clipped or docking paths without capturing pointer events',()=>{
 const path=(taskId,at)=>{const attrs=new Map();return {dataset:{taskId},style:{},getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value),isPointInStroke:point=>point.x===at&&point.y===40};};
 const first=path('first',20),second=path('second',80),paths=[first,second];
 assert.equal(plannerThreadAtPoint(paths,{x:20,y:40}),'first');assert.equal(plannerThreadAtPoint(paths,{x:80,y:40}),'second');
 first.setAttribute('display','none');assert.equal(plannerThreadAtPoint(paths,{x:20,y:40}),null);
 second.style.visibility='hidden';assert.equal(plannerThreadAtPoint(paths,{x:80,y:40}),null);
 assert.equal(plannerThreadAtPoint(paths,{x:NaN,y:40}),null);
});
