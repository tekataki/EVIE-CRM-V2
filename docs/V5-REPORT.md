# EVIE CRM V2 — Informe de entrega v5

Fecha: 2026-10-25 · Rama `main` · Actualización 2026-11-21: **desplegado y en GitHub `main`** (commit 4cec587); D1 0008 aplicada en remoto (tablas v5 presentes).
La parte visual es mínima a propósito: el rediseño es de Sonnet (`docs/HANDOFF-SONNET-v5.md`).

## Verificación

| Prueba | Resultado | Evidencia |
|---|---|---|
| Unitarias + integración (`npm run test:desktop`, PM2 detenido) | **343 / 343** | `evidence/v5-unit.txt` |
| Build (vite + shell) | OK, `_worker.js` 214 kB (72 kB gzip) | — |
| Regresión E2E (Playwright, una suite a la vez) | **14 / 14** (13 heredadas + `v5guest`) | `evidence/v5-regression.txt` |
| Privacidad de `dist/` | OK (se quitó un nombre personal de un comentario heredado de v4) | `npm run test:privacy` |
| Migración D1 0008 en local | aplicada | `wrangler d1 migrations apply --local` |

Kisha: su E2E pasó sus 20 comprobaciones, pero el primer intento capturó 2 errores de página por una carrera que ya
existía (un cambio de fase de la voz llegaba después de salir de la vista). Se corrigió con un guard de una línea en
`kisha-view.js`, sin cambios visuales ni de comportamiento; las 2 re-ejecuciones salieron limpias.

**Sin verificar en este entorno** (hacen falta claves y staging): latencias reales de OpenAI, Groq, Fish y Stadia;
borrado real de usuarios y Storage en Supabase (probado con dobles HTTP); OAuth de Google de punta a punta;
micrófono físico y dictado real de más de un minuto (el ensamblado en español de más de 1 min sí está probado con texto).

## Qué se hizo, por área

| # | Área | Servidor | Cliente | Pruebas |
|---|---|---|---|---|
| 0 | Base, latencia, costos | `evie_metrics` (histogramas sin contenido), `Server-Timing`, costo en micro-USD, topes $0.40 por cuenta y $1 global al día | métricas por etapa (`/ai/metrics`) | tiers |
| 1 | Niveles de IA | `ai_reasoning_tier` por cuenta, `/ai/tier`, voz persistente o una vez, metadatos, fallback avisado, sugiere Profundo sin forzarlo | pestaña «Nivel de IA», casilla «solo la siguiente pregunta», nota de fallback | v5-tiers, controller |
| 2 | Escenas | registro tipado, CRUD, límites, reservadas, conflictos, ambigüedad, `run_id` idempotente, resultado por paso, 403 a invitados | ejecución de pasos de UI, «Ivi, modo SOMA», pestaña Escenas | tasks-scenes, controller, v5guest |
| 3 | Rutas por voz | `/map/route-query`: sección, tarjeta o ruta; desambiguación; ubicación con permiso; aviso honesto de tráfico; sin guardar direcciones | respuesta por voz y panel con candidatos | plan-map |
| 4 | Seguridad e invitados 72 h | tipo de invitación, canje, caducidad en cada petición y antes de cada refresh, limpieza reintentable, revocar, sin escalada, caché TTS y límites STT corregidos | «Entrar con invitación», banner, sin onboarding redundante | guests, v5guest |
| 5 | Tareas SOMA | `evie_tasks` canónico, CRUD, find, `op_id` | Pendientes sin doble conteo, voz para crear, completar, reabrir y listar | tasks-scenes, pendientes, controller |
| 6 | Preparar mi día | propuesta sellada, eventos fijos como restricción, avisos, aprobación explícita, idempotente por ítem, `/plan/next`, nunca Google Calendar | pestaña «Mi día» con aprobación | plan-map, controller, v5guest |
| 7 | Memoria v2 | tipos, procedencia, proyecto, confianza, sensibilidad, historial, búsqueda híbrida con incertidumbre, exportación, incógnito | pestaña Memoria; voz «¿te acuerdas…?» y «corrige» | memory |
| 8 | Dictado largo | STT ≤ 90 s por fragmento, `X-Evie-Chunk`, 413 si es más largo | `evie-dictation.js`: solapes, orden, deduplicación, reintentos, huecos, texto editable, aviso de alto impacto | client-core |
| 9 | Palabra clave | — | apagada por defecto, `wakeGate` de un turno, sin auto-disparo; Electron: atajo y consentimiento existentes; contrato Android | client-core |
| 10 | Ciclo de vida | `request_id` de extremo a extremo | `evie:lifecycle` sin contenido; sonido de «pensando» acotado y desactivable | client-core, controller |

## Limitaciones conocidas (honestas)
* La tarjeta del mapa todavía **no dibuja** la ruta de `/map/route-query`: la ruta se dice y se lista en el panel.
* El recordatorio por voz y el borrado («olvida…») usan los flujos de memoria v4. La UI v5 de memoria corrige y
  exporta; el borrado se hace desde la vista de Memoria existente.
* «Reorganiza mi día» crea una propuesta nueva; no hay edición por arrastre (el servidor ya acepta `edits`).
* Android: solo contrato, sin app.
* El barrido de invitados es perezoso (~5 % de las peticiones); hosted no tiene cron. El dueño puede forzarlo con
  `POST /api/auth/guest/cleanup`.

## Pasos manuales para desplegar
Ver `docs/BACKEND-v5.md` → «Orden de despliegue» y «Rotación de secretos», y luego `docs/SMOKE-v5.md`.
En resumen: exportar D1 y Supabase → aplicar la migración 0008 en remoto → desplegar → prueba de humo.
Para revertir: volver al despliegue anterior; el esquema solo con `0008_v5_backend_down.sql` si es imprescindible.

## Archivos v5
Nuevos en servidor: `src/{v5-schema,tiers,guests,planner,scenes,map-query,v5-routes,memory-v2}.js`, migración y rollback 0008.
Nuevos en cliente: `public/{evie-v5-core,evie-v5,evie-dictation}.js`, `public/evie-v5.css`.
Modificados: `src/{assistant,accounts,google-auth,map}.js`, `public/{evie-assistant,evie-pendientes,account-core,account-ui,evie-v3-views,kisha-view,evie-actions,index}.*`.
Pruebas: `tests/v5-*.test.cjs` (8 archivos + fixture), `tools/e2e-v5guest.mjs`. Docs: `BACKEND-v5`, `SMOKE-v5`, `ANDROID-CONTRACT`, `HANDOFF-SONNET-v5`, este informe.
