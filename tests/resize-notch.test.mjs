import test from 'node:test';import assert from 'node:assert/strict';import {resizeNotch,savedResizeSize} from '../src/resize-notch.mjs';
const s={width:400,height:360,side:'right',maxWidth:720,maxHeight:700};
test('both corners expand width equally around the center',()=>{assert.deepEqual(resizeNotch(s,50,90),{width:500,height:450});assert.deepEqual(resizeNotch({...s,side:'left'},-50,90),{width:500,height:450});});
test('width and height can change independently',()=>{assert.deepEqual(resizeNotch(s,80,0),{width:560,height:360});assert.deepEqual(resizeNotch(s,0,150),{width:400,height:510});});
test('a height limit does not prevent horizontal resizing',()=>{assert.deepEqual(resizeNotch({...s,height:700},100,100),{width:600,height:700});});
test('minimum and screen edges are clamped independently',()=>{assert.deepEqual(resizeNotch(s,-10000,-10000),{width:400,height:260});assert.deepEqual(resizeNotch(s,10000,10000),{width:720,height:700});});
test('expanded height resizing keeps its displayed width and compact preference',()=>{
 const start={...s,width:800,compactWidth:400,expanded:true,minWidth:800,maxWidth:1440};
 const resized=resizeNotch(start,0,80);
 assert.deepEqual(resized,{width:800,height:440});
 const saved=savedResizeSize(start,resized);
 assert.deepEqual(saved,{width:400,height:440});
 assert.equal(Math.min(saved.width*2,start.maxWidth),resized.width);
});
test('expanded horizontal resizing saves half the displayed width and roundtrips at both corners',()=>{
 for(const side of ['left','right']){
  const start={...s,side,width:800,compactWidth:400,expanded:true,minWidth:800,maxWidth:1440};
  const resized=resizeNotch(start,side==='left'?-80:80,40),saved=savedResizeSize(start,resized);
  assert.deepEqual(saved,{width:480,height:400});
  assert.equal(saved.width*2,resized.width);
 }
});
test('a screen-capped height drag preserves the wider compact base without a release jump',()=>{
 const start={...s,width:1050,compactWidth:720,expanded:true,minWidth:800,maxWidth:1050};
 const resized=resizeNotch(start,0,50),saved=savedResizeSize(start,resized);
 assert.deepEqual(saved,{width:720,height:410});
 assert.equal(Math.min(saved.width*2,start.maxWidth),resized.width);
 assert.deepEqual(savedResizeSize(s,{width:560,height:500}),{width:560,height:500});
});
