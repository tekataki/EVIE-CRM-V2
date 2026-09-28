# EVIE CRM V2 · límites de confianza

## Ampliación multiusuario en desarrollo · 2026-09-25

No hay despliegue ni Supabase vivo configurados. Servicios externos cerrados por defecto. Esta sección describe controles implementados, no una certificación de producción; los controles desktop posteriores conservan la base 2.1.

- Supabase Auth REST valida usuario/contraseña a través de Hono. El renderer no recibe tokens Auth ni guarda contraseñas. Cookie web opaca `__Host-evie-session`, HttpOnly, Secure, SameSite=Strict; hash SHA-256 del ID y tokens cifrados AES-GCM en D1. No clave `service_role`. Mutaciones requieren Origin exacto, JSON y `X-Evie-Request:1`.
- Hono Auth se prueba con SQLite real mediante adaptador D1 y Supabase HTTP simulado: cookie opaca, cifrado, rate limit, rotación, refresh concurrente y logout por propietario. El lease de refresh compara también el ciphertext anterior para impedir reutilizar una lectura obsoleta. Fallos temporales del proveedor no borran la sesión; tokens/expiraciones malformados no se persisten. Cerrar sesión requiere identidad esperada y un fallo global no se presenta como éxito. Tras un cierre fallido, la UI exige verificar la sesión antes de volver a pedirlo. No equivale a aceptación D1 distribuido/Supabase vivo.
- `X-Evie-User` liga cada solicitud a la cuenta abierta, además de verificar el usuario Supabase. Una cookie cambiada en otra pestaña no autoriza a escribir los datos anteriores bajo el usuario nuevo. Un 401 bloquea el estado; un 409 conserva sesión y cambios para revisar conflicto.
- `owner_id` es UUID de Auth; `record_id` sigue siendo TEXT sensible a mayúsculas. RLS, RPC CAS atómicas y políticas Storage se probaron en PGlite con catálogo Storage emulado. La migración 003 rechaza campos nulos/incompletos, restringe revisiones a enteros seguros y corrige un bucket preexistente público; sus políticas restrictivas no se eluden añadiendo otra política permisiva. Falta aceptación Supabase/Storage real y validación completa del dominio en servidor.
- BroadcastChannel y evento storage transportan solo una invalidación sin identidad ni credenciales. El receptor bloquea; nunca acepta del evento un usuario de destino. Se verifican sesiones al volver a foco/conexión y periódicamente con la pestaña visible. Datos cacheados nunca sustituyen una verificación fallida al reabrir.
- Cerrar/cambiar sesión cancela sync, voz, propuestas, Undo vinculado a scope y cargas de medios; limpia historial de conversación, borradores y DOM. Las escrituras del Store requieren seguir en el namespace original. Se conservan los cambios persistidos del usuario original, sin copiarlos al siguiente.
- IndexedDB se abre por cuenta. Los handles de una migración fijan el destino incluso para rollback. La separación local es lógica, **no cifrado ni protección contra DevTools, acceso al disco o un usuario del SO que comparta el perfil**.
- Electron usa un origen HTTPS configurado en main y una allowlist estrecha, no fetch arbitrario del renderer. Configuración/grants por UUID de usuario/dispositivo. Un epoch con AsyncLocalStorage impide transferir permisos de un diálogo pendiente al cambiar de cuenta. Falta prueba Electron integrada contra un backend real.
- Migración legacy: acceso explícito a preview solo para el UUID configurado, confirmación, respaldo byte-exacto con imágenes/hashes, diario durable y readback local. La restricción cliente no protege el disco compartido. `cloudVerified:false` hasta implementar y verificar medios remotos. Si falla el rollback o se cierra el proceso a mitad, el diario bloquea repetir a ciegas; no hay recuperación automática todavía.
- Los conflictos usan una revisión de vista previa y verifican que el estado local no cambió antes de aplicar una elección. Los registros acompañantes y los conflictos se validan juntos en el Store; el respaldo se persiste antes de sustituir datos. Si falla la cuota, se detiene la resolución. Un 409 en el push provoca una sola lectura nueva, no una escritura repetida a ciegas. Revisiones remotas regresivas o payloads distintos con la misma revisión se rechazan. Estas garantías se prueban con dispositivos simulados y con botones reales del renderer en Chromium.
- PWA cachea únicamente el shell estático allowlisted, instalado sin credenciales. API, sesiones, medios privados y URLs firmadas no entran al caché. HTML/JS/CSS permanecen en la misma versión y no hay `skipWaiting()` automático. Reabrir offline muestra el shell bloqueado, no acceso autenticado offline completo.

Pruebas actuales y pendientes: [README](../README.md). Evidencia nueva: `accounts-sync-node.tap` (134 pruebas), `accounts-auth-node.tap`, `accounts-storage-node.tap`, `accounts-offline-browser.json`, `accounts-crm-regression.json`. No afirmar integraciones Spotify/Meta, Storage remoto, instalación Windows o aceptación física a partir de estos tests.

## Host y datos

UI Vanilla compartida; web carece de `evieDesktop`. Electron carga solo `evie://app/index.html`, perfil `%APPDATA%\EVIE-CRM-V2`, CSP local, `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`. Main autentica emisor, frame principal, protocolo y host, valida argumentos exactos y aplica límites de frecuencia. Preload nunca expone ipcRenderer, require, fs, shell, tokens ni ejecución genérica. Se bloquean ventanas externas, webviews y navegación externa privilegiada.

Store esquema 4 e IndexedDB existentes, con adaptador de sincronización por cuenta desactivado hasta configurar el backend. El CRM local no está cifrado por EVIE; proteger usuario/disco/respaldos. La migración de preferencias guarda bytes originales antes de escribir. Datos inválidos o de una versión posterior se conservan y provocan error, no un perfil vacío.

## Modelo y herramientas

Ollama solo llama a `127.0.0.1:11434`, sin redirecciones. Modelos instalados y compatibles se consultan sin descargar; selección explícita, sin fallback silencioso. Máximo seis rondas, ocho llamadas por mensaje y una mutación por petición.

Prompt, transcripción y contenido de registros no conceden permisos. El router determinista limita las herramientas ofrecidas **y valida cada llamada antes de ejecutar cualquier llamada del lote**. Finanzas escribe `transactions` en centavos enteros, nunca Agenda como sustituto. Los clientes se resuelven por coincidencia exacta; duplicados requieren elección explícita. Una aclaración caduca en 120 segundos y todavía requiere una nueva confirmación de escritura. Los IDs inventados se rechazan.

## Confirmación y consentimiento

- Lecturas: sin confirmación, sin mutación.
- Navegación EVIE: bajo riesgo.
- Acciones Windows de bajo riesgo: aprobación o grant persistente de acción/app/destino. El antiguo interruptor global `lightConfirm` no omite permisos.
- CRM, archivo, borrador de mensaje y cierre de aplicaciones: siempre preview y confirmación. No existe grant permanente sensible.
- Token main aleatorio, acción inmutable, caducidad 90 s, un solo uso. El botón responde al token exacto. Confirmación hablada usa **otro endpoint de audio**: Whisper local debe transcribir exactamente «Sí, confirma». No se acepta texto del modelo como aprobación.
- Cancelar invalida token y generación de ejecución; no deshace acciones que ya terminaron. Una propuesta CRM guarda snapshot/revisión y caduca a los 120 s. Un cambio posterior obliga a preparar otra.
- Micrófono: consentimiento persistente separado, solicitado manualmente, revocable. Origen exacto y solo audio. No se ignora la privacidad de Windows ni se insiste en bucle tras denegación.

## Windows

Catálogo obtenido por helper fijo de lectura: accesos Start Menu **sin argumentos**, App Paths, StartApps/AppUserModelID y seis protocolos con plantillas limitadas. La autorización se realiza con diálogo nativo por identidad individual. `.lnk` con argumentos no se ejecutan. Iconos de ejecutables se obtienen mediante Electron; Store/protocolos pueden mostrar iniciales y fuente resuelta. El catálogo no autoriza por existir.

No hay parámetros de proceso definidos por el modelo. Ejecutables se validan como archivos locales y se bloquean intérpretes/administración/instaladores/acceso remoto/gestores de contraseñas conocidos. Esto no sustituye la confianza del usuario en un binario: un equipo comprometido o binario autorizado malicioso queda fuera de la garantía. No autorizar desconocidos o ubicaciones modificables por terceros.

Apertura Store usa identidad validada con Explorer; protocolos tienen plantillas cerradas. Foco/control de ventana filtra por ruta ejecutable exacta; cierre usa CloseMainWindow, no termina procesos por fuerza. Windows puede rechazar foco. Multimedia informa solicitud enviada, no reproducción probada. Spotify abre búsqueda codificada, no playback exacto. WhatsApp prepara borrador confirmado con destinatario y texto completos, **nunca envía**. La búsqueda web codifica el texto; HTTPS adicional exige dominio autorizado exacto, sin credenciales ni puerto no estándar.

Helpers PowerShell fijos, `shell:false`, sin concatenación de código, sin ExecutionPolicy Bypass, admin ni cambios de registro/seguridad/servicios/tareas. No acceso a contraseñas/cookies/tokens, compras, banca/crypto, instalación, publicación, streaming, envío autónomo, remote control ni automatización genérica de teclado/navegador. No se implementa una herramienta alterna cuando algo no está admitido.

## Archivos

Solo documentos/medios seleccionados individualmente por el usuario. Carpetas autorizadas solo como destinos, no acceso recursivo. Sin rutas del modelo, UNC, enlaces/redirecciones, perfiles/sistema protegidos ni nombres sensibles. Antes de confirmar se captura identidad/tamaño/fecha y destino; se revalida al ejecutar. Renombrar conserva extensión. Mover/renombrar usa enlace duro y elimina el enlace original únicamente tras verificar; solo mismo volumen, no sobrescribe y no hay fallback de copia. Si hay fallo parcial se conserva el archivo y se advierte revisar ambas ubicaciones. No se promete atomicidad frente a otros procesos modificando simultáneamente el mismo archivo.

Papelera usa `shell.trashItem`; si falla, devuelve error. **Nunca se sustituye por unlink** ni se vacía la Papelera. No se ofrece escritura arbitraria de contenido ni uploads/downloads por herramientas.

## Audio

Sesión explícita, sin wake word ni escucha de arranque. VAD energético requiere calibración, energía de voz sostenida y 1.100 ms de silencio. No es un clasificador semántico: ruido no estacionario y dispositivos reales requieren aceptación. Ventanas máximas de 59 s, PCM mono 16 kHz. Detener libera tracks, nodos, RAF, buffers y procesos pendientes; epochs descartan respuestas tardías. Diagnóstico nunca transcribe.

Whisper y SAPI usan temporales eliminados en finally; un cierre forzado del SO puede dejar `evie-audio-*` en TEMP. No se guarda historial de audio. El analyser mide micrófono y el WAV de SAPI real; la sesión vuelve a escuchar solo después de onended. Se pausa al ocultar/salir.

Auditoría rotativa: herramienta, nombres de argumentos, decisión y estado; nunca valores, audio, notas, transcripciones o tokens. Google OAuth heredado usa safeStorage, scope explícito y loopback, sin sincronización activa.

## Verificación

Fixtures y Linux prueban lógica, contratos y Electron aislado, no la instalación ni APIs reales de Windows. Ver `UPDATE_2_1_REPORT.md` y checklist manual `WINDOWS_ACCEPTANCE.md`. No se consideran certificados SAPI/Whisper/Ollama reales, catálogo/Store/protocolos, controles nativos, Papelera, Acrylic o upgrade por ejecutar mocks.
