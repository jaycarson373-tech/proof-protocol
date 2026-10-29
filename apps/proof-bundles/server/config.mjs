import {validAddress} from '../dist/core.js';
export function configFromEnv(env=process.env){
 const origin=env.APP_ORIGIN||'http://127.0.0.1:3000';const url=new URL(origin);
 if(url.origin!==origin||!['https:','http:'].includes(url.protocol))throw new Error('APP_ORIGIN must be an HTTP(S) origin with no trailing slash.');
 if(env.NODE_ENV==='production'&&url.protocol!=='https:')throw new Error('Production APP_ORIGIN must use HTTPS.');
 const holderMint=env.HOLDER_TOKEN_MINT||'';const holderMinimum=env.HOLDER_MIN_TOKENS||'';
 if(holderMint&&!validAddress(holderMint))throw new Error('HOLDER_TOKEN_MINT is not a valid Solana mint.');
 if(holderMinimum&&(!/^\d+(?:\.\d+)?$/.test(holderMinimum)||BigInt(holderMinimum.replace('.',''))===0n))throw new Error('HOLDER_MIN_TOKENS must be a decimal token amount.');
 const accessMode=env.BUNDLE_ACCESS_MODE||'free-basic';if(accessMode&&!['free-basic','holders-only'].includes(accessMode))throw new Error('Invalid BUNDLE_ACCESS_MODE.');
 return {origin,accessMode,port:Number(env.PORT||3000),holderMint,holderMinimum,holderConfigured:!!holderMint&&!!holderMinimum,rpcUrl:env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',indexerKey:env.GATEKEPT_API_KEY||'',secureCookie:url.protocol==='https:',production:env.NODE_ENV==='production'};
}
