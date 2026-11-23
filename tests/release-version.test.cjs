'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const SCRIPT=path.join(__dirname,'..','scripts','release-version.mjs');
const load=()=>import(pathToFileURL(SCRIPT).href);

// Throwaway copies of the three files a release rewrites, in a temp folder with a space in its name: no real file is touched.
const PKG={name:'evie-crm-v2',version:'2.4.0',main:'electron/main/main.cjs',dependencies:{hono:'^4.13.7'}};
const LOCK={name:'evie-crm-v2',version:'2.4.0',lockfileVersion:3,requires:true,packages:{'':{name:'evie-crm-v2',version:'2.4.0',dependencies:{hono:'^4.13.7'}},'node_modules/hono':{version:'4.13.7',license:'MIT'}}};
const CONFIG="'use strict';\nwindow.DALI_CONFIG = Object.freeze({\n  name:'EVIE CRM V2', assistant:'EVIE', version:'2.4.0', locale:'es-MX', api_version:'v1',\n  limits:{jsonBytes:1048576}\n});\n";
const FILES=['package.json','package-lock.json','public/config.js'];
const read=(dir,name)=>fs.readFileSync(path.join(dir,name),'utf8');
const snapshot=dir=>FILES.map(name=>read(dir,name));
function project(t,{pkg=PKG,lock=LOCK,config=CONFIG}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'evie release '));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.mkdirSync(path.join(dir,'public'));
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 fs.writeFileSync(path.join(dir,'package-lock.json'),JSON.stringify(lock,null,2)+'\n');
 fs.writeFileSync(path.join(dir,'public/config.js'),config);
 return dir;
}

test('nextVersion keeps package.json while it is newer than every release, else bumps the newest one',async()=>{
 const {nextVersion}=await load();
 assert.equal(nextVersion('2.4.0',[]),'2.4.0','no releases yet');
 assert.equal(nextVersion('2.5.0',['v2.4.0','v2.4.3']),'2.5.0','a newer package.json wins');
 assert.equal(nextVersion('2.4.0',['v2.4.0']),'2.4.1','equal to the latest tag → patch+1');
 assert.equal(nextVersion('2.3.2',['v2.4.0','v2.4.1']),'2.4.2','older than the latest tag → patch+1 of that tag');
 assert.equal(nextVersion('2.4.0',['v2.3.9','2.4.4']),'2.4.5','the v is optional');
 assert.equal(nextVersion('2.4.0',['junk','v2.5','v2.6.0-beta.1','v3.0.0.1','vv9.0.0','latest','',null,7]),'2.4.0','junk tags are ignored');
 assert.equal(nextVersion('2.4.0',['v2.4.9','v2.4.10','v2.4.2']),'2.4.11','numeric: 2.4.10 > 2.4.9');
 assert.equal(nextVersion('2.4.10',['v2.4.9']),'2.4.10','a string comparison would call 2.4.10 older');
 assert.equal(nextVersion('2.10.0',['v2.9.9']),'2.10.0');
 assert.equal(nextVersion('2.4.0',['v10.0.0','v9.9.9']),'10.0.1');
 for(const bad of ['2.4','v2.4.0','2.4.0-beta','',undefined])assert.throws(()=>nextVersion(bad,[]),/X\.Y\.Z/,`base «${bad}»`);
});

test('applyVersion rewrites package.json, package-lock.json and public/config.js and nothing else',async t=>{
 const {applyVersion}=await load();
 const dir=project(t);
 applyVersion(dir,'2.4.7');
 const pkgText=read(dir,'package.json'),lockText=read(dir,'package-lock.json');
 const pkg=JSON.parse(pkgText),lock=JSON.parse(lockText);
 assert.deepEqual(pkg,{...PKG,version:'2.4.7'});
 assert.equal(lock.version,'2.4.7');assert.equal(lock.packages[''].version,'2.4.7');
 assert.equal(lock.packages['node_modules/hono'].version,'4.13.7','dependency versions stay');
 assert.equal(pkgText,JSON.stringify(pkg,null,2)+'\n','2-space JSON with a trailing newline');
 assert.equal(lockText,JSON.stringify(lock,null,2)+'\n','2-space JSON with a trailing newline');
 assert.equal(read(dir,'public/config.js'),CONFIG.replace("version:'2.4.0'","version:'2.4.7'"),'only the version changes in config.js');
});

test('applyVersion throws and writes nothing when a file lacks its version',async t=>{
 const {applyVersion}=await load();
 for(const [why,files,message] of [
  ['package.json without "version"',{pkg:{...PKG,version:undefined}},/package\.json has no "version"/],
  ['package-lock.json without "version"',{lock:{...LOCK,version:undefined}},/package-lock\.json has no top-level "version"/],
  ['package-lock.json without packages[""].version',{lock:{...LOCK,packages:{'':{name:'evie-crm-v2'}}}},/packages\[""\]\.version/],
  ['config.js without version',{config:CONFIG.replace("version:'2.4.0', ",'')},/public\/config\.js has no version/],
  ['config.js with two versions',{config:CONFIG.replace('locale:',"version:'9.9.9', locale:")},/public\/config\.js has 2/],
 ]){
  const dir=project(t,files),before=snapshot(dir);
  assert.throws(()=>applyVersion(dir,'2.4.7'),message,why);
  assert.deepEqual(snapshot(dir),before,`${why}: nothing was written`);
 }
 const dir=project(t),before=snapshot(dir);
 for(const bad of ['2.4','v2.4.7','2.4.7-beta',''])assert.throws(()=>applyVersion(dir,bad),/X\.Y\.Z/,`version «${bad}»`);
 assert.deepEqual(snapshot(dir),before,'an invalid version changes nothing');
});

test('the CLI prints version=… for $GITHUB_OUTPUT from --tags and writes it with --apply',async t=>{
 const {nextVersion}=await load();
 // A byte-for-byte copy of the script inside a temp project, so package.json there is the base and --apply is safe.
 const dir=project(t),script=path.join(dir,'scripts','release-version.mjs');
 fs.mkdirSync(path.dirname(script));fs.copyFileSync(SCRIPT,script);
 const run=(args,options={})=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',cwd:dir,...options});
 let r=run(['--tags','v2.4.0,v2.4.1,junk']);
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'version=2.4.2\n');
 assert.equal(run(['--tags','v2.3.9, v2.3.10']).stdout,'version=2.4.0\n','package.json wins when it is newer; spaces are fine');
 assert.equal(run(['--tags','']).stdout,'version=2.4.0\n','an empty list means no releases');
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^path$/i.test(key)));
 r=run([],{env:{...env,PATH:dir}});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'version=2.4.0\n','without gh the release list is empty');
 assert.match(r.stderr,/warning: could not list the releases of .+ with gh/);
 r=run(['--apply','2.4.2']);
 assert.equal(r.status,0,r.stderr);
 assert.equal(JSON.parse(read(dir,'package.json')).version,'2.4.2');
 assert.equal(JSON.parse(read(dir,'package-lock.json')).packages[''].version,'2.4.2');
 assert.match(read(dir,'public/config.js'),/version:'2\.4\.2'/);
 const before=snapshot(dir);
 r=run(['--apply','2.4']);
 assert.equal(r.status,1);assert.match(r.stderr,/X\.Y\.Z/);
 assert.deepEqual(snapshot(dir),before,'a bad --apply changes nothing');
 // The real script, from the repo folder (whose path has spaces), reads the real package.json.
 const real=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8')).version;
 r=spawnSync(process.execPath,[SCRIPT,'--tags','v0.0.1,junk'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,`version=${nextVersion(real,['v0.0.1'])}\n`);
});
