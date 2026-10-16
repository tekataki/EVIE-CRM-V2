# v4 Kisha: long narratives (segmented recording, queued transcription, editable transcript, retry), bounded
# context + larger rolling summary, single mic owner, no jokes in sensitive talks. Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:80]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
LONG = open(R+'tools/patches/kisha_long_segment.js').read()
edit('public/kisha-voice.js',[
 ("   if(!(canCloud('stt')&&window.MediaRecorder&&navigator.mediaDevices?.getUserMedia))return browserListen(signal);\n   let stream;",
  "   if(!(canCloud('stt')&&window.MediaRecorder&&navigator.mediaDevices?.getUserMedia))return browserListen(signal);\n   if(window.EvieMic&&!EvieMic.acquire('kisha',()=>rec?.stop(true)))throw Object.assign(Error('El micrófono está ocupado.'),{code:'mic'});\n   let stream;","EvieMic.acquire('kisha',()=>rec?.stop(true))"),
 ("try{src?.disconnect();}catch{}rec=null;onLevel(0);resolve(","try{src?.disconnect();}catch{}rec=null;window.EvieMic?.release('kisha');onLevel(0);resolve(","rec=null;window.EvieMic?.release('kisha');onLevel(0);resolve("),
 ("catch(e){throw Object.assign(Error(['NotAllowedError','SecurityError'].includes(e?.name)?'No tengo permiso para usar el micrófono. Puedes escribirle a Kisha","catch(e){window.EvieMic?.release('kisha');throw Object.assign(Error(['NotAllowedError','SecurityError'].includes(e?.name)?'No tengo permiso para usar el micrófono. Puedes escribirle a Kisha","catch(e){window.EvieMic?.release('kisha');throw Object.assign(Error(['NotAllowedError','SecurityError'].includes(e?.name)?'No tengo permiso para usar el micrófono. Puedes"),
 ("if(performance.now()-quiet>1500)return stop(false,true);","if(performance.now()-quiet>2200)return stop(false,true);","quiet>2200)return stop(false,true)"),
 ("if(el>(vad?45000:20000))return stop(false,true);","if(el>(vad?55000:20000))return stop(false,true);","vad?55000:20000"),
 ("  function stopRecording(){rec?.stop(false);}",LONG+"  function stopRecording(){rec?.stop(false);}","function recordLong("),
 ("return {unlock,record,stopRecording,","return {unlock,record,recordLong,stopRecording,","record,recordLong,"),
])
edit('public/kisha-core.js',[
 ("const RECENT=8,MAX_TURNS=14;","const RECENT=8,MAX_TURNS=20,TURN_CHARS=8000,CONTEXT_CHARS=20000;","TURN_CHARS=8000"),
 ("function context(session){const msgs=session.messages.filter(m=>m.role==='user'||m.role==='kisha').map(m=>({role:m.role,text:T(m.text,2000)}));",
  "function context(session){const msgs=session.messages.filter(m=>m.role==='user'||m.role==='kisha').map(m=>({role:m.role,text:T(m.text,TURN_CHARS)}));","text:T(m.text,TURN_CHARS)}));"),
 ("  const recent=msgs.slice(Math.max(covered,msgs.length-RECENT));\n  return {messages:recent.slice(-MAX_TURNS),memory:session.memory||null,need_memory:older>covered+4};}",
  "  let recent=msgs.slice(Math.max(covered,msgs.length-RECENT)).slice(-MAX_TURNS);\n  // Bounded cost: keep the newest turns within CONTEXT_CHARS (always at least the last one); older turns are\n  // carried by the rolling summary (memory), which is requested again whenever turns fall out of the window.\n  let total=0,cut=recent.length;for(let k=recent.length-1;k>=0;k--){total+=recent[k].text.length;if(total>CONTEXT_CHARS&&k<recent.length-1)break;cut=k;}recent=recent.slice(cut);\n  const outside=msgs.length-recent.length;\n  return {messages:recent,memory:session.memory||null,need_memory:older>covered+4||outside>covered+1};}","const outside=msgs.length-recent.length;"),
 ("join('\\n').slice(0,15000):null;","join('\\n').slice(0,40000):null;","slice(0,40000):null;"),
])
s=open(R+'public/kisha-core.js').read()
if 'T(m.text,2000)' in s: s=s.replace('T(m.text,2000)','T(m.text,TURN_CHARS)'); open(R+'public/kisha-core.js','w').write(s); print('patched kisha-core T()')
edit('src/kisha.js',[
 ("export const MAX = { turnText: 2000, turns: 14, memory: 1200, transcriptTurns: 120, transcriptChars: 40000,",
  "// v4 long narratives: per-turn text 8000; one /turn call is bounded by turnChars so cost stays predictable;\n// older turns are carried by the rolling summary (memory, up to 2400 chars).\nexport const MAX = { turnText: 8000, turns: 20, turnChars: 24000, memory: 2400, transcriptTurns: 120, transcriptChars: 120000,","turnText: 8000"),
 ("let messages; try { messages = sanitizeMessages(body.messages) } catch (e) { return err(c, e.message) }",
  "let messages; try { messages = sanitizeMessages(body.messages, { maxChars: MAX.turnChars }) } catch (e) { return err(c, e.message) }","maxChars: MAX.turnChars"),
 ("max_output_tokens: needMemory ? 700 : 300,","max_output_tokens: needMemory ? 1100 : 320,","needMemory ? 1100 : 320"),
 ("'En memory escribe un resumen fiel y breve (máx. 900 caracteres) de TODO lo que la persona ha contado hasta ahora, sin interpretar ni añadir nada.'",
  "'En memory escribe un resumen continuo y fiel (máx. 2000 caracteres) de TODO lo que la persona ha contado hasta ahora —parte del resumen anterior y agrega lo nuevo—, con nombres, hechos y emociones que ella expresó, sin interpretar ni añadir nada.'","resumen continuo y fiel"),
 ("nunca celebres ni bromees sobre la tristeza. Si cuenta algo bueno, alégrate con moderación.',",
  "nunca celebres ni bromees sobre la tristeza. En temas sensibles (duelo, miedo, salud, conflictos, autoestima) no hagas bromas, juegos de palabras ni comentarios juguetones de perrita. Si cuenta algo bueno, alégrate con moderación.',\n    'Si la persona contó un relato largo, responde a lo esencial: refleja en una frase lo más importante que dijo (con sus palabras) y haz como mucho una pregunta. No resumas todo de vuelta.',","no hagas bromas, juegos de palabras"),
])
edit('public/kisha-view.js',[
 ("maxlength=\"2000\" placeholder=\"Escribe o usa el micrófono\"","maxlength=\"8000\" placeholder=\"Escribe o usa el micrófono\"","maxlength=\"8000\""),
 ("<button type=\"button\" class=\"icon-button kisha-mic\" data-kisha=\"mic\"","<button type=\"button\" class=\"icon-button kisha-long\" data-kisha=\"long\" aria-pressed=\"false\" aria-label=\"Relato largo: grabar varios minutos\" title=\"Relato largo (hasta 15 min)\">${i('audio-lines')}</button><button type=\"button\" class=\"icon-button kisha-mic\" data-kisha=\"mic\"","data-kisha=\"long\""),
 ("if(a==='mic')mic();","if(a==='mic')mic();else if(a==='long')longTalk();","a==='long')longTalk()"),
 (" function pause(){if(!session)return;",open(R+'tools/patches/kisha_long_view.js').read()+" function pause(){if(!session)return;","async function longTalk()"),
])
