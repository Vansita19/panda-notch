import test from 'node:test';import assert from 'node:assert/strict';import {resizeNotch} from '../src/resize-notch.mjs';
const s={width:400,height:360,side:'right',maxWidth:720,maxHeight:700};
test('both corners expand width equally around the center',()=>{assert.deepEqual(resizeNotch(s,50,90),{width:500,height:450});assert.deepEqual(resizeNotch({...s,side:'left'},-50,90),{width:500,height:450});});
test('width and height can change independently',()=>{assert.deepEqual(resizeNotch(s,80,0),{width:560,height:360});assert.deepEqual(resizeNotch(s,0,150),{width:400,height:510});});
test('a height limit does not prevent horizontal resizing',()=>{assert.deepEqual(resizeNotch({...s,height:700},100,100),{width:600,height:700});});
test('minimum and screen edges are clamped independently',()=>{assert.deepEqual(resizeNotch(s,-10000,-10000),{width:400,height:260});assert.deepEqual(resizeNotch(s,10000,10000),{width:720,height:700});});
