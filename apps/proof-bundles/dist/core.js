export const SOL = 'So11111111111111111111111111111111111111112';
export const CURATED = [SOL,'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN','DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'];
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeUrl(value) {try {const u = new URL(value);return u.protocol==='https:' && !u.username && !u.password ? u.href : '';}catch{return '';}}
export function validAddress(value) {
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
 const chars='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n=0n;
 for(const char of value)n=n*58n+BigInt(chars.indexOf(char));
 let bytes=0;for(;n>0n;n>>=8n)bytes++;
 return bytes+(value.match(/^1*/)?.[0].length||0)===32;
}
export function websiteHost(value){
 try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)return '';const host=u.hostname.toLowerCase().replace(/^www\./,'').replace(/\.$/,'');if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)||/\.(?:local|internal|localhost|invalid|test|onion)$/.test(host))return '';return host;}catch{return '';}
}
export function siteMatches(a,b){const x=websiteHost(a),y=websiteHost(b);return !!x&&!!y&&(x===y||x.endsWith('.'+y)||y.endsWith('.'+x));}
export function websiteQueries(parsed){
 const root=parsed.query||'';
 const simplified=root.replace(/(?:coin|token|protocol|finance|network|labs|dao)$/i,'');
 const withoutPrefix=root.replace(/^(?:get|join)/i,'');
 return [...new Set([root,...(simplified.length>=2&&simplified!==root?[simplified]:[]),...(withoutPrefix.length>=2&&withoutPrefix!==root?[withoutPrefix]:[]),parsed.host])].filter(Boolean).slice(0,3);
}
export function parseInput(value) {
 if(typeof value!=='string')return {type:'invalid'};
 const s=value.trim();if(/^0x[0-9a-f]{40}$/i.test(s))return {type:'unsupported'};if(validAddress(s))return {type:'address',value:s};
 const maybeUrl=/^https?:\/\//i.test(s)?s:/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(s)?'https://'+s:null;
 if(maybeUrl){
  try{const u=new URL(maybeUrl),parts=u.pathname.split('/').filter(Boolean);if(!websiteHost(u.href))return {type:'unsupported'};
   if(['solscan.io','explorer.solana.com'].includes(u.hostname)&&['token','address','account'].includes(parts[0])&&validAddress(parts[1])){if(u.searchParams.has('cluster')&&!['mainnet','mainnet-beta'].includes(u.searchParams.get('cluster')))return {type:'unsupported'};return {type:'address',value:parts[1]};}
   if(u.hostname==='dexscreener.com'){if(parts[0]==='solana'&&validAddress(parts[1]))return {type:'pair',value:parts[1]};return {type:'unsupported'};}
   const host=websiteHost(u.href);if(['x.com','twitter.com','t.me','discord.gg','github.com'].includes(host))return {type:'unsupported'};
   return {type:'website',value:'https://'+host,host,query:(host.split('.').length>2&&['co','com','org','net'].includes(host.split('.').at(-2))?host.split('.').at(-3):host.split('.').at(-2))};
  }catch{return {type:'unsupported'};}
 }
 if(/^[a-z][a-z0-9+.-]*:/i.test(s))return {type:'unsupported'};
 const query=s.replace(/^\$/,'');if(query.length>=2&&query.length<=80&&!/[<>\n\r]/.test(query))return {type:'search',value:query};
 return {type:'invalid'};
}
export function primaryPair(pairs,address) {return (Array.isArray(pairs)?pairs:[]).filter(p=>p.chainId==='solana'&&p.baseToken?.address===address).sort((a,b)=>(Number(b.liquidity?.usd)||0)-(Number(a.liquidity?.usd)||0))[0]||null;}
export function assess(pair, chain, address, marketAvailable = true) {
 const info=chain?.value?.data?.parsed?.info; const isMint=chain?.value?.data?.parsed?.type==='mint';
 const checks=[];
 if(isMint && info && Object.hasOwn(info,'mintAuthority') && Object.hasOwn(info,'freezeAuthority')){
 checks.push({name:'Mint authority',status:info.mintAuthority?'caution':'pass',detail:info.mintAuthority?'An active mint authority can create additional supply.':'Mint authority is revoked. No authority can mint additional supply through this mint.',source:'Solana mainnet · getAccountInfo'});
 checks.push({name:'Freeze authority',status:info.freezeAuthority?'caution':'pass',detail:info.freezeAuthority?'An active freeze authority can freeze eligible token accounts.':'Freeze authority is revoked. This mint has no account-freezing authority.',source:'Solana mainnet · getAccountInfo'});
 if(chain.value.owner==='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') checks.push({name:'Token-2022 extensions',status:'unknown',detail:'This mint uses Token-2022. Transfer fees, hooks and other extensions need additional review.',source:'Solana mainnet · mint owner'});
 }else checks.push({name:'On-chain authorities',status:'unknown',detail:'The public RPC did not return a parsed token mint. Mint and freeze permissions could not be verified.',source:'Solana mainnet · unavailable'});
 if(pair){
 const rawLiq=pair.liquidity?.usd; const liq=Number(rawLiq); const hasLiq=rawLiq!==null&&rawLiq!==undefined&&Number.isFinite(liq);
 checks.push({name:'Pool liquidity',status:hasLiq?(liq<100000?'caution':'pass'):'unknown',detail:hasLiq?`The largest indexed pool has $${Math.round(liq).toLocaleString('en-US')} in reported liquidity. ${liq<100000?'Thin liquidity can amplify price impact.':'Liquidity can change or be withdrawn; it is not proof of a locked pool.'}`:'The market source did not provide liquidity for this pool.',source:'DEX Screener · largest indexed pool'});
 const created=Number(pair.pairCreatedAt);const age=created>0?(Date.now()-created)/86400000:null;
 checks.push({name:'Pool history',status:age===null?'unknown':age<7?'caution':'pass',detail:age===null?'Pool creation date is unavailable.':`This pool was created ${Math.max(0,Math.floor(age))} days ago. ${age<7?'New pools have limited trading history.':'Pool age does not establish project legitimacy.'}`,source:'DEX Screener · pair creation'});
 const activity=pair.txns?.h24; const hasActivity=activity&&Number.isFinite(activity.buys)&&Number.isFinite(activity.sells); checks.push({name:'Trading activity',status:hasActivity?'info':'unknown',detail:hasActivity?`${activity.buys.toLocaleString('en-US')} buys and ${activity.sells.toLocaleString('en-US')} sells in the last 24 hours. This may include bots and wash trading.`:'Trading activity was not provided by the market source.',source:'DEX Screener · pool activity'});
 } else checks.push({name:'Indexed market data',status:marketAvailable?'caution':'unknown',detail:marketAvailable?'No matching base-token pools were returned by DEX Screener. Liquidity and trading activity are unverified.':'The market data service could not be reached. Liquidity and activity are unknown.',source:'DEX Screener · '+(marketAvailable?'no matching pools':'unavailable')});
 checks.push({name:'Team & product claims',status:'unknown',detail:'Identity, product functionality, social claims, holder identities and liquidity locks are outside this automated check. Verify them independently.',source:'Manual review needed'});
 const flags=checks.filter(c=>c.status==='caution').length;
 const missing=checks.filter(c=>c.status==='unknown').length;
 return {checks,flags,missing,title:flags?`${flags} signal${flags===1?'':'s'} worth a closer look`:missing>1?'More evidence needed':'Core checks returned no flags',summary:flags?'Review the highlighted permissions and market signals before making a decision. These checks identify observable conditions, not whether a project is legitimate.':'Available permissions and pool data have been checked. Unverified claims and missing evidence still require your attention. This is not a safety rating.',address};
}
export async function fetchJSON(url,options={}) {const res=await fetch(url,{...options,signal:options.signal||AbortSignal.timeout(15000)});if(!res.ok)throw new Error(res.status===429?'The data source is rate limiting requests. Please try again shortly.':`The data source returned HTTP ${res.status}.`);return res.json();}
export async function rpc(method,params) {
 const data=await fetchJSON('/api/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params}),signal:AbortSignal.timeout(15000)});
 if(data.error)throw new Error(data.error.message||'Mainnet evidence is unavailable.');return data.result;
}
export function money(value,compact=false) {if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';const n=Number(value);if(compact&&n>=1000)return '$'+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);if(n===0)return '$0.00';if(n<.01)return '$'+n.toLocaleString('en-US',{maximumSignificantDigits:4});return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:n<1?4:2});}
export function pct(value) {const n=Number(value);return Number.isFinite(n)&&value!=null?(n>=0?'+':'')+n.toFixed(2)+'%':'—';}
export function short(value,n=4){return value?value.slice(0,n)+'…'+value.slice(-n):'';}
