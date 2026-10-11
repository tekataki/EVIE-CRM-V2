# EVIE CRM V2

CRM personal con asistente de voz **EVIE** para 2 cuentas privadas. Web/PWA (PC y teléfono) + host Electron.
*Created by Alejandro Dali.*

## Qué incluye (v2.3)
- **EVIE**: núcleo neural interactivo en Inicio con subtítulos y caja de texto debajo; voz Groq (transcripción en español) → OpenAI (herramientas tipadas) → Fish Audio; respaldo gratis con voz del navegador; modos ("activa el modo enfoque"); activación por toque, orbe móvil, Ctrl+Espacio y doble aplauso opcional (solo con la página activa y permiso de micrófono). Toda escritura se propone y se confirma.
- **Cuentas**: registro por invitación (propietario + 1 invitado), sesiones selladas, datos aislados por cuenta (Supabase RLS + verificación en servidor).
- **Módulos**: Inicio, Agenda, Finanzas (cuentas/tarjeta con corte y pago, Compras y despensa), Hábitos, Salud y gym (calorías Mifflin–St Jeor), Objetivos, Negocios (SOMA, ALVENTO, Granja, Contenido y propios), Aprendizaje, Bitácora (emociones), Biblioteca, Vision Board, Tendencias (solo horas reales), Logros (25 insignias deterministas), Subir.
- **Conexiones**: Google Calendar solo lectura por cuenta (OAuth + PKCE). OpenAI/Groq/Fish con estado real. Gmail/Spotify: "más adelante", sin simulación.

## Arquitectura
`public/` (frontend) + `src/` (API Hono) → `npm run build` → `dist/` con `_worker.js` → **Cloudflare Pages**. Datos: **Supabase** (`crm_records`, `user_preferences` con RLS). D1 `AUTH_DB` (`evie-auth`): sesiones, roles, invitaciones, uso de IA, tokens de conexiones.

API `/api`: `runtime`, `auth/*`, `data/pull|push`, `ai/status|chat|stt|tts`, `connections`, `connections/google/start|callback|events|disconnect`.

## Configuración
**docs/SETUP.md** (Cloudflare, Supabase, cuentas, claves, costos, Google) y `.dev.vars.example`.

## Pruebas
158 pruebas de Node (`tests/*.test.cjs`), e2e `tools/e2e-life.mjs`, aislamiento en vivo `tools/verify-isolation.mjs`, QA visual `tools/shot.mjs`, privacidad `tools/check-privacy.mjs`.

## Restaurar la versión anterior
Tag `pre-v2.3-946d437` en GitHub, o *Cloudflare → Deployments → Rollback*.
