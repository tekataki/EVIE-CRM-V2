# Handoff a Sonnet (frontend v5)

El backend v5 y el cableado funcional del cliente están hechos. **La parte visual es deliberadamente mínima**; tu
trabajo es diseñarla sin romper contratos. No cambies `src/` salvo bugs reales; no toques Kisha (visual ni
comportamiento) ni los datos de las cuentas existentes.

## Puntos de entrada actuales (feos a propósito)
| Elemento | Archivo | Selectores / API |
|---|---|---|
| Panel v5 (pestañas Nivel IA, Mi día, Tareas, Escenas, Memoria, Ruta) | `public/evie-v5.js` | `#v5-panel`, `.v5-tabs [data-v5-tab]`, `.v5-body`; `EvieV5.openPanel(tab?)`, `closePanel()`; atajo Alt+Shift+I |
| Botones en Ajustes de EVIE | `public/evie-v3-views.js` | `[data-v5-open]`, `[data-v5-dictate]`, `[data-v5-cue]` |
| Dictado largo | `public/evie-dictation.js` | `#evie-dictation`, `#dict-status`, `#dict-text`, `#dict-warn`, `#dict-send` |
| Login invitado | `public/account-ui.js` | `#auth-guest` (details), `#guest-form`, `.guest-submit` |
| Banner invitado | `public/evie-v5.js` | `.v5-guest` dentro del panel (falta un banner global; ver abajo) |

`public/evie-v5.css` solo da la capa funcional (overlay por encima de la navegación, 390 px). Rediséñalo libremente.

## Contratos que debes conservar
* `EvieV5.handle(text)` se llama en `EvieAssistant.ask()` **antes** de `tryLocal`; devuelve `{text,spoken}` o `null`.
* Eventos DOM: `evie:lifecycle` (`{request_id, stage, at_ms, tool?, tier?, code?}`), `evie:tier` (metadatos del nivel).
  `document.documentElement.dataset.evieStage` refleja la etapa: úsalo para animar el orbe (pensando/buscando/herramienta).
* Nivel de IA ≠ modo de trabajo. Etiquetas: «Chispa», «Enfoque», «Profundo» (nivel) vs. insignia de modo «Enfoque».
  En la UI escribe «Nivel de IA» siempre que muestres el nivel para evitar confusión.
* «Solo para mi siguiente pregunta» → `onceTier` (se consume en el siguiente `/ai/chat`).
* Plan: nunca guardes sin botón explícito «Aprobar y guardar». Muestra «(duración estimada)», eventos fijos y avisos.
  Texto obligatorio: no se escribe en Google Calendar.
* Dictado: la transcripción siempre editable antes de enviar; aviso de alto impacto visible.
* Escenas: ocultas para invitados (el servidor responde 403 de todos modos).
* Sonido de «pensando»: acotado (máx. 20 s); respeta silencio y `prefers-reduced-motion`.

## Pendiente de diseño (sugerido)
1. Control de nivel de IA compacto junto al orbe (3 chips) + aviso cuando hay `tier_fallback` o `suggest_tier`.
2. Banner global de invitado con horas restantes (`EvieAccounts.current().expires_at`).
3. Vista «Mi día» como línea de tiempo (slots con `start/end`, fijos bloqueados, arrastrar para `edits` — el
   servidor ya acepta `edits[item_id] = {start, duration_min}` en `/plan/:id/apply`).
4. Editor de escenas con selects por acción (hoy es texto «acción valor» por línea).
5. Memoria: lista por tipo/proyecto con historial (`GET /memory-v2/items/:id/history`) y borrado (usa el borrado existente
   de `evie-memory-view.js`).
6. Ruta: candidatos como lista accesible. La tarjeta del mapa (`evie-map.js`) **todavía no dibuja** la ruta de
   `/map/route-query` (`trip.legs[].shape` codificado de Valhalla): falta conectarla (hoy la ruta solo se dice y se lista en el panel).
7. Indicador de micrófono del dictado y del wake word (Electron ya muestra consentimiento; falta indicador en la UI web).

## Pruebas a mantener verdes
`npm run test:desktop` (con PM2 detenido) y `tools/regress-v4.sh`. Tests de cliente v5:
`tests/v5-client-core.test.cjs`, `tests/v5-client-controller.test.cjs`, `tests/v5-pendientes.test.cjs`.
