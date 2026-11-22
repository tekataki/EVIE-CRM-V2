'use strict';
// v10 · Supabase migration 202611230001_ai_chat on a real PostgreSQL (PGlite): RLS by owner, atomic append with
// consecutive seq, truncate for regenerate, cross-owner protection, expired-guest block and the chat stamp.
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
let db;
before(async()=>{const {PGlite}=await import('@electric-sql/pglite');db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;grant usage on schema public to anon,authenticated;
  create table public.blocked(uid uuid primary key);grant select on public.blocked to authenticated;
  create function public.evie_guest_blocked() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.blocked where uid=auth.uid())$$;
  grant execute on function public.evie_guest_blocked() to authenticated;
  insert into auth.users values('${A}'),('${B}');`);
 await db.exec(fs.readFileSync(path.join(root,'migrations/supabase/202611230001_ai_chat.sql'),'utf8'));});
after(async()=>{await db?.close();});
async function as(id,fn){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
const q=(sql,p=[])=>db.query(sql,p).then(r=>r.rows);

test('owner creates a conversation and appends messages with consecutive seq; the other user sees nothing',async()=>{
 const [c]=await as(A,()=>q("insert into public.ai_conversations(title_sealed) values('t') returning id,owner_id"));assert.equal(c.owner_id,A);
 const r=await as(A,()=>q('select * from public.ai_append_messages($1,$2::jsonb)',[c.id,JSON.stringify([{role:'user',content_sealed:'u1'},{role:'assistant',content_sealed:'a1',meta:{model:'claude-opus-5-5'}}])]));
 assert.deepEqual(r.map(x=>[x.seq,x.role]),[[1,'user'],[2,'assistant']]);
 const r2=await as(A,()=>q('select * from public.ai_append_messages($1,$2::jsonb)',[c.id,JSON.stringify([{role:'user',content_sealed:'u2'}])]));assert.equal(r2[0].seq,3);
 const [conv]=await as(A,()=>q('select message_count from public.ai_conversations where id=$1',[c.id]));assert.equal(conv.message_count,3);
 assert.equal((await as(B,()=>q('select * from public.ai_conversations'))).length,0);assert.equal((await as(B,()=>q('select * from public.ai_messages'))).length,0);
 await assert.rejects(as(B,()=>q('select * from public.ai_append_messages($1,$2::jsonb)',[c.id,JSON.stringify([{role:'user',content_sealed:'x'}])])),/conversation not found/);
 await assert.rejects(as(B,()=>q("insert into public.ai_messages(conversation_id,seq,role,content_sealed) values($1,9,'user','x')",[c.id])),/conversation not found|row-level security/);
 await assert.rejects(as(B,()=>q("insert into public.ai_conversations(owner_id) values($1)",[A])),/row-level security/);
 const n=await as(B,()=>q("update public.ai_conversations set pinned=true where id=$1 returning id",[c.id]));assert.equal(n.length,0,'cannot touch another owner\'s row');
 const removed=await as(A,()=>q('select public.ai_truncate_messages($1,2) as n',[c.id]));assert.equal(removed[0].n,2);
 const [after]=await as(A,()=>q('select message_count from public.ai_conversations where id=$1',[c.id]));assert.equal(after.message_count,1);
 await assert.rejects(as(A,()=>q('select * from public.ai_append_messages($1,$2::jsonb)',[c.id,JSON.stringify([{role:'system',content_sealed:'x'}])])),/check/);});

test('memories, events and state are private per owner; stamp changes on writes; expired guests are blocked',async()=>{
 const s0=(await as(A,()=>q('select public.evie_chat_stamp() as s')))[0].s;
 const [m]=await as(A,()=>q("insert into public.ai_memories(kind,content_sealed,importance) values('goal','sealed',5) returning id"));
 await as(A,()=>q("insert into public.ai_memory_events(memory_id,op) values($1,'add')",[m.id]));await as(A,()=>q("insert into public.ai_state(profile_sealed) values('p')"));
 const s1=(await as(A,()=>q('select public.evie_chat_stamp() as s')))[0].s;assert.notEqual(s0,s1);
 assert.equal((await as(B,()=>q('select * from public.ai_memories'))).length,0);assert.equal((await as(B,()=>q('select * from public.ai_memory_events'))).length,0);assert.equal((await as(B,()=>q('select * from public.ai_state'))).length,0);
 await assert.rejects(as(A,()=>q("insert into public.ai_memories(kind,content_sealed) values('secret','x')")),/check/);
 await assert.rejects(as(A,()=>q("insert into public.ai_memories(kind,content_sealed,importance) values('fact','x',9)")),/check/);
 await db.exec(`insert into public.blocked values('${A}')`);
 assert.equal((await as(A,()=>q('select * from public.ai_memories'))).length,0,'expired guest reads nothing');
 await assert.rejects(as(A,()=>q("insert into public.ai_conversations(title_sealed) values('x')")),/row-level security/);
 await db.exec(`delete from public.blocked`);
 await assert.rejects(as(B,()=>q('select * from public.evie_chat_stamp()')).then(async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');try{await q('select public.evie_chat_stamp()');}finally{await db.exec('reset role');}}),/permission denied/,'anon cannot call it');});
