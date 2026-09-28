# EVIE CRM V2 — auditoría inicial del nuevo encargo

Fecha: 2026-09-25 (UTC). Versión inspeccionada: 2.1.0.

## Procedencia y alcance

- Proyecto existente: `/home/user/webapp`, rama `main`.
- Commit base disponible: `047d0f0`.
- Se leyó completo el nuevo documento `EVIE_CRM_V2_FINAL_MASTER_PROMPT_FOR_ASTRA.md` (1.109 líneas). Este encargo solicita cuentas, sincronización e integraciones adicionales que no pertenecían a la entrega anterior.
- El archivo `BbDJrQBw(1).zip` mencionado en el documento no está entre los adjuntos locales de este turno. No se ha descargado, extraído ni certificado su igualdad con el repositorio disponible.
- Inventario inicial: 310 archivos versionados; 182 en public, 15 en electron, 7 en scripts, 5 en tests, 6 en tools, 2 en src, 7 en docs, 74 en evidence, 1 en assets y 11 en la raíz. Es un inventario, no una afirmación de revisión línea por línea de todos los archivos.
- Revisión directa de package.json, README.md, .gitignore, public/index.html, public/phase3.css, public/store.js y src/index.tsx; búsquedas dirigidas en las fuentes de aplicación e identidad.
- La referencia visual suministrada muestra paneles azul marino densos, bordes discretos y acentos azules. No se han copiado marca, contenido ni activos del diseño de referencia.

## Verificación nueva, no reutilizada del informe anterior

Entorno Linux, Node v22.23.2, npm 10.9.8.

| Comando | Resultado actual |
| --- | --- |
| `npm ci --cache /home/user/.npm` | Correcto: 239 paquetes instalados, 240 auditados, 0 vulnerabilidades reportadas |
| `npm run test:desktop` | 50 pruebas aprobadas, 0 fallidas, 0 omitidas |
| `npm run build` | Correcto: Vite 8.2.2, 41 módulos; dist/_worker.js 22,14 kB, gzip 9,10 kB |

Persisten avisos de obsolescencia de inflight, glob 7 y rimraf 2. La ausencia de vulnerabilidades reportadas por npm no demuestra la seguridad completa del producto.

No se han repetido todavía las pruebas de navegador, Electron empaquetado ni la matriz visual en este turno. La evidencia anterior sigue siendo histórica. No se ha realizado ninguna prueba Windows ni contra proveedores externos.

## Base existente

- Renderer compartido en public, con transporte Hono mínimo y host Electron separado.
- Store con validación, esquema 4, centavos enteros y control optimista de revisión; medios IndexedDB separados.
- Las 50 pruebas actuales cubren contratos tipados, separación Finanzas/Agenda, resultados verificados, confirmaciones, preferencias, cancelación de voz, VAD sintético, catálogo y operaciones restringidas sobre archivos.
- No se han cambiado identidades, claves de datos, rutas de IA ni preferencias del usuario.

## Faltantes y riesgos confirmados

1. No se encontraron AuthAdapter, DataAdapter, integración Supabase ni registro de service worker en las fuentes de aplicación buscadas. No hay aislamiento de cuentas implementado que se pueda presentar como autenticación real.
2. public/index.html contiene la identidad fija `Dali Medina` y avatares `D`; public/app.js concatena `Medina` al nombre preferido.
3. Store.initial contiene datos de perfil específicos del propietario. Store.init ya elimina clients/routines/skills iniciales en orígenes personales nuevos, salvo QA, pero conserva ese perfil. Por tanto, la descripción del prompt sobre la semilla requiere este matiz: no todos los registros de ejemplo se crean en un origen personal nuevo.
4. Store.validate exige nombre, nombre preferido y fecha de nacimiento válidos. El onboarding vacío solicitado necesita adaptar estas invariantes sin inventar una fecha de nacimiento y sin invalidar perfiles existentes.
5. Los identificadores actuales admiten cadenas alfanuméricas con guiones de hasta 80 caracteres, no solo UUID. Adoptar sin análisis la columna SQL `record_id uuid` recomendada puede rechazar importaciones válidas. Debe preservarse el ID original con una representación compatible.
6. Store captura la clave local una sola vez al cargar el script. Cambiar solamente un campo de usuario no aísla cuentas; el cambio de cuenta debe cerrar trabajos pendientes y desmontar el estado anterior antes de cargar datos nuevos.
7. La capa final phase3.css concentra parte del glass, pero muchas reglas densas solo se aplican con `data-desktop=true`. La paridad visual web/desktop todavía requiere trabajo.
8. El ZIP de entrega anterior y los tests actuales no certifican la actualización Windows, sus dispositivos ni las integraciones de Spotify/Meta.

## Cambios realizados en esta auditoría

- Restauración reproducible de dependencias desde el lockfile existente.
- Reejecución de la línea base Node y build de producción.
- Creación de este informe y nueva evidencia de línea base.
- Sin cambios funcionales ni migración de datos. No se ha elevado la versión ni declarado terminado el nuevo encargo.

## Preservación y siguientes condiciones

- No se dispone del perfil real de Windows ni de sus imágenes; no se puede afirmar haber creado su respaldo. Antes de migrarlo se debe exportar el ZIP completo con medios y conservar el estado original byte por byte.
- Confirmar que el repositorio disponible es la fuente autorizada, o aportar el ZIP nombrado si contiene cambios adicionales.
- Confirmar la configuración del servicio externo antes de implementar una ruta de cuentas activa. Supabase requiere proyecto, URL, clave publicable y políticas aplicadas. No enviar contraseñas, service_role, tokens de proveedor ni secretos en el chat.
- Las integraciones oficiales Spotify/Meta requieren registro de aplicaciones, autorización y cuentas elegibles; una interfaz desconectada no constituye una integración verificada.
- La validación Windows y la creación/aceptación del instalador continúan pendientes de un equipo Windows real.
- No se ha desplegado nada ni creado un segundo frontend. El encargo completo permanece pendiente; este archivo documenta únicamente su auditoría inicial.
