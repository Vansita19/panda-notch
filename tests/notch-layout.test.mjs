import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Run the real hook and motion controller with deterministic layout-effect commits.
// ResizeObserver deliberately never delivers: navigation must measure before paint.
const bundled=await build({entryPoints:['src/useNotchMotion.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{
 name:'layout-effect-harness',setup(builder){
  builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
  builder.onResolve({filter:/^\.\/bridge$/},()=>({path:'bridge',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='react'?'export const useRef=(value)=>globalThis.__pandaMotionHarness.useRef(value);export const useLayoutEffect=(fn,deps)=>globalThis.__pandaMotionHarness.useLayoutEffect(fn,deps);':'export const host=(type,payload)=>globalThis.__pandaMotionHarness.host(type,payload);'}));
 }
}]});
const {useNotchMotion}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
function fixture(){
 const hooks=[],pending=[],sizes=[],observers=[],animations=[];let cursor=0;
 const surface={current:{offsetWidth:400,style:{},dataset:{}}};
 const layout={current:{offsetWidth:400,offsetHeight:173,style:{},closest:()=>null}};
 const visual={current:{style:{},animate(frames,options){const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(animation);return animation;}}};
 const overlayAnimations=[],overlay={current:{style:{},offsetHeight:0,animate(frames,options){const animation={frames,options,cancel(){}};overlayAnimations.push(animation);return animation;}}};
 const harness={useRef(value){const index=cursor++;return hooks[index]??(hooks[index]={current:value});},useLayoutEffect(fn,deps){const index=cursor++,old=hooks[index];if(!old||deps.some((dep,i)=>dep!==old.deps[i])){pending.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:fn()};});}},host(type,payload){if(type==='resize')sizes.push(payload);}};
 globalThis.__pandaMotionHarness=harness;
 globalThis.getComputedStyle=node=>({clipPath:node.style.clipPath,getPropertyValue:()=> '28px'});
 globalThis.matchMedia=()=>({matches:false});
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
 const render=(view,navigation,height,{reduced=false,open=true,closing=false,toastHeight=0}={})=>{layout.current.offsetHeight=height;overlay.current.offsetHeight=toastHeight;cursor=0;useNotchMotion(surface,visual,layout,open,closing,reduced,()=>{},{width:400,view,navigation,toast:toastHeight>0},overlay);while(pending.length)pending.shift()();};
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
