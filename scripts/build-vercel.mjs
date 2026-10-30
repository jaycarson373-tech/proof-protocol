import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
const output=new URL('../vercel-output/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('../public/',import.meta.url),output,{recursive:true});
await cp(new URL('../apps/proof-bundles/dist/',import.meta.url),new URL('bundles/',output),{recursive:true});
const index=new URL('index.html',output);await writeFile(index,(await readFile(index,'utf8')).replace('<a href="#/methodology">How it works</a>','<a href="/bundles/">Bundle checker ↗</a><a href="#/methodology">How it works</a>'));
console.log('Built Proof Protocol and Proof Bundles static assets. APIs use the Node function.');
