import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotchMotion} from '../src/notch-motion.mjs';
function fixture(){
 const surface={style:{},dataset:{}}, visual={style:{},animations:[],animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;}};this.animations.push(a);return a;}};
 const sizes=[],rest=[];
 const motion=createNotchMotion(surface,visual,(h,open)=>sizes.push([h,open]),()=>rest.push(true),()=>({clipPath:visual.style.clipPath}));
 return {surface,visual,sizes,rest,motion};
}
test('open reserves space once and only clips; close trims the native window on completion',()=>{
 const f=fixture();f.motion.to(33,{open:false,duration:0});f.motion.to(360,{open:true,duration:260});
 assert.equal(f.visual.animations.length,1);const a=f.visual.animations[0];
 assert.deepEqual(Object.keys(a.frames[0]),['clipPath']);assert.equal(f.surface.style.height,'360px');
 a.onfinish();f.motion.to(33,{open:false,duration:200});assert.equal(f.surface.style.height,'360px');
 f.visual.animations[1].onfinish();assert.equal(f.surface.style.height,'360px');assert.match(f.visual.style.clipPath,/327px/);assert.deepEqual(f.sizes.at(-1),[33,false]);
 assert.ok(f.sizes.length<=5);
});
test('reopening cancels a close and a stale completion cannot collapse the reopened panel',()=>{
 const f=fixture();f.motion.to(360,{open:true,duration:0});f.motion.to(33,{open:false,duration:200});
 const closing=f.visual.animations[0];f.visual.style.clipPath='inset(0px 0px 120px round 0px 0px 14px 14px)';
 f.motion.to(360,{open:true,duration:260});const reopening=f.visual.animations[1];
 assert.ok(closing.cancelled);assert.match(reopening.frames[0].clipPath,/120px/);
 closing.onfinish();assert.equal(f.surface.style.height,'360px');reopening.onfinish();assert.equal(f.surface.style.height,'360px');
});
test('reduced motion and keyboard changes settle immediately without animations',()=>{
 const f=fixture();f.motion.to(33,{open:false,duration:0});f.motion.to(360,{open:true,duration:0});
 assert.equal(f.visual.animations.length,0);assert.equal(f.surface.style.height,'360px');
});
test('open, close and interruptions always keep a 400px notch and never move rail controls sideways',()=>{
 const f=fixture(),sizes=[];
 f.surface.querySelector=()=>{throw new Error('Rail controls must stay in normal layout');};
 const m=createNotchMotion(f.surface,f.visual,(h,open,w)=>sizes.push({h,open,w}),()=>{},()=>({clipPath:f.visual.style.clipPath}));
 m.to(33,{open:false,duration:0});m.to(240,{open:true,duration:280});f.visual.animations[0].onfinish();
 m.to(33,{open:false,duration:240});f.visual.animations[1].onfinish();
 assert.ok(sizes.every(s=>s.w===400));
 for(const a of f.visual.animations)for(const frame of a.frames)assert.match(frame.clipPath,/^inset\(0px 0px [\d.]+px 0px/);
});

test('closing keeps its final painted clip instead of resetting the canvas at the finish boundary',()=>{
 const f=fixture();f.motion.to(360,{open:true,duration:0});f.motion.to(33,{open:false,duration:240});
 const a=f.visual.animations[0],end=a.frames.at(-1).clipPath;a.onfinish();
 assert.equal(f.visual.style.clipPath,end);assert.equal(f.visual.style.height,'360px');
 f.motion.to(33,{open:false,duration:240});assert.equal(f.visual.animations.length,1);
 f.motion.to(240,{open:true,duration:280});assert.equal(f.visual.animations[1].frames[0].clipPath,end);
});

test('planner width expands through a symmetric clip without scaling content',()=>{
 const f=fixture(),sizes=[];
 const m=createNotchMotion(f.surface,f.visual,(h,open,w)=>sizes.push({h,open,w}),()=>{},()=>({clipPath:f.visual.style.clipPath}));
 m.to(300,{open:true,duration:0,width:400});
 m.to(600,{open:true,duration:280,width:740});
 const a=f.visual.animations.at(-1);
 assert.ok(a);assert.match(a.frames[0].clipPath,/inset\(0px 170px 300px 170px/);
 assert.match(a.frames[1].clipPath,/inset\(0px 0px 0px 0px/);
 assert.equal(f.visual.style.width,'740px');
 assert.deepEqual(Object.keys(a.frames[0]),['clipPath']);
 assert.equal(sizes.at(-1).w,740);
 a.onfinish();assert.equal(sizes.at(-1).w,740);
});

test('width collapse reserves the old window until its edges have contracted',()=>{
 const f=fixture(),sizes=[];
 const m=createNotchMotion(f.surface,f.visual,(h,open,w)=>sizes.push(w),()=>{},()=>({clipPath:f.visual.style.clipPath}));
 m.to(600,{open:true,duration:0,width:740});m.to(300,{open:true,duration:280,width:400});
 const a=f.visual.animations.at(-1);
 assert.equal(sizes.at(-1),740);
 assert.match(a.frames[1].clipPath,/inset\(0px 170px 300px 170px/);
 a.onfinish();assert.equal(sizes.at(-1),400);
 assert.equal(f.visual.style.width,'740px');assert.equal(f.visual.style.left,'-170px');
});

test('width reversal continues from the currently painted edges and ignores stale completion',()=>{
 const f=fixture(),sizes=[];
 const m=createNotchMotion(f.surface,f.visual,(h,open,w)=>sizes.push(w),()=>{},()=>({clipPath:f.visual.style.clipPath}));
 m.to(300,{open:true,duration:0,width:400});m.to(600,{open:true,duration:280,width:740});
 const opening=f.visual.animations.at(-1);f.visual.style.clipPath='inset(0px 70px 100px 70px round 0px 0px 14px 14px)';
 m.to(300,{open:true,duration:280,width:400});const closing=f.visual.animations.at(-1);
 assert.ok(opening.cancelled);assert.match(closing.frames[0].clipPath,/inset\(0px 70px 100px 70px/);
 assert.equal(sizes.at(-1),600);opening.onfinish();assert.equal(sizes.at(-1),600);
 closing.onfinish();assert.equal(sizes.at(-1),400);
});

test('equal-height width changes still animate and reduced motion settles both dimensions',()=>{
 const f=fixture(),layout={style:{}};
 const m=createNotchMotion(f.surface,f.visual,()=>{},()=>{},()=>({clipPath:f.visual.style.clipPath}),layout);
 m.to(300,{open:true,duration:0,width:400});m.to(300,{open:true,duration:280,width:740});
 assert.equal(f.visual.animations.length,1);assert.equal(layout.style.width,'740px');assert.equal(layout.style.marginInline,'auto');
 m.to(300,{open:true,duration:0,width:400});
 assert.equal(f.visual.animations.length,1);assert.ok(f.visual.animations[0].cancelled);
 assert.match(f.visual.style.clipPath,/inset\(0px 170px 0px 170px/);assert.equal(layout.style.width,'400px');
});
