# EVIE CRM V2 — Backend v5

Estado: implementado y probado en el sandbox (unitarias + build + E2E de regresión). **No desplegado.**
Cualquier cifra de latencia real del proveedor necesita claves de staging; aquí solo se mide el código.

## 0. Arquitectura base (sin cambios estructurales)

```
Navegador / Electron ── public/*.js (vanilla, defer) ──► /api/* (Hono en Cloudflare Pages Worker)
                                                        ├─ src/accounts.js   sesión, cuentas, invitaciones, montaje de módulos
                                                        ├─ src/assistant.js  /ai/chat · /ai/stt · /ai/tts · /ai/tier · /ai/metrics
                                                        ├─ src/guests.js     invitados 72 h (+ limpieza)
                                                        ├─ src/v5-routes.js  /tasks · /scenes · /plan
                                                        ├─ src/memory-v2.js  /memory-v2
                                                        └─ src/map.js        /map/* (+ /map/route-query)
D1 AUTH_DB (sesiones, ajustes, tareas, escenas, planes, memoria, métricas)   Supabase (auth + datos sincronizados + Storage)
```

* Autenticación: `bound(c)` = cookie de sesión **y** `X-Evie-User` igual al dueño. Toda escritura exige
  `X-Evie-Request: 1`, mismo Origin y JSON. Ningún cuerpo puede traer `owner_id`/`user_id` (`readBody` lo rechaza).
* Esquema auto-reparable: `ensureSchema` (v4) + `ensureV5` (v5) — solo `CREATE IF NOT EXISTS` y `ADD COLUMN`
  si falta. La migración formal es `migrations/d1/0008_v5_backend.sql`; rollback en
  `migrations/d1-rollback/0008_v5_backend_down.sql`. **Aditivo**: no se borra ni reescribe ningún dato existente
  (incluidas las dos cuentas privadas).
* Texto privado (títulos de tareas, escenas, planes, memoria) cifrado con AES-GCM (`EVIE_SESSION_KEY`).
  Las búsquedas usan índices HMAC de palabras, no texto plano.
* Idempotencia: `evie_ops(owner_id, op_id)` → `once()` devuelve el primer resultado ante reintentos.

## Modos de trabajo vs niveles de IA (no confundir)

| Concepto | Valores | Dónde vive | Qué cambia |
|---|---|---|---|
| Modo de trabajo | normal, **enfoque**, gym, negocio, cierre, noche | `preferences.evieMode` (Store, cliente) | Ruta, tema, temporizador |
| Nivel de IA (`ai_reasoning_tier`) | **chispa**, **enfoque**, **profundo** | `evie_user_settings` (D1, por cuenta) | Modelo, esfuerzo de razonamiento, tokens, timeout |

«Modo enfoque» siempre es el modo de trabajo. El nivel solo cambia con frases explícitas
(«usa nivel enfoque», «usa profundo solo para esta pregunta», «pasa a chispa») o desde el panel.

| Nivel | Modelo | Esfuerzo | Máx. salida | Timeout | Fallback |
|---|---|---|---|---|---|
| Chispa | gpt-6-luna | none | 450 | 20 s | — |
| Enfoque (defecto) | gpt-6-luna | medium | 700 | 30 s | chispa |
| Profundo | gpt-6.1-sol | high | 1600 | 60 s | enfoque |

* Voz: persistente («a partir de ahora», «usa…») vs. una vez («solo para esta pregunta»). UI: casilla «solo para mi
  siguiente pregunta» → `body.tier` una vez.
* Respuesta de `/ai/chat`: `request_id`, `tier{id,label,source,model,effort}`, `tier_fallback`, `tier_changed`,
  `suggest_tier` (solo sugiere Profundo, **nunca** cambia en silencio), `timings`, cabecera `Server-Timing`.
* Invitados: sin Profundo. Límite diario `profundo: 25` por cuenta.
* Overrides: `EVIE_TIER_<ID>_MODEL|_EFFORT|_TOKENS`, `EVIE_PRICES='{"modelo":[in,cached,out]}'`.

## Costos y guardarraíles (presupuesto $5, margen +$5–10)

Precios verificados 2026-10 (USD por 1M tokens): luna 0.10 / 0.01 / 0.50 · sol 2 / 0.10 / 10 · web search $10 / 1k.

| Turno típico (≈2 k entrada, 400 salida) | Costo aprox. |
|---|---|
| Chispa / Enfoque (luna) | ≈ $0.0004 |
| Profundo (sol, con razonamiento ≈1 k) | ≈ $0.018 |
| + búsqueda web | + $0.01 |

* Medición real por respuesta en micro-USD (`ai_usage` kind `cost_micro`, por cuenta y `__global__`).
* Topes diarios (UTC): **$0.40 por cuenta**, **$1.00 global**. Al llegar al tope por cuenta, Enfoque/Profundo bajan a
  Chispa (avisado en `tier_fallback`, motivo `account_budget`); al llegar al tope global, `/ai/chat` responde 429
  (`budget_global`) y los comandos locales siguen funcionando. Profundo también cae a Enfoque con el límite diario
  (`daily_limit`) o en cuentas de invitado (`guest`).
  Ajustables con `EVIE_BUDGET_ACCOUNT_DAILY_USD` / `EVIE_BUDGET_GLOBAL_DAILY_USD`.
* Con $5: ~12 000 turnos luna o ~270 turnos Profundo. El tope global evita gastar más de $1/día aunque haya abuso.
* STT (Groq): fragmentos ≤ 90 s, mínimo facturado 10 s; segundos facturados = max(10, declarado, tamaño/32 KB).
  Declarado > 95 s ⇒ 413 `chunk_too_long`. TTS: caché solo para frases genéricas de una lista blanca (clave HMAC).

## Instrumentación de latencia (sin contenido)

* `evie_metrics(owner_id, day, metric, bucket, n)`: histogramas log2 en ms; solo nombres y conteos.
* Servidor: `chat_total:<tier>`, `chat_openai:<tier>`, `retrieval`, `stt`, `scene_run`…
* Cliente (`POST /ai/metrics`, lista blanca): `wake, capture, stt, retrieval, first_token, tools, tts_first_audio, total, dictation_chunk`.
* `GET /ai/metrics` → p50/p95 (cota superior del bucket) de 7 días + gasto de hoy + topes.
* Ciclo de vida en el cliente (`evie:lifecycle`): `request_started, transcribing, thinking, searching,
  tool_running, speaking, completed, failed` con `request_id` y metadatos cortos (herramienta, código); nunca texto.
  Sonido de «pensando» acotado: cada 2.5 s, máx. 20 s, se apaga con «silencio» o en Ajustes; suave con movimiento reducido.

## 2. Escenas de automatización

Registro tipado (`src/scenes.js`): `set_work_mode, set_ai_tier (servidor), set_theme, navigate, open_shortcut,
open_client, show_card, close_card`. Límites: 30 escenas, 8 pasos, 4 frases. Frases reservadas (wake words,
«cancela», «para», «olvida», «recuerda»…), conflictos y duplicados → 409. Resolución exacta; ambigüedad → pregunta.
`POST /scenes/:id/run` con `run_id` idempotente; el cliente ejecuta los pasos de UI y reporta `client_results`;
resultado `completed | partial | failed` por paso. **Invitados: 403** en todas las rutas de escenas.
Sin automatización de WhatsApp/Spotify.

## 3. Rutas por voz

`POST /map/route-query` `{text}` → `open_section` («abre el mapa»), `show_card` («tarjeta del mapa») o `route`
(origen/destino/modo). Geocodificación Stadia (acotada a la zona), desambiguación por candidatos (`choice`),
ubicación actual solo con permiso (`here`), ruta Valhalla. `traffic_note` honesta: sin tráfico en tiempo real salvo
`EVIE_MAP_TRAFFIC=on`. Las direcciones no se guardan ni se registran; la clave de Stadia vive solo en el servidor.

## 4. Seguridad, Google, invitados 72 h

* Pantalla de entrada: «Continuar con Google» (dueño), «Entrar con invitación» (nombre + código, sin contraseña),
  usuario/contraseña heredado (transición).
* **Caducidad del código** (72 h desde que se crea, sin usar) ≠ **caducidad de la cuenta invitada** (72 h desde el canje).
* Comprobado en **cada** petición y antes de cada refresh de token: vencido ⇒ se borran todas sus sesiones.
* Limpieza (`cleanupGuest`): tablas D1 del dueño invitado, Storage (incl. un nivel anidado), usuario de Supabase
  (cascada). Reintentable (`cleanup_attempts`), auditable (`cleanup_log` sin contenido), barrido perezoso ~5 % de
  peticiones (no hay cron en hosted). `POST /auth/guest/cleanup` y `/:id/revoke` para el dueño.
* Aislamiento: el invitado no puede usar Google, conexiones, cambiar contraseña, reclamar dueño ni canjear códigos de
  miembro; un código de invitado no sirve para crear miembro.
* Auditoría de secretos (2026-10-24): ningún secreto en el repo (patrones sk-, JWT, AIza, gsk_, ghp_);
  `.dev.vars`/`.env` ignorados; logs sin texto de usuario (solo códigos/estados). Corregido: la caché TTS usaba el texto
  privado como clave → ahora HMAC y solo frases genéricas.

## 5–7. Tareas SOMA, Preparar mi día, Memoria v2

* `evie_tasks` es el registro canónico. Pendientes las muestra una sola vez (si una tarea coincide con el
  `nextAction` del cliente, no se cuenta dos veces). Voz: «agrega una tarea para Intensity: …», «completa la tarea…»,
  «¿qué tareas tengo con Intensity?».
* `POST /plan/propose` combina dictado + tareas + Pendientes; los eventos fijos de la Agenda son restricciones.
  Avisos: choque, pasado, fuera de horario, desborde, duraciones estimadas. Nada se escribe hasta
  `POST /plan/:id/apply {approved:true}` (idempotente por ítem). **No escribe en Google Calendar** (`google_calendar:'no_write'`).
  «¿Qué sigue?» → `GET /plan/next`.
* Memoria v2: tipos (hecho, contexto de proyecto, plan actual, resumen fechado), procedencia, proyecto, confianza,
  sensibilidad (salud/emocional requieren opt-in + confirmación; ubicaciones nunca), historial de ediciones sellado (≤10),
  búsqueda híbrida léxica con incertidumbre explícita, exportación v2, incógnito no escribe ni consulta.

## 8–9. Dictado largo y palabra clave

* `public/evie-dictation.js`: grabadores solapados (45 s, 3 s de solape, máx. 20 partes = 15 min), orden, deduplicación
  de costuras, reintento ×2 por parte, reporte de huecos. El audio se descarta en cuanto llega su texto.
  Transcripción **siempre editable**; acciones de alto impacto nunca se envían solas. «Ivi, modo dictado» o Ajustes.
* Palabra clave: opt-in, **apagada por defecto**, local (Web Speech), variantes Ivi/Ivy/Evie/Libi/Liby.
  Puerta de un turno (`wakeGate`): ignora mientras escucha/piensa/habla, 1.2 s tras hablar y con un turno abierto.
  Electron: atajo global Ctrl/Cmd+Espacio (push-to-talk) y consentimiento de micrófono en el proceso principal.
  Android: ver `ANDROID-CONTRACT.md`.

## Variables de entorno nuevas (todas opcionales)

`EVIE_BUDGET_ACCOUNT_DAILY_USD`, `EVIE_BUDGET_GLOBAL_DAILY_USD`, `EVIE_TIER_{CHISPA,ENFOQUE,PROFUNDO}_{MODEL,EFFORT,TOKENS}`,
`EVIE_PRICES`, `EVIE_MAP_TRAFFIC`. Requerida para invitados: `SUPABASE_SERVICE_ROLE_KEY` (ya existente).

## Orden de despliegue

1. Respaldo: exportar D1 (`wrangler d1 export evie-auth --remote --output pre-v5.sql`) y Supabase (scripts de v4, solo lectura).
2. `npx wrangler d1 migrations apply evie-auth --remote` (0008; aditiva).
3. Desplegar el Worker. `ensureV5` repara columnas si la migración no corrió.
4. Prueba de humo (`docs/SMOKE-v5.md`).
5. Rollback: volver al despliegue anterior (el código v4 ignora las tablas nuevas). Solo si hace falta revertir el
   esquema: `migrations/d1-rollback/0008_v5_backend_down.sql` (borra datos v5: tareas, escenas, planes, métricas).

## Rotación de secretos

`EVIE_SESSION_KEY` (rotarla invalida sesiones y hace ilegible el texto sellado → exportar memoria/tareas antes),
`OPENAI_API_KEY`, `GROQ_API_KEY`, `FISH_AUDIO_API_KEY`, `STADIA_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`GOOGLE_CLIENT_SECRET`, `EVIE_BOOTSTRAP_TOKEN`. Todas con `wrangler pages secret put`; nunca en el repo.
