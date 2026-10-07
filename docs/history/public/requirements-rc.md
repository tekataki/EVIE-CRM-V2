# DALI — Release Candidate Master Implementation Prompt for Genspark / GPT-6 Astra

## Files that must be attached with this prompt

Attach the current project ZIP named `code_sandbox_light_git_b086123a_1789607986.zip` and all fourteen current-state screenshots listed in the screenshot audit below. Treat the ZIP as the source of truth and the screenshots as visual evidence of the current implementation—not as permission to rebuild the product from scratch.

---

## ROLE

You are the lead product engineer, interaction designer, information architect, data-migration engineer, accessibility engineer, and QA owner for an existing personal web application named **DALI**.

Your task is to transform the attached working project into a polished, stable, daily-use release candidate while preserving every verified behavior and every existing user record.

This is an implementation task. Do not stop after writing a plan, producing mockups, or describing what you would build. Inspect the repository, run the existing tests, make the changes in the actual files, run the full verification matrix, and leave the project in a usable state.

## ONE-SENTENCE PRODUCT DEFINITION

DALI is a private, local-first, single-user **personal command-center web app** for Dalí Medina: finances, fitness analytics, objectives, SOMA clients, learning, personal journal, pig farm operations, books, ALVENTO clothing drops, content creation, vision board, JSON import/export, profile, settings, and a new daily agenda—all connected through real data without pretending to be an operating system.

## LANGUAGE, LOCALE, AND USER

- All visible interface copy must be natural Mexican Spanish.
- Code names and technical documentation may remain in English where appropriate.
- Address the owner as “jefe” sparingly and naturally, especially on Home. Never use “wey” in product copy.
- Currency is MXN.
- Calendar timezone is `America/Mexico_City`.
- The persistent header clock uses a 12-hour format with `a. m.` / `p. m.` and the date in Spanish.
- This is a single-user personal app. Do not add teams, organizations, roles, subscriptions, enterprise permissions, fake users, or a multi-tenant architecture.

---

# 1. NON-NEGOTIABLE RULES

## 1.1 Evolve the existing application; do not replace it

1. Open and inspect the attached ZIP before editing anything.
2. Preserve the existing static architecture: HTML, CSS, and modular Vanilla JavaScript.
3. Do **not** migrate the project to React, Vue, Angular, Svelte, Next.js, Vite, TypeScript, NPM, or any build system.
4. Do not create a parallel demo, a second application, a disconnected prototype, or a fake operating system.
5. Use the existing app shell, routes, state store, domain modules, form system, importer, media store, and test harness as the foundation.
6. Add focused modules/files when separation is useful; do not turn `views.js`, `app.js`, or one CSS file into a new monolith.
7. Preserve all current routes and deep links. Add only the new `#agenda` route requested below.
8. Preserve the existing storage key exactly: `localStorage['dali-os-local-v1']`.
9. Preserve IndexedDB media storage and `media_id` references. Never put image base64 strings into localStorage.
10. Preserve unknown fields during normalization and migration.

## 1.2 Data integrity is more important than visual polish

- Before the first schema-changing write, create a recoverable pre-v4 backup named `dali-os-local-v1-pre-v4` without overwriting older backups.
- Migrate state from version 3 to version 4 on a deep copy, validate the complete result, and replace live state only after validation succeeds.
- The v3→v4 migration must be deterministic, idempotent, and safe to run after an interruption.
- Never delete or silently reinterpret existing transactions, payments, clients, sessions, journal records, animals, reproductive events, health records, feed inventory, books, drops, products, content, vision items, media, import batches, preferences, or profile fields.
- Existing money remains integer cents internally. Existing feed `_cents` values remain cents and `_g` values remain integer grams; never convert them twice.
- Never seed personal records, fake statistics, fake alerts, example animals, invented sales, invented moods, invented workouts, or invented history into the real store.
- All empty-state metrics must display a truthful zero, an em dash, or “Sin datos suficientes”.
- All destructive actions require explicit confirmation and must remain recoverable where the current application already supports recovery.

## 1.3 Preserve verified behavior

The attached baseline reports **77 passing tests and 0 failures**. Run the complete existing suite before changes and record the result. After implementation:

- all 77 existing tests must still pass;
- no existing assertion may be weakened, skipped, deleted, or rewritten merely to make the suite green;
- add focused tests for the new schema, journal JSON, agenda, entity links, theme-aware orb, urgency rules, nutrition/pantry, context export, responsive interactions, and cleanup;
- the final result must have zero known test failures and zero uncaught console errors.

## 1.4 Keep deployment and external services out of this phase

- Do not deploy the app.
- Do not ask whether to use Genspark hosting, Cloudflare, or another host.
- Do not connect Supabase yet.
- Do not add authentication theater or a JavaScript-only “security” screen.
- Do not put secrets, service-role keys, tokens, or OAuth credentials in frontend code.
- You may document clean future adapter boundaries for Supabase and Google Calendar, but they must be visibly marked “No conectado” and must not claim to work.
- ChatGPT remains external in this phase. DALI exchanges reviewed JSON through copy, paste, upload, and download; there is no hidden AI API.

## 1.5 Product honesty

- Never claim an integration exists when it is only a link. The existing WhatsApp action is a `wa.me`/WhatsApp link, not the WhatsApp Business API.
- Never claim Symmetry is connected. Workout data is imported from user-provided JSON.
- Never call a forecast an actual purchase or an actual consumption record.
- Never call a reflective emotional estimate a diagnosis, biometric measurement, psychological assessment, or therapy result.
- Never say the release is complete unless the code, migrations, tests, and visual QA in this prompt are actually complete.

---

# 2. CURRENT BASELINE YOU MUST RESPECT

The repository is a static Vanilla application with no compilation step. Important existing files include:

- `index.html`, `config.js`, `domain.js`, `store.js`, `migrations.js`, `records.js`, `forms.js`, `views.js`, `app.js`
- `v2-domain.js`, `v2-views.js`, `v2-app.js`, `v2.css`
- `media-store.js`, `importer.js`, `recurrence.js`
- `farm-domain.js` and the existing farm/feed modules
- `neural-core.js`, `neural-signals.js`, `neural-home.js`, `neural-forms.js`, `neural-farm.js`, `neural-milestones.js`, `neural-care.js` and their CSS files
- `schemas/`, `samples/`, `tests.html`, `tests*.js`
- living documentation such as `README.md`, `DESIGN_SYSTEM.md`, `MIGRATION_REPORT.md`, `TEST_REPORT.md`, `CHANGELOG_DALI_V4.md`, and `ASSET_INVENTORY.md`

Existing CDN dependencies include Tailwind Browser, Lucide, JSZip, and Google Fonts. CSS already provides important fallbacks. Add dependencies only when they materially improve the result and have a graceful fallback.

Existing verified capabilities that must remain intact include:

- finances in cents, numeric keypad, periods, categories, bills, loans, payments, reversals, trash, CSV, and print;
- SOMA client records, deliverables, installments, linked payments, notes, and WhatsApp links;
- safe JSON import with local validation, preview without writes, confirmation, atomic commit, deduplication, history, and guarded undo;
- gym session JSON imports, 7/28/90-day analytics, body map, body metrics, and imported ranks;
- pig-specific farm lifecycle, audited events, health, litters, tasks, feed catalog, feed rules, integer grams, FIFO inventory, opening stock, purchases, consumption, waste, and forecast;
- learning routes, evidence, study time, weighted progress, and final-project requirement;
- books, ALVENTO, content, vision board, local photos, profile, JSON/ZIP backup, complete ZIP restore, and downloadable source ZIP;
- light/dark themes, global clock, mobile drawer, desktop sidebar, and five mobile shortcuts.

---

# 3. SCREENSHOT AUDIT AND REQUIRED RESPONSE

Inspect every attached screenshot at full resolution and compare it with the rendered app. The following observations are requirements, not optional commentary.

| Screenshot | Current view | What must improve |
|---|---|---|
| `ee3f8b45-90e4-4018-a07e-db1a918812ef.png` | Home, light theme | The shell is light but the hero remains a hardcoded navy island; the orb is visually too small and not interactive. Make the hero genuinely theme-aware, enlarge the DALI Core, and improve information density without clutter. |
| `5c6b8fa4-b7e5-44b8-9d9a-075e2ca429b4.png` | Finance | Preserve the strong banking card and actions. Add truthful sparklines/trend context, richer success feedback, and more intentional empty/low-data states. |
| `1c70527c-0455-441e-b383-564743d04a61.png` | Gym | The zero-session state is a very large empty rectangle. Replace it with a compact, useful onboarding/state view and add the requested nutrition and pantry system without turning DALI into a workout-planning app. |
| `6c2b5508-5e50-493e-b742-f8dfb4a46163.png` | Objectives | Keep the horizons and CRUD behavior, but replace the generic empty canvas with progress rings, recurring-goal clarity, next action, and agenda links based only on real goals. |
| `b65b4e54-a002-4dc4-bd28-fa229c7f7de4.png` | SOMA | Preserve Intensity and all client/payment logic. Add a compact pipeline, next follow-up, payment timeline, and the separate editable SOMA monthly sales target of $15,000 MXN. |
| `7898c5a4-d748-4338-be3d-5ea04d8940db.png` | Learning | Preserve the skill cards and route model. Add a visual route/constellation, next mission, evidence states, and refined progression motion. |
| `2971ed0e-81fe-4f69-a369-e1065bbf44d5.png` | Personal journal | This is the primary functional redesign. Merge the existing journal with Personal Statistics, daily ChatGPT JSON import, emotional trends, calendar, patterns, and day detail as specified below. |
| `dea87ab2-60cc-4227-9e65-7126a9c72296.png` | Books | Replace the oversized empty card with a tactile shelf/grid, cover upload, reading progress, review, learning, and wishlist experience while preserving existing fields. |
| `d150a901-8314-411c-96c4-02837d9b262a.png` | ALVENTO | The dark hero remains dark in light mode. Make the brand area theme-aware, support a real uploaded model/brand image, and expose drop countdown, stock, sales, profit, and milestones without fake numbers. |
| `9fc78519-9c0f-4c14-90a6-8aa550bc1b7f.png` | Content | Replace the oversized blank state with a compact content pipeline for ideas, scripting, recording, editing, publishing, scenes, platforms, series, cadence, and real result snapshots. |
| `c4eb0787-c519-4dab-b1b4-33018c1494e6.png` | Vision Board | Create a visually motivating masonry/cinematic layout, beautiful media upload, focus mode, linked savings/goal progress, and respectful motion. |
| `9bf5ed1f-9444-4bc0-ba3a-dd434de39b2c.png` | Upload | Keep the strong two-column JSON editor, preview, history, atomic confirmation, and undo. Polish it into a clear stepper with drag/drop, schema chips, validation transitions, and excellent mobile behavior. Never auto-apply JSON. |
| `ed8b832a-def2-4bea-90c5-9c9b4cdf3ebe.png` | Profile | Preserve the dense, useful structure. Improve photo presentation, personal pulse, privacy explanation, and motion without making the page decorative or longer than necessary. |
| `6cbc1efb-f6e5-470d-b165-a6c5bf89db4f.png` | Settings | Preserve every backup, restore, export, preference, and destructive action. Organize them as a calm “data vault,” add schema/migration visibility, and make risk levels visually unmistakable. |

Do not treat absent screenshots as permission to ignore a route. Inspect and render every route from the ZIP, including all nine farm subsections and record-detail pages.

---

# 4. VISUAL NORTH STAR

Build an **original personal superhero command center**: precise, calm, cinematic, and premium. It may evoke the confidence of a futuristic suit interface and the ease of a great consumer device, but it must not copy Iron Man, JARVIS, Spider-Man, Apple, iOS, or any copyrighted screen, logo, sound, layout, or asset.

The target balance is:

- futuristic, not military;
- premium, not flashy;
- animated, not distracting;
- information-rich, not dense;
- minimal, not empty;
- personal, not corporate SaaS;
- original, not a franchise imitation;
- effortless, not simplistic.

## 4.1 Design-system requirements

1. Centralize semantic tokens. Components must use tokens rather than hardcoded theme colors.
2. Create paired light/dark tokens for canvas, elevated surfaces, glass surfaces, borders, text, muted text, focus rings, shadows, charts, module accents, orb states, and image overlays.
3. Keep Manrope for expressive headings/figures and DM Sans for body/UI unless the current design system specifies otherwise.
4. Use an 8 px spacing rhythm, consistent radii, a restrained elevation scale, and clear density variants.
5. Maintain module identity through accents—not by forcing an entire page to remain green, blue, purple, or black.
6. In light mode, the Home hero must become a luminous neutral/ice/cobalt surface rather than a dark navy panel. In dark mode it may use deep graphite/navy with controlled glow.
7. In light mode, Farm uses neutral surfaces with sage/forest accents. In dark mode it uses deep graphite with emerald accents. The whole Farm page must not stay bright green.
8. ALVENTO’s hero, the Home hero, charts, overlays, illustrations, and canvases must all react to the theme immediately.
9. Use real whitespace intentionally, but eliminate giant blank cards that communicate nothing.
10. Empty states should be compact illustrated guidance with one primary action and at most one secondary action.

## 4.2 Motion system

Add GSAP 3.x and ScrollTrigger through a pinned CDN version if the environment allows it. Keep a CSS/Web Animations fallback so core UI remains functional if the CDN fails.

Use motion for:

- the DALI Core/orb and its orbital menu;
- subtle ambient particles, orbit traces, gradient breathing, and data pulses;
- page-title and card reveals tied gently to scroll;
- number transitions when real values change;
- sheet/modal transitions;
- segmented-control selection;
- card expansion and drill-down;
- compact success feedback after a real save/import/completion;
- chart drawing and hover/tap focus;
- tasteful image parallax only where it never traps or fights scrolling.

Rules:

- Continuous movement belongs mostly in ambient/hero regions, not behind long forms or tables.
- Do not animate layout properties when transform/opacity is sufficient.
- Kill GSAP timelines, ScrollTriggers, RAF loops, observers, intervals, and pointer listeners when a view is destroyed or rerendered.
- Pause ambient work when the tab is hidden.
- Respect the existing Full/Subtle/Reduced/Pause preferences and `prefers-reduced-motion`.
- Reduced motion must remove orbiting, parallax, counters, and scroll-linked movement without hiding information.
- Never require animation to understand status.
- No sound effects or autoplay media.

## 4.3 Images and visual assets

Use locally stored optimized assets. Do not hotlink random web images. Prefer WebP/AVIF with responsive dimensions and gradient overlays. When the owner has uploaded a real brand, book, vision, farm, or profile image, use that image. Never invent Dalí’s face, ALVENTO products, clients, pigs, books read, or achievements.

If an image generator is available, generate only abstract/editorial supporting art and save it locally. If it is unavailable, create original lightweight SVG/CSS artwork and retain media upload controls. Suggested generation briefs appear later in this prompt.

---

# 5. GLOBAL SHELL AND RESPONSIVE BEHAVIOR

## 5.1 Header

- Display a live, large but balanced 12-hour clock on every route using `Intl.DateTimeFormat` with `America/Mexico_City`; do not rely blindly on the device timezone.
- Show the full Spanish date below or beside it based on width.
- Keep only one clock interval across rerenders.
- Preserve search, theme, notifications, and profile actions.
- Improve search into a unified command/search experience that can find routes and real records without exposing private content before the user opens it.

## 5.2 Desktop navigation

- Preserve the left sidebar, grouping, scroll behavior, labels, and route state.
- Add only one new top-level destination: **Agenda**.
- Keep “Subir” visually separated under tools and “Mi perfil / Configuración” under account.
- Add refined active-state motion and icon microinteractions, but never move the click target away from the pointer.

## 5.3 Mobile navigation

- Target robust CSS layouts at 360×800, 390×844, 412×915, and 430×932. The Samsung Galaxy S25 Ultra is the primary personal device, but do not hardcode physical pixels or user-agent checks.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- Preserve a compact five-item bottom navigation; let the user configure its shortcuts in Settings instead of adding every module.
- All secondary navigation becomes horizontally scrollable segmented controls or accessible bottom sheets.
- Use bottom sheets for the orb menu and complex quick actions; never depend on hover.
- Minimum touch target: 44×44 CSS px. No horizontal page overflow.

## 5.4 Forms and overlays

- Replace dry, enormous generic forms with progressive-disclosure wizards, button groups, chips, segmented controls, numeric pads, steppers, visual pickers, and optional accordions where they reduce typing.
- Preserve every current field and validation rule even if advanced fields move under “Más detalles”.
- Keep draft values while a sheet is open. Warn before closing a dirty form.
- On desktop use a centered modal or contextual side sheet; on mobile use a full-height or near-full-height bottom sheet.
- Put the primary action in a stable, reachable footer. Disable it with a clear reason when invalid.
- Never save on close, swipe, route change, or validation preview.
- Use inline errors in Spanish and move focus to the first invalid field.

---

# 6. THE DALI CORE — LARGE INTERACTIVE ORB

The Home orb becomes the application’s living status control. It is named **DALI Core** in code and accessibility text; visible copy can remain minimal.

## 6.1 Scale and composition

- Increase its visual size to approximately `clamp(22rem, 34vw, 34rem)` on wide desktop and `clamp(13.5rem, 70vw, 18rem)` on mobile, adjusted so it never obscures greeting copy or causes overflow.
- Preserve the current original spherical language but significantly refine depth, refraction, rim light, particles, data arcs, concentric rings, and subtle pointer response.
- Use Canvas/SVG/CSS as appropriate. A WebGL layer is allowed only if it has a reliable Canvas/CSS fallback and no lifecycle leaks.
- Read theme colors from CSS custom properties. Remove hardcoded canvas colors. On theme change, recompute the palette and redraw without a reload.

## 6.2 It must be a real control

The orb is currently decorative/`aria-hidden`. Replace that behavior with a semantic button/control:

- visible focus ring;
- descriptive accessible name including current state;
- keyboard activation with Enter/Space;
- Escape closes the menu and returns focus;
- a focus trap inside the opened menu/sheet;
- no hover-only actions;
- color is never the only signal.

On desktop, click opens a restrained orbital/radial menu anchored to the orb. On mobile, tap opens a polished bottom sheet. Menu actions:

1. **Mi siguiente acción**
2. **Capturar pendiente**
3. **Agenda de hoy**
4. **Alertas**
5. **Ventas del mes**
6. **Modo enfoque**

Each item shows a truthful count or summary only when data exists. A second click or Escape closes it. Pointer movement may create a subtle local response, but the orb must remain calm without a pointer.

## 6.3 State colors and meaning

Use four visual states with an adjacent text/icon label:

| State | Color family | Meaning |
|---|---|---|
| `stable` | blue/cyan | No urgent real item; normal operations. |
| `attention` | amber/gold | At least one important item needs attention soon or progress is meaningfully behind pace. |
| `urgent` | red/coral | A confirmed high-priority item is overdue or requires action today. |
| `completePulse` | emerald pulse over the underlying state | A brief, nonpersistent acknowledgment after a real meaningful completion. |

The worst active severity wins, but the opened panel must explain the top three causes and link to each source. Do not sum unrelated arbitrary points into an unexplained score.

## 6.4 Deterministic status engine

Implement and test a pure status selector. It should consume normalized signals and return `{ level, reasons, nextAction, computedAt }`.

Default rules, configurable in Settings:

- `urgent`: a high-priority agenda item is overdue or due within 24 hours; a confirmed payment is overdue; a user-marked urgent health follow-up is open; a farm due window reaches the configured “today” threshold while a required preparation task remains incomplete.
- `attention`: an important item is due within 72 hours; more than the configured number of medium-priority items are overdue; a farm estimated window is approaching; monthly SOMA sales pace is behind the configured threshold.
- `stable`: no urgent/attention condition is true.

Farm dates are estimates unless backed by a confirmed recorded event. Display “estimado” and never change an animal’s reproductive state from an alert.

For SOMA, create a separate editable goal named **Meta mensual de ventas SOMA** initialized to `$15,000 MXN`. Do not overwrite the existing personal “meta neta mensual” of `$33,000`. Track collected, contracted, and pipeline amounts separately. The default pace logic may flag attention after day 10 when collected plus weighted pipeline is more than 15% behind elapsed-month pace, and urgent in the final seven days when the remaining gap is over 25% with insufficient pipeline. Make thresholds editable and explain the calculation.

Do not use emotional-journal data to turn the orb red. Personal emotions may provide a gentle private reflection card, never an alarm or psychological risk score.

---

# 7. PERSONAL JOURNAL + PERSONAL STATISTICS REDESIGN

Keep the sidebar destination named **Bitácora personal**. Do not create a redundant top-level “Estadísticas personales” route. Inside Bitácora, add these views:

1. **Hoy** — create/review today’s entry;
2. **Estadísticas personales** — trends and distributions;
3. **Calendario emocional** — days with confirmed entries;
4. **Patrones y revisión** — cautious, evidence-limited observations;
5. **Archivo** — searchable day history.

## 7.1 Intended workflow

Dalí will maintain a separate ChatGPT conversation called “Agenda diaria para CRM”. At the end of the day he will describe what happened, how he felt, his wins, difficulties, and pending actions in voice or text. ChatGPT will return one JSON document. In DALI he will paste or upload the JSON, validate it, inspect a human-readable preview, edit any inferred value, explicitly confirm, and then commit it atomically.

There is no direct ChatGPT connection in this release.

## 7.2 New dedicated JSON format

Add `dali.journal.entry` version `1.0` as a fourth accepted import adapter. Normalize it into the existing atomic import engine rather than creating a second unsafe import path. Add:

- `schemas/dali.journal.entry.schema.json`
- `samples/journal-entry-example.json`
- downloadable schema and example links inside Bitácora and Subir;
- clear field-level validation and a human-readable preview;
- stable deduplication based on date, source, and source-entry identifier;
- `merge`, `replace after confirmation`, and `cancel` behavior;
- guarded undo through the existing import-batch system.

Use this exact conceptual structure and enforce strict enums/ranges. The sample must be valid JSON with no comments:

```json
{
  "format": "dali.journal.entry",
  "schema_version": "1.0",
  "import_id": "a3c12075-5392-4f5d-af5b-5cba8e5af12d",
  "timezone": "America/Mexico_City",
  "source": {
    "type": "chatgpt_daily_reflection",
    "label": "Agenda diaria para CRM"
  },
  "entry": {
    "source_entry_id": "2026-09-17-daily-reflection",
    "date": "2026-09-17",
    "title": "Un día de avance con algo de cansancio",
    "raw_narrative": null,
    "summary": "Resumen breve y fiel, sin inventar hechos.",
    "highlights": ["Logro confirmado por el usuario"],
    "difficulties": ["Dificultad confirmada por el usuario"],
    "learnings": ["Aprendizaje expresado o claramente derivado"],
    "events": [
      {
        "area": "personal",
        "title": "Evento real mencionado",
        "sentiment": "mixed",
        "linked_entity_hint": null
      }
    ],
    "emotions": [
      {
        "key": "alegria",
        "label": "Alegría",
        "intensity": 60,
        "basis": "mixed",
        "confidence": 0.72,
        "evidence": "Paráfrasis breve de la razón, nunca una cita inventada."
      },
      {
        "key": "tristeza",
        "label": "Tristeza",
        "intensity": 15,
        "basis": "inferred",
        "confidence": 0.45,
        "evidence": "Inferencia tentativa que requiere revisión."
      },
      {
        "key": "enojo",
        "label": "Enojo",
        "intensity": 10,
        "basis": "reported",
        "confidence": 0.9,
        "evidence": "El usuario lo expresó directamente."
      }
    ],
    "indicators": {
      "energy": { "value": 55, "basis": "reported", "confidence": 0.9 },
      "stress": { "value": 35, "basis": "mixed", "confidence": 0.65 },
      "productivity": { "value": 70, "basis": "reported", "confidence": 0.9 },
      "social_connection": { "value": 65, "basis": "inferred", "confidence": 0.55 }
    },
    "next_actions": [
      {
        "title": "Acción sugerida a partir de lo hablado",
        "suggested_module": "agenda",
        "due_hint": "tomorrow",
        "duration_minutes": 30,
        "priority": "medium",
        "needs_confirmation": true
      }
    ],
    "tags": ["día productivo"],
    "assistant_note": "Reflexión orientativa basada solo en el texto compartido; no es diagnóstico.",
    "review_required": true,
    "confirmed_by_user": false
  }
}
```

Rules:

- `intensity` and indicator values are integers from 0 to 100.
- Emotion intensities are **independent**, may coexist, and do not need to sum to 100.
- `basis` is `reported`, `inferred`, or `mixed`.
- `confidence` is 0–1 and describes confidence in faithful extraction, not confidence in a diagnosis.
- An inferred value must be visually labeled “Inferido” and editable before commit.
- `raw_narrative` is optional. Provide a privacy toggle allowing the user to omit it while retaining the structured reflection.
- Unknown information is `null` or omitted; never fill a value merely to complete a chart.
- `next_actions` never create agenda items automatically. The preview offers checkboxes, off by default, for actions the user wants to create.
- Do not implement hidden suicide-risk, personality, deception, or mental-illness scoring.
- Do not analyze voice biometrics. Only process the transcript the user supplies outside DALI.

## 7.3 Embedded “copy instructions” button

Inside Bitácora, add a button labeled **Copiar instrucciones para mi charla diaria**. It must copy the following Spanish template exactly or with only schema-maintenance changes:

```text
Quiero cerrar mi día y convertir esta conversación en una entrada para mi CRM DALI. Primero escúchame y hazme preguntas breves solo si falta algo importante. Cuando yo diga “genera mi JSON”, devuelve únicamente un JSON válido con formato dali.journal.entry y schema_version 1.0; no uses Markdown ni texto fuera del JSON.

Resume con fidelidad lo que yo sí dije. Separa hechos, logros, dificultades, aprendizajes y próximos pasos. Puedes proponer intensidades de emociones e indicadores de 0 a 100, pero marca cada valor como reported, inferred o mixed y agrega una confianza de 0 a 1. Las emociones son intensidades independientes: no tienen que sumar 100. Si algo no se sabe, usa null o no lo incluyas. No inventes citas, recuerdos, diagnósticos, traumas, intenciones ni causas.

Incluye alegría, tristeza y enojo cuando exista evidencia, y agrega otras emociones solo si realmente aportan. Cualquier inferencia debe sonar tentativa y quedar marcada para revisión. Esto es una reflexión personal, no terapia, diagnóstico ni evaluación clínica.

Los próximos pasos deben incluir suggested_module, due_hint, duration_minutes, priority y needs_confirmation:true. No des por hecho que se crearán automáticamente. Usa la zona horaria America/Mexico_City y la fecha local correcta. El resultado debe pasar el esquema descargable de DALI.
```

Also add **Copiar esquema**, **Descargar ejemplo**, and **Ir a Subir**.

## 7.4 Journal UX and charts

- Today view: a warm editorial summary, editable emotion chips/sliders, wins, difficulties, learning, next action, tags, and source/confidence labels.
- Single-day visualization: independent horizontal intensity bars or a radar chart with a fully accessible table. Do not present a pie chart by default because the values are not a forced whole.
- Optional “Mezcla relativa” view may normalize present emotions to 100%, but it must be labeled as a derived relative view.
- Trend view: smooth lines/sparklines for 7/30/90 days, filterable by emotion/indicator. Show gaps for missing days; never interpolate unrecorded dates as real observations.
- Calendar: color intensity plus a text/icon marker; clicking a day opens that day’s record.
- Personal statistics: entry count, days recorded, selected averages, range, and sample size `n`.
- Do not generate a trend claim with fewer than 3 entries. Display “Aún no hay suficientes registros para una tendencia”.
- Do not show a cross-module association until there are at least 14 relevant confirmed records. Label every such result “Asociación observada; no demuestra causa”.
- Allow the user to turn cross-module comparisons off.
- Add date-range export for journal data and a privacy-safe export that omits raw narrative and evidence.
- Keep manual text/voice entry. Preserve the explicit browser speech-provider privacy notice; DALI must never claim to store audio.

## 7.5 Sensitive-data presentation

Place a short persistent note: **“Tus registros son reflexiones personales almacenadas localmente; no son diagnóstico ni sustituyen apoyo profesional.”** Do not add alarming clinical language to normal entries.

---

# 8. NEW AGENDA MODULE — THE ONLY NEW TOP-LEVEL SECTION

Add **Agenda** as one new sidebar route, `#agenda`. Do not add three or four extra sidebar modules. Nutrition belongs inside Gym, Personal Statistics inside Bitácora, and context export inside Subir/Settings.

## 8.1 Agenda purpose

Agenda is the operational bridge between objectives and daily action. It combines:

- Inbox;
- Today;
- Week;
- Calendar;
- Focus mode;
- completed/archive.

It accepts fast manual capture and reviewed JSON operations from the existing Upload system.

## 8.2 Data model

Add `agendaItems` with validated records such as:

- `id`, `kind` (`task`, `event`, `time_block`, `reminder`)
- `title`, `notes`, `status`
- `priority` (`low`, `medium`, `high`)
- `area` (`personal`, `school`, `soma`, `farm`, `finance`, `gym`, `learning`, `alvento`, `content`, `other`)
- `start_at`, `due_at`, `all_day`, `duration_minutes`
- recurrence using the existing recurrence vocabulary and `America/Mexico_City`
- `energy` (`low`, `medium`, `high`) and optional context
- `linked_entity_ids` or normalized `entityLinks`
- `source`, `created_at`, `updated_at`, `completed_at`

Unknown duration must remain unknown. Suggested scheduling must be previewed and confirmed; DALI must not silently reschedule the user’s life.

## 8.3 Agenda UX

- Quick-capture sheet with natural categories, date/time chips, duration chips, recurrence, priority, and “Vincular con…” search.
- Today timeline with current-time marker, overdue group, unscheduled inbox, and three suggested next actions.
- Week view that works on mobile without a compressed seven-column desktop calendar; use day cards/rail on small screens.
- Focus mode with one task, timer optional, related context, and a clear exit.
- Drag/drop may enhance desktop, but every move must also have accessible buttons and keyboard support.
- Completion creates a subtle real success pulse and updates linked objective progress only when a deterministic confirmed rule exists.

## 8.4 Calendar interoperability without a fake API

For this local release:

- export selected events/tasks as a valid `.ics` file;
- allow download/open for import into Google Calendar;
- optionally provide an “Abrir en Google Calendar” URL for one event;
- show future two-way Google Calendar sync as **No conectado** in Settings, with no fake button that claims success;
- document that real two-way sync later requires Google OAuth, Calendar API scopes, secure token storage, and a backend/serverless layer.

---

# 9. SCHEMA VERSION 4 AND CROSS-MODULE LINKS

## 9.1 New/extended state

Move app state to version 4 and add only what is necessary:

- `agendaItems`
- `entityLinks`
- `nutritionDays`
- `pantryItems`
- `groceryRuns` or a similarly normalized lightweight collection
- journal v4 fields on existing entries rather than duplicating all journal data
- preferences for orb thresholds, module accents, configurable mobile shortcuts, journal privacy, and motion
- a separate SOMA monthly revenue target initialized to 1,500,000 cents

Do not rename the existing storage key. Do not discard old `journal` fields. Upgrade old entries by adding safe defaults and a `legacy`/`manual` source where appropriate; do not fabricate emotions from historical free text during migration.

## 9.2 `entityLinks`

Create a simple normalized connection layer instead of hardcoded cross-module side effects. A link stores source entity, target entity, relation type, creation source, and timestamps. Required relation examples:

- agenda item → objective;
- agenda item → SOMA client/deliverable;
- agenda item → farm task/animal;
- agenda item → content item;
- nutrition target → objective;
- grocery purchase → finance transaction;
- study activity → SOMA capability;
- ALVENTO milestone → agenda item.

Links must never duplicate money, inventory, animal events, or completion state. Deleting a link does not delete either entity. Cascading deletion is forbidden.

## 9.3 Importer extension

Keep `dali.crm.import` at version `2.0` for backward compatibility unless the current importer architecture makes a version bump strictly necessary. Extend allowed module/entity pairs safely for:

- `agenda`: `task`, `event`, `time_block`, `reminder`;
- `gym`: `nutrition_day`, `pantry_item`, `grocery_run`;
- `system`: `entity_link` if this is the cleanest implementation.

Keep preview, strict pair validation, dangerous-key rejection, maximum operation limits, atomic commit, reference resolution, stable dedupe, and guarded undo. Do not execute code from JSON.

---

# 10. GYM: ANALYTICS, NUTRITION, AND PANTRY

DALI is not a routine-execution replacement for Symmetry. Preserve workout imports and analytics; do not restore obsolete Upper/Legs/Chest routine cards.

Use these tabs:

- **Resumen**
- **Sesiones**
- **Mapa corporal**
- **Progreso**
- **Alimentación**
- **Despensa**

## 10.1 Training analytics

- Feature latest session, duration, reported volume, calculated volume, sets, exercises, and completeness.
- Add truthful sparklines for volume, frequency, and selected exercise performance.
- Keep reported and calculated values separate.
- Preserve the front/back body map and muscle list; improve hover/tap/focus states and add a period selector.
- Keep Symmetry-like rank imports as imported data only. Never reverse-engineer or falsely claim official Symmetry ranking logic.
- Turn the zero state into a compact three-step guide: capture Symmetry screenshots externally, convert to the DALI JSON schema, import and review.

## 10.2 Nutrition

Add editable daily targets for calories, protein, carbohydrates, fat, fiber, and sodium. On first use, offer the owner’s stated working targets as an unconfirmed setup suggestion:

- 2,800 kcal
- 150 g protein
- 350 g carbohydrates
- 70 g fat
- 38 g fiber
- 2,300 mg sodium

Require the user to press **Confirmar metas** before treating them as active. Label them personal tracking targets, not medical advice. Allow dates, history, and notes. A completed matching objective may link to the nutrition day, but neither module silently completes the other.

## 10.3 Pantry and shopping

- Pantry item: name, category, unit, quantity, low-stock threshold, preferred amount, estimated days remaining, last restock, usual cadence, optional price, optional photo, notes.
- Generate a reviewable grocery list from low stock and planned restock dates.
- A grocery item may create a finance expense only after a separate amount review and explicit confirmation.
- Show “Próxima reposición” and “Para esta semana,” not false precision when consumption rate is unknown.
- Use attractive food/category chips and useful mobile controls rather than a spreadsheet-like form.

---

# 11. MODULE-BY-MODULE EXPERIENCE UPGRADE

Every module should share DALI’s shell and motion grammar while retaining its own identity. Preserve all current domain logic.

## 11.1 Home

- Build the large interactive DALI Core described above.
- Keep the greeting, stable daily phrase, and real Mexico City clock.
- Under the hero, show **Lo importante, primero** with only actionable real items.
- Add smooth minimal line charts/sparklines—not candlesticks—for selected finance, objectives, workouts, SOMA pace, and journal trends when enough data exists.
- Add a compact “Hoy” strip from Agenda and a “Life Pulse” summary drawn from real module data, not an invented all-purpose score.
- Keep customization/reordering and allow widgets to be hidden.
- The hero must not stay dark in light mode.

## 11.2 Finance

- Preserve the rectangular bank-card proportion on mobile; never let it become a square.
- Animate balances only after real changes and format MXN correctly.
- Enhance the numeric pad, income/expense segmented control, category chips, and save confirmation.
- Add 7/30/90-day sparklines, cashflow line, recurring upcoming payments, loan progress, and comparison only from real records.
- Keep reversals, trash, exports, and the distinction between income, expense, balance, pending payments, and active loans.

## 11.3 Objectives

- Preserve daily/weekly/monthly/yearly horizons and recurrence behavior.
- Add a visual completion ring, streak only when truthfully earned, due-state chips, and next action.
- Link an objective to Agenda, Nutrition, Learning, SOMA, Gym, Content, or ALVENTO without duplicating it.
- Daily reset uses the configured timezone and preserves history; it must not delete the previous day’s result.
- Use a restrained completion animation; no confetti for trivial autosaves.

## 11.4 SOMA

- Preserve client detail, Intensity, payments, installments, deliverables, notes, and WhatsApp link.
- Add a compact pipeline with states such as prospect, active, waiting, delivered, and archived only if those states map safely to existing data.
- Add next follow-up, amount collected, contract amount, confirmed receivable, weighted pipeline, and the separate $15,000 monthly goal.
- Show installment progress such as “Pago 6 de 10” using actual records.
- Never invent missing photo-session fees, models, edited-photo fees, or debts; make them easy to add as deliverables/receivables.
- Add polished client cards and a payment/deliverable timeline.

## 11.5 Learning

- Preserve levels 01–07, weighted progress, study sessions, evidence, import, merge/replace, and the 95% cap without final evidence.
- Visualize the route as a calm vertical constellation or skill tree with current mission, locked/available/completed states, and accessible list parity.
- Add **Subir ruta JSON** near editing controls, schema/example download, and a clear preview.
- Surface how a skill supports another module only through explicit links, e.g. “Ventas para SOMA”.

## 11.6 Farm — pigs only

- Keep this release completely focused on pigs. Do not add generic cattle/poultry abstractions to the UI.
- Preserve every current reproductive and feed rule. A service never becomes confirmed pregnancy by elapsed time; only a recorded positive review confirms it. Parturition and weaning remain idempotent and audited.
- Preserve all nine existing subsections and Spanish terminology.
- Improve cards, filters, stage chips, pig silhouette/photo presentation, reproductive timeline, upcoming windows, capacity, health follow-up, productivity charts, and feed forecast.
- Forms should start with essentials and reveal optional details. Prefer valid stage/action buttons to typing internal values.
- The Home orb may surface farm deadlines but cannot mutate farm state.
- Feed forecast must use registered pigs, confirmed rules, inventory, product weights, safety buffer, and actual chosen period. Clearly distinguish theoretical demand, inventory coverage, shopping suggestion, purchase, and recorded consumption.
- Preserve 40 kg bag handling where catalog products are 40 kg, but always use each product’s stored bag weight rather than a universal assumption.
- Catalog prices remain date-stamped and editable. Never silently activate unconfirmed MAFORNU prices/rations.
- Add compact truthful charts: animals by recorded stage, upcoming reproductive windows, open health follow-ups, feed coverage by product, theoretical cost vs. recorded cost where definitions are valid.
- Keep professional/veterinary responsibility clear. No automatic diagnosis, prescription, dosage, or treatment recommendation.

## 11.7 Books

- Add shelf/grid/list modes, cover upload, status, pages, progress, rating/opinion, concise lessons, short quotes, and wishlist.
- Make “Agregar libro” a pleasant staged flow: cover/photo or search-free manual entry, essentials, reading status, optional reflection.
- Do not fetch or fabricate cover art without an explicit integration.
- Show read count and pages only from actual records.

## 11.8 ALVENTO

- Preserve drops, launch date, products, SKU, sizes, milestones, stock, sales, reversals, income links, and gross-profit definitions.
- Create a theme-aware editorial hero with an optional real uploaded ALVENTO/model image and legible overlay.
- Add drop countdown, launch readiness, milestone timeline, units sold, remaining stock, revenue, gross profit, and best item only from real records.
- Distinguish gross profit from general expenses.
- Do not generate fake clothing, models, inventory, sales, or logos.

## 11.9 Content

- Create a compact pipeline: Idea → Script → Record → Edit → Schedule → Publish → Measure.
- Preserve series/episode, hook, script, scenes, keyboard reorder, checklist, platforms, cadence, and manual metrics snapshots.
- Support the existing personal series “De cero hasta viajar por el mundo” as user-entered content, not seeded fake episodes.
- Detail view should provide a scene-by-scene filming plan and a calm production checklist.
- Platform chips: YouTube, Shorts, Instagram, TikTok, plus Other; do not claim API posting.

## 11.10 Vision Board

- Create an image-forward masonry layout with category filters and fullscreen focus mode.
- Preserve reason, date, estimated cost, savings, linked objective, order, and achieved state.
- Add elegant progress overlays and a rotating motivational line drawn from a small editable local set—not random internet quotes presented as attributed quotations.
- Image upload must be obvious and beautiful on phone and desktop.

## 11.11 Upload

- Preserve editor, file picker, drag/drop, validation, preview, warnings, confirmation checkbox, atomic commit, batch history, dedupe, and guarded undo.
- Present four steps: **1. Cargar → 2. Validar → 3. Revisar → 4. Confirmar**.
- Add clear schema chips for CRM, Gym, Learning, and Journal.
- On mobile, stack editor and preview with a sticky step header; never squeeze two columns.
- Validation animations must not imply a write occurred.

## 11.12 Profile and Settings

- Profile: emphasize the actual photo, identity, location, birthday/age, interests, projects, and real activity counts. Keep editability and photo preservation.
- Settings: create organized groups for Appearance, Motion, DALI Core, Agenda, Data Vault, Imports, Privacy, and Future Integrations.
- Show local-only/no-encryption limitations plainly.
- Keep lightweight JSON export, ZIP with media, complete ZIP restore with pre-restore backup, source ZIP, trash, and cleanup.
- Show current data schema and latest migration status.

---

# 12. DALI CONTEXT EXPORT FOR CHATGPT

Add **Exportar contexto para ChatGPT** in Subir and Settings. This is separate from backup/restore.

Create a read-only format `dali.context.export` version `1.0` containing:

- export timestamp and timezone;
- selected modules and date range;
- schema/version summary;
- compact records or summaries chosen by the user;
- stable IDs needed to propose updates;
- explicit privacy choices;
- no media blobs;
- no hidden secrets;
- optional omission of raw journal narratives, emotion evidence, phone numbers, and sensitive notes.

The UI must show an exact preview of what will leave the browser before download/copy. The exported file is context for an external ChatGPT conversation and is **not** directly importable. An external assistant may return `dali.crm.import`, `dali.gym.session`, `dali.learning.route`, or `dali.journal.entry`, which still goes through the existing review process.

Add a short Spanish explanation:

> “Este archivo sirve para darle contexto a ChatGPT sin entregar un respaldo completo. Tú eliges módulos, fechas y datos sensibles. Revisa antes de copiar o descargar.”

---

# 13. CHARTS AND DATA VISUALIZATION

- Prefer smooth line charts, area sparklines, radial progress, small bars, timelines, heatmaps, and distribution strips.
- Do not use financial candlesticks; the owner requested clean “stock-market-like” lines, not OHLC charts.
- Native SVG/Canvas is preferred for small charts. A pinned Chart.js dependency is acceptable for complex accessible charts if a table/list fallback remains available.
- Every chart needs a title, period, units, accessible text/table equivalent, empty state, and truthful data origin.
- Tooltips must work with pointer, keyboard focus, and touch.
- Do not animate from a misleading zero if the value is unknown.
- Never aggregate across incompatible concepts merely to fill a dashboard.

---

# 14. OPTIONAL ORIGINAL ASSET BRIEFS

If image generation is available, generate at most a small coherent set. No text, logos, celebrity likenesses, franchise symbols, or fake product photography. Save local optimized files and document them in `ASSET_INVENTORY.md`.

1. **Home ambient field**  
   “Original abstract personal command-center background, deep cobalt and cyan refractive energy rings, elegant glass geometry, sparse data particles, cinematic but minimal, generous negative space, no text, no logos, no recognizable movie or superhero imagery, wide 16:9, suitable for light/dark overlays.”

2. **Farm editorial texture**  
   “Premium abstract agricultural technology visual focused on pig care, subtle geometric pig silhouette, warm earth and sage accents, humane calm atmosphere, clean editorial lighting, no text, no logos, no medical claims, wide banner with safe negative space.”

3. **Gym anatomy field**  
   “Original abstract athletic anatomy data visualization, front and back human silhouettes made of clean contour lines and luminous muscle zones, dark neutral background, cobalt and violet accents, non-photorealistic, no text, no brand resemblance.”

4. **Books atmosphere**  
   “Minimal premium reading atmosphere, sculptural stack of books and soft directional light, dark navy and warm ivory palette, elegant editorial still life, no visible titles, no text, no logos, ample interface overlay space.”

5. **Content studio field**  
   “Abstract creator studio interface background, camera-frame geometry, timeline marks, subtle magenta and cobalt accents, cinematic minimalism, no social-network logos, no text, wide layout.”

6. **Vision atmosphere**  
   “Aspirational abstract horizon with architectural light, motion and possibility, premium editorial realism, calm blue-gold palette, no specific car, property, person, logo or text, suitable behind a personal vision-board header.”

For ALVENTO, prefer real attached/uploaded campaign photography. If none exists, use an abstract textile/light texture and a prominent **Subir imagen de campaña** control rather than generating fake models or clothing.

---

# 15. ACCESSIBILITY AND INTERACTION QUALITY

- Use semantic HTML first.
- Full keyboard operation for navigation, orb menu, charts, tabs, dialogs, forms, reordering, and destructive confirmations.
- Visible focus in both themes.
- Correct dialog labels, focus trapping, restoration, and scroll locking.
- `aria-live` only for concise save/import/status feedback; never announce continuous clock or animation frames.
- Color is never the only state signal.
- Meet WCAG AA contrast for normal text and controls.
- Provide accessible tables/lists for visual charts and body maps.
- At 200% zoom the app must remain usable without clipped controls.
- Long names, long notes, large MXN values, zero values, and missing optional data must not break layout.
- Use plain Spanish labels and explain technical terms inline.

---

# 16. PERFORMANCE AND RELIABILITY

Visual ambition is a priority, but “the device is powerful” is not permission to ship leaks or broken navigation.

- Cap Canvas/WebGL device-pixel ratio and particle count sensibly.
- Lazy-load decorative media and decode images asynchronously.
- Avoid repeated full-store scans during every animation frame.
- Cache derived selectors by revision where useful.
- Use one global clock interval.
- Clean up every route-specific listener/timeline/RAF/observer.
- Pause ambient animation when the tab is hidden.
- No layout shift caused by late images.
- Core CRUD/import/export must work if GSAP or optional visual CDNs fail.
- No service worker is required in this phase.

---

# 17. IMPLEMENTATION PHASES

Follow this order so visual changes never hide data regressions.

## Phase 0 — Audit and safety checkpoint

1. Inventory the repository, routes, scripts, styles, schemas, state shape, migrations, media store, and tests.
2. Run the current full suite and record the 77/0 baseline or report the exact real difference before editing.
3. Create a concise implementation checklist mapped to this prompt.
4. Do not ask the user to choose hosting or a framework.

## Phase 1 — Data foundation

1. Implement idempotent v3→v4 migration and pre-v4 backup.
2. Add Agenda, entity links, journal v4 fields, nutrition/pantry collections, and preferences.
3. Extend validators, normalizers, backups, restores, and import/export.
4. Add the Journal schema/adapter and Context Export.
5. Add domain/unit tests before the visual layer.

## Phase 2 — Global design and motion

1. Consolidate semantic theme tokens.
2. Fix hardcoded hero/module/canvas colors in light mode.
3. Implement lifecycle-safe motion orchestration.
4. Upgrade shell, clock, search/command behavior, forms, sheets, and empty states.
5. Build the interactive DALI Core and deterministic status engine.

## Phase 3 — Primary workflows

1. Bitácora + Personal Statistics.
2. Agenda.
3. Home/DALI Core.
4. Gym Nutrition/Pantry.
5. Cross-module links and next actions.

## Phase 4 — Route-by-route visual upgrade

Upgrade Finance, Objectives, SOMA, Learning, Farm, Books, ALVENTO, Content, Vision, Upload, Profile, and Settings while preserving each domain behavior.

## Phase 5 — QA and documentation

1. Run all old and new tests.
2. Run visual QA in both themes and all required widths.
3. Test keyboard, reduced motion, long/empty/error states, and cleanup.
4. Update README, design system, migration report, test report, changelog, checklist, and asset inventory with what is actually implemented.
5. Provide a truthful completion report and do not describe pending items as finished.

Do not stop after an intermediate phase. Continue until the local release candidate and validation are complete, unless a genuine external permission/credential blocker is encountered. A visual preference ambiguity is not a blocker: follow this design brief and the existing product language.

---

# 18. REQUIRED TESTS

Add automated tests for at least the following:

## Data and migration

- v3→v4 preserves every old collection and unknown field;
- pre-v4 backup is created once and not overwritten;
- repeated migration is idempotent;
- migration failure leaves live v3 data untouched;
- old manual journal entries remain readable and do not gain invented emotion scores;
- ZIP/JSON backup and complete restore include new collections and media references;
- no personal data appears in downloadable source ZIP.

## Journal

- valid `dali.journal.entry` previews without writing;
- invalid versions, dates, ranges, enums, dangerous keys, and malformed UUIDs fail clearly;
- emotion values are independent and not required to sum to 100;
- inferred values are marked for review;
- duplicate import is detected;
- merge/replace/cancel behavior is correct;
- optional next actions remain uncreated until checked;
- atomic commit and guarded undo work;
- privacy-safe export excludes selected fields;
- trend gaps do not become invented dates;
- pattern/correlation copy is suppressed below sample thresholds.

## Agenda and links

- recurrence respects `America/Mexico_City`;
- completing an item preserves history;
- links do not duplicate or cascade-delete records;
- suggested schedule never writes before confirmation;
- `.ics` output has valid dates/timezone;
- mobile week view does not overflow horizontally.

## DALI Core

- pure status engine chooses stable/attention/urgent deterministically;
- each reason links to a real source;
- no data produces stable, not a fake alert;
- farm estimated windows do not mutate animal state;
- the $15,000 SOMA target remains separate from the $33,000 profile target;
- orb activation works with click, tap, Enter, and Space;
- Escape closes and restores focus;
- status remains understandable without color;
- light/dark theme changes refresh Canvas/SVG palette;
- RAF/listeners/timelines are cleaned after rerenders and hidden tabs.

## Nutrition and finance linkage

- proposed nutrition targets require confirmation;
- missing consumption data does not fabricate pantry days remaining;
- grocery-to-finance creation requires amount review and confirmation;
- one confirmed purchase creates at most one transaction;
- deleting a link does not delete the expense or pantry record.

## Regression and presentation

- all existing finance, SOMA, gym, learning, farm, feed, books, ALVENTO, content, vision, media, profile, import, backup, restore, and source-ZIP tests remain green;
- no route creates duplicate intervals or event listeners after repeated navigation;
- no `undefined`, `NaN`, invalid date, or raw JSON leaks into visible UI;
- no horizontal overflow at 360, 390, 412, 430, 768, 1024, 1280, 1440, and 1920 CSS px;
- both themes have readable text, borders, focus, charts, overlays, and images;
- reduced motion preserves all actions and information.

---

# 19. VISUAL QA MATRIX

Capture and inspect, at minimum:

- Home/DALI Core closed and open, stable/attention/urgent, light/dark, 412 and 1440 px;
- Bitácora empty, import preview, confirmed day, trends, calendar, light/dark, 412 and 1440 px;
- Agenda inbox/today/week/focus, 412 and 1440 px;
- Finance new movement numeric pad and populated dashboard, 412 and 1440 px;
- Gym empty/imported session/body map/nutrition/pantry, 412 and 1440 px;
- Farm summary/pigs/reproduction/litters/feed/agenda/health/performance/settings plus key forms, 412 and 1440 px;
- SOMA client detail and monthly goal;
- Learning skill route;
- Books add flow and shelf;
- ALVENTO hero/drop detail with and without image;
- Content pipeline/item detail;
- Vision board/focus mode;
- Upload invalid/valid/preview/history;
- Profile and Settings/Data Vault.

For each screenshot, inspect clipping, hierarchy, tap targets, contrast, theme consistency, empty-state usefulness, long text, and data truthfulness. Fix issues and recapture; do not merely list them.

---

# 20. DEFINITION OF DONE

The task is complete only when all of the following are true:

1. The attached existing DALI app—not a replacement—contains the implemented features.
2. Existing personal data loads unchanged.
3. v3→v4 migration is safe, backed up, idempotent, and tested.
4. Bitácora accepts reviewed daily reflection JSON and renders honest personal statistics.
5. The large theme-aware interactive DALI Core works on desktop and mobile and explains its status.
6. Agenda is useful locally and connected through non-destructive entity links.
7. Gym contains nutrition/pantry without pretending to replace Symmetry or offer medical advice.
8. All existing routes have received intentional, theme-consistent polish and useful empty states.
9. All forms and imports remain explicit, reviewable, and recoverable.
10. Every displayed metric is derived from real stored data or clearly labeled as an estimate/target.
11. The application works at the required phone and desktop sizes, in both themes and reduced motion.
12. All old and new tests pass with zero uncaught console errors.
13. Documentation states exactly what is complete, what is local-only, and what remains future work.
14. Supabase, deployment, OAuth, and fake integrations have not been introduced.

---

# 21. FINAL HANDOFF FORMAT

When implementation is genuinely finished, return a concise but evidence-based handoff with:

1. **Implemented** — grouped by data, core experience, modules, responsive behavior, and accessibility.
2. **Preserved** — important existing behaviors and data guarantees.
3. **Migration** — old/new schema, backup key, result, and recovery path.
4. **Tests** — old baseline, final total, failures, console errors, and exact environment.
5. **Visual QA** — routes, widths, themes, and screenshot links/files actually inspected.
6. **Files changed/added** — meaningful list, not every generated byte.
7. **Known limits** — only truthful remaining limitations.
8. **How Dalí uses it tomorrow** — five short steps: open, review DALI Core, use Agenda, import daily journal JSON, export backup.

Do not finish with a hosting question. Do not say “ready for production” merely because the preview renders. End by stating that the local release candidate is ready for the owner’s acceptance review, and that Supabase/sync is a separate next phase only after approval.

Begin now by auditing the attached ZIP and screenshots, run the baseline suite, then implement the complete release candidate.
