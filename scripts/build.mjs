import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {validAddress} from '../public/core.js';
const root=new URL('../',import.meta.url),assets={};
const types={html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',json:'application/json'};
for(const name of await readdir(new URL('public/',root))){const type=types[name.split('.').at(-1)];if(!type)throw Error('Unsupported asset: '+name);assets['/'+name]={type,body:await readFile(new URL('public/'+name,root),'utf8')};}
const worker=(await readFile(new URL('worker/index.js',root),'utf8')).replace("import {validAddress} from '../public/core.js';",validAddress.toString());
await mkdir(new URL('dist/server/',root),{recursive:true});await mkdir(new URL('dist/.openai/',root),{recursive:true});
await writeFile(new URL('dist/server/index.js',root),worker+'\nexport default createWorker('+JSON.stringify(assets)+');\n');
try{await writeFile(new URL('dist/.openai/hosting.json',root),await readFile(new URL('.openai/hosting.json',root)));}catch(e){if(e.code!=='ENOENT')throw e;console.log('No Sites manifest in this checkout. The Worker was built; Vercel uses build:vercel.');}
console.log('Built self-contained Proof Worker with '+Object.keys(assets).length+' original assets.');
