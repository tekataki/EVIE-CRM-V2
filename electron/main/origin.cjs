'use strict';
/* Cloud origin of the desktop app (the EVIE Worker on Cloudflare Pages: accounts, Google sign-in, sync and AI).
   The INSTALLED app connects to it by default, so nobody has to set environment variables in Windows.
   EVIE_ACCOUNT_API_ORIGIN overrides it (another https origin, e.g. a staging deploy) or turns it off
   (off/local/0/false → local-only mode). Running from source (`electron .`) stays local unless the variable is set. */
const DEFAULT_ACCOUNT_ORIGIN='https://evie-crm-v2.pages.dev';
function resolveAccountOrigin(env=process.env,isPackaged=false){
 const raw=env&&env.EVIE_ACCOUNT_API_ORIGIN;
 if(raw!==undefined&&raw!==null){const v=String(raw).trim();if(!v||/^(off|local|0|false)$/i.test(v))return '';return v.replace(/\/+$/,'');}
 return isPackaged?DEFAULT_ACCOUNT_ORIGIN:'';
}
module.exports={DEFAULT_ACCOUNT_ORIGIN,resolveAccountOrigin};
