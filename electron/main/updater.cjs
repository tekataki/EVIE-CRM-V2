'use strict';
/* Automatic updates of the installed Windows app (Squirrel.Windows through Electron's autoUpdater).
   The feed is the latest GitHub release of tekataki/EVIE-CRM-V2, published by .github/workflows/desktop-release.yml with
   RELEASES, the full .nupkg and the Setup.exe. Squirrel downloads in the background and the new version opens on the
   next start; installNow() restarts into it right away. Only the packaged win32 app checks: never from source, never
   with a QA profile (EVIE_DESKTOP_PROFILE) and never on --squirrel-firstrun (Squirrel still holds its lock then).
   Silent by design: no dialogs. The renderer gets {type:'update-downloading'} and {type:'update-ready',version};
   errors only reach status().lastError and the log. */
const FEED_URL='https://github.com/tekataki/EVIE-CRM-V2/releases/latest/download';
function createUpdater({autoUpdater,app,send=()=>{},log=()=>{},platform=process.platform,argv=process.argv,qaProfile='',feedURL=FEED_URL,firstDelayMs=30000,intervalMs=4*3600000,setTimer=setTimeout,setRepeat=setInterval}){
 let enabled=false,checking=false,lastCheck=null,lastError=null,ready=null;
 const notify=action=>{try{send(action);}catch{}};
 const fail=error=>{checking=false;lastError=String(error&&error.message||error||'Error desconocido');try{log('EVIE updater: '+lastError);}catch{}};
 const allowed=()=>!!autoUpdater&&!!app?.isPackaged&&platform==='win32'&&!qaProfile&&!(argv||[]).includes('--squirrel-firstrun');
 // Returns whether checkForUpdates() was called: false while disabled or while a check/download is still in flight.
 function check(){
  if(!enabled||checking)return false;
  checking=true;lastCheck=new Date().toISOString();
  try{autoUpdater.checkForUpdates();return true;}catch(error){fail(error);return false;}
 }
 function start(){
  if(enabled)return true;if(!allowed())return false;
  try{autoUpdater.setFeedURL({url:feedURL});}catch(error){fail(error);return false;}
  autoUpdater.on('checking-for-update',()=>{checking=true;});
  autoUpdater.on('update-available',()=>notify({type:'update-downloading'}));
  autoUpdater.on('update-not-available',()=>{checking=false;lastError=null;});
  autoUpdater.on('update-downloaded',(_event,_releaseNotes,releaseName)=>{checking=false;lastError=null;ready=releaseName?String(releaseName):'nueva';notify({type:'update-ready',version:ready});});
  autoUpdater.on('error',fail);
  enabled=true;setTimer(()=>check(),firstDelayMs);if(intervalMs>0)setRepeat(()=>check(),intervalMs);
  return true;
 }
 function status(){return {enabled,checking,lastCheck,lastError,ready};}
 function installNow(){if(!ready)return false;try{autoUpdater.quitAndInstall();return true;}catch(error){fail(error);return false;}}
 return {start,check,status,installNow};
}
module.exports={FEED_URL,createUpdater};
