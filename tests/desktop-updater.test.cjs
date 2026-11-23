'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createUpdater,FEED_URL}=require('../electron/main/updater.cjs');

// Fake Electron autoUpdater: a real EventEmitter plus call spies. Like Electron on Windows, checkForUpdates() emits
// checking-for-update synchronously. Timers are captured and fired by hand, never real.
function fixture({options={},checkThrows=false}={}){
 const autoUpdater=Object.assign(new EventEmitter(),{feeds:[],checks:0,installs:0});
 autoUpdater.setFeedURL=opts=>{autoUpdater.feeds.push(opts);};
 autoUpdater.checkForUpdates=()=>{autoUpdater.checks++;if(checkThrows)throw Error('Squirrel no responde');autoUpdater.emit('checking-for-update');};
 autoUpdater.quitAndInstall=()=>{autoUpdater.installs++;};
 const sent=[],logs=[],timers=[],repeats=[];
 const updater=createUpdater({autoUpdater,app:{isPackaged:true},send:action=>sent.push(action),log:message=>logs.push(message),platform:'win32',argv:['C:\\EVIE\\evie-crm-v2.exe'],qaProfile:'',
  setTimer:(fn,ms)=>timers.push({fn,ms}),setRepeat:(fn,ms)=>repeats.push({fn,ms}),...options});
 return {updater,autoUpdater,sent,logs,timers,repeats};
}

test('updates stay off from source, off Windows, with a QA profile and on the Squirrel first run',()=>{
 for(const [why,options] of [['unpackaged',{app:{isPackaged:false}}],['macOS',{platform:'darwin'}],['Linux',{platform:'linux'}],['QA profile',{qaProfile:'C:\\EVIE-QA\\profile'}],['first run',{argv:['C:\\EVIE\\evie-crm-v2.exe','--squirrel-firstrun']}]]){
  const f=fixture({options});
  assert.equal(f.updater.start(),false,why);
  assert.equal(f.updater.check(),false,`${why}: check() is a no-op`);
  assert.equal(f.updater.installNow(),false,`${why}: nothing to install`);
  assert.deepEqual(f.autoUpdater.feeds,[],`${why}: no feed`);
  assert.equal(f.autoUpdater.checks,0,`${why}: never checks`);
  assert.equal(f.timers.length+f.repeats.length,0,`${why}: nothing scheduled`);
  assert.deepEqual(f.autoUpdater.eventNames(),[],`${why}: no listeners`);
  assert.deepEqual(f.updater.status(),{enabled:false,checking:false,lastCheck:null,lastError:null,ready:null},why);
 }
});

test('the installed Windows app sets the GitHub feed once and schedules the first check and the repeat',()=>{
 assert.equal(FEED_URL,'https://github.com/tekataki/EVIE-CRM-V2/releases/latest/download');
 const f=fixture();
 assert.equal(f.updater.start(),true);
 assert.equal(f.updater.start(),true,'a second start keeps the running updater');
 assert.deepEqual(f.autoUpdater.feeds,[{url:FEED_URL}],'feed set once');
 assert.equal(f.autoUpdater.listenerCount('error'),1,'events wired once');
 assert.deepEqual(f.timers.map(t=>t.ms),[30000],'first check after 30 s');
 assert.deepEqual(f.repeats.map(t=>t.ms),[4*3600000],'then every 4 h');
 assert.equal(f.autoUpdater.checks,0,'nothing checks before the first delay');
 assert.equal(f.updater.status().enabled,true);
 f.timers[0].fn();
 assert.equal(f.autoUpdater.checks,1,'the first timer checks');
 assert.equal(f.updater.status().checking,true);
 assert.ok(!Number.isNaN(Date.parse(f.updater.status().lastCheck)),'lastCheck is a timestamp');
 f.repeats[0].fn();
 assert.equal(f.autoUpdater.checks,1,'the repeat is skipped while a check is in flight');
 f.autoUpdater.emit('update-not-available');
 assert.equal(f.updater.status().checking,false,'no update → idle');
 f.repeats[0].fn();
 assert.equal(f.autoUpdater.checks,2,'and the next repeat checks again');
 const custom=fixture({options:{feedURL:'https://updates.example.test/evie',firstDelayMs:5,intervalMs:60000}});
 assert.equal(custom.updater.start(),true);
 assert.deepEqual(custom.autoUpdater.feeds,[{url:'https://updates.example.test/evie'}]);
 assert.deepEqual([custom.timers[0].ms,custom.repeats[0].ms],[5,60000]);
});

test('a downloaded update tells the renderer and becomes ready',()=>{
 const f=fixture();f.updater.start();
 assert.equal(f.updater.check(),true);
 assert.equal(f.updater.check(),false,'no second check while one is in flight');
 assert.equal(f.autoUpdater.checks,1);
 f.autoUpdater.emit('update-available');
 assert.deepEqual(f.sent,[{type:'update-downloading'}]);
 assert.equal(f.updater.status().checking,true,'still in flight while downloading');
 assert.equal(f.updater.status().ready,null);
 f.autoUpdater.emit('update-downloaded',{},'Notas','2.4.1',new Date(),FEED_URL);
 assert.deepEqual(f.sent,[{type:'update-downloading'},{type:'update-ready',version:'2.4.1'}]);
 const s=f.updater.status();
 assert.equal(s.ready,'2.4.1');assert.ok(s.ready,'ready is truthy');
 assert.equal(s.checking,false);assert.equal(s.lastError,null);
 f.autoUpdater.emit('update-not-available');
 assert.equal(f.updater.status().ready,'2.4.1','a later empty check keeps the downloaded update');
 const nameless=fixture();nameless.updater.start();
 nameless.autoUpdater.emit('update-downloaded',{});
 assert.deepEqual(nameless.sent,[{type:'update-ready',version:'nueva'}],'no release name → «nueva»');
 assert.equal(nameless.updater.status().ready,'nueva');
});

test('errors are kept in status and the log, never thrown or shown',()=>{
 const f=fixture();f.updater.start();f.updater.check();
 assert.doesNotThrow(()=>f.autoUpdater.emit('error',new Error('net::ERR_INTERNET_DISCONNECTED')));
 const s=f.updater.status();
 assert.equal(s.lastError,'net::ERR_INTERNET_DISCONNECTED');
 assert.equal(s.checking,false,'a failed check frees the next one');
 assert.equal(s.ready,null);
 assert.equal(f.logs.length,1);assert.match(f.logs[0],/ERR_INTERNET_DISCONNECTED/);
 assert.deepEqual(f.sent,[],'the renderer gets nothing: no dialogs, no notices');
 assert.doesNotThrow(()=>f.autoUpdater.emit('error'),'even without an Error object');
 assert.equal(f.updater.status().lastError,'Error desconocido');
 assert.equal(f.updater.check(),true,'the next check runs');
 f.autoUpdater.emit('update-not-available');
 assert.equal(f.updater.status().lastError,null,'a good check clears the old error');
 const broken=fixture({options:{send:()=>{throw Error('ventana cerrada');},log:()=>{throw Error('log lleno');}}});broken.updater.start();
 assert.doesNotThrow(()=>{broken.autoUpdater.emit('update-available');broken.autoUpdater.emit('update-downloaded',{},'','2.4.1');broken.autoUpdater.emit('error',new Error('x'));},'a failing send/log never escapes an event');
});

test('installNow only restarts into an update that is ready',()=>{
 const f=fixture();f.updater.start();
 assert.equal(f.updater.installNow(),false,'nothing downloaded');
 f.updater.check();f.autoUpdater.emit('update-available');
 assert.equal(f.updater.installNow(),false,'still downloading');
 assert.equal(f.autoUpdater.installs,0);
 f.autoUpdater.emit('update-downloaded',{},'','2.4.1');
 assert.equal(f.updater.installNow(),true);
 assert.equal(f.autoUpdater.installs,1);
});

test('check() never throws, even when checkForUpdates does',()=>{
 const f=fixture({checkThrows:true});f.updater.start();
 let result;
 assert.doesNotThrow(()=>{result=f.updater.check();});
 assert.equal(result,false);
 assert.equal(f.autoUpdater.checks,1);
 assert.equal(f.updater.status().lastError,'Squirrel no responde');
 assert.equal(f.updater.status().checking,false);
 assert.equal(f.logs.length,1);
 assert.doesNotThrow(()=>f.timers[0].fn(),'the scheduled check is just as safe');
 assert.equal(f.autoUpdater.checks,2,'and retries instead of staying stuck');
});
