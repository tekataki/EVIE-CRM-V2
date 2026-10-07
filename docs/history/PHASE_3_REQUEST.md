# EVIE CRM V2 — Phase 3 Master Prompt
## Free Local AI, Windows Desktop App, Transparent Holographic UI, Voice Control

You are Astra, acting as the lead product engineer, desktop engineer, AI integration engineer, motion designer, and QA owner for the existing **EVIE CRM V2** codebase.

This is an implementation task, not a concept exercise. Inspect the entire supplied project before changing anything. Then modify the existing project in place and deliver working source code, setup scripts, tests, and a Windows installer build path.

## 1. Product goal

Transform the current EVIE CRM V2 web application into a hybrid product with two preserved targets:

1. **EVIE Desktop for Windows** — a downloadable Electron application with a translucent holographic interface, local voice conversation, local AI reasoning, and a secure allowlisted Windows-control bridge.
2. **EVIE Web/PWA** — the existing browser/mobile version for the Samsung S25 Ultra and other devices. It must remain usable and responsive, but Windows-control capabilities must be visibly unavailable outside the desktop build.

The desktop experience should feel like a personal operating system inspired by futuristic holographic interfaces, not like a conventional website inside a desktop wrapper. The assistant persona is **Ivy** and the product name remains **EVIE CRM V2**.

The first working version must avoid paid AI APIs and recurring cloud costs. Use local, open-weight or operating-system capabilities wherever specified below.

## 2. Non-negotiable constraints

- Do **not** rewrite the project from scratch.
- Do **not** delete, rename, or silently break existing routes, modules, local data, forms, or navigation.
- Preserve the current local-first CRM behavior and migrate existing data safely if storage changes are necessary.
- Inspect the current package structure and adapt the architecture to it. Do not assume React, Next.js, or another framework if the project is currently vanilla HTML/CSS/JavaScript.
- Keep the existing web/PWA target functional.
- Add Electron as a desktop host around the existing application instead of duplicating the whole UI.
- No OpenAI, Anthropic, Gemini, or other paid API is required for the default mode.
- No permanent API keys, OAuth tokens, secrets, or passwords may exist in renderer code, committed source, localStorage, HTML, or client-side bundles.
- Never execute arbitrary shell, PowerShell, JavaScript, URLs, paths, or commands produced by the language model.
- Never expose unrestricted Node.js APIs to the renderer.
- Never use `eval`, `new Function`, `shell: true`, interpolated command strings, or a generic `execute_command` tool.
- Every system action must map to a hard-coded typed tool, validated arguments, and an allowlisted implementation.
- Do not ship fake buttons, fake AI responses, mock system actions, placeholder analytics, or sample CRM data disguised as real user data.
- Use the attached current-UI screenshot as the baseline that must be preserved and improved.
- Use the attached white neural-particle reference as the visual and motion target for Ivy's new neural core. Recreate the behavior procedurally; do not embed the reference GIF as the final implementation.

## 3. First action: audit before editing

Before writing code:

1. Map the current application structure, routes, storage keys, modules, state, tests, build scripts, and entry points.
2. Identify the current neural-core implementation and Farm pig implementation.
3. Identify all code that assumes a browser-only runtime.
4. Identify existing localStorage and IndexedDB schemas. Preserve the existing key `dali-os-local-v1` if it exists, or implement an explicit non-destructive migration.
5. Run the existing test suite and record the baseline.
6. Produce a short implementation plan in `PHASE_3_IMPLEMENTATION_NOTES.md` before beginning the refactor.

If any current behavior conflicts with this prompt, preserve the user's data and working behavior first, then document the smallest necessary change.

## 4. Target architecture

Use one shared UI codebase with environment-specific adapters.

Recommended high-level structure; adapt names to the existing repository rather than forcing this exact tree:

```text
app-or-existing-web-source/
electron/
  main/
    main.(js|ts)
    window-manager.(js|ts)
    ipc-router.(js|ts)
  preload/
    preload.(js|ts)
  ai/
    ollama-client.(js|ts)
    conversation-orchestrator.(js|ts)
    tool-loop.(js|ts)
  voice/
    whisper-service.(js|ts)
    tts-service.(js|ts)
    audio-temp-store.(js|ts)
  tools/
    registry.(js|ts)
    schemas.(js|ts)
    crm-tools.(js|ts)
    windows-tools.(js|ts)
    calendar-tools.(js|ts)
  security/
    validators.(js|ts)
    permissions.(js|ts)
    audit-log.(js|ts)
scripts/
  setup-local-ai.ps1
  verify-local-ai.ps1
  dev-windows.ps1
  build-windows.ps1
assets/
  icons/
  holograms/
tests/
forge.config.(js|ts)
```

The renderer may request only a narrow API exposed through `contextBridge`. Use `contextIsolation: true`, `nodeIntegration: false`, sandboxing where compatible, a strict Content Security Policy, and validated IPC request/response contracts. The main process owns privileged operations.

## 5. Windows desktop packaging

Use Electron and Electron Forge unless the existing repository already has a sound Electron packaging setup.

Required commands:

- `npm run dev:web`
- `npm run dev:desktop`
- `npm run test`
- `npm run lint` if a linter exists or is added
- `npm run make:win`

`npm run make:win` must generate a Windows x64 distributable/installer through Electron Forge. Document the exact output path. Building must be possible locally on Windows without a paid service.

The app must have:

- Product name `EVIE CRM V2`
- Windows application ID
- Proper `.ico` icon with multiple sizes
- Custom frameless title bar with minimize, maximize/restore when supported, and close controls
- Window position and size persistence
- Single-instance lock
- System tray menu: Open EVIE, Listen, Stop Listening, Diagnostics, Quit
- Graceful shutdown of microphone, child processes, and temporary files
- No forced administrator privileges for normal use

Unsigned personal builds are acceptable. Clearly document that Windows SmartScreen may warn about an unsigned installer and that code signing is optional and not part of the free local build.

## 6. Transparent holographic Windows appearance

The Windows desktop build must reveal the user's Windows wallpaper through the application and feel like dark glass suspended over the desktop.

Implement three appearance modes in Settings:

1. **Crystal / Acrylic — default and recommended**
   - Use the Windows system-drawn `backgroundMaterial: 'acrylic'` where supported.
   - Use a frameless window and translucent panels.
   - Preserve normal resizing and usability.

2. **True Transparent Overlay — experimental**
   - Use a transparent frameless BrowserWindow with `transparent: true` and `backgroundColor: '#00000000'`.
   - Because transparent Electron windows have platform limitations, use a deliberate fixed/work-area layout if necessary instead of pretending all native resize/maximize behavior works.
   - Do not enable click-through globally. Interactive controls must remain clickable.

3. **Solid Dark — fallback**
   - Preserve a polished dark background for unsupported systems, screen sharing, accessibility, and the web/PWA build.

Renderer styling requirements for desktop glass mode:

- `html`, `body`, and the root application shell must be transparent only in the Electron glass modes.
- Browser/PWA mode must retain a solid background because a browser cannot reveal the Windows desktop behind its tab.
- Replace large opaque page rectangles with translucent layered panels.
- Suggested visual language: near-black glass at approximately 28–55% opacity, 18–28 px blur where the platform permits, thin white borders at low opacity, subtle inner highlights, and soft shadows.
- White must become the primary luminous color. Cyan may remain only as a restrained status/accent color. Avoid a blue-dominant interface.
- Maintain strong text contrast over both bright and dark wallpapers. Add adaptive scrims behind text and critical controls.
- Add a user-controlled glass-opacity slider.
- Add a `prefers-reduced-motion` path and a Low Motion setting.
- No visual effect may make forms, navigation, or data unreadable.

## 7. Rebuild the Ivy Neural Core

Replace the current simple blue sphere on the Home view with a large, living, white neural entity modeled after the attached white filament/particle reference.

Visual requirements:

- Occupy most of the Home viewport and remain the undisputed focal point.
- Center it prominently with generous negative space.
- Build it procedurally with WebGL/Three.js or an equivalently capable canvas approach.
- Use thousands of restrained white particles, curved filaments, bright neural junctions, orbiting traces, subtle depth, additive glow, and controlled turbulence.
- The silhouette should feel organic and imperfect, not like a rigid geodesic globe.
- Do not simply play the provided GIF.
- Do not create an obvious rectangular canvas background; the core must float directly in the transparent scene.
- Keep greetings such as `Buenas tardes, Dalí.` minimal, elegant, and non-overlapping.
- Remove the old Home hero buttons `Hablar con Ivy`, `Definir mi siguiente paso`, and `Personalizar` if they still exist. Voice activation belongs to the neural core and the persistent voice control.

Implement an explicit visual state machine:

- `idle`: slow breathing, long filament drift, occasional neural sparks
- `listening`: filaments pull inward and react live to microphone amplitude; listening halo appears
- `transcribing`: tighter rotation with a scanning sweep
- `thinking`: faster orbital motion, traveling pulses, denser core activity
- `speaking`: radial expansion and brightness driven by the actual output-audio analyser, not a canned loop
- `executing`: precise rings/beams indicating a tool action
- `success`: short clean outward pulse
- `error`: restrained amber/red distortion, never a full-screen flashing effect

The animation must react to real audio amplitude. Use Web Audio `AnalyserNode` data for microphone listening and for synthesized audio playback. Smooth the signal to avoid jitter. Keep the render loop efficient and pause or reduce it when the window is hidden.

## 8. Farm hologram redesign

Replace the current flat line-art pig in the Granja hero with a procedural 3D holographic pig that rotates continuously through 360 degrees.

Requirements:

- Construct a recognizable pig in Three.js from optimized primitives or use a properly licensed local model included in the repository with its license recorded.
- Use transparent/wireframe/point-cloud materials, luminous white as the main color, and a restrained mint accent matching the Farm module.
- Add a holographic base ring, scan lines, particles, soft glow, and subtle data callouts.
- The pig must have real depth and perspective, not a rotating 2D image.
- Slow continuous rotation while idle; slightly change rotation and pulse behavior on hover/focus.
- Pause rendering when offscreen using `IntersectionObserver`.
- Provide a static/fallback rendering when WebGL is unavailable or Reduced Motion is enabled.
- Maintain the existing Farm data, tabs, forms, and right intelligence rail.

Use the same visual-system approach to add restrained module-specific holographic motion to Agenda, Finanzas, Gimnasio, Objetivos, SOMA, Aprendizaje, Bitácora, Libros, Alvento, Contenido, and Vision Board without overwhelming the actual CRM data.

## 9. Completely local voice and AI pipeline

The default assistant mode must work without paid API keys:

```text
Microphone
  -> local speech-to-text
  -> local Ollama model
  -> validated tool call or conversational answer
  -> local Windows text-to-speech
  -> speaker
```

### 9.1 Speech to text

Use `whisper.cpp` locally with a multilingual model suitable for Spanish. Default to a practical model such as `small` for this PC class and allow `base` as a faster fallback.

- Do not use a browser cloud speech-recognition service as the primary path.
- Capture microphone audio with clear permission and recording indicators.
- Start with reliable push-to-talk and stop controls.
- Add optional VAD-based auto-stop only after push-to-talk works.
- Transcribe Mexican Spanish accurately while allowing English product/app names.
- Never keep recordings by default. Use temporary files and delete them after processing unless the user explicitly enables history.

### 9.2 Local language model

Use Ollama's local HTTP API at loopback only. Default model for the user's Ryzen 5 5600G, GTX 1660 Super, and 16 GB RAM:

- Primary: `qwen3.5:4b`
- Fallback if unavailable: `qwen3:4b`

Use Ollama tool calling with strict JSON schemas. Add a model/provider adapter so a paid cloud model could be added later without rewriting the UI or tools, but do not require or configure a paid provider now.

The assistant system behavior must:

- Identify itself as Ivy inside EVIE CRM V2.
- Address the user as `jefe` naturally, not in every sentence.
- Respond primarily in Spanish unless the user asks otherwise.
- Be concise during voice interactions.
- Never claim an action succeeded until the tool returns success.
- Ask a focused question when required arguments are missing.
- Summarize tool failures honestly.

### 9.3 Local text to speech

Use an offline Windows voice as the zero-cost default. Prefer a Spanish voice installed in Windows.

- Implement TTS behind a provider interface.
- Generate/play audio in a way that allows Web Audio amplitude analysis so the neural core moves while Ivy speaks.
- Use safe child-process invocation with `shell: false`; do not place model-generated text directly inside a PowerShell command string.
- If a helper script is used, pass text through a temporary UTF-8 file or stdin and use fixed script paths and fixed arguments.
- Expose voice selection, rate, and volume in Settings.
- If no Spanish voice is installed, show a clear setup message and fall back to the system default instead of failing silently.

## 10. Voice interaction experience

Add one persistent microphone control and make the neural core itself clickable/focusable as a talk control on Home.

Required interaction:

1. User presses and holds or clicks to start listening.
2. Ivy enters `listening`; the neural core reacts to the real microphone level.
3. User stops or silence ends the capture.
4. Ivy enters `transcribing`, then `thinking`.
5. The transcript appears in a small optional conversation panel.
6. If a tool is read-only, Ivy may execute it immediately.
7. If a tool changes data or controls Windows, show a preview/confirmation according to the permission policy.
8. On confirmation, enter `executing`, run the tool, verify the result, then speak the verified outcome.

Add keyboard shortcut `Ctrl+Space` to toggle listening while EVIE is focused. An optional global shortcut may be offered in Settings but must be opt-in and easy to disable.

Do not implement an always-listening microphone by default. Do not claim that clap detection or a wake word is reliable until tested. Place wake word/double-clap activation behind an Experimental toggle and only run it while the desktop application is open.

## 11. Secure tool registry

Implement tools as typed capabilities. Each tool must define:

- stable name
- human-readable description
- JSON input schema
- permission category
- confirmation policy
- validator
- executor
- normalized success/error result
- audit metadata

Minimum tool set:

### CRM and agenda

- `crm.get_today_agenda`
- `crm.search_events`
- `crm.create_event`
- `crm.update_event`
- `crm.delete_event`
- `crm.get_dashboard_summary`
- `crm.create_task`
- `crm.update_task`
- `crm.navigate`

The first five must work with the existing EVIE Agenda data before Google Calendar is connected. Example conversation that must pass end-to-end:

> User: “Ivy, checa qué tengo hoy en el calendario.”
>
> Ivy reads the actual local Agenda records and speaks a concise summary.
>
> User: “Cambia la cita de las cuatro para mañana a las cinco.”
>
> Ivy resolves the event, shows the exact before/after change, asks for confirmation, updates it, verifies it, and then says it is ready.

### Windows allowlisted actions

- `windows.open_app` using an app ID from a user-editable allowlist
- `windows.focus_app` using an allowlisted app ID
- `windows.open_url` after protocol/domain validation
- `windows.open_location` using configured path aliases, never raw model-generated paths
- `windows.set_volume` with bounded numeric values
- `windows.media_control` limited to play, pause, next, previous, mute
- `windows.show_notification`

Initial app allowlist may include Calendar/browser, Spotify, File Explorer, Calculator, and Settings only after detecting or configuring their safe launch targets. Never guess executable paths. Provide a Settings UI to test each mapping.

Explicitly forbidden in this phase:

- arbitrary shell or PowerShell execution
- arbitrary process launch by raw executable/path
- file deletion or bulk file modification
- software installation/uninstallation
- registry modification
- password or credential access
- shutdown, restart, lockout, or account changes
- simulated typing/clicking into arbitrary windows
- hidden persistence or privilege escalation

Permission policy:

- Read-only CRM queries: no confirmation
- Navigation and media controls: lightweight confirmation can be disabled by the user
- Create/update CRM/calendar records: visible preview and one confirmation
- Delete events/tasks: strong confirmation
- Any future financial, destructive, or security-sensitive operation: strong confirmation and disabled by default

Record a local audit log with timestamp, requested tool, redacted arguments, user decision, result, and error. Never log spoken audio, tokens, passwords, or sensitive free text by default.

## 12. Google Calendar integration scaffold

The local EVIE Agenda must work first. Then add an optional **Connect Google Calendar** flow using the official Google Calendar API and OAuth for a desktop application.

- Use the system browser for consent and a loopback callback suitable for installed apps.
- Keep OAuth logic in the Electron main process, not the renderer.
- Store refresh tokens encrypted using Electron `safeStorage` when available.
- Never put refresh tokens in localStorage.
- Request the minimum practical scopes and explain them before consent.
- Add provider abstraction: `LocalAgendaProvider` and `GoogleCalendarProvider`.
- Show which calendar/provider will be modified before a write.
- If Google credentials have not been configured, show setup instructions and continue using Local Agenda.
- Do not block the free local assistant on Google setup.

Create `docs/GOOGLE_CALENDAR_SETUP.md` with exact steps for the user to create a Google Cloud project, enable Calendar API, configure the OAuth consent screen, create a Desktop OAuth client, and add only the client ID/config required by the app. Do not ask the user to paste credentials into chat.

## 13. Setup and diagnostics

Create a first-run setup wizard and a permanent Settings > Ivy Diagnostics page.

It must check and display:

- Windows/Electron environment
- Microphone permission and live input level
- Ollama installed/running at loopback
- Required local model downloaded
- whisper.cpp binary present
- Whisper model present
- Offline TTS voice available
- Tool bridge available
- Local Agenda readable/writable
- Google Calendar connection status, if configured

Create `scripts/setup-local-ai.ps1` that safely assists with local setup:

- Verify Ollama installation and provide the official download link if missing.
- Pull `qwen3.5:4b` only after the user confirms the download size.
- Download or prepare pinned, verified whisper.cpp Windows assets and a multilingual Whisper model, or provide exact manual steps if automatic retrieval cannot be made safely.
- Use fixed official release URLs/versions and verify checksums where downloads are automated.
- Never disable Windows security features.
- Never require admin privileges unless a clearly explained dependency truly needs them.

Add friendly failure states. For example, if Ollama is not running, Ivy should say it is offline locally and direct the user to Diagnostics, not display a blank screen.

## 14. Responsive and mobile behavior

The Samsung S25 Ultra web/PWA version must remain fully usable.

- Preserve responsive navigation, safe areas, touch targets, and portrait layout.
- Scale the neural core to fit without clipping.
- Reduce particle count based on device capability.
- Disable Windows-only tool controls and show `Available on EVIE Desktop` rather than failing.
- Browser/PWA mode uses Solid Dark background; it cannot reveal the phone or PC wallpaper behind the browser.
- Do not attempt to control the Windows PC directly from the phone in this phase. Keep a documented future adapter boundary for a secure authenticated remote bridge.

## 15. Performance and accessibility

- Target smooth motion on the stated PC without sacrificing stability.
- Dynamically lower particle count if average frame time degrades.
- Pause hidden/offscreen WebGL scenes.
- Dispose WebGL geometries, materials, renderers, event listeners, and audio nodes correctly.
- Avoid more than one active high-cost scene when a module is not visible.
- Support keyboard navigation, visible focus, ARIA labels, and screen-reader status announcements for voice states.
- Respect Reduced Motion and offer reduced-glow mode.
- Avoid rapid flashing and unsafe strobe effects.

## 16. Security requirements

Follow Electron security best practices:

- `contextIsolation: true`
- `nodeIntegration: false`
- renderer sandboxing where compatible
- strict preload allowlist
- strict CSP
- deny unexpected navigation and new-window requests
- validate all external URLs before opening
- no remote content with Node privileges
- schemas validate every IPC request
- rate-limit voice and tool requests
- clean temporary audio files
- keep Ollama bound to loopback for this app's use
- encrypt stored OAuth tokens with `safeStorage`
- no secrets in renderer, Git, console logs, error telemetry, or test fixtures

Create `docs/SECURITY_MODEL.md` containing the trust boundaries, threat model, tool permissions, forbidden operations, and known limitations.

## 17. Testing and acceptance criteria

Keep all existing tests passing and add new coverage.

Minimum automated coverage:

- IPC schema validation and rejection of malformed requests
- tool registry allowlist enforcement
- confirmation rules
- protection against raw command/path/URL injection
- CRM Agenda read/create/update/delete adapters
- Ollama response and tool-call parsing with deterministic fixtures
- voice state machine transitions
- environment capability detection
- web/PWA fallback behavior
- local storage migration and rollback safety

Manual Windows acceptance checklist:

1. Launch desktop app from development command.
2. Verify Crystal/Acrylic, True Transparent, and Solid modes.
3. Verify the wallpaper is visible through desktop glass mode.
4. Verify custom window controls and drag regions.
5. Verify the redesigned white neural core in every state.
6. Verify the 3D pig rotates, is genuinely three-dimensional, and pauses offscreen.
7. Ask Ivy in Spanish what is on today's local Agenda.
8. Create and reschedule an Agenda event through voice with confirmation.
9. Open Calculator or Spotify through the allowlisted bridge.
10. Reject a malicious request that attempts arbitrary shell execution.
11. Disconnect Ollama and verify the failure state.
12. Test microphone denial and recovery.
13. Build the Windows distributable and install it.
14. Reopen the installed app and verify existing CRM data remains intact.
15. Open the web/PWA build on Samsung S25 Ultra dimensions and verify desktop-only tools are disabled cleanly.

Do not mark the task complete unless the core flow is real:

```text
spoken Spanish -> real transcription -> local model -> validated tool -> verified result -> spoken response
```

## 18. Required deliverables

Return all of the following:

1. Updated source code preserving the existing application.
2. Electron desktop entry points and secure preload bridge.
3. Electron Forge Windows packaging configuration.
4. Free local AI integration using Ollama.
5. Local Whisper speech-to-text integration.
6. Offline Windows TTS integration.
7. Typed secure tool registry and initial Windows/CRM tools.
8. Optional Google Calendar provider scaffold and setup guide.
9. Redesigned white reactive Ivy Neural Core.
10. Rotating 3D holographic Farm pig.
11. Crystal/Acrylic, True Transparent, and Solid appearance modes.
12. First-run setup wizard and Diagnostics screen.
13. Updated automated tests and manual Windows checklist.
14. `README.md` with exact installation, development, local AI setup, build, and troubleshooting commands.
15. `PHASE_3_IMPLEMENTATION_NOTES.md`, `docs/SECURITY_MODEL.md`, and `docs/GOOGLE_CALENDAR_SETUP.md`.
16. A concise final report containing:
    - files added/changed
    - commands run
    - test results
    - installer output path
    - known limitations
    - exact remaining manual steps on the user's Windows PC

## 19. Completion behavior

Do not stop after producing a plan. Implement the code.

Do not report success based only on browser preview. Electron transparency, offline TTS, microphone access, allowlisted Windows actions, and the Windows installer must be validated on Windows or clearly labeled as awaiting Windows-only validation.

If the current GenSpark environment is Linux and cannot produce or test a Windows installer, still implement the entire cross-platform source and configuration. Then provide one of these free build paths:

1. Preferred: exact commands to build locally on the user's Windows PC.
2. Optional: a GitHub Actions workflow using `windows-latest`, with artifacts uploaded for download, while explaining any repository/minute limitations.

Do not replace unverified work with claims. Clearly distinguish `implemented`, `tested in current environment`, and `requires Windows validation`.

The finished result should feel like a responsive personal operating system: white living neural intelligence in the center, holographic module visuals, real voice, real local reasoning, real verified CRM actions, and safe control over a small explicit set of Windows capabilities — without a paid AI API.
