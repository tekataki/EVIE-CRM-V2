# v4 global voice: single mic owner (EvieMic) for Ivi; floating mic on pages without another mic. Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:80]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('public/evie-assistant.js',[
 ("async function record(t){set('arming');let stream;",
  "async function record(t){if(window.EvieMic&&!EvieMic.acquire('assistant',()=>rec?.stop(true)))return fail('mic','El micrófono está ocupado por otra función.',t.id);set('arming');let stream;","EvieMic.acquire('assistant',()=>rec?.stop(true))"),
 ("mr.onstop=async()=>{done=true;if(raf)cancelAnimationFrame(raf);stream.getTracks().forEach(x=>x.stop());",
  "mr.onstop=async()=>{done=true;if(raf)cancelAnimationFrame(raf);stream.getTracks().forEach(x=>x.stop());window.EvieMic?.release('assistant');","x.stop());window.EvieMic?.release('assistant');"),
 ("catch(e){return fail('mic',","catch(e){window.EvieMic?.release('assistant');return fail('mic',","catch(e){window.EvieMic?.release('assistant');return fail('mic',"),
 ("r.onend=()=>{rec=null;if(!alive(t.id))return;","r.onend=()=>{rec=null;window.EvieMic?.release('assistant');if(!alive(t.id))return;","r.onend=()=>{rec=null;window.EvieMic?.release('assistant');"),
 ("try{r.start();set('listening');}catch{rec=null;set('idle');}","if(window.EvieMic&&!EvieMic.acquire('assistant',()=>rec?.stop(true))){set('idle');return;}try{r.start();set('listening');}catch{rec=null;window.EvieMic?.release('assistant');set('idle');}","EvieMic.acquire('assistant',()=>rec?.stop(true))){set('idle');return;}"),
])
edit('public/app.js',[("window.EvieHUD?.afterRender();","window.EvieHUD?.afterRender();window.EvieMic?.afterRender();","window.EvieMic?.afterRender();")])
edit('public/index.html',[
 ("<script defer src=\"evie-wake.js\"></script>","<script defer src=\"evie-wake.js\"></script><script defer src=\"evie-mic.js\"></script>","evie-mic.js"),
 ("<link rel=\"stylesheet\" href=\"evie-timers.css\">","<link rel=\"stylesheet\" href=\"evie-timers.css\"><link rel=\"stylesheet\" href=\"evie-mic.css\">","evie-mic.css"),
])
