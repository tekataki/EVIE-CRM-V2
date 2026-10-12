# Idempotent v3 patch applied on top of the pre-v3 workspace (b6129d3).
# Each edit is skipped if its result is already present, so it can be re-run safely.
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

edit('src/accounts.js', [
 ("import { createKisha } from './kisha.js'", "import { createKisha } from './kisha.js'\nimport { createResearch } from './research.js'\nimport { createGoogleAuth } from './google-auth.js'"),
 (' "CREATE TABLE IF NOT EXISTS kisha_turns (owner_id TEXT NOT NULL, turn_id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, turn_id))"]',
  ' "CREATE TABLE IF NOT EXISTS kisha_turns (owner_id TEXT NOT NULL, turn_id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, turn_id))",\n "CREATE TABLE IF NOT EXISTS google_auth_states (state TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL)",\n "CREATE TABLE IF NOT EXISTS google_links (owner_id TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT \'\', linked_at INTEGER NOT NULL)",\n "CREATE TABLE IF NOT EXISTS desktop_handoffs (code TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL)"]'),
 ("providers:{spotify:false,whatsapp:false,instagram:false}}))", "googleAuth:c.env?.EVIE_GOOGLE_AUTH==='true',passwordLogin:c.env?.EVIE_PASSWORD_LOGIN!=='off',research:!!c.env?.OPENAI_API_KEY&&c.env?.EVIE_WEB_SEARCH!=='off',weather:true,providers:{spotify:false,whatsapp:false,instagram:false,gmail:false}}))"),
 (" api.post('/auth/signup',c=>enter(c,true));api.post('/auth/signin',c=>enter(c,false))",
  " const passwordOff=c=>c.env.EVIE_PASSWORD_LOGIN==='off'?jsonError(c,'El acceso con contraseña se retiró. Entra con Google.',410):null\n api.post('/auth/signup',c=>passwordOff(c)||enter(c,true));api.post('/auth/signin',c=>passwordOff(c)||enter(c,false))"),
 (" api.route('/kisha',createKisha({fetcher,authenticate:bound,seal,unseal}))",
  " api.route('/kisha',createKisha({fetcher,authenticate:bound,seal,unseal}))\n api.route('/info',createResearch({fetcher,authenticate:bound,unseal}))\n api.route('/auth/google',createGoogleAuth({remote,issueSession,verified,seal,unseal,digest,limited}))"),
])

edit('src/assistant.js', [
 ("  { name: 'draft_goal', description: 'Propone un objetivo nuevo.', parameters: S({ title: { type: 'string', maxLength: 140 } }) }\n]", """  { name: 'draft_goal', description: 'Propone un objetivo nuevo.', parameters: S({ title: { type: 'string', maxLength: 140 } }) },
  // HUD: contextual cards over the Neural Core. Opening/closing a card never changes data.
  { name: 'show_card', description: 'Muestra una tarjeta contextual en Inicio sobre el núcleo de EVIE (módulo real o información). Úsala cuando el usuario pide "abre X", "muéstrame X" o pide la hora/agenda/pendientes. "kisha" abre a la Mascota Virtual. "capabilities" explica lo que EVIE puede hacer.', parameters: S({ card: { type: 'string', enum: ['finanzas', 'agenda', 'pendientes', 'today', 'clock', 'kisha', 'capabilities', 'habitos', 'objetivos', 'gimnasio', 'soma', 'aprendizaje', 'negocios', 'libros', 'vision', 'tendencias', 'logros'] } }) },
  { name: 'close_card', description: 'Cierra una tarjeta abierta en Inicio ("cierra finanzas", "quita esto"). card=null cierra la tarjeta activa; "all" cierra todas. No borra datos.', parameters: S({ card: nstr('nombre de la tarjeta, "all" o null para la activa') }) },
  { name: 'get_pendientes', description: 'Pendientes unificados del usuario (agenda, objetivos, hábitos, pagos, cobros SOMA) ordenados por urgencia, con severidad roja/amarilla/verde y fuente.', parameters: S({}) },
  { name: 'research_web', description: 'Investigación web en vivo con fuentes citadas y tarjeta. Úsala para "investiga…", noticias, hechos actuales o de hoy. Devuelve resumen verificado y fuentes.', parameters: S({ query: { type: 'string', maxLength: 300 } }) },
  { name: 'get_weather', description: 'Clima actual y pronóstico de 3 días (Open-Meteo). place=null usa la ciudad configurada; si no hay, la herramienta pide la ubicación.', parameters: S({ place: nstr('ciudad, estado o null') }) },
  { name: 'propose_learning_path', description: 'Investiga y propone una ruta de aprendizaje con fuentes para un tema ("quiero aprender psicología"). Muestra vista previa; el usuario confirma antes de guardar. Detecta temas existentes.', parameters: S({ topic: { type: 'string', maxLength: 120 } }) },
  { name: 'desktop_action', description: 'Acciones de EVIE para Windows (solo app de escritorio): abrir Spotify o WhatsApp, controlar la música del sistema, preparar un mensaje a un contacto configurado. En navegador devuelve unavailable. Un mensaje NUNCA se da por enviado: se prepara, se lee y se confirma.', parameters: S({ action: { type: 'string', enum: ['open_spotify', 'open_whatsapp', 'media_next', 'media_previous', 'media_play_pause', 'compose_message'] }, contact: nstr('nombre del contacto para compose_message o null'), message: nstr('texto exacto del mensaje o null') }) }
]"""),
 ("    'Tus respuestas se leen en voz alta: máximo 3 frases", """    'Estás en un HUD: para abrir o cerrar módulos/tarjetas usa show_card/close_card. Para "¿qué hora es?" usa get_current_time y show_card(clock). Para "¿qué tengo hoy?" usa get_today_overview y show_card(today). Para "¿qué pendientes tengo?" usa get_pendientes. Para investigar o noticias usa research_web (no inventes). Para clima usa get_weather.',
    'Solo di que algo se abrió, se buscó o se hizo si la herramienta lo confirma (ok:true). Si devuelve unavailable o error, dilo con honestidad y ofrece la alternativa. Una pregunta de seguimiento es opcional; no la fuerces.',
    'Tus respuestas se leen en voz alta: máximo 3 frases""", "'Estás en un HUD:"),
 ("    'No puedes borrar datos, mover dinero, enviar mensajes ni ejecutar comandos del sistema.", "    'No puedes borrar datos, mover dinero, hacer compras ni pagos, ni ejecutar comandos del sistema. Solo en EVIE para Windows existen acciones de escritorio acotadas (desktop_action); un mensaje se prepara y el usuario confirma o termina de enviarlo."),
 ("  limits: { chat: 150, stt_seconds: 1800, tts_chars: 40000, web_search: 25 }", "  limits: { chat: 150, stt_seconds: 1800, tts_chars: 40000, web_search: 25, weather: 60 }"),
 ("model: env.EVIE_MODEL_FAST || DEFAULTS.model, ttsModel", "model: env.EVIE_MODEL_FAST || DEFAULTS.model, researchModel: env.EVIE_MODEL_RESEARCH || env.EVIE_MODEL_FAST || DEFAULTS.model, research: !!env.OPENAI_API_KEY && env.EVIE_WEB_SEARCH !== 'off', ttsModel"),
])

edit('public/store.js', [
 ("        if (c==='clients' && (!text(r.stage)", "        if (c==='clients' && r.schedules!==undefined && (!Array.isArray(r.schedules)||r.schedules.length>20||(window.SomaPayments&&(()=>{try{return !SomaPayments.validateClient(r);}catch{return true;}})()))) fail('Calendario de cobro no válido en un cliente.');\n        if (c==='clients' && (!text(r.stage)", "Calendario de cobro no válido"),
])
