import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {build} from 'esbuild';

// Exercise the real App row JSX without starting persistence, native APIs or timers.
// AST extraction keeps this fixture independent of formatting and surrounding App hooks.
const appPath=new URL('../src/App.tsx',import.meta.url);
const source=await readFile(appPath,'utf8'),ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const renderers=new Map();
function visit(node){
 if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&['taskMeta','row'].includes(node.name.text)&&node.initializer)renderers.set(node.name.text,node.initializer.getText(ast));
 ts.forEachChild(node,visit);
}
visit(ast);assert.equal(renderers.size,2,'The fixture must exercise App’s actual taskMeta and row renderers');
const bundled=await build({stdin:{contents:`
 import {TaskPriority} from './src/components/TaskPriority';
 const motion={div:'task-row'},Checkbox='checkbox',InlineTaskName='task-name-input',X='delete-icon';
 export const renderPriority=props=>TaskPriority(props);
 export function renderLinkedRow(task,{planning,planningLayout,planningContracting}){
  const dispatch=()=>{},complete=()=>{},remove=()=>{},setPlannerExpanded=()=>{},setDrag=()=>{},renameTask=()=>{};
  const renamingTask=null,drag=null,s={tasks:[task]},clock=()=> '9:00 AM';
  const taskMeta=${renderers.get('taskMeta')};
  const row=${renderers.get('row')};
  return row(task,undefined,{type:'edit-control',props:{}});
 }`,sourcefile:'task-row-fixture.tsx',loader:'tsx',resolveDir:new URL('..',import.meta.url).pathname},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',plugins:[{
 name:'composition-jsx',setup(builder){
  builder.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx-runtime',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const Fragment="fragment";export const jsx=(type,props,key)=>({type,props,key:key??null});export const jsxs=jsx;'}));
  builder.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
 }
}]});
const {renderLinkedRow,renderPriority}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const task={id:'linked-task',title:'Prepare a portfolio presentation with a long descriptive task title',priority:'medium',done:false,calendarLink:{start:1000,end:3601000,missing:false}};
const phases=[
 ['expanded',{planning:true,planningLayout:true,planningContracting:false}],
 ['contracting',{planning:false,planningLayout:true,planningContracting:true}],
 ['compact',{planning:false,planningLayout:false,planningContracting:false}]
];
function find(node,className,path=[]){
 if(!node||typeof node!=='object')return null;
 if(node.props?.className?.split(' ').includes(className))return {node,path};
 const children=node.props?.children;
 for(const [index,child] of (Array.isArray(children)?children:[children]).entries()){
  const result=find(child,className,[...path,index]);if(result)return result;
 }
 return null;
}

test('linked timing retains its place in the same task row through every planner phase',()=>{
 let timingPath,titlePath;
 for(const [phase,state] of phases){
  const row=renderLinkedRow(task,state),timing=find(row,'task-scheduled-time'),title=find(row,'task-title');
  assert.equal(row.key,task.id);assert.equal(row.props['data-linked-task'],task.id);
  assert.ok(timing,`${phase} must retain the timing node so task text does not reflow`);
  assert.ok(title);
  if(timingPath){assert.deepEqual(timing.path,timingPath);assert.deepEqual(title.path,titlePath);}
  timingPath=timing.path;titlePath=title.path;
  assert.notEqual(timing.node.props.hidden,true,`${phase} must keep the timing in layout`);
  assert.notEqual(timing.node.props.style?.display,'none',`${phase} must preserve its layout space`);
  assert.notEqual(timing.node.props.style?.position,'absolute',`${phase} must preserve its layout space`);
 }
});
test('expanded timing is hidden from assistive technology while compact timing is available',()=>{
 const expanded=find(renderLinkedRow(task,phases[0][1]),'task-scheduled-time');
 const compact=find(renderLinkedRow(task,phases[2][1]),'task-scheduled-time');
 assert.ok(expanded,'Expanded rows keep their timing node mounted');
 assert.equal(expanded.node.props['aria-hidden'],true);
 assert.ok(compact);assert.notEqual(compact.node.props['aria-hidden'],true);
});

test('priority is anchored outside the moving timing and reveal containers in every planner phase',()=>{
 for(const [phase,state] of phases){
  const row=renderLinkedRow(task,state),priority=find(row,'task-row-priority'),metadata=find(row,'task-meta'),actions=find(row,'row-actions');
  assert.ok(priority,`${phase} must render the stable priority control`);
  assert.equal(priority.path.length,1,'The control is anchored directly to the task row');
  assert.equal(find(metadata.node,'task-row-priority'),null,'Timing translations cannot move the priority hit area');
  assert.equal(find(actions.node,'task-row-priority'),null,'Revealing actions cannot move the priority hit area');
  assert.match(actions.node.props.children[0].props['aria-label'],/^Delete /);
  assert.equal(actions.node.props.children[1].type,'edit-control','Actions run cross, pencil, then the fixed priority');
 }
});

test('clicking the actual priority control changes its value without bubbling into calendar navigation',()=>{
 for(const [priority,next] of [['low','medium'],['medium','high'],['high','low']]){
  const changes=[];let stopped=false;
  const control=renderPriority({priority,onChange:value=>changes.push(value)});
  control.props.onClick({stopPropagation(){stopped=true;}});
  assert.equal(stopped,true);assert.deepEqual(changes,[next]);
 }
});
