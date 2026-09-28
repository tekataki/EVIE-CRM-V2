'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createAccountHost}=require('../electron/main/account-host.cjs');
const scopedSettings=require('../electron/main/scoped-settings.cjs');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('desktop account transport is disabled without configuration',async()=>{
 let calls=0;const host=createAccountHost({fetcher:async()=>{calls++;}});
 assert.equal((await host.request({path:'runtime',method:'GET'})).accountsEnabled,false);
 for(const args of [{},{path:'evil'},{path:'https://example.com',method:'GET'},{path:'runtime',method:'GET',headers:{}}])await assert.rejects(host.request(args));
 assert.equal(calls,0);
 assert.throws(()=>createAccountHost({origin:'http://example.com'}));
 assert.throws(()=>createAccountHost({origin:'https://example.com/extra'}));
});

test('desktop data requests use only the server-verified account; 401 locks it',async()=>{
 const changes=[];let calls=0;
 const host=createAccountHost({origin:'https://evie.example',onChange:id=>changes.push(id),fetcher:async(url,opts)=>{
  calls++;assert.equal(opts.redirect,'error');assert.equal(opts.headers.Origin,'https://evie.example');
  if(url.endsWith('session'))return Response.json({user:{id:A,username:'user-a'}});
  return Response.json({error:'Expired'},{status:401});
 }});
 await assert.rejects(host.request({path:'data/pull',method:'POST',userId:A,body:{after:''}}));
 assert.equal(calls,0);
 await host.request({path:'auth/session',method:'GET'});
 await assert.rejects(host.request({path:'data/pull',method:'POST',userId:B,body:{after:''}}));
 await assert.rejects(host.request({path:'data/pull',method:'POST',userId:A,body:{after:''}}));
 assert.equal(host.current(),null);assert.deepEqual(changes,[A,null]);
});

test('configured desktop accounts never fall back to the legacy local profile',async()=>{
 const host=createAccountHost({origin:'https://evie.example',fetcher:async()=>Response.json({accountsEnabled:false})});
 await assert.rejects(host.request({path:'runtime',method:'GET'}),/perfil local alternativo/);
});

test('desktop grants and microphone consent are per-user and per-device',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'evie-scope-'));
 try{
  const base=require('../electron/main/settings.cjs')(dir);base.grant('windows.open_app:legacy',true);
  const original=fs.readFileSync(path.join(dir,'desktop-settings.json'),'utf8');
  const scoped=scopedSettings(dir,{enabled:true});assert.equal(scoped.locked(),true);assert.deepEqual(scoped.get().grants,{});
  scoped.select(A);scoped.grant('windows.open_app:spotify',true);scoped.microphone(true);
  scoped.select(B);assert.deepEqual(scoped.get().grants,{});assert.equal(scoped.get().microphoneConsent,false);
  scoped.select(A);assert.equal(scoped.get().grants['windows.open_app:spotify'],true);
  scoped.select(null);assert.throws(()=>scoped.grant('forbidden',true));
  assert.equal(fs.readFileSync(path.join(dir,'desktop-settings.json'),'utf8'),original);
  assert.equal(scopedSettings(dir,{enabled:true}).deviceId,scoped.deviceId);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a delayed permission prompt cannot grant access to a different account',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'evie-scope-'));
 try{
  const scoped=scopedSettings(dir,{enabled:true});scoped.select(A);let resolve;
  const pending=scoped.run(async()=>{await new Promise(r=>resolve=r);scoped.grant('windows.open_app:spotify',true);});
  scoped.select(B);resolve();await assert.rejects(pending,/cuenta cambió/);assert.deepEqual(scoped.get().grants,{});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('late data responses are cancelled when the desktop account changes',async()=>{
 let resolve;const host=createAccountHost({origin:'https://evie.example',fetcher:async url=>{
  if(url.endsWith('session'))return Response.json({user:{id:A}});
  return new Promise(r=>resolve=r);
 }});
 await host.request({path:'auth/session',method:'GET'});
 const pending=host.request({path:'data/pull',method:'POST',userId:A,body:{after:''}});
 host.clear();resolve(Response.json({owner:A,rows:[],next:''}));
 await assert.rejects(pending,/cuenta cambió/);
});
