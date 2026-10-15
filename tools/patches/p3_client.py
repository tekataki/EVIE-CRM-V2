# P3 client wiring: memory (and map) intents before anything else, tool dispatch, private flag,
# current-session tracking, account reset, script/css tags. Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read()
    for a,b,m in pairs:
        if m in s: continue
        assert a in s,(p,a[:90]); s=s.replace(a,b,1)
    open(R+p,'w').write(s)
edit('public/evie-assistant.js',[
 ("for(const c of r.calls){let args={};try{args=JSON.parse(c.arguments||'{}');}catch{}let out;try{out=tools[c.name]?await tools[c.name](args):{error:'unknown tool'};}",
  "for(const c of r.calls){let args={};try{args=JSON.parse(c.arguments||'{}');}catch{}let out;try{const fn=tools[c.name]||window.EvieMemory?.tools?.[c.name]||window.EvieMap?.tools?.[c.name];out=fn?await fn(args):{error:'unknown tool'};}","window.EvieMemory?.tools?.[c.name]"),
 ("const r=await EvieAccounts.request('ai/chat',{method:'POST',body:{input,context},signal});",
  "const r=await EvieAccounts.request('ai/chat',{method:'POST',body:{input,context,private:!!window.EvieMemory?.isPrivate?.()},signal});if(r.memory_used)lastMemoryUsed=r.memory_used;","private:!!window.EvieMemory?.isPrivate?.()"),
 ("let lastResearch=null,","let lastMemoryUsed=null,lastResearch=null,","let lastMemoryUsed=null,"),
 ("return {text:say,spoken:(r.spoken||say).trim(),sources:Array.isArray(r.sources)?r.sources:[],","return {memory:lastMemoryUsed,text:say,spoken:(r.spoken||say).trim(),sources:Array.isArray(r.sources)?r.sources:[],","return {memory:lastMemoryUsed,text:say"),
 (" function tryLocal(text){const q=IvyTools.norm(text)",
  " function tryLocal(text){const speakLater=t=>{if(t){append('evie',t);if(!pref().muted)Voice.speak(t,Voice.begin());}};if(window.EvieMemory){const mm=EvieMemory.intent(text,{say:speakLater});if(mm!==null)return mm;}if(window.EvieMap){const mp=EvieMap.intent(text,{say:speakLater});if(mp!==null)return mp;}const q=IvyTools.norm(text)","EvieMemory.intent(text"),
 ("text=String(text||'').trim();if(!text)return;if(!turnToken)Voice.unlock();","text=String(text||'').trim();if(!text)return;window.EvieMemory?.track?.(text);if(!turnToken)Voice.unlock();","window.EvieMemory?.track?.(text)"),
 (".replace(/^(oye |hey |hola )?evie[, ]*/,'')",".replace(/^(oye |hey |hola )?(?:evie|evi|ivi|ivy|ibi)[, ]+/,'')","(?:evie|evi|ivi|ivy|ibi)[, ]+/"),
])
s=open(R+'public/account-ui.js').read()
if 'EvieMemory?.reset' not in s:
    a='window.EvieAssistant?.reset?.();'; assert a in s
    s=s.replace(a,a+'window.EvieMemory?.reset?.();window.EvieMap?.reset?.();',1); open(R+'public/account-ui.js','w').write(s)
s=open(R+'public/index.html').read()
if 'evie-memory.js' not in s:
    a='<script defer src="evie-assistant.js"></script>'; assert a in s
    s=s.replace(a,'<script defer src="evie-memory.js"></script><script defer src="evie-memory-view.js"></script>'+a,1)
if 'evie-memory.css' not in s:
    a='<link rel="stylesheet" href="form-safety.css">'; assert a in s
    s=s.replace(a,a+'<link rel="stylesheet" href="evie-memory.css">',1)
open(R+'public/index.html','w').write(s)
print('p3 client ok')
