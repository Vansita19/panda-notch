type Pose={transform:string;opacity?:number};
type MotionSpec={selector:string;duration:number;poses:Pose[]};
type MotionRecord={animation:Animation;button:HTMLElement;base:Pose;phase:'enter'|'loop'|'return';ripple?:boolean};
const rest:Pose={transform:'none',opacity:1};
const rhythm='cubic-bezier(.45,0,.55,1)';
const returnDuration=1000;
const rippleExitDuration=750;
const motions:MotionSpec[]=[
 {selector:'.menu-task-glow-one',duration:6600,poses:[rest,{transform:'translate(-20px,-20px) scale(1.08)',opacity:.88},{transform:'translate(12px,-30px) scale(1.02)',opacity:1},{transform:'translate(20px,6px) scale(.94)',opacity:.94},rest]},
 {selector:'.menu-task-glow-two',duration:7800,poses:[rest,{transform:'translate(22px,-12px) scale(.94)',opacity:.92},{transform:'translate(-18px,-25px) scale(1.12)',opacity:1},{transform:'translate(-26px,8px) scale(1.03)',opacity:.86},rest]},
 {selector:'.menu-task-glow-three',duration:6000,poses:[rest,{transform:'translate(-16px,22px) scale(1.14)',opacity:1},{transform:'translate(-28px,-8px) scale(.93)',opacity:.82},{transform:'translate(16px,-18px) scale(1.07)',opacity:.96},rest]},
 {selector:'.menu-focus-glow',duration:4400,poses:[rest,{transform:'translateY(-14px) scale(1.3)',opacity:1},{transform:'translateY(6px) scale(.86)',opacity:.8},rest]},
 {selector:'.menu-focus-core',duration:4400,poses:[{transform:'scale(.9)',opacity:0},{transform:'translateY(-10px) scale(1.24)',opacity:.46},{transform:'scale(.86)',opacity:.1},{transform:'scale(.9)',opacity:0}]},
 {selector:'.menu-links-glow',duration:6400,poses:[rest,{transform:'translate(12px,-20px) scale(1.08)',opacity:1},{transform:'translate(-14px,8px) scale(.96)',opacity:1},rest]},
 {selector:'.menu-ideas-heart',duration:3600,poses:[{transform:'translateY(0px) scale(1)',opacity:.92},{transform:'translateY(-2px) scale(1.09)',opacity:1},{transform:'translateY(0px) scale(1.02)',opacity:.93},{transform:'translateY(-1px) scale(1.065)',opacity:.99},{transform:'translateY(0px) scale(1)',opacity:.92}]},
 {selector:'.menu-ideas-aura',duration:3600,poses:[{transform:'translateY(0px) scale(1)',opacity:.68},{transform:'translateY(-3px) scale(1.17)',opacity:.9},{transform:'translateY(0px) scale(1.02)',opacity:.72},{transform:'translateY(-1px) scale(1.1)',opacity:.84},{transform:'translateY(0px) scale(1)',opacity:.68}]},
];
const rippleFrames:Keyframe[]=[
 {transform:'scale(.3)',opacity:0,offset:0},
 {transform:'scale(.564)',opacity:.45,offset:.16},
 {transform:'scale(1.0425)',opacity:.55,offset:.45},
 {transform:'scale(1.554)',opacity:.24,offset:.76},
 {transform:'scale(1.95)',opacity:0,offset:1}
];
const poseScale=(transform:string)=>{if(transform==='none')return 1;const scale=/scale\(([^,)]+)/.exec(transform);if(scale)return Number(scale[1])||1;const matrix=/matrix(?:3d)?\(([^)]+)\)/.exec(transform);if(!matrix)return 1;const values=matrix[1].split(',').map(Number);return Math.hypot(values[0],values[1])||1;};

/** Decorative loops live in WAAPI, never React's render cycle. Only the hovered card runs. */
export function createMenuCardMotion(){
 const running=new Map<HTMLElement,MotionRecord>();
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let hovered:HTMLElement|null=null;
 const disabled=()=>media.matches||document.documentElement.dataset.reduced==='true'||document.hidden;
 const sample=(node:HTMLElement):Pose=>{const style=getComputedStyle(node);return {transform:style.transform,opacity:Number(style.opacity)};};
 const animate=(node:HTMLElement,button:HTMLElement,spec:MotionSpec,current:Pose)=>{
  const base=running.get(node)?.base??current;
  running.get(node)?.animation.cancel();
  const frames=spec.poses.map(pose=>({...pose,easing:rhythm}));
  frames[0]={...frames[0],...current};frames[frames.length-1]={...frames[frames.length-1],...current};
  const animation=node.animate(frames,{duration:spec.duration,iterations:Infinity,fill:'both'});
  running.set(node,{animation,button,base,phase:'loop'});
 };
 const linksWave=(node:HTMLElement,button:HTMLElement,index:number,current:Pose)=>{
  const base=running.get(node)?.base??current;
  running.get(node)?.animation.cancel();
  // Neighboring strips share one continuous wave traveling to the right, with no flat reset.
  const frames=Array.from({length:17},(_,step)=>{
   const angle=step/16*Math.PI*2-index*.28;
   return {transform:`translateY(${(-Math.sin(angle)*9).toFixed(3)}px) scaleY(${(1+Math.sin(angle)*.18).toFixed(4)})`,opacity:1};
  });
  const animation=node.animate([current,frames[0]],{duration:400,easing:rhythm,fill:'both'});
  running.set(node,{animation,button,base,phase:'enter'});
  animation.onfinish=()=>{
   if(running.get(node)?.animation!==animation)return;
   const loop=node.animate(frames,{duration:4000,iterations:Infinity,easing:'linear',fill:'both'});
   animation.cancel();running.set(node,{animation:loop,button,base,phase:'loop'});
  };
 };
 const ripple=(node:HTMLElement,button:HTMLElement,index:number,current:Pose)=>{
  const base=running.get(node)?.base??current;
  running.get(node)?.animation.cancel();
  const loop=()=>{
   const animation=node.animate(rippleFrames,{duration:4800,delay:index*1600,iterations:Infinity,easing:'linear',fill:'both'});
   running.set(node,{animation,button,base,phase:'loop',ripple:true});
  };
  if((current.opacity??0)<=.005){loop();return;}
  // Reentry lets an already-visible wave fade outward before starting a new wavefront.
  const animation=node.animate([current,{transform:`scale(${poseScale(current.transform)+.18})`,opacity:0}],{duration:rippleExitDuration,easing:'linear',fill:'both'});
  running.set(node,{animation,button,base,phase:'enter',ripple:true});
  animation.onfinish=()=>{if(running.get(node)?.animation!==animation)return;loop();animation.cancel();};
 };
 const softenRings=(node:HTMLElement,button:HTMLElement,current:Pose)=>{
  const base=running.get(node)?.base??current;
  running.get(node)?.animation.cancel();
  const animation=node.animate([current,{transform:'none',opacity:.32}],{duration:500,easing:rhythm,fill:'both'});
  running.set(node,{animation,button,base,phase:'loop'});
 };
 const leave=(button:HTMLElement,instant=false)=>{
  if(hovered===button)hovered=null;
  // Read all painted poses before cancelling anything, so no card snaps to its CSS artwork first.
  const snapshots=[...running].filter(([,record])=>record.button===button&&(instant||record.phase!=='return')).map(([node,record])=>({node,record,current:sample(node)}));
  for(const {node,record,current} of snapshots){
   record.animation.cancel();running.delete(node);
   if(instant)continue;
   const target=record.ripple?{transform:`scale(${poseScale(current.transform)+.18})`,opacity:0}:record.base;
   const animation=node.animate([current,target],{duration:record.ripple?rippleExitDuration:returnDuration,easing:record.ripple?'linear':'cubic-bezier(.2,.6,.2,1)'});
   running.set(node,{...record,animation,phase:'return'});
   animation.onfinish=()=>{if(running.get(node)?.animation===animation)running.delete(node);};
  }
 };
 const stop=()=>{hovered=null;for(const record of running.values())record.animation.cancel();running.clear();};
 const enter=(button:HTMLElement)=>{
  if(hovered===button||disabled())return;
  if(hovered)leave(hovered);
  hovered=button;
  const jobs=motions.flatMap(spec=>Array.from(button.querySelectorAll<HTMLElement>(spec.selector),node=>({node,spec,current:sample(node)})));
  const ripples=Array.from(button.querySelectorAll<HTMLElement>('.menu-reminders-ripple'),(node,i)=>({node,i,current:sample(node)}));
  const resting=Array.from(button.querySelectorAll<HTMLElement>('.menu-reminders-rest'),node=>({node,current:sample(node)}));
  const bars=Array.from(button.querySelectorAll<HTMLElement>('.menu-wave-bar'),(node,i)=>({node,i,current:sample(node)}));
  for(const {node,spec,current} of jobs)animate(node,button,spec,current);
  for(const {node,current} of resting)softenRings(node,button,current);
  for(const {node,i,current} of ripples)ripple(node,button,i,current);
  for(const {node,i,current} of bars)linksWave(node,button,i,current);
 };
 const preference=()=>{if(disabled())stop();};
 const keyboard=()=>stop();
 media.addEventListener('change',preference);
 document.addEventListener('visibilitychange',preference);
 document.addEventListener('keydown',keyboard,true);
 const observer=new MutationObserver(preference);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduced']});
 return {enter,leave,dispose(){stop();media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',preference);document.removeEventListener('keydown',keyboard,true);observer.disconnect();}};
}
