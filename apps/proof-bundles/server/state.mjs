import {createHash} from 'node:crypto';
export function createSharedState(config,{fetcher=fetch}={}){
 if(!config.stateUrl||!config.stateToken)return null;
 const base=new URL(config.stateUrl);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Shared-state URL must use HTTPS.');
 const prefix='proofbundles:'+createHash('sha256').update(config.origin).digest('hex').slice(0,24)+':';
 const key=value=>prefix+createHash('sha256').update(value).digest('hex');
 const command=async parts=>{try{const res=await fetcher(base.href,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+config.stateToken,'content-type':'application/json'},body:JSON.stringify(parts),signal:AbortSignal.timeout(5000)});if(!res.ok)throw 0;const data=await res.json();if(data.error||!Object.hasOwn(data,'result'))throw 0;return data.result;}catch{throw Error('Shared access storage is temporarily unavailable.');}};
 const decode=value=>value===null?null:JSON.parse(value);
 return {durable:true,
  get:async name=>decode(await command(['GET',key(name)])),
  take:async name=>decode(await command(['GETDEL',key(name)])),
  put:async(name,value,seconds)=>{if(await command(['SET',key(name),JSON.stringify(value),'EX',seconds])!=='OK')throw Error('Shared access storage is unavailable.');},
  delete:async name=>{await command(['DEL',key(name)]);},
  count:async(name,seconds)=>{const n=await command(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",1,key(name),seconds]);if(!Number.isSafeInteger(n)||n<1)throw Error('Shared rate limit is unavailable.');return n;}
 };
}
