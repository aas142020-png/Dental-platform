import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
const repository=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app=path.join(repository,"apps/web");
const env={...process.env};
if(process.platform==="win32"){
  const helper=path.join(repository,"scripts/windows-build-junctions.cjs");
  env.NODE_OPTIONS=`${env.NODE_OPTIONS??""} --require="${helper}"`.trim();
}
const result=spawnSync(process.execPath,[path.join(app,"node_modules/@opennextjs/cloudflare/dist/cli/index.js"),"build",...process.argv.slice(2)],{cwd:app,env,stdio:"inherit"});
if(result.error)throw result.error;
process.exitCode=result.status??1;
