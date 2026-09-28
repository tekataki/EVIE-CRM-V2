# Fase 3 · auditoría y plan previo al refactor

## Auditoría inicial (2026-09-19)
- Proyecto existente: frontend Vanilla en public/; Hono + Vite + Wrangler solo como transporte web. Sin React ni Electron previo.
- 16 rutas hash en config.js; render central App.render → Neural/RCApp/IvyShell. Los módulos, formularios e importadores siguen siendo autoritativos.
- JSON esquema 4 en dali-os-local-v1; revisión optimista Store.save, copias pre-v2/pre-v3/pre-v4 y catálogo. IndexedDB usa storageKey + '-media', almacén media. No se cambia el esquema ni la clave.
- Origin distinto en Electron: importar explícitamente ZIP con imágenes desde Configuración; no leer perfiles Chrome ajenos ni copiar datos silenciosamente. El origen evie://app y userData estable mantendrán datos entre dev/instalación.
- Núcleo: ivy-core-renderer.js Canvas 2D, actualmente 220/440 nodos geodésicos. Pig: NeuralFarm.silhouette SVG en neural-farm.js. Render/dispose gobernado por neural-core.js.
- Supuestos navegador: App/Store/MediaStore/importador (DOM, localStorage, IndexedDB, blob URLs), IvyVoice (SpeechRecognition/speechSynthesis), IvyAudio (getUserMedia), navegación hash y descargas. Se conservarán; adaptador desktop separado para privilegios.
- Dependencias visuales CDN: lucide, JSZip, fuentes, Tailwind browser. Desktop deberá cargar librerías locales y excluir script Tailwind dinámico; no depender de Internet para arrancar.
- Baseline real: 177 PASS / 0 FAIL, 14,61 s, Chromium 153.0.8010.12; evidence/phase3-baseline.json.

## Plan de implementación
1. Host Electron Forge con origen propio, CSP, preload mínimo, single instance, tray, geometría y apariencia persistidas sin secretos.
2. Registry de herramientas estricto, confirmación nativa main-process, IPC autenticado por frame/origen, límite de llamadas, auditoría redactada. Agenda usa un adaptador sobre Store y tokens de propuesta/revisión; nunca una base duplicada.
3. Ollama loopback con schemas y bucle acotado; Whisper CLI y SAPI offline vía scripts fijos/archivos temporales; captura PCM y reproducción analizada por Web Audio. Sin comandos producidos por modelo.
4. Núcleo blanco orgánico procedural y cerdo 3D Three.js con fallback; UI compartida, cristal únicamente desktop, controles de voz y diagnóstico.
5. Setup/build Windows, pruebas Node + navegador, documentación de seguridad/Google y checklist Windows.

## Implementación y verificación de entrega · 2026-09-19

La auditoría y el plan anteriores se conservaron como registro previo. No se reescribió el CRM ni se cambió el esquema/clave personal.

### Archivos y capacidades
- `electron/main/main.cjs`, `settings.cjs`, `preload/preload.cjs`: origen estable, ventana/tray/single instance, preferencias, CSP, sandbox, IPC por main-frame y navegación restringida.
- `electron/security/`, `electron/tools/`: 16 schemas, allowlist, confirmación nativa, cancelación generacional y auditoría redactada. Helpers Windows fijos en `scripts/windows-tools.ps1`; nunca comandos generados por el modelo. Corregidas firmas COM PreserveSig y verificación de foco.
- `electron/ai/ollama.cjs`: endpoint loopback fijo, parsing validado, bucle acotado y selección Qwen/fallback. `electron/voice/` + `scripts/windows-tts.ps1`: Whisper WAV temporal y SAPI offline, limpieza y procesos limitados.
- `public/desktop-agenda.js`: proveedor sobre Store existente, propuesta exacta, token de un uso con expiración/revisión, archivado recuperable y resultado verificado. Sin segunda base CRM.
- `public/desktop-voice.js`, `pcm-recorder.js`, `desktop-ui.js`: AudioWorklet, PCM 16 kHz, analyser de entrada/salida, controles persistentes, diagnóstico discard-only, UI local y cancelación de respuestas tardías.
- `public/ivy-core-renderer.js`, `pig-hologram.js`, `phase3.css`, `neural-home.js`: núcleo blanco, 14 primitivas del pig con perspectiva, animación/pausa/cleanup, fallback SVG y eliminación de botones antiguos. Corregidos clipping circular de etiquetas y overflow a zoom CSS 200 %. El SVG se oculta mediante atributo (SVG.hidden no es una propiedad HTML reflejada).
- `public/index.html`, `app.js`, `neural-core.js`, `dali-core.js`, `ivy-command-surface.js`, `project-files.json`, `vendor/`: integración compartida, entrada Desktop coherente, dependencias locales con licencias y exportación web completa.
- `electron/calendar/google.cjs`: OAuth opcional con PKCE/state, loopback y safeStorage, refresh y proveedor de lectura. Sin Google writes ni sync automáticos.
- `forge.config.cjs`, `assets/icons/evie.ico`, `scripts/*windows.ps1`, `setup-local-ai.ps1`, `verify-local-ai.ps1`: camino de build Windows y configuración manual segura de IA.
- `tests/desktop.test.cjs`, `tests/voice.test.cjs`, `tools/test-phase3-browser.mjs`, `test-electron.mjs`, `test-graphics.mjs`: nuevas pruebas. README, guías Windows/seguridad/Google y checklist completados.

### Resultados observados (no equivalen a aceptación Windows)
| Verificación | Resultado registrado | Evidencia |
|---|---|---|
| Suite web heredada | 177 pasan, 0 fallos/errores | `evidence/final-suite.json` |
| Node seguridad/voz | 22 pasan | `npm run test:desktop` |
| Agenda/fallback web | 20 pasan | `evidence/phase3-browser.json` |
| Electron desde fuente | 13 pasan | `evidence/phase3-electron.json` |
| Electron empaquetado Linux | 13 pasan | `evidence/phase3-packaged-electron.json` |
| Gráficos WebGL | 8 pasan | `evidence/phase3-graphics.json` |
| Layout | 1.152 sin incidencias; foco y zoom CSS 200 % correctos | `evidence/visual-matrix.json` |
| Build Hono/Vite | correcto | `npm run build` |
| Dependencias | 0 vulnerabilidades conocidas reportadas | `evidence/phase3-audit.json` |

Cada JSON lleva fecha. La prueba Electron usa un perfil temporal, confirmaciones automatizadas desde main y micrófono sintético Chromium: comprueba AudioWorklet/analyser y liberación, no STT/modelo/TTS reales. WebGL usa SwiftShader, no la GPU del PC del usuario. La matriz mide vistas principales y overflow, no certifica todos los formularios, contraste ni accesibilidad completa.

### Empaquetado: incidencia resuelta y límite explícito
Forge 7.11.2 con Packager 20 producía `TypeError: done is not a function`, incluso con un exit code engañoso. Packager 18.4.4 empaquetaba, pero introducía el extractor ZIP vulnerable. Se fijó el conjunto compatible Forge **8.0.0-alpha.10** + Packager **20.3.0**, Node >=22.12, sin esa alerta. Se generó ASAR y se abrió/probó el ejecutable Linux con el runner real. **Forge sigue siendo pre-release**, documentado en README; Squirrel/instalación solo podrán certificarse en Windows. No se ofrece el paquete Linux como instalador Windows.

Comandos ejecutados: `npm ci`, `npm run build`, `npm run test:desktop`, `node tools/run-suite.mjs evidence/final-suite.json`, `node tools/test-phase3-browser.mjs`, `node tools/test-graphics.mjs`, `node tools/visual-qa.mjs`, `xvfb-run -a node tools/test-electron.mjs`, `npx electron-forge package --platform=linux --arch=x64` y el mismo runner con `EVIE_PACKAGED_EXECUTABLE` apuntando al ejecutable generado. Navegadores ejecutados secuencialmente por el límite de memoria del sandbox.

### Entrega y siguientes pasos
- Código completo con lockfile y guías. El ZIP web interno no contiene host Electron ni datos personales.
- En Windows: `npm ci`, `npm run dev:desktop`; configura IA según `docs/WINDOWS_SETUP.md`, completa `docs/WINDOWS_ACCEPTANCE.md` y luego `npm run make:win`.
- Salida esperada: `out/make/squirrel.windows/x64/EVIE-CRM-V2-Setup.exe`. **No generada ni instalada aquí.**
- Pendiente: voz física española → Whisper real → Ollama → herramienta confirmada/verificada → SAPI real, Acrylic/wallpaper, controles Windows, installer/reapertura, dispositivo Samsung físico y OAuth opcional real.
- Sin despliegue de producción ni sincronización remota. No se marca Phase 3 completa hasta ese flujo real.

## Restricciones de validación
Entorno Linux: no se certifican Acrylic, SmartScreen, SAPI, apps Windows, micrófono físico ni instalación NSIS/Squirrel. No se afirmará completado el flujo de voz real sin prueba Windows. Modelos/binaries no se descargan sin consentimiento. Google opcional requiere configuración OAuth del usuario fuera del chat.
