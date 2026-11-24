import type {CSSProperties} from 'react';
import './closed-task-count.css';

export function ClosedTaskCount({done,total,onOpen}:{done:number;total:number;onOpen:()=>void}) {
  if (!total) return null;
  const label = `${done}/${total}`;
  return <button
    className="closed-task-count"
    data-complete={done===total}
    style={{'--task-count-chars':label.length} as CSSProperties}
    aria-label={`${done} of ${total} tasks completed today. Open To-Do`}
    title="Today’s tasks"
    onClick={onOpen}
  ><span>{done}</span><span className="closed-task-count-divider">/</span><span>{total}</span></button>;
}
