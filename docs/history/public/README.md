# EVIE CRM V2 · Ivy · candidato local

## Phase 3 · 19/09/2026

UI compartida web/Desktop conservando las 16 rutas y datos. Núcleo blanco procedural, cerdo Three.js y controles de voz. Pulsa el núcleo o el control persistente de Ivy; ya no hay botones antiguos del hero.

En web, Ivy conserva comandos locales sin privilegios Windows. En Electron, el código incorpora Ollama/Whisper/SAPI, herramientas tipadas y confirmación nativa. Voz real e instalador Windows siguen pendientes de aceptación: no confundir pruebas Linux/sintéticas con una validación real completa.

Este ZIP contiene **solo la web**. Para Electron se requiere el repositorio/archivo de código completo, incluyendo electron/, scripts/ y Forge. Consulta su README raíz y docs/WINDOWS_SETUP.md. No se ha desplegado producción ni migrado el almacén local.

## Checkpoint histórico · 18/09/2026

La marca actual es **EVIE CRM V2**, asistente **Ivy**, versión `2.0.0-local-rc.1`, esquema 4. Se conservan los módulos y datos de DALI. Ivy navega, consulta y prepara cambios con revisión y confirmación; no es una IA generativa. Voz/dictado dependen del navegador y consentimiento; servicios externos e Ivy Bridge siguen desconectados.

Última verificación: **177 pruebas funcionales correctas, 0 fallos** y **1.152 comprobaciones responsive sin incidencias detectadas**, con 51 capturas. Corregido el desbordamiento transitorio al cambiar de escritorio a móvil. `TEST_REPORT.md` y `RC_REPORT.md` documentan resultados actuales y límites. Los informes inferiores son históricos y sus cifras anteriores no describen este checkpoint.

El frontend estático permanece portable en esta carpeta; el repositorio añade Hono/Vite/Wrangler para la vista previa y Playwright para QA. No se ha publicado producción ni migrado el almacenamiento local. Cambiar de origen requiere trasladar los registros mediante un respaldo completo ZIP con imágenes; no mediante el ZIP del código.

Para usar Ivy: **Hablar con Ivy** o `Ctrl + Mayús + Espacio`; prueba `Abre Agenda` o `Crea pendiente: Revisar propuesta hoy`. Revisa y confirma antes de guardar. No se ha validado micrófono físico ni completado todo el alcance avanzado histórico.

## Documentación histórica DALI Neural v4

> **Estado actual: esquema de datos 4, candidato todavía en desarrollo.** Se han integrado Agenda, Bitácora estructurada, vínculos, alimentación/despensa y exportación de contexto sobre el CRM existente. No es la entrega final del Prompt FINAL. El informe vigente es `RC_REPORT.md`; las secciones históricas inferiores no describen el alcance actual por sí solas.

Centro de mando personal, construido con HTML, CSS y JavaScript Vanilla. Evoluciona los archivos existentes sin React, Vite, NPM ni compilación. La marca está centralizada en `config.js`.

## Incremento actual del Prompt FINAL

- **Datos:** migración conservadora v3→v4 con copia `dali-os-local-v1-pre-v4`, validación antes de la escritura principal e idempotencia. Se mantienen la clave personal y los medios IndexedDB.
- **Agenda:** nueva ruta `#agenda`, fichas `#agenda/ID`, captura manual, Bandeja/Hoy/Semana/Calendario/Completados, recurrencias con historial, enfoque y calendario `.ics` descargable.
- **Bitácora:** `#bitacora` y `#bitacora/ID`; Hoy, estadísticas descriptivas, calendario, revisión y archivo. Adaptador `dali.journal.entry` 1.0 con preview, corrección de intensidades, relato opcional, selección expresa de acciones y confirmación atómica. No hay diagnóstico ni conexión con ChatGPT.
- **Vínculos:** `entityLinks`, buscador y retirada confirmada. No duplican gastos, inventario ni progreso; no hay borrado en cascada.
- **Gimnasio:** nuevas secciones internas Alimentación y Despensa. Metas propuestas inactivas hasta confirmar; desconocidos permanecen vacíos. Listas revisables y gasto separado por importe/confirmación.
- **Contexto externo:** Subir/Configuración → Exportar contexto para ChatGPT. Selección de módulos, fechas y privacidad; preview exacta antes de copiar/descargar. No sustituye un respaldo.
- **Configuración:** cinco accesos móviles configurables, descarga pre-v4, esquema visible y meta mensual SOMA editable de $15.000 MXN independiente de la meta personal.
- **DALI Core:** control semántico grande, paleta clara/oscura, menú radial/sheet, foco/Escape, selector operacional y razones enlazadas. SOMA separa cobrado/contratado/saldo/pipeline. Salud permite cerrar/reabrir con historial; una preparación urgente exige vínculo a una ventana estimada vigente del mismo animal. Las emociones nunca generan alarmas.
- **Formularios:** protección de cambios sin guardar al cerrar/navegar, borrador en el DOM, revisión sin escritura y validación. Bitácora estructurada dispone de cuatro pasos para editar emociones, evidencia/confianza, indicadores, listas, hechos y sugerencias. No hay almacenamiento general persistente de borradores.
- **Estadísticas:** promedios diarios, líneas con huecos, distribución, rango personalizado y calendario alineado. Comparaciones internas y, con permiso explícito desactivado por defecto, con volumen reportado de Gym o minutos de Aprendizaje. Requieren 14 días emparejados, no infieren causalidad.
- **Nutrición:** versiones anteriores de metas al editar/importar y reversión explícita auditable del gasto de despensa, sin tocar existencias.
- **Vínculos anidados:** actividades, entregables y escenas con ID, incluidas referencias `$ref` adelantadas. Reimportación conserva IDs y campos desconocidos; undo protegido. Los enlaces `#aprendizaje/ID/tasks/CHILD`, `#soma/ID/deliverables/CHILD` y `#contenido/ID/shots/CHILD` enfocan la actividad concreta. Agenda permite seleccionar un vínculo desde captura y confirmar ambos en una sola escritura; Hoy muestra hasta tres sugerencias sin reprogramar.
- **Verificación:** última suite completa: **147 correctas / 0 fallos**, 38,09 s, sin errores de consola registrados. Conserva las 97 pruebas anteriores. `TEST_REPORT.md` y `RC_REPORT.md` distinguen evidencias actuales, históricas y cobertura pendiente.

### Modelos, rutas y servicios actuales
`agendaItems`, `entityLinks`, `nutritionDays`, `pantryItems` y `groceryRuns` se añaden al mismo JSON local; las entradas estructuradas se guardan en `journal`, no en otra colección duplicada. Los nuevos datos forman parte de los respaldos y restauraciones. `farm_catalog_version:4` sigue siendo independiente del esquema principal 4. No se usa Table API, D1 ni servidor propio.

Se mantienen las 15 rutas anteriores y se añade solo Agenda (16 en total). Los subapartados de Gym/Bitácora/Agenda se seleccionan dentro de la aplicación. `?qa=NOMBRE` sigue aislando los datos de pruebas, sin ser autenticación. `review-rc-{agenda,journal,nutrition,import,context}.html` son lanzadores de revisión de la aplicación real en almacenes QA, no pantallas de producción.

No hay URL de producción ni API pública configuradas. No se ha desplegado el proyecto.

Entradas funcionales: `index.html#inicio`, `#agenda[/ID]`, `#finanzas`, `#gimnasio[/ID]`, `#objetivos`, `#soma[/ID]`, `#aprendizaje[/ID]`, `#bitacora[/ID]`, `#granja[/ID]`, `#libros[/ID]`, `#alvento[/ID]`, `#contenido[/ID]`, `#vision[/ID]`, `#subir`, `#perfil`, `#configuracion`. Los corchetes indican ficha opcional, no texto literal de la URL. `tests.html` ejecuta todas las pruebas; `tests.html?verbose` añade cada PASS a consola. `review-rc-*.html` carga el index real con datos QA; incluye `care`, `care-dark`, `journalEditor`, `journalEditor-dark` y `journalCalendar`.

Datos adicionales compatibles con esquema 4: `farmHealthRecords.followup_history`, `nutritionDays.target_history`, `groceryRuns.expense_history`, `entityLinks.source/target.child`, `preferences.visionLines` y `preferences.journalPrivacy.crossModule`. No añaden colecciones ni servicios. Persistencia: JSON en localStorage y blobs en IndexedDB, sin Table API ni nube.

### Próximos pasos y límites
Pendientes de implementación/QA, no bloqueos ficticios: fotografía antes del primer guardado y flujos avanzados de todos los módulos; auditoría de vínculos en todos los formularios y agrupación final de Agenda; gráficas detalladas por ejercicio/etapa, streak de objetivos, storyboard y otros refinamientos; organización final de Configuración/Subir; matriz completa de temas, accesibilidad y datos largos. El editor histórico mexicano y el ICS ya usan reglas de zona, pero la interoperabilidad con calendarios externos aún no ha sido probada. Los únicos anchos disponibles en la herramienta de captura son 390 y 1280 px; no se certifican los otros siete solicitados. Consulta `RC_REPORT.md` para límites precisos, próximos pasos y evidencia.

El ZIP actual del código se genera en Configuración y sigue llamándose `dali-neural-v4-en-desarrollo.zip`; no contiene el almacén personal y no hay un ZIP final estático con URL directa. Para conservar tus registros, utiliza **Respaldo completo ZIP con imágenes**.

## Referencia histórica: incremento Neural anterior al Prompt FINAL

Lo que sigue conserva el alcance histórico de esquema 3 y sus 77 pruebas. Para el estado actual prevalecen la sección anterior y `RC_REPORT.md`.

### Implementado sobre los archivos existentes
- Sistema visual aditivo claro/oscuro, acentos por módulo, logo auténtico y reloj global de 12 horas en `America/Mexico_City`.
- Inicio con saludo, frase diaria estable, núcleo SVG/CSS/Canvas original, señales y actividad derivadas, y widgets existentes conservados.
- Entrada de sesión con Omitir/repetir, foco e inactividad temporal del contenido de fondo; preferencias de movimiento Completa/Sutil/Reducida y pausa. Un solo intervalo de reloj, limpieza de RAF/observer/listener de puntero y pausa al ocultar pestaña.
- Shell comprobado en escritorio y móvil sin el solapamiento de sidebar detectado inicialmente.
- Granja activa (`PigViews`): hero con datos derivados, silueta original, etapa registrada, próximo pendiente, cobertura inicial y capacidad proyectada. Sin animales de muestra en el almacén personal.
- Nueve etiquetas: Resumen, Cerdos, Reproducción, Camadas, **Comida**, **Agenda**, Salud, Rendimiento y **Ajustes**. Los identificadores internos permanecen intactos.
- Tarjetas con foto IndexedDB o silueta, arete, última observación, ventana estimada, acción contextual válida y secundarios en «Más acciones».
- Comida: gráfico SVG de demanda **teórica** diaria, tabla exacta accesible y estado vacío guiado. Usa `Feed.forecast`; no registra compras ni consumo.
- Alta rápida de animales por arete y nueve tarjetas de tipo; sexo propuesto editable y datos de nombre/origen/adquisición/peso/notas en secciones opcionales. Guarda sin pedir estado reproductivo ni crear gastos.
- Salud visual: búsqueda y selección explícita por arete, chips de observación, prioridad operativa elegida por el usuario, zona corporal por lista y seguimiento profesional colapsado. Tarjetas con foto opcional mediante MediaStore después de guardar; sin diagnósticos ni recetas automáticas.
- Editor visual de hitos en los ajustes activos: nombre, día relativo, categoría, nota, activo/inactivo, reordenar y eliminación confirmada. Conserva metadatos anteriores; no guarda hasta confirmar el formulario.
- Catálogo ampliado con 16 referencias inactivas del 16/09/2026, conservando las 14 anteriores y lactancia tradicional a $349. Revisión expresa de Monensina/Racto, actualización idempotente y respaldo `-pre-catalog-v4` descargable desde Granja → Ajustes. No modifica raciones, inventario ni Finanzas.
- Exportación del código con seis descargas concurrentes como máximo, cancelación por error/plazo y manifiesto ampliado para incluir Neural, logo y pruebas. Configuración → Descargar proyecto genera el ZIP del código actual, no un respaldo personal.

### Aún pendiente de v4
No están implementados `entityLinks`, migración a esquema 4, wizards completos/borradores/cierre seguro general, captura de fotos antes del primer guardado y selección corporal sobre silueta, dock contextual y paleta avanzada, ni los rediseños específicos completos de Gym, Finanzas, SOMA, Objetivos, Aprendizaje, Bitácora, Libros, ALVENTO, Contenido y Vision. Tampoco se da por terminada la matriz visual y de accesibilidad solicitada. Los límites avanzados de Granja v3 siguen vigentes.

### Pruebas del incremento y próximos pasos
**77 pruebas correctas, 0 fallos** en la ejecución completa más reciente; incluye foco de bienvenida, editor de hitos, ZIP de código y restauración con imágenes. Capturas posteriores confirman Cerdos y Comida en 1280/390 px, con rail de una fila. Evidencia y límites en `TEST_REPORT.md`.
1. Completar borradores/cierre seguro y formularios complejos. Alta, Salud y Ajustes ya cuentan con revisión visual de sus modales en 1280/390 px.
2. Implementar conexiones entre módulos y su migración atómica respaldada. El catálogo nuevo ya está integrado sin cambiar el esquema principal.
3. Aplicar las experiencias específicas restantes y ejecutar la matriz de pruebas/capturas para la entrega final.

### Archivos y acceso
- Nuevos: `neural-core.js`, `neural-signals.js`, `neural-home.js`, `neural-forms.js`, `neural-farm.js`, `neural-milestones.js`, `neural-care.js`, sus CSS y `tests-neural.js`.
- `review-animal.html`, `review-health.html` y `review-milestones.html` cargan el `index.html` real con almacenes `visual-form-*` aislados y abren sus formularios. No son pantallas de producción ni añaden datos al almacén personal.
- Las quince rutas y `?qa=NOMBRE` descritas abajo no cambian. Granja recuerda su apartado mediante preferencias, no mediante nuevas URLs.
- Persistencia: localStorage e IndexedDB; esquema 3 y clave original conservados. Preferencias adicionales de movimiento y metadatos de hitos son compatibles con el modelo existente. `sessionStorage` se usa para la entrada, no para registros del CRM.
- Sin Supabase, backend, autenticación simulada ni despliegue. **No hay URL de producción ni API pública configuradas.**
- Documentación viva: `CHANGELOG_DALI_V4.md`, `DESIGN_SYSTEM.md`, `MIGRATION_REPORT.md`, `TEST_REPORT.md` y `ASSET_INVENTORY.md`. Son informes de avance, no una declaración de cierre v4.

## Abrir y usar

Abre `index.html` desde la vista previa del proyecto o sirve esta carpeta con un servidor estático. Si Python ya está instalado, puedes usar `python3 -m http.server 8000` y abrir `http://localhost:8000`. No hay servidor de aplicación ni dependencias que instalar. Evita `file://`: los navegadores restringen fetch, IndexedDB y descargas de recursos locales. Usa HTTPS o localhost para portapapeles y UUID.

Los datos pertenecen al **origen y navegador**: localhost, la vista previa y un dominio publicado no comparten datos. Exporta/importa un ZIP para trasladarlos. No se ha realizado ningún despliegue durante esta tarea. No hay URL de producción ni API de datos pública configuradas.

## Funciones implementadas

- Quince secciones con metadatos, grupos, búsqueda, breadcrumbs y rutas hash persistentes. Sidebar con scroll interno, drawer móvil y cinco accesos inferiores.
- Tema claro/oscuro, reloj y saludo en America/Mexico_City, widgets reordenables/ocultables, tarjeta bancaria rectangular de ancho completo en móvil.
- Finanzas conservadas: movimientos en centavos, pad numérico, periodos, búsqueda, categorías, CSV, impresión, pagos/préstamos con abonos, reversión y papelera. SOMA conserva fichas, entregables, abonos vinculados e hipervínculos WhatsApp (no API).
- Migración v1→v2 validada sobre una copia; respaldo previo recuperable; misma clave de almacenamiento; preservación de campos no conocidos, rutinas y sesiones originales. Sesiones terminadas convertidas a estadísticas parciales sin atribuir rangos.
- Subir: pegar/seleccionar/soltar JSON, validación local, vista previa de acciones y avisos, corrección en el editor, confirmación explícita, commit único, historial, deduplicación y deshacer con detección de modificaciones posteriores.
- Tres formatos: `dali.crm.import` 2.0, `dali.gym.session` 1.0 y `dali.learning.route` 1.0. Versiones desconocidas y claves peligrosas se rechazan. Referencias entre operaciones con `{ "$ref": "operation_id" }`.
- Gimnasio estadístico: sesiones parciales/completas, detalle de ejercicios/series, periodos 7/28/90 días, volumen reportado separado del calculado, mapa corporal esquemático interactivo y lista equivalente, rangos solo importados, peso corporal y descarga del legado. No hay ejecución de rutinas en el flujo actual.
- Granja v3: nueve apartados (Resumen, Cerdos, Reproducción, Camadas, Alimentación, Calendario y pendientes, Salud, Rendimiento, Configuración). Estado derivado de eventos: servicio → pendiente, confirmación solo con revisión positiva. Parto/destete idempotentes, correcciones auditadas, ventanas operativas, capacidad de maternidad, salud y comparación básica con muestras explícitas. Alimentación por producto/etapa, gramos enteros, raciones confirmadas, excepción individual, fórmula de lactancia opcional, FIFO, merma, existencia inicial y compra con gasto central único.
- Aprendizaje: rutas importadas con fusión/reemplazo recuperable, actividades con puntos, evidencias y estudio; 95% máximo sin proyecto final con evidencia.
- Libros: biblioteca y wishlist, autor/estado/páginas, reseña, aprendizajes, citas breves, fotografía y progreso.
- ALVENTO: drops, fecha de lanzamiento, productos/SKU/tallas, hitos, stock derivado, ventas y reversión atómica de stock/ingreso; utilidad bruta de unidades vendidas separada de costos generales.
- Contenido: ideas, estados, serie/episodio, guion, hook y producción, escenas reordenables con teclado, checklist por escena y snapshots manuales de resultados.
- Vision Board: aspiraciones, motivo, imagen, fecha/costo/ahorro, objetivo vinculado, orden por botones accesibles, modo enfoque y estado logrado.
- Perfil: datos editables, foto local con recorte/zoom/reposición, edad y próximo cumpleaños; edición del perfil conserva la foto.
- Fotos JPEG/PNG/WebP en IndexedDB, compresión WebP, miniatura, límite de 10 MB, errores de cuota y limpieza de medios no referenciados. Nunca se incrustan imágenes base64 en localStorage.
- Configuración: JSON ligero, ZIP de datos e imágenes, restauración completa ZIP con respaldo previo, papelera y descarga del proyecto estático como ZIP generado en el navegador.

## Rutas funcionales

Todas se sirven desde `index.html`; el fragmento es la ruta del cliente.

| Ruta | Uso |
|---|---|
| `#inicio` | Centro de mando |
| `#finanzas` | Movimientos, pagos, préstamos |
| `#gimnasio`, `#gimnasio/UUID` | Analítica y sesión |
| `#objetivos` | Horizontes y archivo |
| `#soma`, `#soma/UUID` | Clientes y ficha |
| `#aprendizaje`, `#aprendizaje/UUID` | Habilidades y ruta |
| `#bitacora` | Diario por texto/voz |
| `#granja`, `#granja/UUID` | Animales, eventos y apartados operativos |
| `#libros`, `#libros/UUID` | Biblioteca y detalle |
| `#alvento`, `#alvento/UUID` | Drops y gestión |
| `#contenido`, `#contenido/UUID` | Producción y métricas |
| `#vision`, `#vision/UUID` | Aspiraciones y detalle |
| `#subir` | Importación operativa JSON |
| `#perfil`, `#configuracion` | Cuenta local, preferencias y respaldo |
| `tests.html` | Suite automatizada sobre datos QA aislados |
| `index.html?qa=NOMBRE#ruta` | Espacio de pruebas separado; no es autenticación |

`schemas/*.schema.json` y `samples/*.json` son archivos estáticos descargables, no endpoints de backend.

## Almacenamiento y modelos

El estado JSON permanece en `localStorage['dali-os-local-v1']`: **la clave no se cambia** al migrar, pero `version` pasa a 3 mediante v1→v2→v3. Se conserva `dali-os-local-v1-pre-v2` cuando existe y se añade `dali-os-local-v1-pre-v3` antes de sustituir un estado anterior. La validación y migración se realizan en una copia. Una revisión optimista detecta cambios habituales en otra pestaña; localStorage no ofrece una transacción distribuida ni sincronización multiusuario.

Colecciones originales: `transactions`, `bills`, `loans`, `goals`, `clients`, `routines`, `sessions`, `metrics`, `skills`, `studySessions`, `journal`.

Nuevas: `gymSessions`, `gymRanks`, `importBatches`, `farmAnimals`, `farmEvents`, `farmLitters`, `farmHealthRecords`, `farmSettings`, `books`, `alventoDrops`, `alventoProducts`, `alventoSales`, `alventoMilestones`, `contentItems`, `visionItems`, `mediaMetadata`. Perfil/preferencias son objetos singleton. Los registros usan IDs UUID; IDs históricos válidos se preservan. Eventos y lotes conservan versiones anteriores. No se usa D1, CosmosDB, Table API ni Supabase.

Imágenes: IndexedDB `${storageKey}-media`, object store `media`, con `id`, Blob optimizado, thumbnail y dimensiones. Los registros usan `media_id`; no URLs permanentes. Los ZIP incluyen `data.json`, `manifest.json` y `media/`.

Dinero interno en **centavos enteros**; los campos operativos `amount` usan **pesos MXN positivos**. Excepción explícita de alimentación: campos `price_cents`/`cost_cents` ya son centavos y los sufijos `_g` son gramos enteros; no se convierten de nuevo. La conversión ocurre una vez al importar. Fechas de calendario YYYY-MM-DD, marcas de tiempo ISO UTC, presentación en México. Recurrencias conservan frecuencia, intervalo, hora, día de mes, días semanales y zona horaria. No se inventan registros de días nunca observados.

## Importación y recuperación

1. Pega un JSON válido en Subir o selecciona el archivo.
2. Valida. Esto no escribe ningún registro.
3. Revisa acciones y advertencias. Corrige campos en el editor y vuelve a validar si es necesario.
4. Confirma mediante casilla y botón. Un fallo cancela el lote entero, también si el documento solicita atomic:false.
5. Historial → Deshacer revierte los registros tocados si no hubo ediciones posteriores. Los creados permanecen como copia recuperable en `importBatches.changes`, fuera de las colecciones activas. Las ediciones posteriores bloquean el deshacer: no se fuerzan silenciosamente.

La importación operativa **no es restauración de respaldo**. El respaldo JSON se mezcla por IDs sin sobrescribir registros/perfil existentes; una relación inconsistente cancela la mezcla. El ZIP restaura el estado completo y sus medios después de descargar un respaldo de seguridad.

Los esquemas describen la envoltura y estructura principal. El validador Vanilla aplica restricciones de dominio adicionales; no se ejecuta código del JSON. Los campos canónicos pueden consultarse en `records.js`, `v2-domain.js` e `importer.js`. Una productividad desconocida de bitácora no se inventa: debe confirmarse antes de importar.

## Estructura técnica

- `domain.js`, `recurrence.js`: finanzas, fechas, objetivos y progreso.
- `store.js`, `migrations.js`, `media-store.js`: persistencia, migraciones e imágenes.
- `farm-domain.js`, `v2-domain.js`: reglas y validaciones.
- `records.js`: formularios/modelos declarativos y normalización.
- `importer.js`: adaptadores, vista previa, lotes y rollback.
- `views.js`, `forms.js`, `app.js`: base DALI conservada.
- `v2-views.js`, `v2-app.js`, `v2.css`: evolución y módulos nuevos.
- `reference/`: copia del código anterior y referencia visual GranjaControl, no ejecutada.
- `tests*.js`, `tests.html`: pruebas aisladas sin instalación.

CDN: Tailwind Browser 4.1.13, Lucide 0.468.0, JSZip 3.10.1; Google Fonts. CSS propio cubre el layout si Tailwind falla. Sin CDN de JSZip no se pueden generar ZIP; JSON sigue disponible. No hay service worker ni garantía de arranque sin conexión desde una pestaña nueva.

## Privacidad e integraciones

Modo local **sin autenticación ni cifrado**. Cualquier persona que acceda a este perfil de navegador puede consultar los registros. No uses equipos compartidos. El dictado puede enviar audio al proveedor del navegador y solicita consentimiento; DALI no guarda audio. ChatGPT se utiliza fuera de la aplicación mediante copiar/pegar JSON. No hay conexión con Symmetry, redes, pagos ni WhatsApp Business API.

Supabase no está integrado: requeriría backend/autenticación real, políticas por propietario y sincronización verificadas fuera de las capacidades estáticas de esta entrega. No introduzcas claves secretas en `config.js` ni `.env.example`. La protección Hosted de la plataforma no está activada; la herramienta informó que requiere Plus o superior. No se ha simulado protección con JavaScript.

## Validación y alcance pendiente

La suite `tests.html` ejecuta reglas y flujos contra la aplicación real con una clave QA aleatoria. Resultados y revisión visual se documentan en `QA.md`. No es una certificación de accesibilidad ni una afirmación de haber probado todos los navegadores/anchos.

**El documento maestro completo no está cerrado.** Consulta `CHECKLIST.md`: todavía faltan capacidades avanzadas (calendarios completos, algunas métricas/comparaciones, Kanban/cadencias, filtros exhaustivos, historial visual granular y QA de todos los anchos). Son trabajo local de desarrollo pendiente, no bloqueos de credenciales. Los flujos enumerados arriba sí están implementados; no se presentan como terminadas funciones que solo existen en el documento.

Próximos pasos: cerrar las métricas avanzadas y limitaciones de previsión descritas abajo, ampliar validadores/pruebas de errores de cuota y completar QA responsive/accesibilidad. Solo después abordar servicios externos o publicación privada.

## Granja v3: operación y alcance verificado

**59 pruebas correctas, 0 fallos** en la ejecución de referencia v3 y en la regresión tras integrar el primer Inicio Neural (antes de ampliar Granja y la suite Neural). Incluye las 36 pruebas base, adaptadas únicamente donde el modelo reproductivo anterior era incorrecto, y 23 verificaciones nuevas. QA visual real en 1280 y 390 px: Cerdos claro y Alimentación oscura. Detalles en `QA.md`.

### Empezar sin datos ficticios
1. Granja → Cerdos → Agregar cerdo: registra aretes reales. No se crean 18 animales ni un semental llamado Canelo.
2. Registra celo y servicio desde la ficha. La monta natural exige un semental registrado; la inseminación se registra explícitamente. El servicio permanece **Servida por confirmar** aunque transcurran 114 días. Una revisión inconclusa no confirma; una negativa vuelve a Vacía.
3. Registra revisión positiva, parto y destete según evidencia. El preparto es una etiqueta estimada. Los recordatorios no alteran estados. Completar pendientes y convertirlos en objetivos son acciones separadas.
4. Alimentación → Productos: revisa producto, peso de costal, precio y fecha. Las 14 referencias MAFORNU están inactivas y pendientes de confirmación. Racto exige además revisar cumplimiento.
5. Raciones: configura únicamente cantidades confirmadas del rancho. Sin una regla aplicable se muestra **configuración incompleta**; los animales excluidos no equivalen a consumo cero. Ninguna ración de 2,75 kg/día se activa automáticamente.
6. Inventario: registra la existencia inicial sin crear gasto ficticio, o una compra con casilla opcional de Finanzas. Consumo/ajuste trabaja con gramos, FIFO, sobrantes y merma. No admite inventario negativo. Una compra sin movimientos posteriores puede anularse junto con su gasto, conservando evidencia.
7. Previsión: 7/15 días, mes real o rango de hasta 366 días, colchón visible (0% por defecto), costales redondeados por producto y sobrante arrastrado. Copia la lista de compra; el cálculo no registra consumos ni compras automáticamente.

### Nuevos modelos e importaciones
Colecciones: `farmTasks`, `farmFeedProducts`, `farmFeedPriceHistory`, `farmFeedRules`, `farmFeedInventoryLots`, `farmFeedMovements`. Se mantienen animales, eventos, camadas, salud y configuración existentes. `farmMigrationReport` conserva animales cuyo estado histórico necesitó revisión; `migration_original` y `reproductive_baseline` preservan evidencia previa. Las antiguas gestaciones sustentadas solo por monta pasan a pendientes. No se elimina el resto del CRM.

En `dali.crm.import` 2.0, módulo `farm`: `animal`, `event`, `litter`, `health_record`, `setting`, `task`, `feed_product`, `feed_price`, `feed_rule`, `feed_opening`, `feed_purchase`, `feed_consumption`. No se insertan movimientos/lotes arbitrarios: los tres últimos usan operaciones de dominio. `feed_purchase` requiere `product_id`, `bags`, `price_cents`, `date` y `link` opcional; `feed_consumption` requiere `product_id`, `type`, `quantity_g`, `date`, `notes`, con `leftover_g`, `waste_g` y `lot_id` opcionales. `feed_opening` requiere producto, gramos, fecha y motivo. Mantén `dedupe_key` estable. Las relaciones entre operaciones usan `{ "$ref": "operation_id" }`. Los precios históricos se añaden como nuevos registros, no se sobreescriben mediante el importador. Ejemplo inactivo: `samples/farm-feed.json`.

ZIP/JSON incluyen las colecciones nuevas. Se verificó también la restauración ZIP mediante su formulario real, con imágenes IndexedDB, y la recarga de Granja. Configuración → Descargar proyecto genera `dali-neural-v4-en-desarrollo.zip` sin datos personales. El manifiesto incluye todos los scripts de Granja y la fotografía de referencia.

### Límites que siguen pendientes
- Rendimiento ofrece comparación por promedio destetado, intervalo entre partos, nacidos, mortalidad, servicios y revisiones con muestras. **No** implementa todavía un puntaje multifactor configurable para seleccionar las 8 mejores, días no productivos, todas las tasas reproductivas ni anualización completa.
- No hay imputación trazable de costo real FIFO por animal/ciclo/camada/lechón ni panel completo planeado frente a consumido. El costo de consumo mostrado en Previsión es teórico, valorado al precio confirmado al inicio del rango; no es el costo histórico de las salidas. Los precios reales de cada compra se conservan.
- La previsión usa una instantánea del inventario utilizable al inicio del rango. No simula caducidades sobrevenidas durante el rango, reposiciones futuras ni salidas planificadas de otros periodos. Cobertura/fecha de compra usan la demanda del primer día, no una simulación de agotamiento variable. Se deben recalcular con los movimientos reales.
- Se segmentan transiciones reproductivas estimadas, pero no todas las transiciones de engorda por edad/peso. La configuración de rancho usa la última revisión guardada; no hay reconstrucción temporal completa de políticas históricas. Las reglas de ración editadas tampoco constituyen un libro inmutable de versiones.
- No se admiten eventos insertados antes del último registrado; se usa corrección auditada. No se permite anular una corrección con otra anulación automática, ni una compra cuyo lote ya tenga movimientos.
- Persistencia local sin nube, autenticación o cifrado. No se ha publicado ni desplegado el proyecto. No hay URL de producción ni API externa configurada.

### Referencias y QA
La foto amplia está en `reference/feed-board-wide.jpg`. En lactancia tradicional la lectura visual fue ambigua (posible $319); se conserva **$349 de la tabla solicitada**, como referencia inactiva. En v3 no se habían recibido el ZIP/src ni el vídeo de GranjaControl. En la fase v4 sí se recibió y analizó el vídeo como referencia visual; sigue sin estar disponible un ZIP completo con `src/`. No se incorporaron configuraciones React/Vite/TypeScript.

`review-farm.html` y `review-feed.html` preparan **solo almacenes QA aislados** y redirigen a la aplicación real; no son pantallas de producción ni siembran registros personales. La navegación de Granja se conserva en las preferencias del navegador. Las rutas públicas siguen siendo las de la tabla anterior; no hay endpoints nuevos.
