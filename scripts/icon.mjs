import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from '/Users/vansitaaddanki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs';
await build({entryPoints:['src/components/Panda.tsx'],outfile:'scripts/panda-icon.mjs',platform:'node',format:'esm',bundle:true,packages:'external',jsx:'automatic'});
const {Panda}=await import('./panda-icon.mjs');
const face=renderToStaticMarkup(React.createElement(Panda,{mini:true}));
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="bg" x2=".8" y2="1"><stop stop-color="#b6c6f5"/><stop offset="1" stop-color="#788fad"/></linearGradient></defs><rect x="50" y="50" width="924" height="924" rx="210" fill="url(#bg)"/><g transform="translate(115 155)"><svg width="794" height="700" viewBox="8 0 104 91">${face.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<g class="sleep-eyes"[\s\S]*?<\/g>/,'').replace(/<path class="panda-happy"[^>]*\/>/,'')}</svg></g></svg>`;
await mkdir('native/Panda.iconset',{recursive:true});await writeFile('native/icon.svg',svg);
for(const n of [16,32,128,256,512]){await sharp(Buffer.from(svg)).resize(n,n).png().toFile(`native/Panda.iconset/icon_${n}x${n}.png`);await sharp(Buffer.from(svg)).resize(n*2,n*2).png().toFile(`native/Panda.iconset/icon_${n}x${n}@2x.png`);}
