import {validAddress} from '../public/core.js';
const GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const METHODS=new Set(['getAccountInfo','getTokenLargestAccounts','getBalance']);
export function createWorker(assets={},transport=fetch,clock=Date.now){
 const verified=new Map(),cache=new Map(),pending=new Map(),limits=new Map();
 const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
 async function call(url,method,params){
  const response=await transport(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw Error('upstream unavailable');const data=await response.json();
  if(data.error||!Object.hasOwn(data,'result'))throw Error('upstream RPC error');return data.result;
 }
 async function evidence(method,address,env){
  let providers=['https://solana-rpc.publicnode.com','https://api.mainnet-beta.solana.com'];
  if(env.SOLANA_RPC_URL){const u=new URL(env.SOLANA_RPC_URL);if(u.protocol!=='https:'||u.username||u.password)throw Error('invalid provider');providers=[u.href,...providers];}
  for(const url of providers){try{
   if((verified.get(url)||0)<clock()){if(await call(url,'getGenesisHash',[])!==GENESIS)throw Error('wrong cluster');verified.set(url,clock()+300000);}
   const result=await call(url,method,[address,{commitment:'finalized',...(method==='getAccountInfo'?{encoding:'jsonParsed'}:{})}]);
   if(!result||!Number.isSafeInteger(result.context?.slot)||result.context.slot<=0||!Object.hasOwn(result,'value'))throw Error('invalid context');
   if(method==='getBalance'&&(!Number.isSafeInteger(result.value)||result.value<0))throw Error('invalid balance');
   if(method==='getTokenLargestAccounts'&&(!Array.isArray(result.value)||result.value.length>20||result.value.some(a=>!validAddress(a?.address||'')||!/^\d+$/.test(a?.amount||''))))throw Error('invalid accounts');
   if(method==='getAccountInfo'&&result.value!==null){const a=result.value;if(!validAddress(a.owner||''))throw Error('invalid account');if(a.data?.parsed?.type==='mint'){const p=a.data.parsed.info;if(!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(a.owner)||!p||!/^\d+$/.test(p.supply||'')||!Number.isInteger(p.decimals)||p.decimals<0||p.decimals>255||['mintAuthority','freezeAuthority'].some(k=>!Object.hasOwn(p,k)||(p[k]!==null&&!validAddress(p[k]))))throw Error('invalid mint');}}
   return result;
  }catch{/* Do not reflect provider credentials or raw errors. */}}
  throw Error('Evidence unavailable');
 }
 return {async fetch(request,env={}){
  const url=new URL(request.url);
  if(url.pathname==='/api/status')return json({network:'solana-mainnet',mode:'read-only',rpc:'server-side',signing:false});
  if(url.pathname==='/api/rpc'){
   if(request.method!=='POST')return json({error:{message:'Use POST.'}},405,{allow:'POST'});
   if((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:{message:'Invalid request origin.'}},403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:{message:'Use application/json.'}},415);
   const ip=request.headers.get('cf-connecting-ip')||'local',window=Math.floor(clock()/60000),limit=limits.get(ip);
   if(limit?.window===window&&limit.count>=60)return json({error:{message:'Too many requests. Retry shortly.'}},429,{'retry-after':'60'});
   limits.set(ip,{window,count:limit?.window===window?limit.count+1:1});
   if(limits.size>2000)for(const [k,v]of limits)if(v.window!==window)limits.delete(k);
   if(limits.size>4000)return json({error:{message:'Evidence service is busy.'}},503);
   let body;try{const reader=request.body?.getReader();if(!reader)throw 0;let chunks=[],size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return json({error:{message:'Request too large.'}},413);}chunks.push(value);}body=JSON.parse(new TextDecoder().decode(Uint8Array.from(chunks.flatMap(c=>Array.from(c)))));}catch{return json({error:{message:'Invalid JSON.'}},400);}
   if(!METHODS.has(body?.method)||!Array.isArray(body.params)||body.params.length<1||body.params.length>2||!validAddress(body.params[0]||''))return json({error:{message:'Unsupported read-only request.'}},400);
   const key=body.method+':'+body.params[0],saved=cache.get(key);if(saved&&saved.until>clock())return json({result:saved.result,cached:true});
   try{if(!pending.has(key))pending.set(key,evidence(body.method,body.params[0],env).then(result=>{cache.set(key,{result,until:clock()+15000});if(cache.size>500)cache.delete(cache.keys().next().value);return result;}).finally(()=>pending.delete(key)));return json({result:await pending.get(key),cached:false});}catch{return json({error:{message:'Mainnet evidence is temporarily unavailable. Retry shortly.'}},503);}
  }
  if(url.pathname.startsWith('/api/'))return json({error:{message:'Not found.'}},404);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
  const assetPath=url.pathname==='/'?'/index.html':url.pathname;const asset=Object.hasOwn(assets,assetPath)?assets[assetPath]:null;if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','cache-control':'no-cache'}});
 }};
}
