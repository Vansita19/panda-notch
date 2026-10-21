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
 assert.ok(tasks.layers.every(layer=>layer.animations.at(-1).options.duration===420));
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

test('the links waveform loops its individual bars using only compositing properties',()=>environment(({button,Layer,active})=>{
 const card=button('menu-links-glow','menu-links-mask','menu-links-wave');
 card.layers.push(...Array.from({length:25},()=>new Layer('menu-wave-bar')));
 const motion=createMenuCardMotion();motion.enter(card);
 const bars=active().filter(animation=>animation.node.name==='menu-wave-bar');
 assert.equal(bars.length,25);assert.ok(bars.every(animation=>animation.options.iterations===Infinity));
 assert.notEqual(bars[0].frames[1].transform,bars[1].frames[1].transform);
 for(const animation of active())for(const frame of animation.frames)assert.ok(Object.keys(frame).every(key=>['transform','opacity','easing'].includes(key)));
 motion.leave(card);assert.equal(active().filter(animation=>animation.options.iterations===Infinity).length,0);
 motion.dispose();assert.equal(active().length,0);
}));
