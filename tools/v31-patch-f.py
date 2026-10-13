# v3.1 Kisha open composition + sound cues (open, ducking, anti-stacking) + robust TTS start. Idempotent.
def edit(p,pairs):
    s=open(p).read()
    for a,b,m in pairs:
        if m in s: continue
        assert a in s,(p,a[:60]); s=s.replace(a,b,1)
    open(p,'w').write(s)
edit('public/kisha-view.js',[
 ('<div class="kisha-char" id="kisha-char"></div>\n','<div class="kisha-char" id="kisha-char"></div>\n   <p class="kisha-subs" id="kisha-subs" aria-hidden="true">${e([...(session?.messages||[])].reverse().find(m=>m.role===\'kisha\')?.text||\'\')}</p>\n','id="kisha-subs"'),
 ("function add(role,text){session.messages.push({role,text,at:new Date().toISOString()});","function add(role,text){session.messages.push({role,text,at:new Date().toISOString()});if(role==='kisha'){const sb=document.getElementById('kisha-subs');if(sb)sb.textContent=text;}","sb.textContent=text"),
])
c='public/kisha.css';t=open(c).read();M='/* v3.1 Kisha open composition */'
if M not in t:
    t+='\n'+M+'\n.kisha-stage.panel{background:transparent!important;border:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;overflow:visible}\n.kisha-stage::before{inset:-10% 0 auto;height:60%;opacity:.8}\n.kisha-subs{margin:-4px 0 0;max-width:min(92%,560px);min-height:1.4em;text-align:center;font-size:clamp(.98rem,1.6vw,1.12rem);line-height:1.45;color:var(--g-text);text-wrap:balance;opacity:.92}\n.kisha-subs:empty{display:none}\n.kisha-stage .kisha-status{font-size:.82rem;color:var(--g-muted);letter-spacing:.02em}\n.kisha-stage .kisha-privacy{max-width:620px;opacity:.85}\n'
    open(c,'w').write(t)
edit('public/evie-sounds.js',[
 ("  speak:()=>","  open:()=>{tone(740,{d:.08,g:.05,type:'triangle'});tone(1109,{t:.06,d:.12,g:.05,type:'triangle'});tone(1480,{t:.12,d:.2,g:.04});},\n  speak:()=>","open:()=>"),
 ("a.gain.linearRampToValueAtTime(g*pref().vol,now+attack)","a.gain.linearRampToValueAtTime(g*pref().vol*duck(),now+attack)","*duck()"),
 (" let ctx=null;const last={};"," let ctx=null;const last={};let lastAny=0;\n // Duck cues while EVIE or Kisha is speaking so they never mask the voice.\n const duck=()=>{try{const st=document.documentElement.dataset.evieVoice||'';return /speak/.test(st)||document.getElementById('kisha-stage')?.dataset.phase==='speaking'?.4:1;}catch{return 1;}};","const duck="),
 ("if(now-(last[name]||0)<140)return false;last[name]=now;","if(now-(last[name]||0)<140||now-lastAny<90)return false;last[name]=now;lastAny=now;","lastAny<90"),
])
edit('public/kisha-voice.js',[
 ("try{await player.play();}catch{if(clip)clip.playing=false;return 'blocked';}","try{const started=await Promise.race([player.play().then(()=>true),new Promise(r=>setTimeout(()=>r(false),8000))]);if(!started){try{player.pause();}catch{}if(clip)clip.playing=false;return 'blocked';}}catch{if(clip)clip.playing=false;return 'blocked';}","Promise.race([player.play()"),
])
print('patch f ok')
