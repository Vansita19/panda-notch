import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Exercise the real form callbacks; no browser, Calendar writes, or saved data are involved.
const bundled=await build({entryPoints:['src/components/NewEventComposer.tsx'],bundle:true,write:false,platform:'node',format:'esm',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'},plugins:[{
 name:'composer-hooks',setup(builder){
  builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
  builder.onResolve({filter:/^\.\.\/arc\/button\/button$/},()=>({path:'button',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='button'?'export const Button=props=>props;':'export const useRef=value=>({current:value});export const useState=value=>globalThis.__pandaComposerHarness.state(value);export const useEffect=fn=>globalThis.__pandaComposerHarness.effect(fn);export const useLayoutEffect=fn=>fn();'}));
 }
}]});
const {NewEventComposer}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const children=node=>Array.isArray(node?.props?.children)?node.props.children:[node?.props?.children];
function fixture(onCreate){
 const states=[],cleanups=[];let closed=0;
 globalThis.__pandaComposerHarness={state(value){const slot={value};states.push(slot);return [value,next=>{slot.value=typeof next==='function'?next(slot.value):next;}];},effect(fn){const cleanup=fn();if(cleanup)cleanups.push(cleanup);}};
 const form=NewEventComposer({slot:{start:new Date(2026,9,22,9).getTime(),end:new Date(2026,9,22,11).getTime()},root:{current:null},anchor:()=>null,onCreate,onClose:()=>closed++});
 const input=children(form).find(child=>child?.type==='input');
 return {form,states,setTitle:title=>input.props.onChange({target:{value:title}}),submit:()=>form.props.onSubmit({preventDefault(){}}),unmount:()=>cleanups.forEach(cleanup=>cleanup()),get closed(){return closed;}};
}

test('an empty name cannot create a task; names submit trimmed',async()=>{
 const names=[],f=fixture(async title=>{names.push(title);return {ok:true,task:{id:'new'}};});
 await f.submit();assert.deepEqual(names,[]);assert.match(f.states[2].value,/name/);assert.equal(f.closed,0);
 f.setTitle('  Plan a portfolio review  ');await f.submit();assert.deepEqual(names,['Plan a portfolio review']);assert.equal(f.closed,1);
});

test('rapid repeated Enter calls create once while Calendar is pending',async()=>{
 let finish,calls=0;const result=new Promise(resolve=>finish=resolve),f=fixture(()=>{calls++;return result;});f.setTitle('Review');
 const first=f.submit();await f.submit();assert.equal(calls,1);assert.equal(f.states[1].value,true);assert.equal(f.closed,0);
 finish({ok:true,task:{id:'new'}});await first;assert.equal(f.closed,1);assert.equal(f.states[1].value,false);
});

test('a retained task closes after Calendar failure, while a pre-save failure remains retryable',async()=>{
 const retained=fixture(async()=>({ok:false,task:{id:'saved-local'},error:'Calendar unavailable'}));retained.setTitle('Review');await retained.submit();assert.equal(retained.closed,1);
 let attempts=0;const retry=fixture(async()=>++attempts===1?{ok:false,error:'Local save failed'}:{ok:true,task:{id:'retry'}});retry.setTitle('Apply');
 await retry.submit();assert.equal(retry.closed,0);assert.equal(retry.states[2].value,'Local save failed');
 await retry.submit();assert.equal(attempts,2);assert.equal(retry.closed,1);
});

test('a completed background creation does not touch an unmounted form',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>finish=resolve));f.setTitle('Review');const pending=f.submit();f.unmount();finish({ok:true,task:{id:'new'}});await pending;assert.equal(f.closed,0);
});
