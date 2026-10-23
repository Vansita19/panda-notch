import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialState,reduce,durations} from '../src/model.mjs';

// Run the shipped component callbacks and reducer. Only React's host and native DOM
// surfaces are replaced, so the same missing pointer wiring breaks this test.
const bundled=await build({entryPoints:['src/components/FocusTimer.tsx'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'},plugins:[{
 name:'focus-roller-host',setup(builder){
  builder.onResolve({filter:/^(react|react\/jsx-runtime|motion\/react|lucide-react)$/},({path})=>({path,namespace:'fixture'}));
  builder.onResolve({filter:/^\.\.\/arc\/button\/button$/},()=>({path:'button',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='react'?`export default {Fragment:'fragment'};export const memo=fn=>fn;export const useRef=value=>globalThis.__pandaFocusHarness.ref(value);export const useState=value=>globalThis.__pandaFocusHarness.state(value);export const useEffect=(fn,deps)=>globalThis.__pandaFocusHarness.effect(fn,deps);export const useLayoutEffect=useEffect;export const useCallback=(fn,deps)=>globalThis.__pandaFocusHarness.callback(fn,deps);export const useId=()=>globalThis.__pandaFocusHarness.id();`:path==='react/jsx-runtime'?`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='fragment';`:path==='motion/react'?`export const useReducedMotion=()=>false;`:path==='button'?`export const Button=props=>({type:'button',props});`:`export const Clock3=()=>null,Leaf=()=>null,Minus=()=>null,Pause=()=>null,Play=()=>null,Plus=()=>null,RotateCcw=()=>null;`}));
 }
}]});
const {FocusTimer}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const find=(node,predicate)=>{if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=find(child,predicate);if(found)return found;}return null;}return predicate(node)?node:find(node.props?.children,predicate);};
function fixture(t){
 const instances=new Map(),effects=[],actions=[];let current,cursor=0,dirty=false,tree;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const harness={ref(value){const i=cursor++;return current[i]??(current[i]={current:value});},state(value){const i=cursor++,entry=current[i]??(current[i]={value:typeof value==='function'?value():value});return [entry.value,next=>{const value=typeof next==='function'?next(entry.value):next;if(!Object.is(value,entry.value)){entry.value=value;dirty=true;}}];},effect(fn,deps){const i=cursor++,owner=current,old=owner[i];if(!old||!same(old.deps,deps))effects.push(()=>{old?.cleanup?.();owner[i]={deps,cleanup:fn()};});},callback(fn,deps){const i=cursor++,old=current[i];if(!old||!same(old.deps,deps))current[i]={deps,value:fn};return current[i].value;},id(){cursor++;return 'focus-test';}};
 class Element{
  style={transform:'none'};listeners=new Map();captures=new Set();focused=false;selected=false;
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  emit(type,event){for(const listener of this.listeners.get(type)??[])listener(event);}
  setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
  focus(){this.focused=true;}select(){this.selected=true;}
  animate(){return {cancel(){},onfinish:null};}
 }
 const dom={hours:{root:new Element(),track:new Element(),button:new Element(),input:new Element()},minutes:{root:new Element(),track:new Element(),button:new Element(),input:new Element()}},rolls={};
 const state=initialState(10000);state.settings.focusMinutes=45;state.timer.seconds=2700;
 const dispatch=action=>{actions.push(action);Object.assign(state,reduce(state,action,10000));dirty=true;};
 const renderComponent=(name,component,props)=>{current=instances.get(name)??[];instances.set(name,current);cursor=0;return component(props);};
 const render=()=>{let attempts=0;do{dirty=false;tree=renderComponent('focus',FocusTimer,{s:state,seconds:durations(state,state.timer.mode),dispatch});for(const unit of ['hours','minutes']){const child=find(tree,node=>node.props?.unit===unit&&typeof node.type==='function');rolls[unit]=renderComponent(unit,child.type,child.props);rolls[unit].props.ref.current=dom[unit].root;find(rolls[unit],node=>node.props?.className==='focus-number-reel').props.ref.current=dom[unit].track;const input=find(rolls[unit],node=>node.type==='input');if(input)input.props.ref.current=dom[unit].input;}while(effects.length)effects.shift()();assert.ok(++attempts<20,'Component updates must settle');}while(dirty);return tree;};
 for(const [name,value]of Object.entries({__pandaFocusHarness:harness,getComputedStyle:node=>({transform:node.style.transform})})){const old=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);}
 t.after(()=>{for(const hooks of instances.values())for(const hook of hooks)hook?.cleanup?.();});
 const number=unit=>find(rolls[unit],node=>node.props?.className==='focus-roller-number');
 const pointer=(unit,kind,y,{id=1,button=0,...rest}={})=>{const event={pointerId:id,button,isPrimary:true,clientX:0,clientY:y,currentTarget:dom[unit].button,preventDefault(){this.prevented=true;},stopPropagation(){},...rest};number(unit).props['on'+kind]?.(event);return event;};
 const click=(unit,detail=1)=>{number(unit).props.onClick({detail});render();};
 const input=unit=>find(rolls[unit],node=>node.type==='input');
 render();return {state,actions,dom,render,pointer,click,input,number,wheel(unit,deltaY){dom[unit].root.emit('wheel',{deltaY,deltaX:0,deltaMode:0,ctrlKey:false,preventDefault(){},stopPropagation(){}});render();},tree:()=>tree};
}

test('dragging the minute face changes the duration and release does not open typing',t=>{
 const f=fixture(t);f.pointer('minutes','PointerDown',300);assert.equal(f.input('minutes'),null);
 f.pointer('minutes','PointerMove',90);f.render();
 assert.equal(f.state.settings.focusMinutes,45,'A drag previews the reel without repeatedly saving');
 assert.match(f.dom.minutes.track.style.transform,/translateY\(-2155px\)/);
 f.pointer('minutes','PointerUp',90);f.render();f.click('minutes');
 assert.equal(f.state.settings.focusMinutes,50);assert.equal(f.input('minutes'),null);
 assert.equal(f.actions.filter(action=>action.type==='settings').length,1);
 assert.equal(f.dom.minutes.button.hasPointerCapture(1),false);
});

test('a click still edits digits, while canceled drags leave the saved duration intact',t=>{
 const f=fixture(t);f.pointer('minutes','PointerDown',100);f.pointer('minutes','PointerUp',101);f.click('minutes');
 assert.ok(f.input('minutes'));f.input('minutes').props.onChange({target:{value:'30'}});f.render();f.input('minutes').props.onKeyDown({key:'Enter',preventDefault(){},stopPropagation(){}});f.render();assert.equal(f.state.settings.focusMinutes,30);
 f.pointer('hours','PointerDown',200);f.pointer('hours','PointerMove',158);f.render();assert.equal(f.dom.hours.track.style.transform,'translateY(-97px)');f.pointer('hours','PointerCancel',158);f.render();
 assert.equal(f.state.settings.focusMinutes,30);assert.equal(f.dom.hours.button.hasPointerCapture(1),false);
});

test('hour drags, direction changes, and duration limits use the actual reel gesture',t=>{
 const f=fixture(t);f.pointer('hours','PointerDown',200);f.pointer('hours','PointerMove',158);f.pointer('hours','PointerUp',158);f.render();assert.equal(f.state.settings.focusMinutes,105);
 f.pointer('minutes','PointerDown',100);f.pointer('minutes','PointerMove',-2000);f.pointer('minutes','PointerUp',-2000);f.render();assert.equal(f.state.settings.focusMinutes,120);
 f.pointer('minutes','PointerDown',100);f.pointer('minutes','PointerMove',150);f.pointer('minutes','PointerMove',142);f.pointer('minutes','PointerUp',142);f.render();assert.equal(f.state.settings.focusMinutes,119);
 f.pointer('minutes','PointerDown',0);f.pointer('minutes','PointerUp',6000);f.render();assert.equal(f.state.settings.focusMinutes,1);
});

test('the next normal click is editable after a drag and wheel then drag compose without losing minutes',t=>{
 const f=fixture(t);f.wheel('minutes',70);f.pointer('hours','PointerDown',100);f.pointer('hours','PointerUp',58);f.render();f.click('hours');
 assert.equal(f.state.settings.focusMinutes,110);assert.equal(f.input('hours'),null);
 f.pointer('minutes','PointerDown',100);f.pointer('minutes','PointerUp',100);f.click('minutes');assert.ok(f.input('minutes'));
});

test('only the primary pointer owns a drag and Escape rolls it back without saving',t=>{
 const f=fixture(t);f.pointer('minutes','PointerDown',200,{button:2});f.pointer('minutes','PointerUp',158);f.render();assert.equal(f.state.settings.focusMinutes,45);
 f.pointer('minutes','PointerDown',200);assert.equal(f.dom.minutes.button.focused,true,'The drag target must receive Escape even if another control was focused');f.pointer('minutes','PointerMove',116,{id:2});f.pointer('minutes','PointerUp',116,{id:2});f.render();assert.equal(f.dom.minutes.track.style.transform,'translateY(-1945px)');
 f.pointer('minutes','PointerMove',116);f.render();assert.equal(f.dom.minutes.track.style.transform,'translateY(-2029px)');
 f.number('minutes').props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});f.render();f.pointer('minutes','PointerUp',116);f.render();
 assert.equal(f.state.settings.focusMinutes,45);assert.equal(f.dom.minutes.track.style.transform,'translateY(-1945px)');assert.equal(f.actions.length,0);assert.equal(f.dom.minutes.button.hasPointerCapture(1),false);
});

test('arrow keys settle a pending wheel gesture before changing the chosen digit',t=>{
 const f=fixture(t);f.wheel('minutes',28);f.number('minutes').props.onKeyDown({key:'ArrowUp',preventDefault(){},stopPropagation(){}});f.render();
 assert.equal(f.state.settings.focusMinutes,48);assert.equal(f.dom.minutes.track.style.transform,'translateY(-2071px)');
});
