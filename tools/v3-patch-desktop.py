# Idempotent v3 Electron patch (desktop IPC, Google deep link, account routes, preload, forge protocol).
import sys
def edit(p, pairs):
    s = open(p, encoding='utf-8').read(); changed = False
    for a, b, *mark in pairs:
        m = mark[0] if mark else b
        if m in s: continue
        if a not in s: sys.exit(f'ANCHOR NOT FOUND in {p}: {a[:80]}')
        s = s.replace(a, b, 1); changed = True
    if changed: open(p, 'w', encoding='utf-8').write(s)
    print(('patched ' if changed else 'ok      ') + p)

edit('electron/main/main.cjs', [
 ("{randomUUID}=require('node:crypto');", "{randomUUID,randomBytes,createHash}=require('node:crypto');\nconst {createDesktopActions,validateDesktop}=require('../tools/desktop-actions.cjs');", "createDesktopActions,validateDesktop"),
 ("let win,tray,", "let desktopActions,googleNonce=null,accountRef=null,win,tray,"),
 ("  account:args=>account.request(args),", """  account:args=>account.request(args),
  desktop:async args=>{validateDesktop(args);return desktopActions.run(args);},
  'google.signin':async()=>{if(!process.env.EVIE_ACCOUNT_API_ORIGIN)throw Error('Configura EVIE_ACCOUNT_API_ORIGIN para entrar con Google.');googleNonce=randomBytes(32).toString('base64url');const hash=createHash('sha256').update(googleNonce).digest('base64url');const r=await account.request({path:'auth/google/start',method:'POST',body:{mode:'signin',desktop_nonce_hash:hash}});if(!/^https:\\/\\//.test(r?.url||''))throw Error('El servidor no devolvió la URL de Google.');await shell.openExternal(r.url);return {opened:true};},""", "desktop:async args=>"),
 ("app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});", "app.on('second-instance',(_e,argv)=>{const link=(argv||[]).find(a=>typeof a==='string'&&a.startsWith('evie-crm://'));if(link)handleDeepLink(link);if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});"),
 ("async function install(){", """// evie-crm://auth?code=... finishes Google sign-in started by THIS app instance (nonce kept in memory only).
async function handleDeepLink(raw){let u;try{u=new URL(raw);}catch{return;}if(u.protocol!=='evie-crm:'||u.hostname!=='auth')return;const code=u.searchParams.get('code')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(code)||!googleNonce||!accountRef){send({type:'notice',text:'Enlace de acceso no válido o expirado. Vuelve a tocar «Entrar con Google».'});return;}const nonce=googleNonce;googleNonce=null;try{const r=await accountRef.request({path:'auth/google/redeem',method:'POST',body:{code,nonce}});send({type:'google-auth',ok:true,user:r.user});}catch(e){send({type:'google-auth',ok:false,error:e.message});}}
async function install(){""", "async function handleDeepLink"),
 ("const account=require('./account-host.cjs').createAccountHost(", "const account=accountRef=require('./account-host.cjs').createAccountHost("),
 (" const windows=windowsTools(", """ desktopActions=createDesktopActions({shell,media:async key=>{const ps=path.join(process.env.SystemRoot||'C:\\\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');return JSON.parse(await processes.run(ps,['-NoProfile','-NonInteractive','-File',helper('windows-tools.ps1'),'-Action','media','-Value',key]));}});
 if(!app.isDefaultProtocolClient('evie-crm'))app.setAsDefaultProtocolClient('evie-crm',process.defaultApp?process.execPath:undefined,process.defaultApp?[path.resolve(process.argv[1]||'.')]:undefined);
 const windows=windowsTools(""", "desktopActions=createDesktopActions("),
 ("const empty=new Set(['settings.get',", "const empty=new Set(['google.signin','settings.get',"),
])
edit('electron/main/account-host.cjs', [
 ("['data/pull','POST'],['data/push','POST']]);", "['data/pull','POST'],['data/push','POST'],['auth/google/start','POST'],['auth/google/redeem','POST'],['info/research','POST'],['info/weather','POST'],['info/learn','POST']]);"),
 ("const authAction=['auth/signin','auth/signup','auth/signout','auth/session'].includes(args.path)", "const authAction=['auth/signin','auth/signup','auth/signout','auth/session','auth/google/redeem'].includes(args.path)"),
 ("if(['auth/signin','auth/signup','auth/signout'].includes(args.path))clear();", "if(['auth/signin','auth/signup','auth/signout','auth/google/redeem'].includes(args.path))clear();"),
 ("if(['auth/session','auth/signin','auth/signup'].includes(args.path)){", "if(['auth/session','auth/signin','auth/signup','auth/google/redeem'].includes(args.path)){"),
 ("if(args.path.startsWith('data/')&&(!current||args.userId!==current))", "if((args.path.startsWith('data/')||args.path.startsWith('info/'))&&(!current||args.userId!==current))"),
])
edit('electron/preload/preload.cjs', [
 ("tool:(name,args)=>call('tool',{name,args}),", "tool:(name,args)=>call('tool',{name,args}),desktop:args=>call('desktop',args),googleSignIn:()=>call('google.signin'),onGoogle:handler=>{const fn=(_e,a)=>{if(a?.type==='google-auth')handler(a);};ipcRenderer.on('evie:action',fn);return ()=>ipcRenderer.removeListener('evie:action',fn);},"),
])
edit('forge.config.cjs', [("asar:true,", "asar:true,protocols:[{name:'EVIE CRM',schemes:['evie-crm']}],")])
