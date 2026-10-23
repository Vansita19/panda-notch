import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {build} from 'esbuild';
import {initialState,dayKey} from '../src/model.mjs';

const source=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler;
function visit(node){
 if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='complete')handler=node.initializer?.getText(ast);
 ts.forEachChild(node,visit);
}
visit(ast);assert.ok(handler,'Exercise App’s actual completion callback');
const fixture=await build({stdin:{contents:`
 import {finishesVisibleTasks,taskCelebrationMs} from './src/task-completion.mjs';
 import {reduce} from './src/model.mjs';
 import {TaskCompletionCelebration} from './src/components/TaskCompletionCelebration';
 export const renderCelebration=props=>TaskCompletionCelebration(props);
 export function checklist(state){
  const stateRef={current:state},celebrateTimer={current:null},completionTimer={current:null},completionCount={current:0};
  let toast=null,pulse=0,happy=false,cancellations=0;
  const sounds=[],timers=[];
  const dispatch=action=>{stateRef.current=reduce(stateRef.current,action);};
  const setCompletionPulse=value=>{pulse=value;};
  const setCelebrate=value=>{happy=value;};
  const setToast=value=>{toast=typeof value==='function'?value(toast):value;};
  const notify=(text,undo)=>{toast={text,undo};};
  const playPandaSound=value=>{sounds.push(value);};
  const clearTimeout=()=>{};
  const setTimeout=(callback,delay)=>{timers.push({callback,delay});return timers.length;};
  const cancelTaskCelebration=()=>{cancellations++;completionTimer.current=null;setCompletionPulse(0);};
  const complete=${handler};
  return {complete,undo:()=>toast?.undo(),snapshot:()=>({state:stateRef.current,toast,pulse,happy,cancellations,sounds,timers})};
 }`,sourcefile:'completion-fixture.tsx',loader:'tsx',resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',plugins:[{
 name:'completion-component-fixture',setup(builder){
  builder.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx-runtime',namespace:'fixture'}));
  builder.onLoad({filter:/^jsx-runtime$/,namespace:'fixture'},()=>({contents:'export const jsx=(type,props,key)=>({type,props,key:key??null});export const jsxs=jsx;'}));
  builder.onResolve({filter:/^motion\/react$/},()=>({path:'motion',namespace:'fixture'}));
  builder.onLoad({filter:/^motion$/,namespace:'fixture'},()=>({contents:'export const useReducedMotion=()=>false;'}));
  builder.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
 }
}]});
const {checklist,renderCelebration}=await import('data:text/javascript;base64,'+Buffer.from(fixture.outputFiles[0].text).toString('base64'));
const now=Date.now();
const task=(id,done=false)=>({id,title:id,done,created:now,completedDay:done?dayKey(now):null,priority:'medium'});
const state=(tasks,settings={})=>{const base=initialState(now);return {...base,tasks,settings:{...base.settings,...settings}};};

test('the actual completion callback gives normal feedback before the last task and one final pulse',()=>{
 const list=checklist(state([task('one'),task('two')]));
 assert.equal(list.snapshot().pulse,0,'No celebration on launch');
 list.complete(task('one'));
 assert.equal(list.snapshot().toast.text,'Nicely done.');assert.equal(list.snapshot().pulse,0);
 list.complete(task('two'));
 const after=list.snapshot();assert.equal(after.toast.text,'All done for today.');assert.equal(after.pulse,1);
 assert.equal(after.state.tasks.every(item=>item.done),true);
 const end=after.timers.find(timer=>timer.delay===2200);assert.ok(end);end.callback();
 assert.equal(list.snapshot().pulse,0,'The effect ends without another interaction');
});

test('Undo cancels the pulse and reopens only the task just completed',()=>{
 const list=checklist(state([task('earlier',true),task('last')]));
 list.complete(task('last'));const before=list.snapshot().cancellations;list.undo();
 const after=list.snapshot();assert.equal(after.pulse,0);assert.equal(after.happy,false);assert.ok(after.cancellations>before);
 assert.equal(after.state.tasks.find(item=>item.id==='last').done,false);
 assert.equal(after.state.tasks.find(item=>item.id==='earlier').done,true);
});

test('reopening and stale completion callbacks neither celebrate nor invert an Undo',()=>{
 const list=checklist(state([task('last')]));list.complete(task('last'));
 const undo=list.snapshot().toast.undo;list.complete(task('last'));
 assert.equal(list.snapshot().pulse,0);assert.equal(list.snapshot().toast,null);
 assert.equal(list.snapshot().state.tasks[0].done,false);undo();
 assert.equal(list.snapshot().state.tasks[0].done,false,'Undo after manual reopening is a no-op');
});

test('the final completion respects the existing sound setting and ignores a deleted task',()=>{
 const list=checklist(state([task('last')],{mascotSounds:false}));
 list.complete(task('missing'));assert.equal(list.snapshot().toast,null);assert.deepEqual(list.snapshot().sounds,[]);
 list.complete(task('last'));assert.equal(list.snapshot().pulse,1);assert.deepEqual(list.snapshot().sounds,[]);
});

test('the real effect component is absent until triggered and has only twelve decorative particles',()=>{
 assert.equal(renderCelebration({active:false}),null);
 const rendered=renderCelebration({active:true});
 assert.equal(rendered.props['aria-hidden'],'true');
 const [wash,pieces]=rendered.props.children;assert.equal(wash.props.className,'task-completion-wash');assert.equal(pieces.length,12);
 assert.equal(pieces.every(piece=>piece.type==='i'),true);
});

test('reduced motion keeps static visual feedback without rendering any confetti',()=>{
 const rendered=renderCelebration({active:true,reducedMotion:true});
 assert.equal(rendered.props['data-still'],true);
 assert.equal(rendered.props.children[1],false);
});
