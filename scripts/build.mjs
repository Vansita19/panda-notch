import {build} from 'esbuild';
import {mkdir,writeFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/main.tsx'],bundle:true,outfile:'dist/app.js',format:'iife',target:'safari17',minify:true,jsx:'automatic',legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'}});
await writeFile('dist/index.html',`<!doctype html><html lang="en" data-theme="dark" data-accent="blue"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self' file:; script-src 'self' 'unsafe-inline' file:; style-src 'self' 'unsafe-inline' file:; img-src 'self' data: file:; connect-src 'none'; font-src 'self' file:; object-src 'none'"><title>Panda</title><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script src="app.js"></script></body></html>`);
await cp('assets/audio','dist/audio',{recursive:true});
await cp('assets/menu','dist/menu',{recursive:true});
console.log('Built offline frontend.');
