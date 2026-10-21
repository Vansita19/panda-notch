import './task-priority.css';

export type TaskPriorityValue='low'|'medium'|'high';
export const priorityOptions=[
 {value:'low',label:'Low',bars:1},
 {value:'medium',label:'Medium',bars:2},
 {value:'high',label:'High',bars:3},
] as const;

type PriorityProps={priority?:TaskPriorityValue|string|null;showLabel?:boolean;decorative?:boolean;className?:string};
const optionFor=(priority:PriorityProps['priority'])=>priorityOptions.find(option=>option.value===priority)??priorityOptions[1];

/** Priority remains readable without depending on color: one, two, or three lit bars. */
export function TaskPriority({priority='medium',showLabel=false,decorative=false,className=''}:PriorityProps){
 const option=optionFor(priority);
 return <span className={`task-priority ${className}`} data-priority={option.value} role={decorative?undefined:'img'} aria-label={decorative?undefined:`${option.label} priority`} aria-hidden={decorative||undefined} title={decorative?undefined:`${option.label} priority`}>
  <span className="task-priority-bars" aria-hidden="true">{[0,1,2].map(index=><i key={index} data-lit={index<option.bars}/>)}</span>
  {showLabel&&<span className="task-priority-label">{option.label}</span>}
 </span>;
}

type PriorityChoicesProps={priority?:TaskPriorityValue|string|null;onChange:(priority:TaskPriorityValue)=>void;disabled?:boolean;label?:string};
export function TaskPriorityChoices({priority='medium',onChange,disabled=false,label='Priority'}:PriorityChoicesProps){
 const selected=optionFor(priority).value;
 return <fieldset className="task-priority-choices" disabled={disabled}>
  <legend>{label}</legend>
  <div className="task-priority-options">{priorityOptions.map(option=><button key={option.value} type="button" className="task-priority-choice" aria-label={`${option.label} priority`} aria-pressed={selected===option.value} onClick={()=>{if(option.value!==selected)onChange(option.value);}}>
   <TaskPriority priority={option.value} decorative/>
   <span>{option.label}</span>
  </button>)}</div>
 </fieldset>;
}
