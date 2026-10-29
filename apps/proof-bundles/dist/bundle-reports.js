import {validAddress} from './core.js';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const digitString=s=>typeof s==='string'&&/^\d{1,40}$/.test(s);
export function validBundleSnapshot(r){
 if(!r||r.mode!=='sampled-rpc'||!validAddress(r.mint)||!Number.isFinite(Date.parse(r.scannedAt)))return false;
 const c=r.coverage;
 if(!c||!integer(c.requested)||!integer(c.analyzed)||c.analyzed>c.requested||!integer(c.failed)||!Array.isArray(r.groups)||r.groups.length>100||!Array.isArray(r.sharedTransfers)||r.sharedTransfers.length>100||!Array.isArray(r.limitations)||!r.limitations.every(t=>typeof t==='string'&&t.length<=2000))return false;
 if(!r.sharedTransfers.every(f=>validAddress(f.source)&&Array.isArray(f.destinations)&&f.destinations.every(validAddress)&&Array.isArray(f.transfers)&&f.transfers.every(t=>validAddress(t.destination)&&typeof t.signature==='string'&&integer(t.lamports))))return false;
 return r.groups.every(g=>integer(g.slot)&&Array.isArray(g.owners)&&g.owners.length<=100&&g.owners.every(validAddress)&&Array.isArray(g.transactions)&&g.transactions.length<=100&&g.transactions.every(t=>typeof t.signature==='string'&&Array.isArray(t.gains)&&t.gains.every(a=>validAddress(a.owner)&&digitString(a.rawGain))));
}
export function bundleSummary(r){
 const c=r.coverage,groupedWallets=new Set(r.groups.flatMap(g=>g.owners));
 const percent=c.requested>0?Math.round(c.analyzed/c.requested*100):0;
 const incomplete=c.requested===0||c.analyzed<c.requested||c.unattributedBalances>0;
 return {coverage:percent,incomplete,groups:r.groups.length,wallets:groupedWallets.size,requested:c.requested,analyzed:c.analyzed,
  tone:!c.analyzed?'unknown':incomplete?'partial':r.groups.length?'observed':'neutral',
  headline:!c.analyzed?'Not enough evidence':r.groups.length?`${r.groups.length} acquisition pattern${r.groups.length===1?'':'s'} observed`:incomplete?'No pattern found in a partial sample':'No pattern found in this sample',
  explanation:!c.analyzed?'No usable transaction sample was returned. No bundle conclusion can be drawn.':incomplete?'Some requested evidence was unavailable. These results describe only the transactions that could be analyzed.':'This is a bounded transaction sample. It does not establish whether the full launch was bundled.',
  launchVerified:c.launchVerified===true};
}
export function bundleWalletRows(r){
 const owners=new Map(),seen=new Set();
 for(const group of r.groups)for(const tx of group.transactions)for(const gain of tx.gains||[]){
  if(!validAddress(gain.owner)||!digitString(gain.rawGain)||BigInt(gain.rawGain)<=0n)continue;
  const key=tx.signature+':'+gain.owner;if(seen.has(key))continue;seen.add(key);
  const row=owners.get(gain.owner)||{owner:gain.owner,rawAcquired:0n,slots:new Set(),proofs:[]};
  row.rawAcquired+=BigInt(gain.rawGain);row.slots.add(group.slot);row.proofs.push({signature:tx.signature,slot:group.slot,rawGain:gain.rawGain});owners.set(row.owner,row);
 }
 return [...owners.values()].map(r=>({...r,rawAcquired:r.rawAcquired.toString(),slots:[...r.slots],transactionCount:r.proofs.length})).sort((a,b)=>b.transactionCount-a.transactionCount||a.owner.localeCompare(b.owner));
}
export function formatTokenUnits(raw,decimals){
 if(!digitString(raw)||!Number.isInteger(decimals)||decimals<0||decimals>18)return null;
 const padded=raw.padStart(decimals+1,'0');const whole=(decimals?padded.slice(0,-decimals):padded).replace(/^0+(?=\d)/,'');
 const fraction=decimals?padded.slice(-decimals).replace(/0+$/,''):'';return whole+(fraction?'.'+fraction:'');
}
export function snapshotId(r){return [r.mint,r.scannedAt,r.coverage.anchor||'recent'].join('|');}
export function keepBundleSnapshot(history,r,limit=40){
 if(!validBundleSnapshot(r))return Array.isArray(history)?history.filter(validBundleSnapshot).slice(0,limit):[];
 return [r,...(Array.isArray(history)?history:[]).filter(s=>validBundleSnapshot(s)&&snapshotId(s)!==snapshotId(r))].sort((a,b)=>Date.parse(b.scannedAt)-Date.parse(a.scannedAt)).slice(0,limit);
}
export function compareBundleSnapshots(current,previous){
 if(!validBundleSnapshot(current)||!validBundleSnapshot(previous)||current.mint!==previous.mint)return null;
 const now=new Set(bundleWalletRows(current).map(r=>r.owner)),before=new Set(bundleWalletRows(previous).map(r=>r.owner));
 const sameAnchor=!!current.coverage.anchor&&current.coverage.anchor===previous.coverage.anchor;
 return {sameAnchor,previousAt:previous.scannedAt,currentAt:current.scannedAt,groupDelta:current.groups.length-previous.groups.length,
  added:[...now].filter(w=>!before.has(w)),removed:[...before].filter(w=>!now.has(w)),
  description:sameAnchor?'Both snapshots sample the same anchor slot. Coverage and provider availability can still differ.':'These snapshots cover rolling or different transaction windows. Differences are sample observations, not a change in the token’s overall bundle status.'};
}
