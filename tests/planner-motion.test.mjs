import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlannerMotion} from '../src/planner-motion.mjs';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.001,`${actual} != ${expected}`);
const translation=value=>{const numbers=value?.match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[0,0];return [numbers[0],numbers[1]||0];};
function fixture(compact=400,wide=800){
 let time=0,viewport=compact+28,surfaceWidth=compact;
 const animations=[],nodes=new Map();
 const keys=['.task-checklist','.planner-day','.panel-date','.panda-tabs','.rail-leading','.rail-menu','.panel-heading>.icon-button','.notch-corner-left','.notch-corner-right','.planner-thread'];
 const current=(node,name,fallback)=>{
  const animation=[...animations].reverse().find(item=>item.node===node&&!item.cancelled&&name in item.frames[0]);
  if(!animation)return fallback;
  const progress=Math.min(1,Math.max(0,(time-animation.start)/animation.options.duration));
  const a=animation.frames[0][name],b=animation.frames[1][name];
  if(name==='transform'){const from=translation(a),to=translation(b);return `translate(${from[0]+(to[0]-from[0])*progress}px, ${from[1]+(to[1]-from[1])*progress}px)`;}
  if(name==='width')return parseFloat(a)+(parseFloat(b)-parseFloat(a))*progress;
  return Number(a)+(Number(b)-Number(a))*progress;
 };
 for(const key of keys){const node={key,style:{},base:{left:0,top:0,width:1,height:24,visible:true},getBoundingClientRect(){const [x,y]=translation(current(this,'transform','translate(0px, 0px)'));return {left:viewport/2+this.base.left+x,top:this.base.top+y,width:current(this,'width',this.base.width),height:this.base.height};}};nodes.set(key,node);}
 const surface={querySelector:key=>nodes.get(key)??null,get offsetWidth(){return surfaceWidth;},getBoundingClientRect:()=>({left:(viewport-surfaceWidth)/2,top:0,width:surfaceWidth,height:600})};
 const controller=createPlannerMotion({readStyle:node=>({opacity:String(current(node,'opacity',node.style.opacity??1)),visibility:node.base.visible?'visible':'hidden',display:'block',transform:'none'}),animate:(node,frames,options)=>{
  const animation={node,frames,options,start:time,cancelled:false,finished:false,cancel(){this.cancelled=true;}};animations.push(animation);return animation;
 }});
 const layout=(expanded,{retained=false,nativeWidth}={})=>{
  surfaceWidth=expanded?wide:compact;if(nativeWidth!==undefined)viewport=nativeWidth;
  const left=-surfaceWidth/2,contentWidth=surfaceWidth-36,columnWidth=(wide-72)/2;
  for(const node of nodes.values())Object.assign(node.base,{top:100,width:30,height:24,visible:true});
  Object.assign(nodes.get('.task-checklist').base,{left:left+18,width:expanded?columnWidth:contentWidth,height:250});
  Object.assign(nodes.get('.planner-day').base,{left:expanded?-wide/2+18+columnWidth+36:left+18+columnWidth+36,width:columnWidth,height:440,visible:expanded||retained});
  for(const key of ['.panel-date','.panda-tabs'])Object.assign(nodes.get(key).base,{left:left+18,width:key==='.panda-tabs'?contentWidth:contentWidth-25});
  Object.assign(nodes.get('.rail-leading').base,{left:left+14});Object.assign(nodes.get('.rail-menu').base,{left:-left-62});
  Object.assign(nodes.get('.panel-heading>.icon-button').base,{left:-left-40});
  Object.assign(nodes.get('.notch-corner-left').base,{left:left-14,width:14});Object.assign(nodes.get('.notch-corner-right').base,{left:-left,width:14});
  Object.assign(nodes.get('.planner-thread').base,{left:left+18,width:retained?wide-36:contentWidth,height:487});
 };
 const rect=key=>{const node=nodes.get(key),value=node.getBoundingClientRect();return {...value,left:value.left-viewport/2};};
 const advance=elapsed=>{time+=elapsed;for(const animation of animations)if(!animation.cancelled&&!animation.finished&&time-animation.start>=animation.options.duration){animation.finished=true;animation.onfinish?.();}};
 const play=expanded=>controller.play(surface,{expanded,duration:280,easing:'linear'});
 layout(false);controller.play(surface,{expanded:false,reduced:true});
 return {controller,surface,nodes,animations,layout,rect,advance,play,setViewport:value=>{viewport=value;},opacity:key=>Number(current(nodes.get(key),'opacity',nodes.get(key).style.opacity??1))};
}

test('all stable controls preserve their first painted screen position when native width expands',()=>{
 const f=fixture(),selectors=['.task-checklist','.panel-date','.panda-tabs','.rail-leading','.rail-menu','.panel-heading>.icon-button','.notch-corner-left','.notch-corner-right'];
 const before=new Map(selectors.map(key=>[key,f.rect(key)]));f.controller.capture(f.surface);f.layout(true);f.play(true);
 for(const key of selectors){close(f.rect(key).left,before.get(key).left);if(['.task-checklist','.panda-tabs'].includes(key))close(f.rect(key).width,before.get(key).width);}
 f.setViewport(828);for(const key of selectors)close(f.rect(key).left,before.get(key).left);
 assert.equal(f.opacity('.planner-day'),0);close(f.rect('.planner-day').left,f.nodes.get('.planner-day').base.left+28);
 f.advance(280);close(f.rect('.task-checklist').left,-382);close(f.rect('.panda-tabs').width,764);assert.equal(f.opacity('.planner-day'),1);
 assert.ok(f.animations.every(animation=>animation.frames.every(frame=>!frame.transform?.includes('scale'))));
});
test('Compact fades and slides the calendar right, then holds it hidden through layout release',()=>{
 const f=fixture();f.layout(true,{nativeWidth:828});f.controller.play(f.surface,{expanded:true,reduced:true});
 const before=f.rect('.task-checklist');f.controller.capture(f.surface);f.layout(false,{retained:true});f.play(false);
 close(f.rect('.task-checklist').left,before.left);assert.equal(f.opacity('.planner-day'),1);
 f.advance(130);assert.ok(f.opacity('.planner-day')<1);f.advance(150);
 assert.equal(f.opacity('.planner-day'),0);assert.equal(f.opacity('.planner-thread'),0);close(f.rect('.task-checklist').left,-182);
 f.advance(100);assert.equal(f.opacity('.planner-day'),0);
 f.setViewport(428);close(f.rect('.task-checklist').left,-182);f.layout(false);f.controller.finish(f.surface);
 close(f.rect('.task-checklist').left,-182);assert.ok(f.animations.every(animation=>animation.cancelled));
});
test('capped expansion interpolates real checklist width without scaling or a finish jump',()=>{
 const f=fixture(720,1200);f.controller.capture(f.surface);f.layout(true,{nativeWidth:1228});f.play(true);
 close(f.rect('.task-checklist').width,684);f.advance(280);close(f.rect('.task-checklist').width,564);
 f.controller.capture(f.surface);f.layout(false,{retained:true});f.play(false);close(f.rect('.task-checklist').width,564);
 f.advance(140);close(f.rect('.task-checklist').width,624);f.advance(140);close(f.rect('.task-checklist').width,684);
 f.layout(false,{nativeWidth:748});f.controller.finish(f.surface);close(f.rect('.task-checklist').width,684);close(f.rect('.task-checklist').left,-342);
});
test('rapid reversal samples painted position, width and opacity before canceling prior animations',()=>{
 const f=fixture(720,1200);f.controller.capture(f.surface);f.layout(true,{nativeWidth:1228});f.play(true);f.advance(90);
 const before=f.rect('.task-checklist'),day=f.rect('.planner-day'),opacity=f.opacity('.planner-day'),old=f.animations.slice();
 f.controller.capture(f.surface);f.layout(false,{retained:true});f.controller.prepare();
 // Target measurement can now see the actual compact width, before FLIP restores the painted width.
 close(f.rect('.task-checklist').width,684);f.play(false);
 close(f.rect('.task-checklist').left,before.left);close(f.rect('.task-checklist').width,before.width);close(f.rect('.planner-day').left,day.left);close(f.opacity('.planner-day'),opacity);
 assert.ok(old.every(animation=>animation.cancelled));f.advance(70);
 const again=f.rect('.task-checklist'),dayAgain=f.rect('.planner-day'),opacityAgain=f.opacity('.planner-day'),threadOpacityAgain=f.opacity('.planner-thread');
 f.controller.capture(f.surface);f.layout(true);f.controller.prepare();f.play(true);
 close(f.rect('.task-checklist').left,again.left);close(f.rect('.task-checklist').width,again.width);close(f.rect('.planner-day').left,dayAgain.left);close(f.opacity('.planner-day'),opacityAgain);close(f.opacity('.planner-thread'),threadOpacityAgain);
 f.advance(280);close(f.rect('.task-checklist').left,-582);close(f.rect('.task-checklist').width,564);assert.equal(f.opacity('.planner-day'),1);
 // Stale callbacks cannot cancel the current, settled state.
 old.forEach(animation=>animation.onfinish?.());close(f.rect('.task-checklist').left,-582);assert.equal(f.opacity('.planner-day'),1);
});
test('reduced motion settles immediately and dispose removes held exit effects',()=>{
 const f=fixture();f.controller.capture(f.surface);f.layout(true);f.controller.play(f.surface,{expanded:true,reduced:true});assert.equal(f.animations.length,0);close(f.rect('.task-checklist').left,-382);
 f.controller.capture(f.surface);f.layout(false,{retained:true});f.controller.play(f.surface,{expanded:false,reduced:true});assert.equal(f.animations.length,0);assert.equal(f.opacity('.planner-day'),0);
 f.layout(false);f.controller.dispose();assert.equal(f.nodes.get('.planner-day').style.opacity,undefined);
});
