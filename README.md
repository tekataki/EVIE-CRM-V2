# EVIE CRM V2 · ampliación multiusuario en desarrollo

Repositorio autoritativo: `/home/user/webapp`. Se amplía el producto existente, no un prototipo paralelo. Renderer Vanilla compartido web/móvil/Electron, 16 módulos, Store esquema 4 y 38 colecciones. La versión de paquete sigue siendo **2.1.0** mientras se completa y valida el nuevo master prompt.

**Estado del 28 de septiembre de 2026:** conexiones externas desactivadas; no despliegue de producción, Supabase vivo ni instalador Windows nuevo. La implementación multiusuario es parcial. Los informes 2.1/Phase 3 anteriores son históricos, no certifican esta ampliación.

## Implementado y comprobado localmente

- Materiales compartidos navy/grafito, paneles legibles y núcleo neuronal conservado. Nombre, iniciales y saludo dinámicos en las superficies ya adaptadas; queda copy global por revisar.
- Personalización: mostrar, ocultar, ordenar, fijar hasta cinco favoritos y elegir cinco accesos móviles. Los favoritos visibles aparecen primero, sin duplicados y siguiendo el orden de módulos. Ocultar conserva la preferencia y todos los registros; mostrar restaura el favorito. Inicio, Perfil y Configuración no pueden ocultarse.
- Navegación accesible: nombre de favorito también con barra colapsada, una sola página actual, foco conservado al ocultar/mostrar, cambiar accesos o restaurar módulos. Arrastre y botones Subir/Bajar probados en Chromium. Los módulos ocultos siguen accesibles desde Buscar, accesos móviles o los comandos existentes de Ivy, como `Abre Libros`. No se ha ampliado el parser español en este bloque.
- Cuenta mediante usuario/contraseña; frontend y backend REST de Supabase Auth, sin contraseñas ni tokens persistidos en el renderer. Desactivado de forma predeterminada, sin cuentas ficticias.
- Perfiles y colecciones completamente vacíos para cuentas nuevas, con preferencias independientes. La clave `?qa=NOMBRE` conserva fixtures históricos solo para pruebas locales; no concede autenticación.
- Sesiones web con cookie opaca HttpOnly/Secure/SameSite, hash del identificador y tokens AES-GCM en D1. Requests de datos ligados al UUID autenticado; validación de origen en mutaciones.
- Migración SQL de perfiles, preferencias, registros/contactos y dispositivos con RLS. `owner_id` UUID; `record_id` TEXT sensible a mayúsculas con `^[a-zA-Z0-9-]{1,80}$`. No se regeneran ni convierten los IDs existentes.
- Sync por registro: diff durable contra sombra verificada, revisiones optimistas, tombstones, lotes atómicos RPC, comparación JSON canónica, conflictos explícitos y respaldo previo a resolverlos. ACK incompleto no vacía cambios pendientes. Un 409 durante el envío consulta otra vez las versiones, sin reintento ciego de escritura. La resolución valida versión de vista previa y estado local, incluye registros vinculados no conflictivos y rechaza revisiones remotas regresivas.
- Verificación de sesión y sincronización al recuperar conexión/foco y cada 60 segundos en una pestaña visible. No Supabase Realtime. El refresco evita reemplazar un formulario abierto.
- Bloqueo entre pestañas mediante notificación sin credenciales. Cierra estado renderizado, borradores, historial Ivy, propuestas, voz y animaciones. Conserva la caché propia; no la reasigna. Propuestas y Undo se ligan al namespace de origen.
- IndexedDB de imágenes por cuenta. Migración y rollback fijan su base de destino: cambiar de cuenta nunca redirige una copia o borrado pendiente. URLs Blob se revocan y las cargas tardías se descartan.
- Permisos Electron por cuenta/dispositivo, transporte HTTPS tipado y guardas de epoch contra diálogos nativos tardíos. Probado con mocks Node; falta repetir aceptación Electron integrada y Windows real.
- Migración legacy explícita para la cuenta autorizada: preview, ZIP con `data.json` byte-exacto, imágenes, hashes SHA-256, copia local verificada y diario durable. No se lee el legado durante el arranque normal de una cuenta.
- PWA: build genera manifiesto de 97 assets estáticos. Caché versionada de HTML/JS/CSS; excluye API, credenciales, medios privados y URLs firmadas. No fuerza actualizaciones sobre formularios abiertos.

## Límite offline actual

La página ya abierta mantiene las escrituras locales y su cola cuando pierde conexión. **Al reabrir sin red, la PWA carga el shell pero bloquea los datos porque no puede verificar configuración/sesión.** Tampoco abre automáticamente el perfil legacy. Todavía no existe desbloqueo offline autenticado de una nueva ventana. No describir este comportamiento como acceso offline completo a cuentas.

## Identidades y almacenamiento

| Elemento | Valor preservado |
|---|---|
| Producto | EVIE CRM V2 |
| Application ID | `com.evie.crm.v2` |
| Origen y entrada Electron | `evie://app` · `evie://app/index.html` |
| Perfil Windows | `%APPDATA%\EVIE-CRM-V2` |
| Assets IA | `%LOCALAPPDATA%\EVIE\ai` |
| Instalador previsto, no entregado | `EVIE-CRM-V2-Setup.exe` |
| Clave legacy | `dali-os-local-v1` |
| IndexedDB legacy | `dali-os-local-v1-media` |
| Cuenta | `evie-account-<auth_uuid>` |
| Imágenes de cuenta | `evie-account-<auth_uuid>-media` |
| Esquema / moneda | 4 / centavos enteros MXN |

La caché CRM local y los ZIP **no están cifrados** por EVIE. El aislamiento lógico por cuenta no protege contra alguien con acceso al perfil del navegador, DevTools o disco. RLS y sesiones del servidor sí constituyen la frontera de acceso remoto. Protege el usuario del SO y los respaldos. Ocultar un módulo es una preferencia visual, no una restricción de acceso.

Las sesiones backend usan el binding D1 `AUTH_DB` y `migrations/0001_auth_sessions.sql`. Los registros remotos usan las migraciones `supabase/migrations/`. El bucket privado `user-media` y sus políticas RLS se prueban en PostgreSQL embebido con un catálogo Storage emulado. La migración `202609250003_validation_guards.sql` corrige campos SQL nulos, limita revisiones a enteros seguros y exige paths de imagen bajo el UUID propietario, incluso ante otras políticas permisivas. **El adaptador remoto de imágenes y la aceptación del API Storage real siguen pendientes**.

## Arranque local

Node 22.12 o posterior. No se requieren credenciales para construir o ejecutar las pruebas offline.

```sh
npm ci
# En un sandbox de 1 GiB, detener primero el preview si estaba iniciado:
pm2 stop webapp
npm run test:desktop
npm run build
NODE_OPTIONS=--max-old-space-size=192 pm2 start ecosystem.config.cjs
curl -f http://localhost:3000/api/runtime
```

Si es el primer arranque, omite `pm2 stop webapp`; si ya estaba registrado, usa `pm2 restart webapp --update-env` con el mismo `NODE_OPTIONS`. Node/PGlite y Chromium se ejecutan en secuencia, no simultáneamente. Ejecutar PGlite junto a Wrangler agotó la memoria de este sandbox; la suite pasó sin servidor. `tools/run-suite.mjs` limita el heap V8 de Chromium a 160 MiB, tiene un plazo de 150 segundos medido desde Node y cierra el navegador en `finally`. Este límite pertenece al ejecutor de pruebas, no al producto ni a Electron.

`npm run build` ejecuta `scripts/build-shell.mjs` antes de Vite. Preview Hono/Workers: `http://localhost:3000`. Producción: **no desplegada**. No se han cambiado servicios reales ni aplicado migraciones remotas.

El runtime predeterminado informa `accountsEnabled:false` y proveedores Spotify/WhatsApp/Instagram desactivados. Configuración de ejemplo en `.env.example`; no colocar secretos en `public/` ni subir `.dev.vars` a Git.

## Rutas y contratos

- `/` o `/index.html#inicio`: renderer compartido.
- Módulos: `#inicio`, `#agenda`, `#finanzas`, `#gimnasio`, `#objetivos`, `#soma`, `#aprendizaje`, `#bitacora`, `#granja`, `#libros`, `#alvento`, `#contenido`, `#vision`, `#subir`, `#perfil`, `#configuracion`.
- `/tests.html`: suite del dominio; `?qa=NOMBRE` en modo local aísla datos de pruebas.
- `GET /api/runtime`: capacidades públicas, sin credenciales.
- `POST /api/auth/signup`, `POST /api/auth/signin`: `{username,password}`.
- `GET /api/auth/session`: identidad verificada o `null`.
- `POST /api/auth/signout`: `{all:boolean}`.
- `POST /api/data/pull`: `{after:string}`; `POST /api/data/push`: `{changes:[...]}`. Owner inferido de sesión, no del payload.
- `/sw.js`, `/sw-manifest.js`, `/manifest.webmanifest`: instalación y caché estática web. Electron no registra el SW.

## Guía de uso actual

1. Sin backend configurado, abre el espacio local existente; un origen nuevo no recibe datos de Dalí.
2. Perfil o Configuración → Personalizar módulos. Fija favoritos con la estrella; usa Subir/Bajar o arrastra para ordenar. Ocultar retira de la barra lateral, no elimina registros ni bloquea Buscar/Ivy. Los cinco accesos móviles se eligen por separado. Restaurar orden también muestra módulos y vacía favoritos, sin cambiar registros.
3. En un entorno de cuentas habilitado, inicia sesión solo con usuario y contraseña y completa nombre/saludo. La cuenta nueva empieza vacía.
4. Cuenta y sincronización permite revisar conflictos, sincronizar y cerrar sesión. Ante cambio de sesión en otra pestaña, se bloquea el espacio y se requiere verificar de nuevo.
5. Solo la cuenta designada mediante `EVIE_LEGACY_OWNER_ID` verá la migración. Revisa conteos, confirma y guarda el ZIP. La fuente permanece intacta. La verificación cloud no está terminada y se registra como `false`.
6. Si aparece un diario de migración interrumpida, conserva fuente, ZIP y destino. No borres el marcador ni repitas una importación a ciegas: no existe recuperación automática de procesos cerrados a mitad de copia.
7. Las capacidades Windows/voz permanecen en Desktop. Los borradores WhatsApp y búsquedas Spotify heredadas no equivalen a envío o playback verificados.

## Pruebas comprobadas de este bloque

| Prueba | Resultado | Evidencia |
|---|---:|---|
| Node, preferencias, Auth Hono/SQLite, SQL PGlite, Storage RLS, sync y migración | 140/140 | `evidence/accounts-personalization-node.tap` |
| Chromium: favoritos, aislamiento, PWA, migración, foco y conflictos | 45/45 | `evidence/accounts-offline-browser.json` |
| Chromium: regresión Agenda/Finanzas/voz web | 38/38 | `evidence/phase3-browser.json` |
| Chromium: suite heredada del CRM | 177/177 | `evidence/accounts-crm-regression.json` |
| Build después de personalización | Correcto | `evidence/accounts-personalization-build.txt` |

```sh
# Sin preview activo en el sandbox de 1 GiB:
npm run test:desktop
# Con preview ya iniciado; ejecutar secuencialmente:
node tools/test-accounts-offline.mjs
node tools/test-phase3-browser.mjs
node --max-old-space-size=128 tools/run-suite.mjs evidence/accounts-crm-regression.json
```

PGlite ejecuta las tres migraciones SQL con roles/auth y catálogo Storage emulados; no es una prueba contra Supabase vivo. Comprueba CRUD/RLS entre cuentas, anonimato, rutas inválidas, bucket privado, nulos/tipos, atomicidad e IDs de texto. No valida subida HTTP, MIME real, URLs firmadas ni almacenamiento de blobs remoto. La prueba browser de cuentas simula HTTP Auth/sync, pero usa Store, IndexedDB, ZIP, BroadcastChannel, teclado, arrastre y renderer reales. Se envía `Abre Libros` desde el formulario de Ivy con el módulo oculto. La PWA se prueba con el runtime Wrangler local real.

El backend Hono tiene además 16 pruebas de signup/signin, cookie opaca, cifrado, rate limit, identidad esperada, renovación concurrente y logout. Ejecutan las sentencias SQL de D1 contra SQLite real mediante un adaptador de pruebas; Supabase HTTP sigue simulado, no se ha validado D1 distribuido. Un fallo temporal de refresh conserva la sesión cifrada; un refresh inválido la revoca. Logout exige la identidad esperada, incluso al reintentar. Estas pruebas no certifican Windows ni completan la matriz visual/zoom.

## Pendiente del master prompt y siguientes pasos

1. Adaptador de medios remotos y aceptación Storage real; aceptación Auth/refresh/logout en D1 y Supabase reales; validación de todas las invariantes del dominio en servidor más allá de los constraints SQL ya endurecidos; lotes de más de 5.000 cambios.
2. Recuperación de migración interrumpida y verificación cloud de todos los registros/imágenes; desbloqueo offline definido de forma segura.
3. Matriz visual/zoom completa, avatar de onboarding y copy dependiente del modo. Los favoritos ya se reflejan en la navegación compartida.
4. Ampliar parser español, navegación por voz, manos libres/Undo, diagnóstico de micrófono, wake word/palmada experimental; navegador preferido/Opera y UI Automation tipada.
5. Spotify PKCE/playback y conectores autorizados Meta/contactos/mensajería. No hay envío WhatsApp ni integración Instagram terminados.
6. Repetir Electron integrado; probar Windows real, instalación/upgrade/rollback, hardware, SAPI/Whisper/Ollama, permisos, DPI y Acrylic.
7. Completar documentación de configuración/seguridad/release, inventario de exportación, versión final, ZIP final y eventual instalador.

## Base Desktop conservada

33 herramientas tipadas, Ollama local, Whisper, SAPI, grants por aplicación, preview/confirmación y readback de Agenda/Finanzas. El renderer no obtiene shell ni IPC genérico. Compras y movimientos financieros externos siguen bloqueados.

```powershell
npm ci
npm run dev:desktop
# Empaquetado y verificación requieren entorno Windows adecuado:
npm run make:win
```

Identidad de instalador prevista: `out/make/squirrel.windows/x64/EVIE-CRM-V2-Setup.exe`. No se ha generado en este bloque.

Referencias históricas: [Auditoría inicial](CURRENT_AUDIT.md), [Informe 2.1](docs/UPDATE_2_1_REPORT.md), [Setup Windows](docs/WINDOWS_SETUP.md), [Actualización](docs/UPDATING_WINDOWS.md), [Aceptación Windows](docs/WINDOWS_ACCEPTANCE.md), [Modelo de seguridad](docs/SECURITY_MODEL.md). No asumir que una evidencia antigua valida funciones nuevas.
