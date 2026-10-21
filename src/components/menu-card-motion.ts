type Pose={transform:string;opacity?:number};
type MotionSpec={selector:string;duration:number;poses:Pose[];once?:boolean};
const rest:Pose={transform:'none',opacity:1};
const rhythm='cubic-bezier(.45,0,.55,1)';
const motions:MotionSpec[]=[
 {selector:'.menu-task-glow-one',duration:6600,poses:[rest,{transform:'translate(-20px,-20px) scale(1.08)',opacity:.88},{transform:'translate(12px,-30px) scale(1.02)',opacity:1},{transform:'translate(20px,6px) scale(.94)',opacity:.94},rest]},
 {selector:'.menu-task-glow-two',duration:7800,poses:[rest,{transform:'translate(22px,-12px) scale(.94)',opacity:.92},{transform:'translate(-18px,-25px) scale(1.12)',opacity:1},{transform:'translate(-26px,8px) scale(1.03)',opacity:.86},rest]},
 {selector:'.menu-task-glow-three',duration:6000,poses:[rest,{transform:'translate(-16px,22px) scale(1.14)',opacity:1},{transform:'translate(-28px,-8px) scale(.93)',opacity:.82},{transform:'translate(16px,-18px) scale(1.07)',opacity:.96},rest]},
 {selector:'.menu-focus-glow',duration:5200,poses:[rest,{transform:'translateY(-10px) scale(1.18)',opacity:1},{transform:'translateY(4px) scale(.84)',opacity:.72},rest]},
 {selector:'.menu-focus-core',duration:5200,poses:[{transform:'scale(.9)',opacity:0},{transform:'translateY(-8px) scale(1.16)',opacity:.3},{transform:'scale(.82)',opacity:.06},{transform:'scale(.9)',opacity:0}]},
 {selector:'.menu-links-glow',duration:6400,poses:[rest,{transform:'translate(12px,-20px) scale(1.08)',opacity:.86},{transform:'translate(-14px,8px) scale(.96)',opacity:1},rest]},
 {selector:'.menu-links-mask',duration:650,once:true,poses:[rest,{transform:'none',opacity:.2}]},
 {selector:'.menu-links-wave',duration:650,once:true,poses:[{transform:'none',opacity:0},{transform:'none',opacity:.92}]},
 {selector:'.menu-ideas-glow',duration:6800,poses:[rest,{transform:'translate(18px,-22px) rotate(-7deg) scale(1.12)',opacity:.86},{transform:'translate(-16px,-8px) rotate(5deg) scale(.92)',opacity:1},{transform:'translate(8px,10px) scale(1.06)',opacity:.9},rest]},
 // Every circle shares the same fixed center. Different radii breathe in response.
 {selector:'.menu-reminders-ring-three',duration:6000,poses:[rest,{transform:'scale(1.24)',opacity:1},{transform:'scale(.94)',opacity:.78},rest]},
 {selector:'.menu-reminders-ring-two',duration:6000,poses:[rest,{transform:'scale(1.06)',opacity:.8},{transform:'scale(1.1)',opacity:1},rest]},
 {selector:'.menu-reminders-ring-one',duration:6000,poses:[rest,{transform:'scale(.88)',opacity:.86},{transform:'scale(1.13)',opacity:1},rest]},
];

/** Decorative loops live in WAAPI, never React's render cycle. Only the hovered card runs. */
export function createMenuCardMotion(){
 const running=new Map<HTMLElement,{animation:Animation;button:HTMLElement;base:Pose}>();
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let hovered:HTMLElement|null=null;
 const disabled=()=>media.matches||document.documentElement.dataset.reduced==='true'||document.hidden;
 const sample=(node:HTMLElement):Pose=>{const style=getComputedStyle(node);return {transform:style.transform,opacity:Number(style.opacity)};};
 const animate=(node:HTMLElement,button:HTMLElement,spec:MotionSpec)=>{
  const current=sample(node),base=running.get(node)?.base??spec.poses[0];
  running.get(node)?.animation.cancel();
  const frames=spec.poses.map(pose=>({...pose,easing:rhythm}));
  frames[0]={...frames[0],...current};
  if(!spec.once)frames[frames.length-1]={...frames[frames.length-1],...current};
  const animation=node.animate(frames,{duration:spec.duration,iterations:spec.once?1:Infinity,fill:'both'});
  running.set(node,{animation,button,base});
 };
 const leave=(button:HTMLElement,instant=false)=>{
  if(hovered===button)hovered=null;
  for(const [node,record] of [...running]){
   if(record.button!==button)continue;
   const current=sample(node);record.animation.cancel();running.delete(node);
   if(instant)continue;
   const animation=node.animate([current,record.base],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
   running.set(node,{...record,animation});
   animation.onfinish=()=>{if(running.get(node)?.animation===animation)running.delete(node);};
  }
 };
 const stop=()=>{hovered=null;for(const record of running.values())record.animation.cancel();running.clear();};
 const enter=(button:HTMLElement)=>{
  if(hovered===button||disabled())return;
  if(hovered)leave(hovered);
  hovered=button;
  for(const spec of motions)button.querySelectorAll<HTMLElement>(spec.selector).forEach(node=>animate(node,button,spec));
  button.querySelectorAll<HTMLElement>('.menu-wave-bar').forEach((node,i)=>{
   const poses:Pose[]=[rest];
   for(let phase=1;phase<6;phase++){
    const angle=phase/6*Math.PI*2-i*.34;
    poses.push({transform:`translateY(${(Math.cos(angle)*7).toFixed(2)}px) scaleY(${(.61+Math.sin(angle)*.31).toFixed(3)})`,opacity:1});
   }
   poses.push(rest);animate(node,button,{selector:'',duration:4800,poses});
  });
 };
 const preference=()=>{if(disabled())stop();};
 const keyboard=()=>stop();
 media.addEventListener('change',preference);
 document.addEventListener('visibilitychange',preference);
 document.addEventListener('keydown',keyboard,true);
 const observer=new MutationObserver(preference);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduced']});
 return {enter,leave,dispose(){stop();media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',preference);document.removeEventListener('keydown',keyboard,true);observer.disconnect();}};
}
