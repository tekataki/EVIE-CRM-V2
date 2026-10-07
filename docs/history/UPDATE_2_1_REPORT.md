# EVIE CRM V2 · informe de actualización 2.1.0

Fecha de verificación: 2026-09-19. Extensión in-place de `/home/user/webapp`; no prototipo ni reemplazo. Se mantienen app/producto `EVIE CRM V2`, ID `com.evie.crm.v2`, `evie://app`, `%APPDATA%\EVIE-CRM-V2`, `%LOCALAPPDATA%\EVIE\ai`, instalador `EVIE-CRM-V2-Setup.exe`, clave personal e IndexedDB. Versión de aplicación 2.1.0, preferencias 2, Store personal 4 sin migración destructiva.

## Implementación entregada

1. **Inicio y migración:** eliminado el temporizador de onboarding. Diagnóstico/configuración manuales. Respaldo byte-exacto de ajustes antes de convertir opacidad; conserva campos/rutas/permisos. Rechaza ajustes corruptos/futuros sin sobrescribir.
2. **Glass:** tokens 0–100; base 90–96 %, paneles 92–97 %, overlays 97–100 %, blur de 50 px en superficies compatibles; núcleo/texto independientes. Decoración en cero al máximo. Corrección de layout al 200 % mediante wrapping y container query, sin esconder overflow.
3. **Voz continua:** clic inicia, clic detiene; VAD calibrado con voz sostenida y 1100 ms de silencio. Whisper instalado, modelo seleccionado y WAV SAPI real. La promesa de TTS termina con onended; entonces reabre captura. Cancelación/epochs, denegación sin retry y diagnóstico sin transcripción.
4. **Micrófono:** consentimiento persistente/revocable separado de confirmaciones de acción; permiso Windows independiente.
5. **Núcleo:** expansión 28 % según amplitud de escucha, 23 % según habla, deformación/glow por analyser, transcripción hacia dentro y pensamiento cyan/violeta. Respeta movimiento reducido. Cerdo Three.js preservado.
6. **Inteligencia CRM:** router antes de ofrecer/ejecutar tools; lote completo validado antes de actuar. Finanzas usa ledger existente y centavos; resumen/búsqueda/alta/edición/archivo; búsqueda de entidades y lectura por ID. Cliente exacto, duplicados con selección de ID y sin escritura previa. Una mutación por petición, preview, confirmación, commit validado/read-back; no éxito basado solo en texto del modelo.
7. **Modelos:** lista `/api/tags` y capacidades `/api/show`; seleccionado/Rápido/Más preciso explícitos. Sin fallback, cambio ni descarga silenciosos.
8. **Windows:** catálogo Win32, Start Menu sin argumentos, Store AppUserModelID y protocolos seguros; fuente/editor, icono ejecutable si disponible, capacidades, autorización individual y revocación. Apertura/foco/minimizar/maximizar/restaurar, cierre normal confirmado, volumen/media, HTTPS y búsqueda codificada. Spotify búsqueda sin fingir reproducción, Roblox apertura, WhatsApp borrador confirmado sin envío.
9. **Archivos:** selección individual; reveal; rename/move mismo volumen sin sobrescribir; revalidación de identidad; Papelera mediante API del sistema y sin eliminación permanente alternativa.
10. **Confirmación:** token main inmutable de 90 s, una acción/un uso; botón o endpoint Whisper dedicado con frase exacta «Sí, confirma». Sin aprobación emitida por el modelo. Grants solo para bajo riesgo, por acción/identidad/destino; cambiar una identidad invalida sus grants anteriores. Sensibles siempre confirman.

## Ejemplos exigidos

- `Agrega en Finanzas mil pesos de una venta de Intensity`: `finance.create_transaction`, ingreso `amount:100000`, categoría Ventas, hoy. Resuelve cliente exacto si existe, pregunta ante duplicados. Las pruebas verifican **cero cambios Agenda**.
- `Agenda mañana cobrarle a Intensity mil pesos`: `crm.create_task`, mañana. **Sin escritura financiera**.

No se modifican movimientos con `origin` vinculado genéricamente: se remiten a su dominio original para preservar consistencia.

## Resultados automatizados y alcance

| Ejecución | Resultado | Evidencia |
|---|---:|---|
| `npm ci` | Correcto; 0 vulnerabilidades conocidas en esa ejecución | Salida de instalación; persisten avisos de deprecación |
| `npm run build` | Correcto, 41 módulos, worker 22.14 kB | Salida Vite |
| `npm run test:desktop` / `node --test tests/*.test.cjs` | **50 pasan, 0 fallos** | `evidence/update-node.tap` |
| Suite web heredada | **177 pasan, 0 fallos** | `evidence/update-suite.json` |
| Adaptador Agenda/Finanzas + fallback web | **38 pasan, sin errores JS** | `evidence/phase3-browser.json` (actualizada) |
| UI desktop simulada: 16 rutas, 1366/1920, zoom 100/125/150/200 %, setup/modelos/core | **133 pasan** | `evidence/update-ui.json` |
| Matriz visual heredada | **1152 checks, sin incidencias**, foco/teclado/zoom correctos | `evidence/visual-matrix.json` |
| Three.js/core/fallback/exportación | **8 pasan** | `evidence/phase3-graphics.json` (actualizada) |
| Electron fuente aislado | **16 pasan** | `evidence/phase3-electron.json` (actualizada) |
| Empaquetado Linux + arranque del paquete | **16 pasan** | `evidence/phase3-packaged-electron.json` (actualizada) |

Los nombres `phase3-*` se conservaron por compatibilidad con runners; sus fechas indican las ejecuciones de esta actualización. Se incluyen nuevas capturas `update-home-1366.png` y `update-settings-1366.png`. Las pruebas Electron usan decisiones IPC automatizadas y micrófono sintético Chromium. La suite Windows de Node usa fixtures: **no ejecuta APIs reales de Windows**.

### Incidencias encontradas y correcciones

- La primera prueba financiera añadió Intensity cuando el fixture ya lo contenía: la guardia de duplicados rechazó correctamente. Se ajustó el fixture, sin eliminar la guardia.
- La nueva matriz detectó overflow en Inicio a 1366/zoom 200 %. Se corrigieron topbar, tags y grids con wrapping/container query; 133 checks posteriores pasan.
- Faltaba `xauth` en el entorno restaurado; se instalaron dependencias de test gráficas, no se modificaron requisitos de Windows.
- Un lanzamiento Electron dentro de la ejecución larga agotó 20 s esperando DALI_READY. La repetición aislada pasó los 16 checks; el paquete Linux también pasó. Se registra como timeout transitorio del entorno, no como éxito de aquella ejecución fallida.
- Hubo interrupciones del sandbox durante el trabajo. Los resultados finales se guardaron en archivos; no se consideran pruebas los procesos interrumpidos sin resultado.

## Archivos de implementación cambiados respecto de la entrega Phase 3

### Runtime y configuración

- `package.json`, `package-lock.json`, `public/config.js` — versión 2.1.0 y comando test:update-ui; toolchain fijada preservada.
- `electron/main/settings.cjs` — migración, backups, micrófono, modelos, mappings/grants y revocación al cambiar identidad.
- `electron/main/main.cjs` — integración, contexto/modelos, permisos, catálogo, IPC confirmación/archivos y diagnóstico.
- `electron/preload/preload.cjs` — bridge estrecho extendido y errores CRM útiles acotados.
- `electron/security/contracts.cjs` — 33 contratos tipados.
- `electron/security/confirmation.cjs` — nuevo broker de aprobación exacta.
- `electron/ai/router.cjs` — nuevo router determinista y parser estrecho de ejemplos.
- `electron/ai/ollama.cjs` — scope, contexto, modelos compatibles, aclaraciones y respuestas verificadas.
- `electron/tools/registry.cjs` — Finanzas local, fallos de preparación, grants y snapshot Windows.
- `electron/tools/windows.cjs` — ejecución tipada y alcance de acciones/grants.
- `electron/tools/catalog.cjs` — nuevo descubrimiento/validación/identidades/capacidades.
- `electron/tools/files.cjs` — nuevas operaciones acotadas de documentos/medios.
- `scripts/discover-apps.ps1` — nuevo inventario de lectura Windows.
- `scripts/windows-tools.ps1` — control de ventana por ruta exacta y cierre no forzado.
- `public/desktop-agenda.js` — proveedor compartido ampliado a ledger/entidades, snapshots/read-back y cliente ambiguo.
- `public/desktop-voice.js` — VAD/sesión, TTS completion, cancelación y captura de confirmación.
- `public/desktop-ui.js` — configuración manual, slider/modelos/mic, catálogo/grants/archivos, conversación no modal y preview de acción.
- `public/ivy-core-renderer.js` — estados reactivos más visibles y métricas.
- `public/phase3.css` — tokens glass, superficies, zoom/layout, conversación y catálogo.

### Pruebas y documentación

- `tests/desktop.test.cjs`, `tests/voice.test.cjs` — regresiones existentes ampliadas.
- `tests/routing.test.cjs`, `tests/settings.test.cjs`, `tests/windows-update.test.cjs` — nuevas suites.
- `tools/test-phase3-browser.mjs`, `tools/test-electron.mjs` — integración ampliada.
- `tools/test-update-ui.mjs` — nueva matriz desktop/appearance.
- `README.md`, `docs/WINDOWS_SETUP.md`, `docs/WINDOWS_ACCEPTANCE.md`, `docs/SECURITY_MODEL.md` — actualizados.
- `docs/UPDATING_WINDOWS.md`, `docs/UPDATE_2_1_REPORT.md` — nuevos.
- Evidencias listadas arriba y capturas regeneradas por los runners.

Store, Records, media-store, claves personales, base IndexedDB, Forge IDs/nombres y assets IA no se reemplazaron.

## Límites pendientes/no habilitados

- **No hay instalador Windows generado/validado aquí**. `npm run make:win` debe ejecutarse en Windows y validar upgrade/rollback sobre una copia real del perfil.
- Requiere Windows real: voz española completa, permiso tras reinicio, ruido variable/VAD, SAPI/Whisper/Ollama, Acrylic/wallpaper, DPI nativo, discovery de todas las variantes, Store/protocolos, ventanas y Papelera.
- `.lnk` con argumentos se excluyen deliberadamente. Store/protocolos no prometen foco/minimizar/cerrar; usan apertura. Iconos Store/protocolo pueden ser iniciales. Editor Win32 proviene de metadatos, no es una validación de firma.
- WhatsApp prepara borrador, no envía; navegador predeterminado hace la búsqueda, no se promete automatización específica de Opera. No hay uploads/downloads, streaming/publicación, escritura arbitraria de contenido, compras ni herramientas privilegiadas.
- Movimientos de archivos son del mismo volumen y requieren revisar cualquier error parcial. No se prueba concurrencia hostil de otros procesos.
- VAD energético no garantiza clasificar cualquier sonido ambiental como no-voz; anotar y ajustar en aceptación con el hardware real. Nunca usarlo como autorización para una acción sensible.
- No se desplegó producción ni se habilitó sincronización cloud. No usar evidencia Linux como sustituto del checklist de 20 categorías de Windows.

## Comandos de entrega

```powershell
npm ci
npm run test:desktop
npm run dev:desktop
npm run make:win
```

El ZIP completo de fuente contiene Electron, scripts, UI, tests, docs y evidencia; excluye node_modules, builds, perfiles personales, modelos y credenciales. No es instalador ni respaldo de datos. Seguir `UPDATING_WINDOWS.md` antes de instalar sobre la versión anterior.
