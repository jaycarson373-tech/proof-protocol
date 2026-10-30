const COMPUTE_BUDGET='ComputeBudget111111111111111111111111111111';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function decode58(value){
 if(typeof value!=='string'||value.length>100||!value.length)return null;
 let n=0n;for(const c of value){const i=alphabet.indexOf(c);if(i<0)return null;n=n*58n+BigInt(i);}
 const bytes=[];while(n){bytes.unshift(Number(n&255n));n>>=8n;}
 for(const c of value){if(c!=='1')break;bytes.unshift(0);}return bytes;
}
export function executionEvidence(t){
 if(!t?.meta||t.meta.err!==null||!t.transaction?.message||typeof t.transaction.signatures?.[0]!=='string')return null;
 const instructions=t.transaction.message.instructions;
 let priorityFeeMicroLamports=null,computeUnitLimit=null;
 for(const i of Array.isArray(instructions)?instructions:[]){
  if(i.programId!==COMPUTE_BUDGET)continue;const b=decode58(i.data);if(!b)continue;
  if(b[0]===3&&b.length===9){let n=0n;for(let j=8;j>=1;j--)n=(n<<8n)+BigInt(b[j]);priorityFeeMicroLamports=n.toString();}
  if(b[0]===2&&b.length===5)computeUnitLimit=b[1]+b[2]*256+b[3]*65536+b[4]*16777216;
 }
 const payer=t.transaction.message.accountKeys?.[0];
 return {signature:t.transaction.signatures[0],slot:t.slot,blockIndex:Number.isSafeInteger(t.blockIndex)&&t.blockIndex>=0?t.blockIndex:null,feePayer:typeof payer==='string'?payer:payer?.pubkey??null,feeLamports:Number.isSafeInteger(t.meta.fee)&&t.meta.fee>=0?t.meta.fee:null,computeUnitsConsumed:Number.isSafeInteger(t.meta.computeUnitsConsumed)&&t.meta.computeUnitsConsumed>=0?t.meta.computeUnitsConsumed:null,priorityFeeMicroLamports,computeUnitLimit,instructionsAvailable:Array.isArray(instructions)};
}
export function executionSummary(transactions){
 const seen=new Set(),rows=[];for(const t of transactions){const e=executionEvidence(t);if(e&&!seen.has(e.signature)){seen.add(e.signature);rows.push(e);}}
 return {schema:1,transactions:rows,priorityPriceDeclarations:rows.filter(t=>t.priorityFeeMicroLamports!==null).length,orderedTransactions:rows.filter(t=>t.blockIndex!==null).length,feePayers:[...new Set(rows.map(t=>t.feePayer).filter(Boolean))],jitoBundleProof:false};
}
