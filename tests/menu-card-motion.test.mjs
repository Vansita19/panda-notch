import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

// Exercise the production helper without opening a browser or substituting its logic.
const bundled=await build({entryPoints:[fileURLToPath(new URL('../src/components/menu-card-motion.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {createMenuCardMotion}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));

class Events{
 listeners=new Map();
 addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
 removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
 emit(type){for(const listener of [...(this.listeners.get(type)??[])])listener({type});}
 get count(){return [...this.listeners.values()].reduce((total,listeners)=>total+listeners.size,0);}
}
function environment(run){
 const originals=new Map(['document','matchMedia','getComputedStyle','MutationObserver'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const document=new Events();document.documentElement={dataset:{}};document.hidden=false;
 const media=new Events();media.matches=false;
 const observers=[],animations=[];
 class Observer{constructor(callback){this.callback=callback;this.connected=false;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}}
 class Layer{
  constructor(name,opacity=1,transform='none'){this.name=name;this.computed={transform,opacity:String(opacity)};this.animations=[];}
  animate(frames,options){
   const animation={node:this,frames,options,cancelled:false,finished:false,onfinish:null,cancel(){this.cancelled=true;},finish(){this.finished=true;this.onfinish?.();}};
   this.animations.push(animation);animations.push(animation);return animation;
  }
 }
 const button=(...names)=>{
  const layers=names.map(name=>new Layer(name,name==='menu-focus-core'||name==='menu-links-wave'?0:1,name==='menu-focus-core'?'scale(.9)':'none'));
  return {layers,querySelectorAll(selector){return layers.filter(layer=>selector==='.'+layer.name);}};
 };
 Object.assign(globalThis,{document,matchMedia:()=>media,getComputedStyle:node=>node.computed,MutationObserver:Observer});
 try{return run({document,media,observers,animations,button,Layer,active:()=>animations.filter(animation=>!animation.cancelled&&!animation.finished)});}
 finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
}

test('only the hovered card loops, and repeated pointer moves do not restart it',()=>environment(({button,animations,active})=>{
 const tasks=button('menu-task-glow-one','menu-task-glow-two','menu-task-glow-three'),focus=button('menu-focus-glow','menu-focus-core');
 const motion=createMenuCardMotion();motion.enter(tasks);
 assert.equal(active().length,3);assert.ok(active().every(animation=>animation.options.iterations===Infinity));
 motion.enter(tasks);motion.enter(tasks);assert.equal(animations.length,3);
 motion.enter(focus);
 assert.ok(tasks.layers.every(layer=>layer.animations[0].cancelled));
 assert.equal(active().filter(animation=>animation.options.iterations===Infinity).length,2);
 assert.ok(tasks.layers.every(layer=>layer.animations.at(-1).options.duration>=900));
 motion.dispose();assert.equal(active().length,0);
}));

test('leaving samples the painted pose before cancelling and returns to the original artwork',()=>environment(({button,active})=>{
 const card=button('menu-task-glow-one'),layer=card.layers[0],motion=createMenuCardMotion();motion.enter(card);
 const loop=layer.animations[0];layer.computed={transform:'matrix(1.04, 0, 0, 1.04, 9, -12)',opacity:'.91'};
 motion.leave(card);const returning=layer.animations.at(-1);
 assert.equal(loop.cancelled,true);
 assert.deepEqual(returning.frames[0],{transform:layer.computed.transform,opacity:.91});
 assert.deepEqual(returning.frames[1],{transform:'none',opacity:1});
 assert.equal(returning.options.iterations,undefined);
 returning.finish();assert.equal(active().length,0);
 const count=layer.animations.length;motion.leave(card);assert.equal(layer.animations.length,count);
 motion.dispose();
}));

test('rapid reentry cancels the return animation and resumes from its visible intermediate pose',()=>environment(({button,active})=>{
 const card=button('menu-focus-glow','menu-focus-core'),layer=card.layers[0],motion=createMenuCardMotion();
 motion.enter(card);layer.computed={transform:'matrix(1.1, 0, 0, 1.1, 0, -6)',opacity:'.9'};motion.leave(card);
 const returning=layer.animations.at(-1);
 layer.computed={transform:'matrix(1.03, 0, 0, 1.03, 0, -2)',opacity:'.97'};motion.enter(card);
 const resumed=layer.animations.at(-1);
 assert.equal(returning.cancelled,true);assert.equal(resumed.options.iterations,Infinity);
 assert.deepEqual({transform:resumed.frames[0].transform,opacity:resumed.frames[0].opacity},{transform:layer.computed.transform,opacity:.97});
 // A stale completion callback must not remove the new loop's ownership.
 returning.finish();motion.leave(card);
 assert.equal(resumed.cancelled,true);
 for(const animation of active())animation.finish();
 assert.equal(active().length,0);motion.dispose();
}));

test('OS and Panda reduced-motion preferences prevent loops and cancel in-flight motion',()=>environment(({button,media,document,observers,animations,active})=>{
 const card=button('menu-task-glow-one'),motion=createMenuCardMotion();
 media.matches=true;motion.enter(card);assert.equal(animations.length,0);
 media.matches=false;document.documentElement.dataset.reduced='true';motion.enter(card);assert.equal(animations.length,0);
 document.documentElement.dataset.reduced='false';motion.enter(card);assert.equal(active().length,1);
 document.documentElement.dataset.reduced='true';observers[0].callback();assert.equal(active().length,0);
 document.documentElement.dataset.reduced='false';motion.enter(card);assert.equal(active().length,1);
 media.matches=true;media.emit('change');assert.equal(active().length,0);
 motion.dispose();
}));

test('keyboard input, hidden documents, and unmount release every animation and listener',()=>environment(({button,document,media,observers,active})=>{
 const card=button('menu-task-glow-one','menu-task-glow-two'),motion=createMenuCardMotion();
 motion.enter(card);document.emit('keydown');assert.equal(active().length,0);
 motion.enter(card);document.hidden=true;document.emit('visibilitychange');assert.equal(active().length,0);
 motion.enter(card);assert.equal(active().length,0);
 document.hidden=false;motion.enter(card);motion.leave(card);assert.equal(active().length,2);
 motion.dispose();assert.equal(active().length,0);
 assert.equal(document.count,0);assert.equal(media.count,0);assert.ok(observers.every(observer=>!observer.connected));
}));

test('Focus has a visible breathing peak while preserving its two artwork layers',()=>environment(({button,active})=>{
 const card=button('menu-focus-glow','menu-focus-core'),motion=createMenuCardMotion();motion.enter(card);
 const loops=active();assert.equal(loops.length,2);
 const scales=loops.flatMap(animation=>animation.frames.map(frame=>Number(/scale\(([^)]+)\)/.exec(frame.transform)?.[1]??1)));
 assert.ok(Math.max(...scales)>=1.25);
 const core=loops.find(animation=>animation.node.name==='menu-focus-core');assert.ok(Math.max(...core.frames.map(frame=>frame.opacity))>=.35);
 motion.dispose();
}));

const scaleOf=transform=>Number(/scale\(([^)]+)\)/.exec(transform)?.[1]??1);
const yOf=transform=>Number(/translateY\(([-\d.]+)px\)/.exec(transform)?.[1]??0);
const poseOf=frame=>({transform:frame.transform,opacity:frame.opacity});
const sampleY=(frames,phase)=>{
 phase=(phase%1+1)%1;const stops=frames.map((frame,i)=>({frame,offset:frame.offset??i/(frames.length-1)}));
 const index=Math.max(1,stops.findIndex(stop=>stop.offset>=phase)),a=stops[index-1],b=stops[index];
 const fraction=(phase-a.offset)/(b.offset-a.offset||1);return yOf(a.frame.transform)+(yOf(b.frame.transform)-yOf(a.frame.transform))*fraction;
};
const reminderCard=(button,Layer)=>{const card=button('menu-reminders-rest');card.layers.push(...Array.from({length:3},()=>new Layer('menu-reminders-ripple',0,'scale(.3)')));return card;};

test('Ideas heart and aura keep a gentle double breath in transform and opacity only',()=>environment(({button,Layer,active})=>{
 const card=button();card.layers.push(new Layer('menu-ideas-heart',.92,'translateY(0px) scale(1)'),new Layer('menu-ideas-aura',.68,'translateY(0px) scale(1)'));
 const motion=createMenuCardMotion();motion.enter(card);const loops=active();assert.equal(loops.length,2);
 for(const animation of loops){
  assert.equal(animation.options.iterations,Infinity);assert.ok(animation.options.duration>=3000);
  assert.deepEqual(poseOf(animation.frames[0]),poseOf(animation.frames.at(-1)));
  const scales=animation.frames.map(frame=>scaleOf(frame.transform));
  const peaks=scales.filter((scale,i)=>i>0&&i<scales.length-1&&scale>scales[i-1]&&scale>scales[i+1]);assert.equal(peaks.length,2);
  assert.ok(scales.every(scale=>scale>=1&&scale<=1.2));
  for(const frame of animation.frames)assert.ok(Object.keys(frame).every(key=>['transform','opacity','easing','offset'].includes(key)));
 }
 motion.leave(card);assert.equal(active().filter(animation=>animation.options.iterations===Infinity).length,0);motion.dispose();assert.equal(active().length,0);
}));

test('Links joins each original art strip into a continuous left-to-right wave without dimming',()=>environment(({button,Layer,active})=>{
 const card=button('menu-links-glow','menu-links-mask','menu-links-wave');
 card.layers.push(...Array.from({length:25},()=>new Layer('menu-wave-bar')));
 const motion=createMenuCardMotion();motion.enter(card);
 const joining=active().filter(animation=>animation.node.name==='menu-wave-bar');
 assert.equal(joining.length,25);assert.ok(joining.every(animation=>animation.options.duration===400&&animation.options.iterations!==Infinity));
 assert.ok(joining.every(animation=>animation.frames.every(frame=>frame.opacity===1)));
 joining.forEach(animation=>animation.finish());
 const bars=active().filter(animation=>animation.node.name==='menu-wave-bar');
 assert.equal(bars.length,25);assert.ok(bars.every(animation=>animation.options.iterations===Infinity&&animation.options.duration===4000));
 bars.forEach((animation,i)=>{
  assert.deepEqual(poseOf(joining[i].frames.at(-1)),poseOf(animation.frames[0]));
  assert.deepEqual(poseOf(animation.frames[0]),poseOf(animation.frames.at(-1)));
  assert.ok(Math.max(...animation.frames.map(frame=>Math.abs(yOf(frame.transform))))>=8);
  const scales=animation.frames.map(frame=>Number(/scaleY\(([^)]+)\)/.exec(frame.transform)?.[1]??1));
  assert.ok(scales.every(scale=>scale>=.819&&scale<=1.181));assert.ok(Math.min(...scales)<=.84&&Math.max(...scales)>=1.16);
 });
 assert.ok(bars.some((animation,i)=>i>0&&animation.frames[0].transform!==bars[i-1].frames[0].transform));
 const travelError=lag=>bars.slice(1).reduce((sum,animation,i)=>sum+Array.from({length:20},(_,t)=>{const phase=t/20;return (sampleY(animation.frames,phase+lag)-sampleY(bars[i].frames,phase))**2;}).reduce((a,b)=>a+b,0),0);
 const lags=Array.from({length:16},(_,i)=>(i+1)/100);
 assert.ok(Math.min(...lags.map(travelError))<Math.min(...lags.map(lag=>travelError(-lag)))*.7,'A crest must reach each right neighbor after its left neighbor');
 assert.equal(card.layers.find(layer=>layer.name==='menu-links-mask').animations.length,0);
 assert.equal(card.layers.find(layer=>layer.name==='menu-links-wave').animations.length,0);
 assert.ok(active().every(animation=>animation.frames.every(frame=>frame.opacity===1)));
 for(const animation of active())for(const frame of animation.frames)assert.ok(Object.keys(frame).every(key=>['transform','opacity','easing','offset'].includes(key)));
 motion.leave(card);assert.equal(active().filter(animation=>animation.options.iterations===Infinity).length,0);
 motion.dispose();assert.equal(active().length,0);
}));

test('fresh reminder overlay loops grow monotonically and fade before wrapping',()=>environment(({button,Layer,active})=>{
 const card=reminderCard(button,Layer),motion=createMenuCardMotion();motion.enter(card);
 const loops=active().filter(animation=>animation.node.name==='menu-reminders-ripple');assert.equal(loops.length,3);
 for(const animation of loops){
  const scales=animation.frames.map(frame=>scaleOf(frame.transform));
  assert.ok(scales.every((scale,index)=>index===0||scale>=scales[index-1]));
  assert.equal(scales[0],.3);assert.equal(scales.at(-1),1.95);
  assert.equal(animation.frames[0].opacity,0);assert.equal(animation.frames.at(-1).opacity,0);
  assert.equal(Math.max(...animation.frames.map(frame=>frame.opacity)),.55);
  for(const frame of animation.frames)assert.ok(Object.keys(frame).every(key=>['transform','opacity','offset'].includes(key)));
 }
 motion.dispose();assert.equal(active().length,0);
}));

test('reminder exit samples its painted radius and fades farther outward while artwork returns',()=>environment(({button,Layer,active,animations})=>{
 const card=reminderCard(button,Layer),motion=createMenuCardMotion();motion.enter(card);
 const entering=active(),ripples=card.layers.slice(1);card.layers[0].computed.opacity='.32';
 ripples.forEach((layer,i)=>{layer.computed={transform:`matrix(${.6+i*.4}, 0, 0, ${.6+i*.4}, 0, 0)`,opacity:String(.5-i*.1)};});
 motion.leave(card);const returns=active(),count=animations.length;
 assert.equal(returns.length,4);assert.ok(entering.every(animation=>animation.cancelled));
 const exiting=returns.filter(animation=>animation.node.name==='menu-reminders-ripple');assert.equal(exiting.length,3);
 exiting.forEach((animation,i)=>{assert.deepEqual(poseOf(animation.frames[0]),{transform:ripples[i].computed.transform,opacity:Number(ripples[i].computed.opacity)});assert.equal(animation.options.duration,750);assert.ok(Math.abs(scaleOf(animation.frames.at(-1).transform)-(.6+i*.4+.18))<.001);assert.equal(animation.frames.at(-1).opacity,0);});
 const resting=returns.find(animation=>animation.node.name==='menu-reminders-rest');assert.equal(resting.options.duration,1000);assert.equal(resting.frames.at(-1).opacity,1);
 entering.forEach(animation=>animation.finish());assert.equal(animations.length,count);
 motion.leave(card);assert.equal(animations.length,count);
 returns.forEach(animation=>animation.finish());assert.equal(active().length,0);
 motion.dispose();
}));

test('rapid reminder reentry finishes its visible ripple outward before starting a fresh loop',()=>environment(({button,Layer,active,animations})=>{
 const card=reminderCard(button,Layer),layer=card.layers[1],motion=createMenuCardMotion();motion.enter(card);
 layer.computed={transform:'matrix(.9, 0, 0, .9, 0, 0)',opacity:'.4'};motion.leave(card);const returning=layer.animations.at(-1);
 layer.computed={transform:'matrix(1.1, 0, 0, 1.1, 0, 0)',opacity:'.25'};motion.enter(card);const joining=layer.animations.at(-1);
 assert.equal(returning.cancelled,true);assert.notEqual(joining.options.iterations,Infinity);assert.equal(joining.options.duration,750);
 assert.deepEqual(poseOf(joining.frames[0]),{transform:layer.computed.transform,opacity:.25});
 assert.ok(scaleOf(joining.frames.at(-1).transform)>=1.28-.001);assert.equal(joining.frames.at(-1).opacity,0);
 const before=animations.length;returning.finish();assert.equal(animations.length,before);joining.finish();
 assert.equal(layer.animations.at(-1).options.iterations,Infinity);assert.equal(layer.animations.at(-1).options.duration,4800);
 motion.dispose();const count=animations.length;joining.finish();assert.equal(animations.length,count);assert.equal(active().length,0);
}));

test('reminders start three fresh overlay ripples immediately while dimming their resting artwork',()=>environment(({button,Layer,active})=>{
 const card=button('menu-reminders-rest');
 card.layers.push(...Array.from({length:3},()=>new Layer('menu-reminders-ripple',0,'scale(.3)')));
 const motion=createMenuCardMotion();motion.enter(card);
 const loops=active().filter(animation=>animation.node.name==='menu-reminders-ripple');
 assert.equal(loops.length,3,'Three dedicated overlay ripples must start on hover');
 assert.deepEqual(loops.map(animation=>animation.options.delay),[0,1600,3200]);
 assert.ok(loops.every(animation=>animation.options.iterations===Infinity&&animation.options.duration===4800));
 const resting=active().find(animation=>animation.node.name==='menu-reminders-rest');
 assert.equal(resting?.frames.at(-1).opacity,.32);motion.dispose();
}));

test('keyboard and reduced motion cancel ripple joins without allowing stale loops to restart',()=>environment(({button,Layer,document,observers,animations,active})=>{
 const card=reminderCard(button,Layer),layer=card.layers[1],motion=createMenuCardMotion();motion.enter(card);
 layer.computed={transform:'matrix(1.1, 0, 0, 1.1, 0, 0)',opacity:'.3'};motion.leave(card);motion.enter(card);
 const joining=layer.animations.at(-1);document.emit('keydown');assert.equal(active().length,0);
 const stopped=animations.length;joining.finish();assert.equal(animations.length,stopped);
 motion.enter(card);const nextJoin=layer.animations.at(-1);document.documentElement.dataset.reduced='true';observers[0].callback();assert.equal(active().length,0);
 const reduced=animations.length;nextJoin.finish();assert.equal(animations.length,reduced);
 motion.dispose();assert.equal(active().length,0);assert.equal(document.count,0);
}));
