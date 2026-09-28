'use strict';
const path=require('node:path');
module.exports={
 packagerConfig:{
  name:'EVIE CRM V2',executableName:'evie-crm-v2',appBundleId:'com.evie.crm.v2',
  icon:path.join(__dirname,'assets/icons/evie'),asar:true,
  extraResource:[path.join(__dirname,'scripts')],
  win32metadata:{CompanyName:'EVIE',FileDescription:'EVIE CRM V2 · Ivy local',ProductName:'EVIE CRM V2',OriginalFilename:'evie-crm-v2.exe'},
  ignore:[/^\/(evidence|tests|docs|tools|src|dist|out|\.git|\.wrangler)(\/|$)/,/^\/\.env/,/^\/\.dev\.vars/,/^\/node_modules\/(hono)(\/|$)/]
 },
 makers:[
  {name:'@electron-forge/maker-squirrel',platforms:['win32'],config:{name:'evie_crm_v2',authors:'EVIE',description:'EVIE CRM V2 con Ivy local',setupExe:'EVIE-CRM-V2-Setup.exe',setupIcon:path.join(__dirname,'assets/icons/evie.ico'),noMsi:true}},
  {name:'@electron-forge/maker-zip',platforms:['win32'],config:{}}
 ]
};
