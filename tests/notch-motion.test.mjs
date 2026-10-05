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
 f.visual.animations[1].onfinish();assert.equal(f.surface.style.height,'33px');assert.deepEqual(f.sizes.at(-1),[33,false]);
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
