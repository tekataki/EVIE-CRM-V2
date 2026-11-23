// Version of each desktop release (.github/workflows/desktop-release.yml). CI never commits the bump back, so package.json
// is only the floor: its version wins while it is newer than every vX.Y.Z release; otherwise the newest release gets
// patch+1 (numeric comparison, 2.4.10 > 2.4.9).
//   node scripts/release-version.mjs [--tags v2.4.0,v2.4.1]  → prints version=X.Y.Z (for $GITHUB_OUTPUT); without --tags
//                                                              the release tags come from `gh api` (none if gh fails)
//   node scripts/release-version.mjs --apply X.Y.Z           → writes it to package.json, package-lock.json, public/config.js
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
const ROOT=path.resolve(import.meta.dirname,'..');
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CONFIG_VERSION=/(\bversion\s*:\s*')[^'\n]*'/g;
const isVersion=v=>typeof v==='string'&&VERSION.test(v);
const parts=v=>v.split('.').map(Number);
const compare=(a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
export function nextVersion(base,tags=[]){
 if(!isVersion(base))throw new Error(`Invalid base version «${base}»: expected X.Y.Z.`);
 const top=(tags||[]).map(t=>typeof t==='string'?t.replace(/^v/,''):'').filter(isVersion).map(parts).sort(compare).pop();
 return !top||compare(parts(base),top)>0?base:`${top[0]}.${top[1]}.${top[2]+1}`;
}
// Checks all three files before writing any of them, so a missing version never leaves a half-applied release.
export function applyVersion(root,version){
 if(!isVersion(version))throw new Error(`Invalid version «${version}»: expected X.Y.Z.`);
 const file=name=>path.join(root,name),read=name=>fs.readFileSync(file(name),'utf8');
 const fail=message=>{throw new Error(`${message}; nothing was changed.`);};
 const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json')),config=read('public/config.js');
 if(typeof pkg.version!=='string')fail('package.json has no "version"');
 if(typeof lock.version!=='string')fail('package-lock.json has no top-level "version"');
 if(typeof lock.packages?.['']?.version!=='string')fail('package-lock.json has no packages[""].version');
 const found=(config.match(CONFIG_VERSION)||[]).length;
 if(found!==1)fail(found?`public/config.js has ${found} version:'…' entries instead of one`:`public/config.js has no version:'…'`);
 pkg.version=version;lock.version=version;lock.packages[''].version=version;
 const json=data=>JSON.stringify(data,null,2)+'\n';
 fs.writeFileSync(file('package.json'),json(pkg));
 fs.writeFileSync(file('package-lock.json'),json(lock));
 fs.writeFileSync(file('public/config.js'),config.replace(CONFIG_VERSION,(_match,prefix)=>prefix+version+"'"));
}
const list=(text,separator)=>text.split(separator).map(item=>item.trim()).filter(Boolean);
function releaseTags(){
 const repo=process.env.GITHUB_REPOSITORY||'tekataki/EVIE-CRM-V2';
 try{return list(execFileSync('gh',['api',`repos/${repo}/releases`,'--paginate','--jq','.[].tag_name'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}),/\r?\n/);}
 catch(error){console.error(`warning: could not list the releases of ${repo} with gh (${String(error.stderr||'').trim().split(/\r?\n/)[0]||error.message}); assuming there are none.`);return [];}
}
function main(args){
 const {values}=parseArgs({args,options:{tags:{type:'string'},apply:{type:'string'}}});
 if(values.apply!==undefined){
  if(!isVersion(values.apply))throw new Error(`--apply needs X.Y.Z, got «${values.apply}».`);
  applyVersion(ROOT,values.apply);console.log(`Applied ${values.apply} to package.json, package-lock.json and public/config.js.`);return;
 }
 const base=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;
 console.log(`version=${nextVersion(base,values.tags!==undefined?list(values.tags,','):releaseTags())}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{main(process.argv.slice(2));}catch(error){console.error(`release-version: ${error.message}`);process.exitCode=1;}
}
