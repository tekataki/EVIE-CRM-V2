# EVIE CRM V2 · Puesta en producción

**Arquitectura (verificada en el código):** frontend estático `public/` + API Hono en `src/` empaquetada por Vite como `dist/_worker.js` → **Cloudflare Pages** (con Functions). Datos de cada cuenta en **Supabase** (Auth + tabla `crm_records` con RLS). Sesiones, invitaciones, uso de IA y tokens de conexiones en **Cloudflare D1** `evie-auth` (binding `AUTH_DB`). No hay dos sistemas de cuentas: Supabase es la identidad; D1 solo guarda la sesión sellada y metadatos ligados al mismo `owner_id`.

- Build: `npm run build` → salida `dist/` (confirmado en `wrangler.jsonc: pages_build_output_dir`).
- Sitio existente detectado: `https://evie-crm-v2.pages.dev` (cuentas activas; sirve la versión anterior).

## 1. Cloudflare Pages
**Cloudflare → Workers & Pages → evie-crm-v2 → Settings**
1. *Build configuration*: Build command `npm run build` · Output `dist` · Production branch `main`.
2. *Bindings → Add → D1 database*: nombre `AUTH_DB` → base `evie-auth` (Production y Preview).
3. *Variables and Secrets*: agrega cada variable de `.dev.vars.example` como **Secret** (no "Text") para las claves.
4. Aplica las migraciones D1 (una vez, desde tu PC con wrangler autenticado):
   `npx wrangler d1 migrations apply evie-auth --remote` → `0001_auth_sessions`, `0002_invites_usage`, `0003_connections`.
5. *Deployments*: cada push a `main` despliega. Para volver atrás: Deployments → versión anterior → **Rollback**.

## 2. Supabase
**Supabase → tu proyecto**
1. *SQL Editor*: si es un proyecto nuevo, ejecuta en orden `migrations/supabase/202609250001_accounts.sql`, `…0002_media.sql`, `…0003_validation_guards.sql`. Si ya existían, **no hay migraciones nuevas de Supabase en v2.3** (Hábitos, Logros, Compras viven en el estado de cada cuenta `user_preferences.payload.evieData`, protegido por la misma RLS).
2. *Project Settings → API*: copia `SUPABASE_URL` y la *publishable key* → secretos en Cloudflare.
3. *Authentication → Providers → Email*: desactiva **Confirm email**, o define `SUPABASE_SERVICE_ROLE_KEY` (solo en Cloudflare).
4. Antes de cambios: *Database → Backups* (o `pg_dump`).

## 3. Cuentas para 2 personas
1. Define `EVIE_BOOTSTRAP_TOKEN`. La primera cuenta se crea con ese código como **propietario**.
   - Si tu cuenta ya existía: *EVIE → Configuración → “¿Eres quien administra EVIE?”* → pega el código → Reclamar.
2. Propietario: *Configuración → Personas → Crear invitación* → código `XXXX-XXXX-XXXX` (72 h, un uso) para la otra persona.
3. Verifica el aislamiento: `node tools/verify-isolation.mjs https://evie-crm-v2.pages.dev usuarioA usuarioB` (pide contraseñas por teclado).

## 4. Voz: Groq → OpenAI → Fish Audio
| Paso | Dónde crear la clave | Variable(s) | Costo (verificado 2026-10-11) |
|---|---|---|---|
| Oír (voz→texto, español) | https://console.groq.com/keys | `GROQ_API_KEY` (`GROQ_STT_MODEL`) | whisper-large-v3-turbo ≈ US$0.04/hora de audio, mínimo 10 s por petición |
| Pensar y usar herramientas | https://platform.openai.com/api-keys · saldo en *Settings → Billing* · tope en *Settings → Limits* | `OPENAI_API_KEY` (`EVIE_MODEL_FAST`) | gpt-6-luna US$0.10 entrada / US$0.50 salida por 1M tokens |
| Hablar | https://fish.audio/app/api-keys · voz en https://fish.audio | `FISH_AUDIO_API_KEY`, `FISH_AUDIO_VOICE_ID` (`FISH_AUDIO_MODEL`) | `s2.1-pro-free` US$0 (uso justo); `s2.1-pro` US$15 por millón de bytes |

- **La suscripción de ChatGPT es otra cosa**: no da clave de API ni acceso a tus chats, proyectos, memoria o Tareas de ChatGPT. La API se paga aparte.
- Las claves del panel "IA" de GenSpark solo sirven dentro del sandbox; **no** configuran el sitio en Cloudflare.
- Estimado de uso personal (2 personas, ~40 preguntas/día con voz): OpenAI < US$1/mes, Groq < US$1/mes (por el mínimo de 10 s), Fish gratis con `s2.1-pro-free`.
- Límites por cuenta y día: `EVIE_DAILY_LIMITS`. Sin claves, EVIE usa dictado y voz del navegador. Comandos simples (abrir, modos, resumen de hoy, marcar hábito) nunca usan IA.
- No se guardan grabaciones. El audio solo viaja a Groq durante la transcripción.

## 5. Google Calendar (solo lectura, cada persona conecta la suya)
1. https://console.cloud.google.com → proyecto → *APIs & Services → Library* → **Google Calendar API** → Enable.
2. *OAuth consent screen*: External; alcance `https://www.googleapis.com/auth/calendar.events.readonly`; *Test users*: los 2 correos de Google.
3. *Credentials → Create credentials → OAuth client ID → Web application*.
   *Authorized redirect URI*: `https://evie-crm-v2.pages.dev/api/connections/google/callback` (y tu dominio propio si usas uno).
4. Guarda `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como secretos en Cloudflare.
5. En EVIE: *Configuración → Conexiones → Conectar Google Calendar*. "Desconectar" revoca en Google y borra el token.
**No conectados (sin simulación):** Gmail (alcance restringido → verificación de Google) y Spotify (Premium + dispositivo + aprobación).

## 6. Desarrollo y pruebas
```bash
cp .dev.vars.example .dev.vars
npm run build && pm2 start ecosystem.config.cjs          # http://localhost:3000
npx wrangler d1 migrations apply evie-auth --local
for f in tests/*.test.cjs; do node --test "$f"; done     # 158 pruebas
node tools/e2e-life.mjs          # Hábitos / Logros / Compras (servidor local)
node tools/check-privacy.mjs     # dist sin datos personales
```
