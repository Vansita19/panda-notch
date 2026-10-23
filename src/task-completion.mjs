import {taskProgress} from './model.mjs';

export const taskCelebrationMs=2200;

// Match the checklist and closed-notch progress, including unfinished carry-over.
// This is consulted only for a direct user's checkbox action, never on state sync.
export function finishesVisibleTasks(state,taskId,now=Date.now()){
 const task=state.tasks.find(item=>item.id===taskId);
 if(!task||task.done)return false;
 const {done,total}=taskProgress(state,now);
 return total>0&&done===total-1;
}
