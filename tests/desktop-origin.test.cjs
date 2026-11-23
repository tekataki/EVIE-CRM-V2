'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {resolveAccountOrigin,DEFAULT_ACCOUNT_ORIGIN}=require('../electron/main/origin.cjs');
const {createAccountHost}=require('../electron/main/account-host.cjs');

test('the installed desktop app connects to the EVIE cloud by default (no Windows variables needed)',()=>{
 assert.equal(DEFAULT_ACCOUNT_ORIGIN,'https://evie-crm-v2.pages.dev');
 assert.equal(resolveAccountOrigin({},true),DEFAULT_ACCOUNT_ORIGIN,'packaged app → cloud');
 assert.equal(resolveAccountOrigin({},false),'','running from source stays local unless asked');
 assert.doesNotThrow(()=>createAccountHost({origin:resolveAccountOrigin({},true),fetcher:async()=>new Response('{}')}),'the default origin passes the account host validation');
});

test('EVIE_ACCOUNT_API_ORIGIN overrides the cloud origin or turns it off',()=>{
 for(const off of ['off','OFF','local','0','false',' ',''])assert.equal(resolveAccountOrigin({EVIE_ACCOUNT_API_ORIGIN:off},true),'',`«${off}» → local mode`);
 assert.equal(resolveAccountOrigin({EVIE_ACCOUNT_API_ORIGIN:'https://staging.example.test/'},true),'https://staging.example.test');
 assert.equal(resolveAccountOrigin({EVIE_ACCOUNT_API_ORIGIN:'https://staging.example.test'},false),'https://staging.example.test','an explicit origin also works from source');
});
