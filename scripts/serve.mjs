import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {createWorker} from '../worker/index.js';
const root=new URL('../public/',import.meta.url),assets={};
const types={html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml'};
for(const name of await readdir(root))assets['/'+name]={body:await readFile(new URL(name,root),'utf8'),type:types[name.split('.').at(-1)]||'application/json'};
const worker=createWorker(assets),port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});const response=await worker.fetch(request,{SOLANA_RPC_URL:process.env.SOLANA_RPC_URL});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Request failed');}}).listen(port,'127.0.0.1',()=>console.log('Proof Protocol preview: http://127.0.0.1:'+port));
