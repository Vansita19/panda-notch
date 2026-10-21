type Pose={transform:string;opacity?:number};
type MotionSpec={selector:string;duration:number;poses:Pose[]};
type MotionRecord={animation:Animation;button:HTMLElement;base:Pose;phase:'enter'|'loop'|'return'};
const rest:Pose={transform:'none',opacity:1};
const rhythm='cubic-bezier(.45,0,.55,1)';
const returnDuration=1000;
const motions:MotionSpec[]=[
 {selector:'.menu-task-glow-one',duration:6600,poses:[rest,{transform:'translate(-20px,-20px) scale(1.08)',opacity:.88},{transform:'translate(12px,-30px) scale(1.02)',opacity:1},{transform:'translate(20px,6px) scale(.94)',opacity:.94},rest]},
 {selector:'.menu-task-glow-two',duration:7800,poses:[rest,{transform:'translate(22px,-12px) scale(.94)',opacity:.92},{transform:'translate(-18px,-25px) scale(1.12)',opacity:1},{transform:'translate(-26px,8px) scale(1.03)',opacity:.86},rest]},
 {selector:'.menu-task-glow-three',duration:6000,poses:[rest,{transform:'translate(-16px,22px) scale(1.14)',opacity:1},{transform:'translate(-28px,-8px) scale(.93)',opacity:.82},{transform:'translate(16px,-18px) scale(1.07)',opacity:.96},rest]},
 {selector:'.menu-focus-glow',duration:5200,poses:[rest,{transform:'translateY(-10px) scale(1.18)',opacity:1},{transform:'translateY(4px) scale(.84)',opacity:.72},rest]},
 {selector:'.menu-focus-core',duration:5200,poses:[{transform:'scale(.9)',opacity:0},{transform:'translateY(-8px) scale(1.16)',opacity:.3},{transform:'scale(.82)',opacity:.06},{transform:'scale(.9)',opacity:0}]},
 {selector:'.menu-links-glow',duration:6400,poses:[rest,{transform:'translate(12px,-20px) scale(1.08)',opacity:1},{transform:'translate(-14px,8px) scale(.96)',opacity:1},rest]},
 {selector:'.menu-ideas-glow',duration:6800,poses:[rest,{transform:'translate(18px,-22px) rotate(-7deg) scale(1.12)',opacity:.86},{transform:'translate(-16px,-8px) rotate(5deg) scale(.92)',opacity:1},{transform:'translate(8px,10px) scale(1.06)',opacity:.9},rest]},
];
const waves=[
 {selector:'.menu-reminders-ring-one',radius:53.2194,phase:.27},
 {selector:'.menu-reminders-ring-two',radius:68.051,phase:.27+1/3},
 {selector:'.menu-reminders-ring-three',radius:82.8827,phase:.27+2/3},
];
const waveStops=[{phase:0,opacity:0},{phase:.14,opacity:.65},{phase:.3,opacity:1},{phase:.62,opacity:.55},{phase:1,opacity:0}];
const waveRadius=(phase:number)=>8+196*phase;
const waveOpacity=(phase:number)=>{const index=waveStops.findIndex(stop=>stop.phase>=phase),end=waveStops[Math.max(0,index)],start=waveStops[Math.max(0,index-1)],fraction=end.phase===start.phase?0:(phase-start.phase)/(end.phase-start.phase);return start.opacity+(end.opacity-start.opacity)*fraction;};
const wavePose=(radius:number,phase:number):Pose=>({transform:`scale(${(waveRadius(phase)/radius).toFixed(5)})`,opacity:waveOpacity(phase)});
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
 const wave=(node:HTMLElement,button:HTMLElement,spec:typeof waves[number],current:Pose)=>{
  const base=running.get(node)?.base??current;
  running.get(node)?.animation.cancel();
  // Join the outgoing wave from its painted radius; never pull a visible ring inward on reentry.
  const currentPhase=(spec.radius*poseScale(current.transform)-8)/196;
  const phase=Math.min(.995,Math.max(spec.phase,currentPhase+.035));
  const animation=node.animate([current,wavePose(spec.radius,phase)],{duration:650,easing:'cubic-bezier(.2,.6,.2,1)',fill:'both'});
  running.set(node,{animation,button,base,phase:'enter'});
  animation.onfinish=()=>{
   if(running.get(node)?.animation!==animation)return;
   const loop=node.animate(waveStops.map(stop=>({...wavePose(spec.radius,stop.phase),offset:stop.phase})),{duration:6000,iterations:Infinity,iterationStart:phase,easing:'linear',fill:'both'});
   animation.cancel();running.set(node,{animation:loop,button,base,phase:'loop'});
  };
 };
 const leave=(button:HTMLElement,instant=false)=>{
  if(hovered===button)hovered=null;
  // Read all painted poses before cancelling anything, so no card snaps to its CSS artwork first.
  const snapshots=[...running].filter(([,record])=>record.button===button&&(instant||record.phase!=='return')).map(([node,record])=>({node,record,current:sample(node)}));
  for(const {node,record,current} of snapshots){
   record.animation.cancel();running.delete(node);
   if(instant)continue;
   const animation=node.animate([current,record.base],{duration:returnDuration,easing:'cubic-bezier(.2,.6,.2,1)'});
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
  const ringJobs=waves.flatMap(spec=>Array.from(button.querySelectorAll<HTMLElement>(spec.selector),node=>({node,spec,current:sample(node)})));
  const bars=Array.from(button.querySelectorAll<HTMLElement>('.menu-wave-bar'),(node,i)=>({node,i,current:sample(node)}));
  for(const {node,spec,current} of jobs)animate(node,button,spec,current);
  for(const {node,spec,current} of ringJobs)wave(node,button,spec,current);
  for(const {node,i,current} of bars){
   const poses:Pose[]=[rest];
   for(let phase=1;phase<6;phase++){
    const angle=phase/6*Math.PI*2-i*.34;
    poses.push({transform:`translateY(${(Math.cos(angle)*3).toFixed(2)}px) scaleY(${(1+Math.sin(angle)*.025).toFixed(3)})`,opacity:1});
   }
   poses.push(rest);animate(node,button,{selector:'',duration:4800,poses},current);
  }
 };
 const preference=()=>{if(disabled())stop();};
 const keyboard=()=>stop();
 media.addEventListener('change',preference);
 document.addEventListener('visibilitychange',preference);
 document.addEventListener('keydown',keyboard,true);
 const observer=new MutationObserver(preference);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduced']});
 return {enter,leave,dispose(){stop();media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',preference);document.removeEventListener('keydown',keyboard,true);observer.disconnect();}};
}
