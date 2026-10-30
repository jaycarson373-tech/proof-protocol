import {validAddress} from '../dist/core.js';
const METHODS=new Set(['getAccountInfo','getTokenLargestAccounts','getBalance']);
export function createRpcGateway(config,services){
 const limits=new Map();
 return async(req,res)=>{
  if(new URL(req.url,config.origin).pathname!=='/api/rpc')return false;
  const json=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));return true;};
  if(req.method!=='POST')return json(405,{error:{message:'Use POST.'}});
  if(req.headers.origin!==config.origin)return json(403,{error:{message:'Invalid request origin.'}});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:{message:'Use application/json.'}});
  const window=Math.floor(Date.now()/60000),ip=req.socket?.remoteAddress||'local',key=ip+':'+window;
  limits.set(key,(limits.get(key)||0)+1);if(limits.get(key)>60)return json(429,{error:{message:'Too many requests. Retry shortly.'}});
  if(limits.size>2000)limits.clear();
  let body;try{let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>2048)return json(413,{error:{message:'Request too large.'}});}body=JSON.parse(raw);}catch{return json(400,{error:{message:'Invalid JSON.'}});}
  if(!METHODS.has(body?.method)||!Array.isArray(body.params)||body.params.length<1||body.params.length>2||!validAddress(body.params[0]||''))return json(400,{error:{message:'Unsupported read-only request.'}});
  try{
   const result=await services.rpc(body.method,[body.params[0],{commitment:'finalized',...(body.method==='getAccountInfo'?{encoding:'jsonParsed'}:{})}]);
   if(!result||!Number.isSafeInteger(result.context?.slot)||result.context.slot<=0||!Object.hasOwn(result,'value'))throw 0;
   if(body.method==='getBalance'&&(!Number.isSafeInteger(result.value)||result.value<0))throw 0;
   if(body.method==='getTokenLargestAccounts'&&(!Array.isArray(result.value)||result.value.length>20||result.value.some(a=>!validAddress(a?.address||'')||!/^\d+$/.test(a?.amount||''))))throw 0;
   if(body.method==='getAccountInfo'&&result.value?.data?.parsed?.type==='mint'){const a=result.value,p=a.data.parsed.info;if(!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(a.owner)||!p||!/^\d+$/.test(p.supply||'')||!Number.isInteger(p.decimals)||p.decimals<0||p.decimals>255||['mintAuthority','freezeAuthority'].some(k=>!Object.hasOwn(p,k)||(p[k]!==null&&!validAddress(p[k]))))throw 0;}
   return json(200,{result});
  }catch{return json(503,{error:{message:'Mainnet evidence is temporarily unavailable.'}});}
 };
}
