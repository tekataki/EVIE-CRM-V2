# EVIE en Android — plan v10 (documentado, no compilado)

Estado: **plan listo para implementar**. En este equipo no hay Android SDK, así que no se compila ni se prueba aquí.
El contrato del backend (`docs/ANDROID-CONTRACT.md`) sigue vigente; este documento agrega lo que pide v10 y cómo
hacerlo sin romper la seguridad de la web (el Worker sigue siendo el único camino a Supabase y a la IA).

## 1. Empaquetado: Capacitor sobre la PWA
- `npx cap init "EVIE" com.example.evie --web-dir=dist` y `npx cap add android` (usar el id real de la cuenta de
  Play; aquí va un ejemplo). La app carga **el sitio en vivo** (`server.url = https://evie-crm-v2.pages.dev`) para que
  la cookie HttpOnly, el `Origin` y las actualizaciones del service worker funcionen igual que en el navegador.
  - Alternativa más simple: **TWA** (Trusted Web Activity) con Bubblewrap; misma PWA, sin código nativo, pero sin
    widgets ni Health Connect.
- `EVIE_PUBLIC_ORIGIN` ya valida el `Origin`; no se necesita CORS adicional si se usa `server.url`.
- Nunca incluir llaves (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_*`, `FISH_*`, Supabase service) en el APK.

## 2. Avisos que funcionan con la app cerrada (lo que hoy no puede la web)
- **«Sal ahora»** y **«Ivi te avisa»** (check-in ~30 min antes) hoy solo avisan con EVIE abierta o en segundo plano.
  En Android: `@capacitor/local-notifications` programa la notificación en el dispositivo al guardar «Mi horario»,
  al crear tareas/exámenes de Escuela y al recalcular el ETA (ruta con tráfico). El texto sale de
  `IviProactive.departureText()` y `EvieBriefing.todayCommitments()` (ya existen en el frontend).
- Recalcular ETA: `@capacitor/background-runner` cada 15 min cerca del compromiso (Android limita la frecuencia).

## 3. Widgets de pantalla de inicio
- Widget nativo (Kotlin, `AppWidgetProvider`) que lee un resumen JSON escrito por la app en `@capacitor/preferences`:
  próximo compromiso + hora de salida, misión (%), seguimientos de SOMA de hoy, tarjetas de Escuela pendientes,
  recuperación (músculos listos). El frontend ya calcula todo eso: `EvieMission.plan()`, `EvieSchool.summary()`,
  `IviProactive.nudges()`, `EvieFisico.recovery()`.
- Botón del widget «Hablar con Ivi» → abre la app en `#inicio` con el micrófono (mismo flujo que el atajo de escritorio).

## 4. Compartir hacia EVIE (share sheet)
- `intent-filter` `ACTION_SEND` (texto, enlaces, imágenes). La app recibe el contenido y lo manda al «Subir» de EVIE
  o al Chat de Ivi como borrador **editable** (nunca se guarda ni se envía solo). Enlaces → Radar/Chat; imágenes →
  `data/media` (límite 10 MB, solo webp/png/jpeg, igual que la web).

## 5. Health Connect (pasos y sueño)
- Permisos `READ_STEPS` y `READ_SLEEP` pedidos de forma explícita y revocables. Se leen agregados diarios (pasos,
  horas de sueño) y se guardan como `metrics` del usuario (colección existente) para el briefing, la recuperación y
  la Revisión del domingo. Nunca se suben datos crudos de salud a la IA; solo totales con permiso.

## 6. Voz
- Igual que la web: STT por `/api/ai/stt` (Groq; ahora acepta `X-Evie-Lang: en` para el Dojo en inglés) y TTS por
  `/api/ai/tts` (Fish Audio). Palabra clave opcional y en el dispositivo (ver `ANDROID-CONTRACT.md`).

## 7. Pruebas sugeridas cuando exista el proyecto Android
- Emulador API 34 con Play Services: inicio de sesión, sincronización entre web y Android (sello `data/stamp`),
  notificación local programada, widget actualizado tras un aporte a la Misión, compartir un enlace al Chat.
- Revisar que la app no tenga llaves embebidas: `apkanalyzer` + búsqueda de `sk-`/`gsk_`.
