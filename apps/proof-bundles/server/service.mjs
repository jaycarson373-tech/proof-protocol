import {createNativeLaunchScanner,LaunchScanError} from './native-launch.mjs';
import {validAddress} from '../dist/core.js';
import {summarizeBundles,normalizeIndexedReport,initializesMint} from '../dist/bundles.js';
import {minimumRaw,holderBalance} from './auth.mjs';
export class ApiError extends Error{constructor(status,code,message){super(message);Object.assign(this,{status,code});}}
export function createServices(config,{fetcher=fetch}={}){
 const verifiedEndpoints=new Map();let rpcId=0;const cache=new Map(),inFlight=new Map();let active=0;const budget=[];
 const rpc=async(method,params)=>{
  const endpoints=config.rpcUrl==='https://api.mainnet-beta.solana.com'?[config.rpcUrl,'https://solana-rpc.publicnode.com']:[config.rpcUrl];
  for(const endpoint of endpoints){
   try{if((verifiedEndpoints.get(endpoint)||0)<Date.now()){const g=await fetcher(endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method:'getGenesisHash',params:[]}),signal:AbortSignal.timeout(5000)});if(!g.ok||(await g.json()).result!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')continue;verifiedEndpoints.set(endpoint,Date.now()+300000);}const r=await fetcher(endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method,params}),signal:AbortSignal.timeout(5000)});if(!r.ok)continue;const j=await r.json();if(j.error||j.result===undefined)continue;return j.result;}catch{}
  }
  throw new ApiError(503,'RPC_UNAVAILABLE','The Solana RPC could not return this data. Retry shortly or configure a dedicated SOLANA_RPC_URL.');
 };
 const requireHolder=async(wallet)=>{
  if(!config.holderConfigured)throw new ApiError(503,'HOLDER_CONFIG_REQUIRED','Holder verification needs the official mint and token threshold.');
  if(!validAddress(wallet||''))throw new ApiError(401,'WALLET_LOGIN_REQUIRED','Verify wallet ownership first.');
  const [mint,accounts]=await Promise.all([rpc('getAccountInfo',[config.holderMint,{encoding:'jsonParsed',commitment:'confirmed'}]),rpc('getTokenAccountsByOwner',[wallet,{mint:config.holderMint},{encoding:'jsonParsed',commitment:'confirmed'}])]);
  const parsed=mint?.value?.data?.parsed;
  if(parsed?.type!=='mint')throw new ApiError(503,'MINT_UNAVAILABLE','The configured holder token is not a parsed mainnet mint.');
  let minimum,amount;try{minimum=minimumRaw(config.holderMinimum,parsed.info?.decimals);amount=holderBalance(accounts,wallet,config.holderMint);}catch{throw new ApiError(503,'HOLDER_DATA_UNAVAILABLE','Holder policy or source data could not be validated.');}
  if(amount<minimum)throw new ApiError(403,'PRO_REQUIRED','This wallet does not meet the configured holder threshold.');
  return {wallet,mint:config.holderMint,minimumTokens:config.holderMinimum,rawAmount:amount.toString(),rawMinimum:minimum.toString(),decimals:parsed.info.decimals,verifiedAt:new Date().toISOString(),slot:accounts.context?.slot??null};
 };
 const sampledInternal=async(mint,anchor)=>{
  if(!validAddress(mint))throw new ApiError(400,'INVALID_MINT','Enter a Solana mint address.');
  if(anchor&&!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(anchor))throw new ApiError(400,'INVALID_SIGNATURE','Enter a valid transaction signature.');
  const key='sample:'+mint+':'+(anchor||'');const old=cache.get(key);if(old&&old.until>Date.now())return {...old.data,cached:true};
  if(active>=2)throw new ApiError(503,'SCANNER_BUSY','The scanner is busy. Try again shortly.');active++;
  try{
   const account=await rpc('getAccountInfo',[mint,{encoding:'jsonParsed',commitment:'confirmed'}]);
   if(account?.value?.data?.parsed?.type!=='mint')throw new ApiError(400,'NOT_A_MINT','This address is not a parsed SPL mint on mainnet.');
   let transactions=[],requested=0,examined=0,available=0,launchVerified=false;
   if(anchor){
    const anchored=await rpc('getTransaction',[anchor,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}]);
    if(!anchored||!Number.isSafeInteger(anchored.slot)||anchored.meta?.err)throw new ApiError(400,'ANCHOR_UNAVAILABLE','The anchor transaction is unavailable or failed.');
    const mentionsMint=[...(anchored.meta?.preTokenBalances||[]),...(anchored.meta?.postTokenBalances||[])].some(b=>b.mint===mint)||initializesMint(anchored,mint);
    if(!mentionsMint)throw new ApiError(400,'ANCHOR_MINT_MISMATCH','The anchor does not contain evidence for this mint.');
    const block=await rpc('getBlock',[anchored.slot,{encoding:'jsonParsed',transactionDetails:'full',rewards:false,maxSupportedTransactionVersion:0,commitment:'confirmed'}]);
    if(!Array.isArray(block?.transactions))throw new ApiError(503,'ANCHOR_BLOCK_UNAVAILABLE','The RPC could not return the anchor block. An archival RPC may be needed.');
    const matching=block.transactions.map((t,blockIndex)=>({...t,blockIndex})).filter(t=>!t.meta?.err&&[...(t.meta?.preTokenBalances||[]),...(t.meta?.postTokenBalances||[])].some(b=>b.mint===mint));
    examined=block.transactions.length;available=matching.length;transactions=matching.slice(0,12).map(t=>({...t,slot:anchored.slot,blockTime:block.blockTime??anchored.blockTime??null}));requested=transactions.length;launchVerified=initializesMint(anchored,mint);
   }else{
    const list=await rpc('getSignaturesForAddress',[mint,{limit:60}]);
    if(!Array.isArray(list))throw new ApiError(503,'INVALID_RPC_DATA','The RPC returned invalid signature data.');
    const signatures=list.filter(s=>!s.err).map(s=>s.signature).filter((v,i,a)=>typeof v==='string'&&a.indexOf(v)===i).slice(0,12);examined=list.length;available=list.filter(s=>!s.err).length;requested=signatures.length;
    for(let i=0;i<signatures.length;i+=3){const group=await Promise.allSettled(signatures.slice(i,i+3).map(signature=>rpc('getTransaction',[signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}])));transactions.push(...group.map(r=>r.status==='fulfilled'?r.value:null));}
    if(signatures.length&&transactions.every(t=>!t))throw new ApiError(503,'TRANSACTIONS_UNAVAILABLE','The RPC returned signatures but no parsed transactions. No bundle verdict can be produced.');
   }
   const data=summarizeBundles(transactions,mint,{requested,anchor,launchVerified});data.token={decimals:Number.isInteger(account.value.data.parsed.info?.decimals)?account.value.data.parsed.info.decimals:null};data.coverage.signaturesExamined=examined;data.coverage.successfulSignaturesAvailable=available;
   cache.set(key,{data,until:Date.now()+45000});if(cache.size>200)cache.delete(cache.keys().next().value);return data;
  }finally{active--;}
 };
 const indexedInternal=async(mint)=>{
  if(!validAddress(mint))throw new ApiError(400,'INVALID_MINT','Enter a Solana mint address.');
  if(!config.indexerKey)throw new ApiError(503,'INDEXER_NOT_CONFIGURED','Indexed launch evidence requires a configured GateKept API key and account credits.');
  const key='indexed:'+mint;const old=cache.get(key);if(old&&old.until>Date.now())return {...old.data,cached:true};
  const now=Date.now();while(budget.length&&budget[0]<now-3600000)budget.shift();
  if(budget.length>=20)throw new ApiError(429,'INDEXER_BUDGET_LIMIT','The server’s hourly indexer call limit has been reached.');budget.push(now);
  let response;
  try{response=await fetcher('https://api.gatekept.io/api/v1/bundles/launches/'+encodeURIComponent(mint),{headers:{Authorization:'Bearer '+config.indexerKey},signal:AbortSignal.timeout(15000)});}catch{throw new ApiError(503,'INDEXER_UNAVAILABLE','The launch indexer could not be reached.');}
  if(response.status===404)throw new ApiError(404,'LAUNCH_NOT_INDEXED','The indexer has no stored launch for this token. This does not mean it was unbundled.');
  if(response.status===401||response.status===403)throw new ApiError(503,'INDEXER_AUTH_REQUIRED','The configured indexer key is not authorized.');
  if(response.status===402)throw new ApiError(503,'INDEXER_CREDITS_REQUIRED','The indexer account needs credits.');
  if(response.status===429)throw new ApiError(429,'INDEXER_RATE_LIMIT','The launch indexer is rate limiting requests. Retry shortly.');
  if(!response.ok)throw new ApiError(503,'INDEXER_UNAVAILABLE','The launch indexer could not return this evidence.');
  try{const body=await response.json();const data=normalizeIndexedReport(body.data,mint);cache.set(key,{data,until:Date.now()+120000});return data;}catch{throw new ApiError(503,'INDEXER_INVALID_DATA','The indexer returned an invalid or mismatched launch.');}
 };
 const nativeScanner=createNativeLaunchScanner({rpc});
 const launchInternal=async(mint,anchor='')=>{
  const cacheKey='native:'+mint+':'+anchor;const old=cache.get(cacheKey);if(old&&old.until>Date.now())return {...old.data,cached:true};
  if(active>=2)throw new ApiError(503,'SCANNER_BUSY','The scanner is busy. Try again shortly.');active++;
  try{const report=await nativeScanner(mint,anchor);cache.set(cacheKey,{data:report,until:Date.now()+120000});if(cache.size>200)cache.delete(cache.keys().next().value);return report;}catch(e){if(e instanceof LaunchScanError){const error=new ApiError(e.status,e.code,e.message);error.details=e.details;throw error;}throw e;}finally{active--;}
 };
 const deduplicated=(key,run)=>{if(inFlight.has(key))return inFlight.get(key);const work=run().finally(()=>inFlight.delete(key));inFlight.set(key,work);return work;};
 const sampled=(mint,anchor)=>deduplicated('sample:'+mint+':'+(anchor||''),()=>sampledInternal(mint,anchor));
 const indexed=mint=>deduplicated('indexed:'+mint,()=>indexedInternal(mint));
 const launch=(mint,anchor='')=>deduplicated('native:'+mint+':'+anchor,()=>launchInternal(mint,anchor));
 return {rpc,requireHolder,sampled,indexed,launch};
}
