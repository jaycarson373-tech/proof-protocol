import {createWorker} from '../worker/index.js';
import {createApi} from '../apps/proof-bundles/server/api.mjs';
import {configFromEnv} from '../apps/proof-bundles/server/config.mjs';

// All API routes share the same handler. An explicit APP_ORIGIN takes precedence.
// Vercel terminates TLS and routes the Host before invoking this function.
export function createApplication({env=process.env,assets={},transport=fetch,bundleServices}={}){
 const worker=createWorker(assets,transport),apis=new Map();
 return async(req,res)=>{
  try{
   const host=req.headers.host||'localhost';
   if(!/^[a-z0-9][a-z0-9.:-]{0,252}$/i.test(host))throw Error('Invalid host');
   const origin=env.APP_ORIGIN||(env.VERCEL?'https://'+host:'http://'+host);
   const path=new URL(req.url,origin).pathname;
   if(path.startsWith('/api/')&&!['/api/rpc','/api/status'].includes(path)){
    if(!apis.has(origin)){
     if(apis.size>=8){res.writeHead(503);res.end('Service busy');return;}
     apis.set(origin,createApi(configFromEnv({...env,APP_ORIGIN:origin}),{...(bundleServices?{services:bundleServices}:{})}));
    }
    // Only the platform adapter uses its trusted forwarding header for rate limits.
    if(env.VERCEL)req.proofClientIp=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    await apis.get(origin)(req,res);return;
   }
   let body;
   if(!['GET','HEAD'].includes(req.method)){
    if(req.body!==undefined)body=typeof req.body==='string'||Buffer.isBuffer(req.body)?req.body:JSON.stringify(req.body);
    else{const chunks=[];let size=0;for await(const c of req){size+=Buffer.byteLength(c);if(size>2048){res.writeHead(413);res.end('Request too large');return;}chunks.push(Buffer.from(c));}body=Buffer.concat(chunks);}
   }
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):String(v));
   headers.set('cf-connecting-ip',env.VERCEL?String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim():req.socket?.remoteAddress||'local');
   const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(body?.length?{body}:{})});
   const response=await worker.fetch(request,{SOLANA_RPC_URL:env.SOLANA_RPC_URL});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(!res.headersSent)res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:{message:'The evidence service could not complete the request.'}}));}
 };
}
