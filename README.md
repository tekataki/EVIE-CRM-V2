# EVIE CRM V2

CRM personal con asistente de voz **EVIE** para 2 cuentas privadas. Web/PWA (PC y teléfono) + host Electron.
*Created by Alejandro Dali.*

## Qué incluye (v2.3)
- **EVIE**: núcleo neural interactivo en Inicio con subtítulos y caja de texto debajo; voz Groq (transcripción en español) → OpenAI (herramientas tipadas) → Fish Audio; respaldo gratis con voz del navegador; modos ("activa el modo enfoque"); activación por toque, orbe móvil, Ctrl+Espacio y doble aplauso opcional (solo con la página activa y permiso de micrófono). Toda escritura se propone y se confirma.
- **Cuentas**: registro por invitación (propietario + 1 invitado), sesiones selladas, datos aislados por cuenta (Supabase RLS + verificación en servidor).
- **Módulos**: Inicio, Agenda, Finanzas (cuentas/tarjeta con corte y pago, Compras y despensa), Hábitos, Salud y gym (calorías Mifflin–St Jeor), Objetivos, Negocios (SOMA, ALVENTO, Granja, Contenido y propios), Aprendizaje, Mascota Virtual (Kisha, ruta #mascota; alias #bitacora), Biblioteca, Vision Board, Tendencias (solo horas reales), Logros (25 insignias deterministas), Subir.
- **Conexiones**: Google Calendar solo lectura por cuenta (OAuth + PKCE). OpenAI/Groq/Fish con estado real. Gmail/Spotify: "más adelante", sin simulación.

## Mascota Virtual · Kisha (v2.5)
- **Qué es**: reemplaza la antigua Bitácora. Kisha, una Border Collie animada (SVG articulado original, sin assets externos), conversa contigo sobre tu día por voz o texto. Es una compañera de IA para reflexionar, no una terapeuta.
- **Flujo**: Iniciar conversación → Kisha saluda con tu nombre preferido → hablas o escribes → preguntas breves de seguimiento → **Concluir conversación** abre una **revisión** (título, resumen, momentos, intensidades sugeridas 0–100 editables, transcripción opcional) → **Guardar** o **Descartar**. Nada se escribe sin tu confirmación; un guardado por sesión (idempotente).
- **Estados de Kisha**: sentada respirando (espera), orejas al frente (escuchando), cabeza ladeada mirando arriba (pensando), boca sincronizada con la amplitud real del audio (hablando, solo mientras suena), curiosa, confundida, apoyo calmado (cejas suaves, ojos entrecerrados), contenta moderada (cola), tumbada descansando (pausa / fin). La IA solo puede sugerir un *cue* de una lista cerrada; la máquina de estados del cliente manda sobre escuchar/pensar/hablar/error. Respeta `prefers-reduced-motion` y hay botón para desactivar la animación.
- **API**: `POST /api/kisha/turn` (respuesta + cue, JSON Schema estricto, cuota `chat`, caché idempotente sellada 24 h por cuenta) y `POST /api/kisha/analyze` (borrador con citas textuales; descarta emociones sin evidencia; <8 palabras ⇒ «Sin datos suficientes», sin llamar al modelo). Voz: `/api/ai/stt` (Groq) y `/api/ai/tts` (Fish Audio). Personalización leída en el servidor del perfil de la cuenta autenticada.
- **Datos**: entradas confirmadas en la colección `journal` (`journal_version:4`, `source:'kisha'`, `source_entry_id:'kisha:<sesión>'`), sincronizadas por cuenta igual que el resto (Supabase/RLS). Borrador sin terminar solo en `localStorage` bajo una clave por cuenta. No se guarda audio. Registros anteriores (manuales e importados) se conservan en «Registros anteriores».
- **D1**: tabla `kisha_turns` (migración `0005_kisha.sql`, creada automáticamente por `ensureSchema`).
- **Pruebas**: `tests/kisha-server.test.cjs`, `tests/kisha-core.test.cjs`, `tools/e2e-kisha.mjs` (navegador, proveedores simulados), `tools/shot-kisha.mjs` (layout 320–1440, claro/oscuro).

## Novedades v3 · Neural Core
- **Inicio = Neural Core**: un único núcleo neural centrado, saludo «Bienvenido, [nombre preferido]», sin barra lateral ni panel derecho; estados idle/escuchando/transcribiendo/pensando/consultando/hablando/confirmación/error; texto, subtítulos y conversación completa como alternativas.
- **Tarjetas tipadas** (`public/evie-hud-cards.js`, `evie-hud.js`): finanzas, agenda, hábitos, objetivos, gimnasio, SOMA, aprendizaje, Kisha, pendientes, hora, hoy, capacidades, investigación, clima, ruta de aprendizaje, mensaje. Máx. 4, sin solaparse, cerrar nunca borra datos; voz, clic, teclado (Esc) y lector de pantalla.
- **EVIE más capaz**: investigación web con fuentes verificadas (solo URLs devueltas por la herramienta, fecha de publicación vs. evento, hora de consulta), clima Open-Meteo, intenciones locales sin coste (abrir/cerrar tarjetas, hora, capacidades, pendientes).
- **Activación**: clic en el núcleo, botón de micrófono, atajo, doble aplauso y palabra de activación opcional «Ivi/Evie» **solo si el navegador la procesa en el dispositivo** (nunca se envía audio a Groq para detectarla). Sonidos originales con volumen.
- **Google** con Supabase (PKCE, invitaciones, vinculación explícita, sin fusión por correo, traspaso a escritorio por `evie-crm://`).
- **SOMA**: calendarios de cobro recurrentes, cuotas, pagos parciales, proyección en Finanzas (separada del dinero recibido) y un cobro confirmado = exactamente un ingreso.
- **Pendientes** unificados (rojo/amarillo/verde, origen, deduplicados, zona horaria) en `#pendientes` y en la tarjeta.
- **Aprendizaje asistido**: ruta propuesta con fuentes → vista previa → confirmación → sin duplicados.
- **Escritorio Windows**: abrir Spotify/WhatsApp, teclas multimedia, mensaje prellenado con confirmación (IPC validado). En web estas acciones se muestran como no disponibles.

Configuración v3: ver `docs/SETUP.md §7`.

## Arquitectura
`public/` (frontend) + `src/` (API Hono) → `npm run build` → `dist/` con `_worker.js` → **Cloudflare Pages**. Datos: **Supabase** (`crm_records`, `user_preferences` con RLS). D1 `AUTH_DB` (`evie-auth`): sesiones, roles, invitaciones, uso de IA, tokens de conexiones.

API `/api`: `runtime`, `auth/*`, `data/pull|push`, `ai/status|chat|stt|tts`, `connections`, `connections/google/start|callback|events|disconnect`.

## Configuración
**docs/SETUP.md** (Cloudflare, Supabase, cuentas, claves, costos, Google) y `.dev.vars.example`.

## Pruebas
158 pruebas de Node (`tests/*.test.cjs`), e2e `tools/e2e-life.mjs`, aislamiento en vivo `tools/verify-isolation.mjs`, QA visual `tools/shot.mjs`, privacidad `tools/check-privacy.mjs`.

## Restaurar la versión anterior
Tag `pre-v2.3-946d437` en GitHub, o *Cloudflare → Deployments → Rollback*.
