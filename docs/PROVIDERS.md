# Proveedores (revisado 2026-10-11)
- **OpenAI** Responses API `POST https://api.openai.com/v1/responses` · herramientas `type:function, strict:true` · `store:false`. Precios: https://developers.openai.com/api/docs/pricing
- **Groq** `POST https://api.groq.com/openai/v1/audio/transcriptions` (transcripción, `language=es`; no se usa `/translations`). https://console.groq.com/docs/model/whisper-large-v3-turbo
- **Fish Audio** `POST https://api.fish.audio/v1/tts` · header `model` · `reference_id` = voz. https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits
- **Google** OAuth 2.0 code + PKCE (S256) · `https://oauth2.googleapis.com/token` · revocar `https://oauth2.googleapis.com/revoke` · Calendar v3 `events.list`.
- **Gmail**: `gmail.readonly` es alcance restringido → verificación + evaluación de seguridad.
- **Spotify**: reproducción requiere Premium, dispositivo activo y app aprobada.
