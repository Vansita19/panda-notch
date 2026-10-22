const parts=[
 {selector:'.task-checklist',width:true},
 {selector:'.planner-day',calendar:true},
 {selector:'.panel-date'},
 {selector:'.panda-tabs',width:true},
 {selector:'.rail-leading'},
 {selector:'.rail-menu'},
 {selector:'.panel-heading>.icon-button'},
 {selector:'.notch-corner-left'},
 {selector:'.notch-corner-right'},
 {selector:'.planner-thread',threads:true}
];
const finite=rect=>rect&&[rect.left,rect.top,rect.width,rect.height].every(Number.isFinite);
const rounded=value=>Math.round(value*1000)/1000;
const translate=(x,y,base)=>`translate(${rounded(x)}px, ${rounded(y)}px)${base&&base!=='none'?` ${base}`:''}`;

/** Positions are relative to the surface center, which stays fixed during native window resize. */
function measureCentered(node,surface){
 const rect=node.getBoundingClientRect(),anchor=surface.getBoundingClientRect();
 return {left:rect.left-anchor.left-surface.offsetWidth/2,top:rect.top-anchor.top,width:rect.width,height:rect.height};
}

/** One FLIP clock owns planner composition; the notch controller owns only its painted clip. */
export function createPlannerMotion({readStyle=getComputedStyle,measure=measureCentered,animate=(node,frames,options)=>node.animate(frames,options)}={}){
 let pending=null,pendingMoving=false,settled=null,revision=0,lastExpanded=null;
 const animations=new Map(),heldOpacity=new Map();
 const snapshot=surface=>{
  const result=new Map();
  for(const part of parts){
   const node=surface.querySelector(part.selector);if(!node)continue;
   const rect=measure(node,surface);if(!finite(rect))continue;
   const style=readStyle(node),opacity=parseFloat(style.opacity);
   result.set(part.selector,{node,rect,opacity:Number.isFinite(opacity)?opacity:1,visible:style.visibility!=='hidden'&&style.display!=='none'&&rect.width>0&&rect.height>0});
  }
  return result;
 };
 const cancel=()=>{
  for(const animation of animations.values())animation.cancel();
  animations.clear();
  for(const [node,opacity] of heldOpacity){if(opacity===undefined)delete node.style.opacity;else node.style.opacity=opacity;}
  heldOpacity.clear();
 };
 const holdHidden=node=>{if(!heldOpacity.has(node))heldOpacity.set(node,node.style.opacity);node.style.opacity='0';};
 return {
  // Sample the painted values before any layout mutation or cancellation, including a reversal.
  capture(surface){pending=snapshot(surface);pendingMoving=animations.size>0||heldOpacity.size>0;},
  // After React commits, release old animated widths before the notch measures target content.
  // The captured paint remains available for play(), including reversal opacity.
  prepare(){revision++;pendingMoving=pendingMoving||animations.size>0||heldOpacity.size>0;cancel();},
  /** @param {*} surface @param {{expanded?:boolean,duration?:number,easing?:string,reduced?:boolean}} [options] */
  play(surface,{expanded=false,duration=280,easing='cubic-bezier(.22,1,.36,1)',reduced=false}={}){
   const token=++revision,wasMoving=pendingMoving||animations.size>0||heldOpacity.size>0;
   const before=pending??(wasMoving?snapshot(surface):settled??snapshot(surface));pending=null;
   pendingMoving=false;
   cancel();
   const after=snapshot(surface);settled=after;
   const instant=reduced||!duration;
   for(const part of parts){
    const target=after.get(part.selector);if(!target||!target.visible)continue;
    const previous=before.get(part.selector),revealing=part.calendar||part.threads;
    if(instant){if(revealing&&!expanded)holdHidden(target.node);continue;}
    const start=previous?.visible?previous.rect:target.rect;
    const base=readStyle(target.node).transform;
    let dx=start.left-target.rect.left,dy=start.top-target.rect.top;
    const endX=part.calendar&&!expanded?28:0;
    if(part.calendar&&!previous?.visible){dx=28;dy=0;}
    // Paths already follow both endpoints; translate only the calendar, fade its cords in place.
    if(part.threads){dx=0;dy=0;}
    const from={transform:translate(dx,dy,base)},to={transform:translate(endX,0,base)};
    if(part.width&&Math.abs(start.width-target.rect.width)>=.5){from.width=`${start.width}px`;to.width=`${target.rect.width}px`;}
    if(revealing){
     const freshEntry=expanded&&(!previous?.visible||(part.threads&&!wasMoving&&lastExpanded!==true));
     from.opacity=freshEntry?0:previous?.opacity??(expanded?0:1);to.opacity=expanded?1:0;
    }
    const translated=Math.abs(dx-endX)>=.01||Math.abs(dy)>=.01;
    const fading=revealing&&Math.abs(from.opacity-to.opacity)>=.001;
    if(!translated&&!fading&&!from.width){if(revealing&&!expanded)holdHidden(target.node);continue;}
    const animation=animate(target.node,[from,to],{duration,easing,fill:'both'});
    animations.set(part.selector,animation);
    animation.onfinish=()=>{
     if(token!==revision||animations.get(part.selector)!==animation)return;
     // Exit stays painted at opacity zero until retained layout is hidden/released by React.
     if(revealing&&!expanded)return;
     animations.delete(part.selector);animation.cancel();
    };
   }
   lastExpanded=expanded;
  },
  // Call after releasing the retained layout, in a layout effect before its next paint.
  finish(surface){revision++;cancel();pending=null;pendingMoving=false;settled=surface?snapshot(surface):null;lastExpanded=false;},
  dispose(){revision++;cancel();pending=null;pendingMoving=false;settled=null;lastExpanded=null;}
 };
}
