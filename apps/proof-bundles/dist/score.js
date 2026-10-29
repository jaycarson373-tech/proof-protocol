// Proof score v1. Unknown inputs earn no points; the denominator stays 100.
// This checklist measures observable signals, not legitimacy or expected returns.
import {safeUrl,validAddress} from './core.js';
export const SCORE_VERSION='1.0';
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function accountConcentration(chain,largest){
 const supply=chain?.value?.data?.parsed?.info?.supply;
 const entries=largest?.value;
 if(!/^\d+$/.test(supply||'')||!Array.isArray(entries)||!entries.length)return null;
 try{
  const total=BigInt(supply);if(total<=0n)return null;
  if(entries.some(e=>!/^\d+$/.test(e?.amount||'')||!validAddress(e.address||'')))return null;
  const sorted=[...entries].sort((a,b)=>BigInt(a.amount)>BigInt(b.amount)?-1:BigInt(a.amount)<BigInt(b.amount)?1:0).slice(0,10);
  const held=sorted.reduce((sum,e)=>sum+BigInt(e.amount),0n);
  if(held>total)return null;
  return {percent:Number(held*100000000n/total)/1000000,points:held*100n<=total*20n?10:held*100n<=total*40n?6:held*100n<=total*60n?3:0,accounts:sorted.map(e=>({address:e.address,amount:e.amount})),slot:largest.context?.slot??null};
 }catch{return null;}
}
export function scoreEvidence(report){
 const pair=report.pair,chain=report.chain;
 const mint=chain?.value?.data?.parsed;
 const info=mint?.type==='mint'?mint.info:null;
 const at=Number.isFinite(Date.parse(report.at))?Date.parse(report.at):Date.now();
 const source='https://solscan.io/token/'+report.address;
 const market=safeUrl(pair?.url)||'https://dexscreener.com/solana/'+report.address;
 const categories=[];
 const add=(id,label,max,points,detail,url)=>categories.push({id,label,max,points,detail,url,state:points===null?'unknown':points===max?'observed':'review'});
 for(const [key,label,max] of [['mintAuthority','Mint permission',20],['freezeAuthority','Freeze permission',15]]){
  const known=info&&Object.hasOwn(info,key)&&(info[key]===null||validAddress(info[key]));
  add(key,label,max,known?(info[key]===null?max:0):null,known?(info[key]===null?`Authority: null (revoked). Confirmed mainnet RPC slot ${chain?.context?.slot??'unavailable'}.`:`Active authority: ${info[key]}. Confirmed mainnet RPC slot ${chain?.context?.slot??'unavailable'}.`):'The parsed mint permission was unavailable.',source);
 }
 const liq=pair?.liquidity?.usd;
 add('liquidity','Pool liquidity',25,finite(liq)?liq>=1000000?25:liq>=100000?20:liq>=25000?10:liq>=10000?5:0:null,finite(liq)?`$${Math.round(liq).toLocaleString('en-US')} reported in the largest indexed pool. ≥$1m: 25; ≥$100k: 20; ≥$25k: 10; ≥$10k: 5; below: 0.`:'No usable pool liquidity was returned.',market);
 const created=pair?.pairCreatedAt;
 const days=finite(created)&&created>0&&created<=at?(at-created)/86400000:null;
 add('history','Pool history',15,days===null?null:days>=180?15:days>=30?12:days>=7?8:days>=1?3:0,days===null?'Pool creation time is unavailable or invalid.':`${Math.floor(days)} days old at the scan timestamp. ≥180 days: 15; ≥30: 12; ≥7: 8; ≥1: 3; below: 0.`,market);
 const buys=pair?.txns?.h24?.buys,sells=pair?.txns?.h24?.sells;
 const transactions=finite(buys)&&finite(sells)?buys+sells:null;
 add('activity','Trading presence',10,transactions===null?null:transactions>=1000?10:transactions>=100?7:transactions>=10?4:transactions>0?1:0,transactions===null?'24-hour pool activity is unavailable.':`${transactions.toLocaleString('en-US')} transactions in 24h. ≥1,000: 10; ≥100: 7; ≥10: 4; >0: 1. Bots and wash trading are not excluded.`,market);
 const concentration=accountConcentration(chain,report.largestAccounts);
 add('concentration','Top-account spread',10,concentration===null?null:concentration.points,concentration===null?'Largest-account data or a positive mint supply was unavailable. Wrapped SOL has special supply accounting.':`Top 10 token accounts hold ${concentration.percent.toLocaleString('en-US',{maximumFractionDigits:6})}% of mint supply. ≤20%: 10; ≤40%: 6; ≤60%: 3; above: 0. Pools and treasuries may be included; these are not unique holders.`,source+'#holders');
 const websites=(Array.isArray(pair?.info?.websites)?pair.info.websites:[]).filter(w=>safeUrl(w.url));
 const socials=(Array.isArray(pair?.info?.socials)?pair.info.socials:[]).filter(s=>safeUrl(s.url));
 add('links','Indexed project links',5,pair?(websites.length?3:0)+(socials.length?2:0):null,pair?`${websites.length} website link(s), ${socials.length} social link(s) in the market index. Website: 3 points; social: 2. Listing does not verify ownership or functionality.`:'No indexed project links were available.',market);
 const points=categories.reduce((sum,c)=>sum+(c.points??0),0);
 const coverage=categories.reduce((sum,c)=>sum+(c.points===null?0:c.max),0);
 return {version:SCORE_VERSION,total:points,max:100,coverage,known:categories.filter(c=>c.points!==null).length,count:categories.length,band:coverage<70?'Incomplete evidence':points>=80?'More supporting signals':points>=50?'Mixed signals':'Limited supporting signals',categories,concentration,limitations:['Not a safety, legitimacy, or investment rating.','Team identity, product claims, source-code audits, liquidity locks and Token-2022 extensions are not verified.','Unknown categories earn zero points; the score is never normalized upward for missing data.']};
}
