import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {createApplication} from '../server/application.mjs';
// The root has no dependencies; proxy setup is optional in managed development.
if(process.env.HTTPS_PROXY||process.env.HTTP_PROXY){try{const {EnvHttpProxyAgent,setGlobalDispatcher}=await import('../apps/proof-bundles/node_modules/undici/index.js');setGlobalDispatcher(new EnvHttpProxyAgent());}catch{console.warn('Install the companion app dependencies to enable the development HTTP proxy.');}}
const assets={},types={html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml'};
for(const [directory,prefix]of [['../public/','/'],['../apps/proof-bundles/dist/','/bundles/']]){
 const root=new URL(directory,import.meta.url);for(const name of await readdir(root))assets[prefix+name]={body:await readFile(new URL(name,root),'utf8'),type:types[name.split('.').at(-1)]||'application/json'};
}
assets['/bundles/']=assets['/bundles/index.html'];
const handler=createApplication({assets}),port=Number(process.env.PORT||3000);
http.createServer((req,res)=>{if(req.url==='/bundles'){res.writeHead(302,{location:'/bundles/'});res.end();return;}return handler(req,res);}).listen(port,'127.0.0.1',()=>console.log('Proof Protocol: http://127.0.0.1:'+port+' · Bundles: /bundles/'));
