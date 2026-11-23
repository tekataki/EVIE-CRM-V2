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
0. **Producción (2026-11-21): proyecto `EVIE CRM V2` (`mehhbdnxskfbortgglnd`, org dali-os), con las 5 migraciones aplicadas. Ver `docs/SUPABASE-SETUP.md`.**
1. *SQL Editor*: si es un proyecto nuevo, ejecuta en orden `migrations/supabase/202609250001_accounts.sql`, `…0002_media.sql`, `…0003_validation_guards.sql`, `202610130001_automations.sql`, `202611210001_hardening.sql`. Si ya existían, **no hay migraciones nuevas de Supabase en v2.3** (Hábitos, Logros, Compras viven en el estado de cada cuenta `user_preferences.payload.evieData`, protegido por la misma RLS).
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

## 5. Google Calendar (cada persona conecta la suya)
EVIE lee eventos con `calendar.events.readonly` y, solo si la persona lo permite, crea eventos con
`calendar.events.owned` (únicamente calendarios propios; no puede tocar calendarios compartidos ajenos).
Cada token se guarda cifrado (AES-GCM, `EVIE_SESSION_KEY`) y ligado a la sesión del dueño: Naomi nunca ve el calendario de Alejandro.

1. https://console.cloud.google.com → crea o elige un proyecto → *APIs & Services → Library* → **Google Calendar API** → *Enable*.
2. *OAuth consent screen* → *External*. Nombre de la app, correo de soporte y dominio (`evie-crm-v2.pages.dev`).
   Alcances: `.../auth/calendar.events.readonly` y `.../auth/calendar.events.owned`.
   *Test users*: añade los 2 correos de Google (en modo *Testing* el refresh token caduca a los 7 días; publica la app para evitarlo).
3. *Credentials → Create credentials → OAuth client ID* → *Web application*.
   *Authorized redirect URI*: `https://evie-crm-v2.pages.dev/api/connections/google/callback` (y tu dominio propio si usas uno).
4. Guarda los secretos en Cloudflare (Pages → evie-crm-v2 → Settings → Variables and secrets, tipo *Secret*):
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Redespliega.
5. En EVIE: *Configuración → Conexiones → Conectar Google Calendar* (lectura).
   Para crear eventos: **Permitir que EVIE cree eventos** (vuelve a pedir consentimiento con el alcance de escritura).
6. Crear un evento: EVIE muestra una vista previa y solo escribe al pulsar *Confirmar*. Cada borrador lleva una clave
   de idempotencia que se usa como id del evento, así que repetir la confirmación no lo duplica.
   "Desconectar" revoca en Google y borra el token.

**No conectados (sin simulación):**
- Gmail: alcances restringidos → requiere verificación de seguridad de Google (CASA) antes de uso real.
- Spotify: requiere app en el Developer Dashboard, cuenta Premium, un dispositivo activo y aprobación de cuota extendida.

## 6. Desarrollo y pruebas
```bash
cp .dev.vars.example .dev.vars
npm run build && pm2 start ecosystem.config.cjs          # http://localhost:3000
npx wrangler d1 migrations apply evie-auth --local
for f in tests/*.test.cjs; do node --test "$f"; done     # 158 pruebas
node tools/e2e-life.mjs          # Hábitos / Logros / Compras (servidor local)
node tools/check-privacy.mjs     # dist sin datos personales
```

## 7. EVIE v3 (Neural Core, investigación, Google, SOMA, escritorio)

### Variables de entorno (Cloudflare Pages → Settings → Variables / `wrangler pages secret put`)
| Variable | Valor | Uso |
|---|---|---|
| `EVIE_GOOGLE_AUTH` | `true` | Activa «Entrar con Google» (desactivado por defecto) |
| `EVIE_PASSWORD_LOGIN` | `off` (opcional) | Retira el acceso con contraseña **solo** cuando todos hayan vinculado Google |
| `EVIE_PUBLIC_ORIGIN` | `https://evie-crm-v2.pages.dev` | Origen usado para el callback OAuth |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto | Opcional: borra usuarios Supabase huérfanos de Google sin invitación |
| `EVIE_MODEL_RESEARCH` | p. ej. `gpt-6-luna` | Modelo con `web_search` para investigación |
| `EVIE_WEB_SEARCH` | `off` para desactivar | Investigación en vivo (de pago, se mide) |
| `EVIE_DAILY_LIMITS` | JSON, p. ej. `{"web_search":20,"weather":60}` | Límites diarios por cuenta |
| `OPENAI_API_KEY`, `GROQ_API_KEY`, `FISH_AUDIO_API_KEY`, `FISH_AUDIO_VOICE_ID` | secretos | Chat/investigación, STT, TTS |

Clima: Open-Meteo, sin clave (atribución CC BY 4.0).

### Supabase
1. Authentication → Sign In / Providers → **Google**: activar con el Client ID/Secret de Google Cloud.
2. Activar **Manual linking** (necesario para «Vincular Google» desde Configuración).
3. Authentication → URL Configuration → Redirect URLs: añadir `https://evie-crm-v2.pages.dev/api/auth/google/callback*` (y `http://localhost:3000/api/auth/google/callback*` para pruebas).
4. Google Cloud Console → OAuth client (Web) → Authorized redirect URI: `https://<proyecto>.supabase.co/auth/v1/callback`. Ámbitos: solo `openid email profile` (sin Gmail/Calendar).

Reglas: no se fusionan cuentas por correo. Las cuentas existentes (Alejandro, Naomi) entran con usuario+contraseña y vinculan Google en **Configuración → Acceso con Google**. Una cuenta de Google nueva necesita código de invitación del propietario.

### D1
`migrations/d1/0006_google_research.sql` (tablas `google_auth_states`, `google_links`, `desktop_handoffs`). También se crean solas vía `SCHEMA`. Reversión: `DROP TABLE` de las tres (comentado en el archivo).

### Escritorio Windows (instalador)
El `.exe` de Squirrel debe compilarse **en Windows** (en Linux falla la edición de recursos del ejecutable sin wine):
```powershell
npm ci
npm run build
powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1   # o: npm run make:win
# → out/make/squirrel.windows/x64/EVIE-CRM-V2-Setup.exe  y  out/make/zip/win32/x64/*.zip
```
Cuentas/Google en escritorio (desde 2.3.1): la app **instalada** se conecta sola a `https://evie-crm-v2.pages.dev`
(`electron/main/origin.cjs`); no hace falta ninguna variable de Windows. `EVIE_ACCOUNT_API_ORIGIN` sigue sirviendo para
apuntar a otro despliegue (`https://…`) o para forzar el modo local (`EVIE_ACCOUNT_API_ORIGIN=off`); ejecutada desde el
código (`npm run dev:desktop`) la app es local salvo que definas la variable. La app registra el protocolo `evie-crm://`
(vuelta de Google al escritorio): «Entrar con Google» abre tu navegador y al terminar regresa a EVIE.
Contactos para «mándale un mensaje a…»: Configuración → Contactos de EVIE. EVIE solo abre WhatsApp con el mensaje prellenado; **nunca envía ni confirma entrega**.

**Actualizaciones automáticas (desde 2.4):**
- Cada push a `main` que cambia `public/`, `electron/`, `scripts/`, `package*.json` o `forge.config.cjs` corre
  *Desktop release (Windows)* (GitHub Actions, `windows-latest`, solo con `GITHUB_TOKEN`).
- Ese flujo compila el instalador y publica el release `vX.Y.Z` con `RELEASES`, el `.nupkg` completo y
  `EVIE-CRM-V2-Setup.exe`.
- La versión es la de `package.json` o, si ya existe ese release, el siguiente parche libre. No se hace commit de vuelta.
- Las apps instaladas buscan la actualización en `https://github.com/tekataki/EVIE-CRM-V2/releases/latest/download` y
  la aplican al reiniciar.
- Para subir de versión menor, sube `package.json` por encima del último release.
- `[skip desktop]` en el commit evita el release. Desde la pestaña *Actions* también se puede lanzar a mano
  (*workflow_dispatch*).

**Ivi en la app de escritorio:**
- Con sesión iniciada usa la IA, la voz y las herramientas de la nube, igual que la web.
- Para que Ivi abra una app que no está en la lista fija, la primera vez Windows te pregunta «¿Permitir que Ivi abra…?».
  Para revocarlo: Configuración → Equipo → Catálogo de aplicaciones.

## 8. v3.2 · Lista consolidada (borradores seguros, Mapa, Memoria, Configuración personalizada)
> No hay que tocar el proyecto de Supabase en vivo: esta versión **no trae migraciones de Supabase**.

### Cloudflare (Pages → evie-crm-v2 → Settings → Variables and Secrets)
| Variable | Tipo | Obligatoria | Uso |
|---|---|---|---|
| `STADIA_API_KEY` | **Secret** | Para el Mapa | Búsqueda y rutas vía Worker (`/api/map`). Sin ella el Mapa muestra «no configurado» y no inventa rutas |
| `EVIE_MAP_LIMITS` | Text | No | JSON, por defecto `{"map_search":200,"map_route":120}` por cuenta y día |
| `EVIE_MAP_TRAFFIC` | Text | No | `on` solo con plan Stadia Standard o superior + atribución TomTom |
| `EVIE_MAP_STYLE_URL` / `EVIE_MAP_STYLE_URL_DARK` | Text | No | Otro estilo de Stadia (por defecto `alidade_smooth(_dark)`) |
| `STADIA_BASE_URL` | Text | No | Por defecto `https://api.stadiamaps.com` |
| `EVIE_SESSION_KEY` | Secret | Ya existe | También cifra la memoria de Ivi (AES-GCM) y sus índices HMAC |

### Stadia Maps (https://client.stadiamaps.com/signup/)
1. Crea la cuenta (14 días de prueba Professional; después queda en Free salvo que contrates un plan).
2. *Manage Properties → Authentication*:
   - Añade `evie-crm-v2.pages.dev` (y tu dominio propio) en **Authorized domains**. Así las teselas cargan sin clave en el navegador.
   - Para desarrollo local, `localhost` ya está permitido.
3. *API Keys → Create*: copia la clave a `STADIA_API_KEY` como **Secret** y redespliega.
4. **Plan:**
   - Free = 200 000 créditos/mes, **solo no comercial**.
   - Uso comercial (SOMA, clientes) → Starter, 20 US$/mes.
   - Tráfico en vivo → Standard.
   - Detalle de créditos y estimación en `docs/MAP.md`.

### D1 (`evie-auth`)
`npx wrangler d1 migrations apply evie-auth --remote` → aplica `0007_memory.sql` (aditiva: 3 tablas nuevas + índices). El Worker también las crea si faltan.

### Verificación después del despliegue
1. *Configuración personalizada*: escribe y espera más de 60 s. El texto no se pierde y aparece el aviso de actualización en pausa si llega un cambio remoto.
2. *Mapa*: «Ivi, calcula la ruta al Tecnológico» → elige el lugar → «Mi ubicación» → ruta con distancia y tiempo → «Iniciar navegación» → «Detener».
3. *Memoria*: «Ivi, recuerda que mi color favorito es azul» → aparece en *Configuración personalizada → Memoria*. «Ivi, olvida mi color favorito» lo borra.
4. Entra con la otra cuenta: no debe ver nada de lo anterior.

### Pruebas
```bash
for f in tests/*.test.cjs; do node --max-old-space-size=300 --test --test-reporter=spec "$f"; done   # 26 archivos
for t in drafts memory map login v31 hud workspace kisha gym life; do W=1440 node tools/e2e-$t.mjs; W=390 node tools/e2e-$t.mjs; done
SHOT=evidence/sweep node tools/qa-sweep.mjs     # desborde / etiquetas / áreas táctiles en todas las secciones
```
