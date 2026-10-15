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

## Novedades v3.1
- **Acceso Google-first**: dos recorridos («Iniciar sesión» / «Crear mi cuenta»), pestañas operables con flechas, estados claros (`not_linked`, `not_invited`, `expired`, `disabled`, cancelado), transición con usuario y contraseña si Google no está configurado (sin bloqueo), onboarding con Ivi.
- **Workspace del HUD por cuenta**: las tarjetas no se pierden al hablar, re-renderizar, cambiar tema o volver de un módulo; sin desalojo (las que no caben van a una bandeja); cierre por nombre («cierra la tarjeta del clima», «finaliza esta tarjeta», «cierra todas»); una respuesta tardía no resucita una tarjeta cerrada; otra cuenta nunca ve tus tarjetas.
- **«¿Qué puedes hacer?»** abre una vista radial (hoja en móvil) generada del registro real de capacidades; no borra tarjetas.
- **Automatizaciones**: accesos directos a sitios (solo `http/https`, sin credenciales en URL, sin redes locales); se abren por voz o clic; en Windows con `open_url` validado.
- **Kisha**: composición abierta (sin panel rectangular) con subtítulos bajo el personaje; el arranque de la voz tiene tope de 8 s → si el navegador no reproduce, pasa a «Tocar para escuchar» en lugar de quedarse en el saludo.
- **Sonidos**: nuevo cue `open`; los cues se atenúan (−60 %) mientras EVIE o Kisha hablan y nunca se apilan (≥ 90 ms entre cues).
- **Pendiente**: rediseño fotorrealista de Kisha con poses generadas (bloqueado por créditos de generación de imágenes); la Kisha SVG actual sigue activa.

## Novedades v3.2
- **Sin parpadeos ni texto perdido**:
  - Antes, el refresco de sesión cada 60 s, la renovación de metas y la actualización del service worker re-renderizaban la página y borraban lo que escribías en *Configuración personalizada*.
  - Ahora, mientras editas, esas tareas se posponen (aviso visible). Los borradores, el foco, el cursor y el scroll se conservan.
  - Nada se sube sin que lo guardes, y no se recarga con cambios sin guardar.
- **Mapa · Ciudad Guzmán** (`#mapa`):
  - Stadia Maps (OpenStreetMap) a través del Worker, con MapLibre.
  - Búsqueda con desambiguación y rutas solo del proveedor.
  - Navegación en primer plano con precisión del GPS, recálculo con antirrebote, voz y botón Detener.
  - Sin historial de ubicación. Ver `docs/MAP.md`.
- **Memoria privada de Ivi**:
  - «recuerda / olvida / ¿recuerdas lo que te pregunté ayer?» y modo privado.
  - Panel con fuente, edición, exportación y borrado.
  - Cifrada por cuenta. Ver `docs/MEMORY.md`.
- **Configuración personalizada rediseñada**:
  - Paneles verticales: Cómo me habla Ivi / Quién soy / Lugar y hora / Memoria / Privacidad y datos / Salud (plegado).
  - Máximo 2 columnas, estado de guardado visible y vista previa que no tapa el formulario.

## Arquitectura
`public/` (frontend) + `src/` (API Hono) → `npm run build` → `dist/` con `_worker.js` → **Cloudflare Pages**. Datos: **Supabase** (`crm_records`, `user_preferences` con RLS). D1 `AUTH_DB` (`evie-auth`): sesiones, roles, invitaciones, uso de IA, tokens de conexiones.

API `/api`: `runtime`, `auth/*`, `memory/*`, `map/config|search|route`, `data/pull|push`, `ai/status|chat|stt|tts`, `connections`, `connections/google/start|callback|events|disconnect`.

## Configuración
**docs/SETUP.md** (Cloudflare, Supabase, cuentas, claves, costos, Google; §8 lista consolidada v3.2), **docs/MAP.md**, **docs/MEMORY.md** y `.dev.vars.example`.

## Pruebas
Pruebas de Node en 26 archivos (`tests/*.test.cjs`; ejecútalas archivo por archivo en máquinas con poca RAM), e2e `tools/e2e-drafts.mjs`, `e2e-memory.mjs`, `e2e-map.mjs`, `e2e-login.mjs`, `e2e-v31.mjs`, `e2e-hud.mjs`, `e2e-workspace.mjs`, `e2e-kisha.mjs`, `e2e-gym.mjs`, `tools/e2e-life.mjs`, aislamiento en vivo `tools/verify-isolation.mjs`, QA visual `tools/shot.mjs` y `tools/qa-sweep.mjs`, privacidad `tools/check-privacy.mjs`.

## Restaurar la versión anterior
Tag `pre-v2.3-946d437` en GitHub, o *Cloudflare → Deployments → Rollback*.
