import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
import {configFromEnv} from '../server/config.mjs';
import {createApi} from '../server/api.mjs';
if(process.env.HTTPS_PROXY||process.env.HTTP_PROXY)setGlobalDispatcher(new EnvHttpProxyAgent());
const config=configFromEnv();const api=createApi(config);
import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.PORT||process.argv[2]||3000);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try {
  if(await api(req,res))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(root,'.'+pathname);
  const relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end('Forbidden');return;}
  if(pathname==='/'||!path.extname(pathname))file=path.join(root,'index.html');
  const info=await stat(file);
  if(!info.isFile())throw new Error('not a file');
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Proof Bundles: http://127.0.0.1:${port}`));
