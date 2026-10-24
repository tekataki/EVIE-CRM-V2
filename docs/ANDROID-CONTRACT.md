# Contrato Android (andamiaje, no implementado)

Estado: **solo contrato**. No existe app Android en este repo. Este documento fija lo que una app nativa/TWA debe
cumplir para reutilizar el backend v5 sin cambios.

## Autenticación
* Misma API `/api/*`. Sesión por cookie HttpOnly + cabecera `X-Evie-User: <uuid>` + `X-Evie-Request: 1` en escrituras.
* En WebView/TWA: el origen debe coincidir con `EVIE_PUBLIC_ORIGIN` (las escrituras validan Origin).
* App nativa (no WebView): requiere un endpoint de tokens dedicado que **no existe todavía**; no usar la clave
  de servicio de Supabase en el dispositivo.

## Voz
* STT: `POST /api/ai/stt` con audio ≤ 90 s por fragmento, `X-Evie-Duration` (s) y `X-Evie-Chunk` (índice) para
  dictado largo. Ensamblado del lado del cliente (misma lógica que `EvieV5Core.assemble`).
* Chat: `POST /api/ai/chat` `{input, context, private, request_id?, tier?}`; respuesta con `calls` para herramientas cliente.
* Ciclo de vida: emitir localmente `request_started → transcribing → thinking → (searching|tool_running) → speaking →
  completed|failed` con el `request_id`; nunca enviar contenido en métricas (`POST /api/ai/metrics` solo números).

## Palabra clave en Android — límites honestos
* Opt-in, apagada por defecto, detección **en el dispositivo** (p. ej. Porcupine/Vosk local). Nunca audio continuo al servidor.
* Android 14+ restringe el micrófono en segundo plano: requiere servicio en primer plano tipo `microphone` con
  notificación persistente visible. Sin ese servicio, la escucha solo funciona con la app abierta.
* Indicador del sistema (punto verde) siempre visible mientras escucha; botón push-to-talk como alternativa.
* Puerta de un turno igual que `wakeGate`: ignorar mientras habla/piensa/escucha y 1.2 s después de hablar.

## Fuera de alcance
* Sin automatización de WhatsApp, Spotify ni otras apps (no hay APIs oficiales para controlarlas de forma segura).
* Sin escritura en Google Calendar.
* Sin invitados creando escenas.
