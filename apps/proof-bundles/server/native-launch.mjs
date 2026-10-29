import {validAddress} from '../dist/core.js';
import {acquisitionEvidence,initializesMint,summarizeBundles} from '../dist/bundles.js';
import {holderBalance} from './auth.mjs';
export class LaunchScanError extends Error{constructor(status,code,message,details){super(message);Object.assign(this,{status,code,details});}}
const raw=value=>typeof value==='string'&&/^\d{1,40}$/.test(value)?BigInt(value):null;
const signature=t=>t?.transaction?.signatures?.[0];
const key=k=>typeof k==='string'?k:k?.pubkey;
function ownerChanges(t,mint){
 const amounts=new Map();
 for(const [name,sign]of [['preTokenBalances',-1n],['postTokenBalances',1n]])for(const b of t.meta?.[name]||[]){const amount=raw(b.uiTokenAmount?.amount);if(b.mint===mint&&validAddress(b.owner||'')&&amount!==null)amounts.set(b.owner,(amounts.get(b.owner)||0n)+sign*amount);}
 return amounts;
}
export function nativeWindowEvidence(mint,initialization,blocks,coverage,token){
 const matching=[];
 for(const block of blocks)for(const t of block.transactions||[]){if(t.meta?.err)continue;if([...(t.meta?.preTokenBalances||[]),...(t.meta?.postTokenBalances||[])].some(b=>b.mint===mint))matching.push({...t,slot:block.slot,blockTime:block.blockTime??null});}
 const selected=matching.slice(0,240);
 const evidence=summarizeBundles(selected,mint,{requested:selected.length,anchor:signature(initialization),launchVerified:true});evidence.token=token;evidence.coverage.scope='verified initialization window · bounded mint transactions';
 const recipients=new Map();
 for(const t of selected){const observed=acquisitionEvidence(t,mint);if(!observed)continue;for(const gain of observed.gains){const row=recipients.get(gain.owner)||{address:gain.owner,positiveAcquisitionsRaw:0n,windowNetChangeRaw:0n,firstSignature:observed.signature,firstSlot:observed.slot,proofs:[]};row.positiveAcquisitionsRaw+=BigInt(gain.rawGain);row.proofs.push({signature:observed.signature,slot:observed.slot,rawGain:gain.rawGain});recipients.set(row.address,row);}}
 for(const t of selected)for(const [owner,delta]of ownerChanges(t,mint)){const row=recipients.get(owner);if(row)row.windowNetChangeRaw+=delta;}
 const payer=key(initialization.transaction?.message?.accountKeys?.[0]);
 return {schema:2,mode:'native-launch',source:'Proof Bundles · Solana RPC',mint,scannedAt:new Date().toISOString(),initialization:{signature:signature(initialization),slot:initialization.slot,blockTime:initialization.blockTime??null,feePayer:validAddress(payer||'')?payer:null,verified:true},token,evidence,recipients:[...recipients.values()].map(r=>({...r,positiveAcquisitionsRaw:r.positiveAcquisitionsRaw.toString(),windowNetChangeRaw:r.windowNetChangeRaw.toString(),currentBalanceRaw:null,currentSupplyPct:null,currentSlot:null})),coverage:{...coverage,matchingTransactions:matching.length,analyzedTransactions:selected.length,transactionsTruncated:matching.length>selected.length,unavailableMetadata:blocks.reduce((n,b)=>n+(b.transactions||[]).filter(t=>!t.meta).length,0),completeWindow:coverage.slotEnumerationKnown&&coverage.windowMatured&&coverage.failedSlots.length===0&&matching.length===selected.length&&evidence.coverage.unattributedBalances===0&&blocks.every(b=>(b.transactions||[]).every(t=>!!t.meta))},fundingSources:[],fundingCoverage:{walletsRequested:0,walletsRead:0,signaturesExamined:0,transactionsRead:0,failedTransactions:0},limitations:['Same-slot acquisitions do not prove a Jito bundle, a developer identity, or common wallet ownership.','This examines a bounded initialization window, not every later trade or launch-team history.','Positive acquisitions may include transfers or mint allocations; they are not necessarily purchases. Net changes are only within the observed window.','Current account reads use the current mint supply and are not an atomic historical snapshot. They do not establish the initial supply allocation.','Funding checks inspect a small number of transactions before each selected recipient’s first acquisition. Shared services and exchange withdrawals can have the same source.']};
}
export function directFundingEvidence(transaction,owner,beforeSignature){
 if(!transaction?.meta||transaction.meta.err!==null)return [];
 const instructions=[...(transaction.transaction?.message?.instructions||[]),...(transaction.meta?.innerInstructions||[]).flatMap(i=>i.instructions||[])];
 return instructions.filter(i=>i.program==='system'&&i.parsed?.type==='transfer').map(i=>i.parsed.info).filter(i=>i.destination===owner&&validAddress(i.source||'')&&i.source!==owner&&Number.isSafeInteger(i.lamports)&&i.lamports>0).map(i=>({source:i.source,recipient:owner,lamports:i.lamports,signature:signature(transaction),slot:transaction.slot,blockTime:transaction.blockTime??null,beforeAcquisitionSignature:beforeSignature}));
}
export function createNativeLaunchScanner({rpc,clock=()=>Date.now()}){
 return async(mint,anchor='')=>{
  if(!validAddress(mint))throw new LaunchScanError(400,'INVALID_MINT','Enter a Solana mint address.');
  if(anchor&&!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(anchor))throw new LaunchScanError(400,'INVALID_SIGNATURE','Enter a valid mint-creation transaction signature.');
  const deadline=clock()+75000;
  const read=async(method,params)=>{if(clock()>deadline)throw new LaunchScanError(503,'RPC_READ_BUDGET','The bounded read exceeded its time budget. Provide a creation signature or use a faster archival RPC.');return rpc(method,params);};
  const batch=async(items,fn,size=2)=>{const results=[];for(let i=0;i<items.length;i+=size){if(clock()>deadline){results.push(...items.slice(i).map(()=>({status:'rejected',reason:new Error('Read budget reached.')})));break;}results.push(...await Promise.allSettled(items.slice(i,i+size).map(fn)));}return results;};
  const account=await read('getAccountInfo',[mint,{encoding:'jsonParsed',commitment:'confirmed'}]);
  const parsed=account?.value?.data?.parsed;
  if(parsed?.type!=='mint')throw new LaunchScanError(400,'NOT_A_MINT','This address is not a parsed SPL mint on mainnet.');
  const token={decimals:Number.isInteger(parsed.info?.decimals)?parsed.info.decimals:null,currentSupplyRaw:raw(parsed.info?.supply)!==null?parsed.info.supply:null,mintReadSlot:account.context?.slot??null};
  let initialization=null,pages=0,examined=0,probes=0;
  if(anchor){
   const t=await read('getTransaction',[anchor,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}]);probes++;
   if(!t||!initializesMint(t,mint))throw new LaunchScanError(422,'CREATION_ANCHOR_REQUIRED','The supplied transaction does not contain a parsed initialization of this mint. Use its mint-creation signature; the basic checker supports other anchor transactions.');initialization=t;
  }else{
   let before;let candidates=[];
   for(let p=0;p<2;p++){
    const page=await read('getSignaturesForAddress',[mint,{limit:1000,...(before?{before}:{})}]);
    if(!Array.isArray(page))throw new LaunchScanError(503,'HISTORY_UNAVAILABLE','The RPC did not return a usable mint history.');
    pages++;examined+=page.length;if(page.length)candidates=page.filter(s=>!s.err&&typeof s.signature==='string');
    if(page.length<1000)break;before=page.at(-1)?.signature;
   }
   const oldest=candidates.slice(-4).reverse();
   const checked=await batch(oldest,s=>read('getTransaction',[s.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}]));probes=checked.length;
   initialization=checked.find(r=>r.status==='fulfilled'&&r.value&&initializesMint(r.value,mint))?.value||null;
   if(!initialization)throw new LaunchScanError(422,'CREATION_NOT_LOCATED','A mint-creation transaction was not verified within the bounded history search. Supply the creation signature or use an archival RPC. No launch verdict was produced.',{pagesRead:pages,signaturesExamined:examined,transactionsProbed:probes});
  }
  if(!Number.isSafeInteger(initialization.slot))throw new LaunchScanError(503,'INVALID_CREATION_DATA','The RPC did not return a valid initialization slot.');
  const start=initialization.slot,end=start+4;
  const range=await Promise.allSettled([read('getSlot',[{commitment:'confirmed'}]),read('getBlocks',[start,end,{commitment:'confirmed'}])]);
  const head=range[0].status==='fulfilled'&&Number.isSafeInteger(range[0].value)?range[0].value:null;
  const listed=range[1].status==='fulfilled'&&Array.isArray(range[1].value)?range[1].value:null;
  const enumerationKnown=!!listed&&listed.every(s=>Number.isSafeInteger(s)&&s>=start&&s<=end)&&listed.includes(start);
  const slots=enumerationKnown?[...new Set(listed)].sort((a,b)=>a-b):Array.from({length:5},(_,i)=>start+i);
  const loaded=await batch(slots,async slot=>{const b=await read('getBlock',[slot,{encoding:'jsonParsed',transactionDetails:'full',rewards:false,maxSupportedTransactionVersion:0,commitment:'confirmed'}]);if(!Array.isArray(b?.transactions))throw new Error('Block unavailable.');return {...b,slot};});
  const blocks=loaded.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(!blocks.length)throw new LaunchScanError(503,'LAUNCH_BLOCKS_UNAVAILABLE','Creation was verified, but no launch-window blocks could be read. An archival RPC may be required.');
  const report=nativeWindowEvidence(mint,initialization,blocks,{startSlot:start,endSlot:end,slotEnumerationKnown:enumerationKnown,windowMatured:head!==null&&head>=end,headSlot:head,requestedSlots:slots,readSlots:blocks.map(b=>b.slot),failedSlots:slots.filter((_,i)=>loaded[i].status==='rejected'),historySearch:{pagesRead:pages,signaturesExamined:examined,transactionsProbed:probes,explicitAnchor:!!anchor}},token);
  const recipients=report.recipients.slice(0,6);
  const balances=await batch(recipients,async row=>{const data=await read('getTokenAccountsByOwner',[row.address,{mint},{encoding:'jsonParsed',commitment:'confirmed'}]);return {amount:holderBalance(data,row.address,mint),slot:data.context?.slot??null};});
  for(let i=0;i<recipients.length;i++)if(balances[i].status==='fulfilled'){const {amount,slot}=balances[i].value;recipients[i].currentBalanceRaw=amount.toString();recipients[i].currentSlot=slot;const supply=raw(token.currentSupplyRaw);recipients[i].currentSupplyPct=supply>0n&&amount<=supply?Number(amount*1000000n/supply)/10000:null;}
  report.coverage.recipientCount=report.recipients.length;report.coverage.balancesRequested=recipients.length;report.coverage.balancesRead=balances.filter(r=>r.status==='fulfilled').length;
  const fundingRows=[];const selected=recipients.slice(0,3);report.fundingCoverage.walletsRequested=selected.length;
  for(const row of selected){
   if(clock()>deadline)break;
   try{const list=await read('getSignaturesForAddress',[row.address,{before:row.firstSignature,limit:4}]);if(!Array.isArray(list))continue;report.fundingCoverage.walletsRead++;report.fundingCoverage.signaturesExamined+=list.length;const reads=await batch(list.filter(s=>!s.err&&typeof s.signature==='string').slice(0,2),s=>read('getTransaction',[s.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}]));for(const r of reads){if(r.status==='fulfilled'&&r.value){report.fundingCoverage.transactionsRead++;fundingRows.push(...directFundingEvidence(r.value,row.address,row.firstSignature));}else report.fundingCoverage.failedTransactions++;}}catch{}
  }
  const sources=new Map();for(const transfer of fundingRows){const f=sources.get(transfer.source)||{source:transfer.source,recipients:new Set(),transfers:[]};f.recipients.add(transfer.recipient);f.transfers.push(transfer);sources.set(f.source,f);}
  report.fundingSources=[...sources.values()].map(s=>({...s,recipients:[...s.recipients],shared:s.recipients.size>1}));
  report.coverage.readBudgetReached=clock()>deadline;return report;
 };
}
