// Build-only harness: render Cuelume's original engine through OfflineAudioContext.
// Native NSSound can play the same synthesis without browser activation requirements.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {dirname,resolve} from 'node:path';
const engine=resolve('node_modules/cuelume/dist/audio/engine.js');
const source=await readFile(engine,'utf8');
const harness=`
document.querySelector('button').onclick=async()=>{
 const name=document.querySelector('select').value;
 const offline=new OfflineAudioContext(2,35280,44100);
 sharedOutput=null;sharedRoom=null;sharedNoise=null;voices.clear();
 renderRecipe(offline,name,THEMES.default[name],1,'normal',shapeFor(name,contextFrom({}),'normal',Infinity));
 const audio=await offline.startRendering();
 const buffer=new ArrayBuffer(44+audio.length*4),v=new DataView(buffer);
 const text=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
 text(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,44100,true);v.setUint32(28,176400,true);v.setUint16(32,4,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,audio.length*4,true);
 for(let i=0;i<audio.length;i++)for(let c=0;c<2;c++)v.setInt16(44+i*4+c*2,Math.round(Math.max(-1,Math.min(1,audio.getChannelData(c)[i]))*32767),true);
 let binary='';for(const byte of new Uint8Array(buffer))binary+=String.fromCharCode(byte);
 document.querySelector('textarea').value=btoa(binary);document.querySelector('output').textContent=name+' rendered';
};`;
await mkdir('../sound-renderer',{recursive:true});
await build({stdin:{contents:source+harness,resolveDir:dirname(engine)},bundle:true,outfile:'../sound-renderer/render.js',format:'iife'});
await writeFile('../sound-renderer/index.html',`<!doctype html><title>Cuelume audio export</title><select aria-label="Cue"><option>attention</option><option>select</option></select><button>Render cue</button><output></output><textarea aria-label="Rendered WAV" style="width:400px;height:80px"></textarea><script src="render.js"></script>`);
