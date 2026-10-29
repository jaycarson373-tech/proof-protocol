import {validAddress} from './core.js';
const publicKey=k=>typeof k==='string'?k:k?.pubkey;
const raw=n=>typeof n==='string'&&/^\d+$/.test(n)?BigInt(n):null;
export function initializesMint(transaction,mint){
 const instructions=[...(transaction?.transaction?.message?.instructions||[]),...(transaction?.meta?.innerInstructions||[]).flatMap(i=>i.instructions||[])];
 return !!transaction?.meta&&transaction.meta.err===null&&instructions.some(i=>['spl-token','spl-token-2022'].includes(i.program)&&['initializeMint','initializeMint2'].includes(i.parsed?.type)&&i.parsed.info?.mint===mint);
}
export function acquisitionEvidence(transaction,mint){
 if(!transaction||!transaction.meta||!transaction.transaction?.message||transaction.meta.err||!Number.isSafeInteger(transaction.slot))return null;
 const keys=transaction.transaction?.message?.accountKeys||[];
 const required=transaction.transaction?.message?.header?.numRequiredSignatures||0;
 const signers=new Set(keys.filter((k,i)=>typeof k==='object'?k.signer===true:i<required).map(publicKey));
 const balances=new Map();let unattributed=0;
 for(const [side,factor] of [['preTokenBalances',-1n],['postTokenBalances',1n]]){
  for(const item of transaction.meta?.[side]||[]){
   if(item.mint!==mint)continue;
   const amount=raw(item.uiTokenAmount?.amount);
   if(amount===null||!validAddress(item.owner||'')){unattributed++;continue;}
   balances.set(item.owner,(balances.get(item.owner)||0n)+factor*amount);
  }
 }
 const gains=[...balances].filter(([owner,amount])=>amount>0n&&signers.has(owner)).map(([owner,amount])=>({owner,rawGain:amount.toString()}));
 const signature=transaction.transaction?.signatures?.[0];
 if(typeof signature!=='string')return null;
 const instructions=[...(transaction.transaction?.message?.instructions||[]),...(transaction.meta?.innerInstructions||[]).flatMap(i=>i.instructions||[])];
 const transfers=instructions.filter(i=>i.program==='system'&&i.parsed?.type==='transfer').map(i=>i.parsed.info).filter(i=>validAddress(i.source||'')&&validAddress(i.destination||'')&&Number.isSafeInteger(i.lamports)&&i.lamports>0).map(i=>({source:i.source,destination:i.destination,lamports:i.lamports,signature,slot:transaction.slot}));
 return {signature,slot:transaction.slot,blockTime:transaction.blockTime??null,gains,transfers,unattributed};
}
export function summarizeBundles(transactions,mint,meta={}){
 const seen=new Set();const evidence=[];
 for(const t of transactions){const item=acquisitionEvidence(t,mint);if(item&&!seen.has(item.signature)){seen.add(item.signature);evidence.push(item);}}
 const slots=new Map();
 for(const item of evidence){if(!item.gains.length)continue;const group=slots.get(item.slot)||{slot:item.slot,blockTime:item.blockTime,transactions:[],owners:new Set()};group.transactions.push(item);item.gains.forEach(g=>group.owners.add(g.owner));slots.set(item.slot,group);}
 const groups=[...slots.values()].filter(g=>g.transactions.length>=2&&g.owners.size>=2).sort((a,b)=>a.slot-b.slot).map(g=>({slot:g.slot,blockTime:g.blockTime,owners:[...g.owners],transactions:g.transactions.map(t=>({signature:t.signature,gains:t.gains})),classification:'same-slot-acquisitions',confirmedBundle:false}));
 const groupOwners=new Set(groups.flatMap(g=>g.owners));const funding=new Map();
 for(const item of evidence)for(const transfer of item.transfers){if(!groupOwners.has(transfer.destination)||transfer.source===transfer.destination)continue;const f=funding.get(transfer.source)||{source:transfer.source,destinations:new Set(),transfers:[]};f.destinations.add(transfer.destination);f.transfers.push(transfer);funding.set(f.source,f);}
 const sharedTransfers=[...funding.values()].filter(f=>f.destinations.size>=2).map(f=>({...f,destinations:[...f.destinations]}));
 const knownTimes=evidence.map(t=>t.blockTime).filter(Number.isFinite);
 return {schema:1,mint,scannedAt:new Date().toISOString(),mode:'sampled-rpc',classification:groups.length?'Patterns observed':'No pattern observed in sample',confirmedBundle:false,groups,sharedTransfers,coverage:{requested:meta.requested??transactions.length,returned:transactions.filter(Boolean).length,analyzed:evidence.length,failed:transactions.length-evidence.length,acquisitionTransactions:evidence.filter(t=>t.gains.length).length,unattributedBalances:evidence.reduce((n,t)=>n+t.unattributed,0),firstTime:knownTimes.length?Math.min(...knownTimes):null,lastTime:knownTimes.length?Math.max(...knownTimes):null,scope:meta.anchor?'anchor-slot transaction sample':'recent mint-address transaction sample',anchor:meta.anchor||null,launchVerified:meta.launchVerified===true},limitations:['A same-slot pattern does not prove a Jito bundle or common ownership.','This samples transactions referencing the mint. It is not a complete launch, holder or funding history.','Positive balance changes are acquisitions, not necessarily purchases. Only recipient owners signing the transaction are counted.','Common transfers shown here were observed inside this sample; no root-funder attribution is made.','Zero patterns in a sample is not evidence of an unbundled launch.']};
}
export function normalizeIndexedReport(data,mint){
 const launch=data?.launch;
 if(!launch||launch.mint!==mint||(launch.chain&&launch.chain!=='solana'))throw new Error('The indexer did not return a matching launch.');
 const pct=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100?n:null;
 return {schema:1,mode:'indexed-launch',mint,scannedAt:new Date().toISOString(),source:'GateKept API',sourceUrl:'https://gatekept.io/bundles?mint='+mint,providerReportedBundle:typeof launch.bundle?.isBundled==='boolean'?launch.bundle.isBundled:null,initialSupplyPct:pct(launch.bundle?.totalPct),bundleWalletsPct:pct(launch.bundle?.walletsPct),currentlyHeldPct:pct(launch.pnl?.heldPct),creator:validAddress(launch.creator?.address||'')?launch.creator.address:null,slot:Number.isSafeInteger(launch.slot)?launch.slot:null,updatedAt:launch.updatedAt||null,attribution:launch.attribution||null,wallets:(launch.bundle?.wallets||[]).filter(w=>validAddress(w.address||'')),cluster:Array.isArray(data.cluster)?data.cluster:[],knownWallets:Array.isArray(data.knownWallets)?data.knownWallets:[],raw:data,limitations:['Provider-reported attribution is not independent proof of wallet identity.','Stored launches only; an untracked launch returns no indexed verdict.','Initial allocation and currently held supply are different figures. Missing values remain unknown.']};
}
