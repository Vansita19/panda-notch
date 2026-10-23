import React from 'react';
import {useReducedMotion} from 'motion/react';
import './task-completion-celebration.css';

const pieces=Array.from({length:12},(_,index)=>({
 left:`${24+index*4.7}%`,
 '--confetti-x':`${(index%2?-1:1)*(24+index%4*17)}px`,
 '--confetti-y':`${68+index%5*19}px`,
 '--confetti-turn':`${(index%2?-1:1)*(130+index*29)}deg`,
 '--confetti-delay':`${index%4*45}ms`
} as React.CSSProperties));

export function TaskCompletionCelebration({active,reducedMotion=false}:{active:boolean;reducedMotion?:boolean}){
 const systemReduced=useReducedMotion(),still=Boolean(reducedMotion||systemReduced);
 if(!active)return null;
 return <div className="task-completion-celebration" data-still={still||undefined} aria-hidden="true">
  <div className="task-completion-wash"/>
  {!still&&pieces.map((style,index)=><i className="task-completion-confetti" key={index} style={style}/>)}
 </div>;
}
