import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Run the real hook and motion controller with deterministic layout-effect commits.
// ResizeObserver delivers only when a test requests it: navigation must measure before paint.
const bundled=await build({entryPoints:['src/useNotchMotion.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{
 name:'layout-effect-harness',setup(builder){
  builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
  builder.onResolve({filter:/^\.\/bridge$/},()=>({path:'bridge',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='react'?'export const useRef=(value)=>globalThis.__pandaMotionHarness.useRef(value);export const useLayoutEffect=(fn,deps)=>globalThis.__pandaMotionHarness.useLayoutEffect(fn,deps);':'export const host=(type,payload)=>globalThis.__pandaMotionHarness.host(type,payload);'}));
 }
}]});
const {useNotchMotion}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
function fixture(){
 const hooks=[],pending=[],sizes=[],observers=[],animations=[];let cursor=0,naturalHeight=173;
 const style=()=>({setProperty(name,value){this[name]=value;},getPropertyValue(name){return this[name]??'';},removeProperty(name){delete this[name];}});
 const surface={current:{offsetWidth:400,style:style(),dataset:{}}};
 const layout={current:{offsetWidth:400,get offsetHeight(){const limit=parseFloat(surface.current.style.getPropertyValue('--screen-height'));return Number.isFinite(limit)?Math.min(naturalHeight,limit):naturalHeight;},style:{},closest:()=>null}};
 const visual={current:{style:{},animate(frames,options){const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(animation);return animation;}}};
 const overlayAnimations=[],overlay={current:{style:{},offsetHeight:0,animate(frames,options){const animation={frames,options,cancel(){}};overlayAnimations.push(animation);return animation;}}};
 const harness={useRef(value){const index=cursor++;return hooks[index]??(hooks[index]={current:value});},useLayoutEffect(fn,deps){const index=cursor++,old=hooks[index];if(!old||deps.some((dep,i)=>dep!==old.deps[i])){pending.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:fn()};});}},host(type,payload){if(type==='resize')sizes.push(payload);}};
 globalThis.__pandaMotionHarness=harness;
 globalThis.getComputedStyle=node=>({clipPath:node.style.clipPath,getPropertyValue:name=>name==='--safe-top'?'28px':surface.current.style.getPropertyValue(name)});
 globalThis.matchMedia=()=>({matches:false});
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;this.nodes=[];observers.push(this);}observe(node){this.nodes.push(node);}disconnect(){this.disconnected=true;}};
 const render=(view,navigation,height,{reduced=false,open=true,closing=false,toastHeight=0,width=400,measureHeight,availableHeight}={})=>{surface.current.offsetWidth=width;naturalHeight=height;overlay.current.offsetHeight=toastHeight;cursor=0;useNotchMotion(surface,visual,layout,open,closing,reduced,()=>{},{width,view,navigation,toast:toastHeight>0,measureHeight,availableHeight},overlay);while(pending.length)pending.shift()();};
 const dispose=()=>{for(const hook of hooks)hook?.cleanup?.();};
 return {surface,layout,visual,sizes,observers,animations,overlay,overlayAnimations,render,dispose};
}
test('fresh Menu to Task plan measures tabs and content in the same pre-paint commit',()=>{
 const f=fixture();f.render('today',false,173);f.render('tasks',true,345);
 assert.equal(f.animations.length,1);
 assert.equal(f.visual.current.style.height,'345px');
 assert.match(f.animations[0].frames[0].clipPath,/172px/);
 assert.match(f.animations[0].frames[1].clipPath,/0px 0px 0px 0px/);
 assert.deepEqual(f.sizes.map(size=>size.height),[189,361]);
 assert.ok(f.sizes.every(size=>size.width===428));f.dispose();
});
test('same-width feature switches and navigation-only changes invalidate geometry, ticks do not',()=>{
 const f=fixture();f.render('today',false,173);f.render('today',true,219);
 assert.equal(f.animations.length,1);f.animations[0].onfinish();
 f.render('focus',true,410);assert.equal(f.animations.length,2);
 const observerCount=f.observers.length;f.render('focus',true,410);f.render('focus',true,410);
 assert.equal(f.animations.length,2);assert.equal(f.observers.length,observerCount);f.dispose();
});
test('rapid navigation reverses from the painted height and a stale finish cannot shrink the page',()=>{
 const f=fixture();f.render('today',false,173);f.render('tasks',true,345);const entering=f.animations[0];
 f.visual.current.style.clipPath='inset(0px 0px 65px 0px round 0px 0px 14px 14px)';
 f.render('today',true,219);const returning=f.animations[1];
 assert.ok(entering.cancelled);assert.match(returning.frames[0].clipPath,/65px/);
 const before=f.sizes.length;entering.onfinish();assert.equal(f.sizes.length,before);
 returning.onfinish();assert.equal(f.sizes.at(-1).height,235);f.dispose();
});
test('reduced motion settles the complete new page without starting an animation',()=>{
 const f=fixture();f.render('today',false,173,{reduced:true});f.render('tasks',true,345,{reduced:true});
 assert.equal(f.animations.length,0);assert.equal(f.sizes.at(-1).height,361);f.dispose();
});

test('outside feedback reserves and trims only extra native space while Menu height stays fixed',()=>{
 const f=fixture();f.render('today',false,173);const clip=f.visual.current.style.clipPath;
 f.render('today',false,173,{toastHeight:48});
 assert.equal(f.layout.current.offsetHeight,173);assert.equal(f.visual.current.style.height,'173px');assert.equal(f.visual.current.style.clipPath,clip);
 assert.equal(f.sizes.at(-1).height,245);assert.equal(f.overlay.current.style.transform,'translateY(181px)');assert.equal(f.animations.length,0);
 f.render('today',false,173,{toastHeight:0});assert.equal(f.sizes.at(-1).height,189);assert.equal(f.layout.current.offsetHeight,173);f.dispose();
});
test('feedback anchors to the visible panel edge after a larger canvas has been retained',()=>{
 const f=fixture();f.render('today',false,173);f.render('focus',true,410);f.animations.at(-1).onfinish();
 f.render('today',false,173);f.animations.at(-1).onfinish();assert.equal(f.visual.current.style.height,'410px');
 f.render('today',false,173,{toastHeight:48});
 assert.equal(f.overlay.current.style.transform,'translateY(181px)');assert.equal(f.sizes.at(-1).height,245);
 assert.equal(f.visual.current.style.height,'410px');f.dispose();
});
test('a detached reminder can appear and disappear while the closed notch stays at rail height',()=>{
 const f=fixture();f.render('today',false,28,{open:false});const clip=f.visual.current.style.clipPath;
 f.render('today',false,28,{open:false,toastHeight:40});
 assert.equal(f.layout.current.offsetHeight,28);assert.equal(f.visual.current.style.height,'28px');assert.equal(f.visual.current.style.clipPath,clip);
 assert.equal(f.sizes.at(-1).height,76);assert.equal(f.sizes.at(-1).open,false);assert.equal(f.overlay.current.style.transform,'translateY(36px)');assert.equal(f.animations.length,0);
 f.render('today',false,28,{open:false,toastHeight:0});assert.equal(f.sizes.at(-1).height,28);assert.equal(f.animations.length,0);f.dispose();
});
test('a reminder and Undo feedback stack can resize without remeasuring or expanding the notch',()=>{
 const f=fixture();f.render('tasks',true,345,{toastHeight:40});const clip=f.visual.current.style.clipPath;
 const overlayObserver=f.observers.find(observer=>observer.nodes.includes(f.overlay.current));assert.ok(overlayObserver);
 f.overlay.current.offsetHeight=88;overlayObserver.callback();
 assert.equal(f.sizes.at(-1).height,457);assert.equal(f.layout.current.offsetHeight,345);assert.equal(f.visual.current.style.clipPath,clip);assert.equal(f.animations.length,0);
 f.overlay.current.offsetHeight=40;overlayObserver.callback();assert.equal(f.sizes.at(-1).height,409);
 f.overlay.current.offsetHeight=0;overlayObserver.callback();assert.equal(f.sizes.at(-1).height,361);assert.equal(f.animations.length,0);f.dispose();
});

// The disappearing calendar retains its scroll viewport while the painted shell
// contracts to the compact checklist. Releasing that layout must be a no-op.
test('Compact clips to the checklist target without shrinking the exiting calendar viewport',()=>{
 const f=fixture();f.render('tasks',true,600,{width:800});
 const measureHeight=()=>300;
 f.render('tasks',true,600,{width:400,measureHeight});
 const exit=f.animations.at(-1);assert.ok(exit);
 assert.equal(f.layout.current.offsetHeight,600);
 assert.match(exit.frames.at(-1).clipPath,/inset\(0px 200px 300px 200px/);
 exit.onfinish();assert.equal(f.sizes.at(-1).height,316);
 const count=f.animations.length;
 f.render('tasks',true,300,{width:400});
 assert.equal(f.animations.length,count);assert.equal(f.sizes.at(-1).height,316);f.dispose();
});

test('a tall view reserves display space for detached notices before paint and restores its natural height',()=>{
 const f=fixture();f.render('tasks',true,800,{availableHeight:800});
 f.render('tasks',true,800,{availableHeight:800,toastHeight:40});
 assert.equal(f.layout.current.offsetHeight,751);
 assert.equal(f.surface.current.style.getPropertyValue('--screen-height'),'751px');
 assert.equal(f.overlay.current.style.transform,'translateY(759px)');
 assert.equal(f.sizes.at(-1).height,815);
 assert.ok(f.sizes.every(size=>size.height<=815));
 assert.ok(759+40<=f.sizes.at(-1).height,'the whole pill fits inside the native frame');
 assert.equal(f.layout.current.style.transform,undefined,'reserving space only changes the bottom viewport');
 assert.match(f.visual.current.style.clipPath,/^inset\(0px /);
 assert.equal(f.animations.length,0,'the new notice must not begin below the display during contraction');
 const observer=f.observers.find(observer=>!observer.disconnected&&observer.nodes.includes(f.overlay.current));
 f.overlay.current.offsetHeight=88;observer.callback();
 assert.equal(f.layout.current.offsetHeight,703);
 assert.equal(f.overlay.current.style.transform,'translateY(711px)');
 assert.equal(f.sizes.at(-1).height,815);
 assert.ok(711+88<=f.sizes.at(-1).height);
 f.overlay.current.offsetHeight=0;observer.callback();
 assert.equal(f.surface.current.style.getPropertyValue('--screen-height'),'800px');
 assert.equal(f.layout.current.offsetHeight,800);
 f.animations.at(-1)?.onfinish();
 assert.equal(f.overlay.current.style.transform,'translateY(808px)');
 assert.equal(f.sizes.at(-1).height,815);
 assert.ok(f.sizes.every(size=>size.height<=815));f.dispose();
});

test('a frozen Compact measurement still respects the current notice reserve',()=>{
 const f=fixture(),measureHeight=()=>780;
 f.render('tasks',true,800,{width:800,availableHeight:800});
 f.render('tasks',true,800,{width:400,availableHeight:800,toastHeight:40,measureHeight});
 assert.equal(f.layout.current.offsetHeight,751);
 assert.equal(f.overlay.current.style.transform,'translateY(759px)');
 assert.equal(f.sizes.at(-1).height,815);
 f.render('tasks',true,800,{width:400,availableHeight:800,toastHeight:0,measureHeight});
 f.animations.at(-1)?.onfinish();
 assert.equal(f.overlay.current.style.transform,'translateY(788px)','removing the reserve restores the frozen compact target, not the retained layout height');
 assert.equal(f.sizes.at(-1).height,796);f.dispose();
});
