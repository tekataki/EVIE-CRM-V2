# EVIE CRM V2 · informe de pruebas

## Phase 3 · 19/09/2026

Resultados verificados: 177 pruebas heredadas; 22 Node de contratos, voz y cancelación; 20 pruebas nuevas de Agenda/web; 13 de Electron fuente y 13 de paquete Linux (confirmación automatizada y micrófono sintético); 8 de gráficos procedurales. Matriz: 1.152 layouts, sin errores de consola/overflow, foco y zoom CSS 200 % correctos. Evidencia fechada en evidence/ del repositorio completo.

Corregidos estados al terminar herramientas, cancelaciones tardías de voz, prueba de micrófono sin envío, acceso legado a Ivy, zoom del núcleo, wrapping del dock y visibilidad del fallback SVG. Forge 8 alpha fijado + Packager 20 empaqueta y arranca Linux; npm audit no informa vulnerabilidades conocidas. No certifica Squirrel ni hardware Windows.

No se afirma que el pipeline físico completo haya sido probado. Ver docs/WINDOWS_ACCEPTANCE.md y PHASE_3_IMPLEMENTATION_NOTES.md del proyecto completo.

## Resultado histórico · 18/09/2026 · Ivy

- Suite funcional: **177 correctas, 0 fallos**, 18,05 s, Chromium 153.0.8010.12; sin errores de consola. Evidencia del repositorio: `evidence/final-suite.json`.
- Matriz automatizada: **1.152 comprobaciones, 0 incidencias**, 68,00 s; 16 rutas × 9 anchuras (360/390/412/430/768/1024/1280/1440/1920) × 2 temas × 4 modos de movimiento. Evidencia: `evidence/visual-matrix.json`, 51 capturas.
- Se comprueban overflow de página, encabezado principal y texto inválido. No implica revisión manual de cada estado ni certificación integral de accesibilidad.
- Enter abre Ivy y Escape devuelve el foco al Core. Inicio a 390 px con zoom CSS 200 % no presenta overflow; no es una prueba de zoom nativo.
- Incidencia corregida: el margen animado de `.app-shell` conservaba transitoriamente los 232 px de la barra lateral mientras el contenido ya tenía anchura móvil. Eliminada esa transición; repetición completa sin desbordamientos detectados.
- Build correcto; dependencias instaladas sin vulnerabilidades conocidas según npm. Los ejecutores ahora fallan también ante errores de consola/layout.
- Sin pruebas de micrófono físico, lectores de pantalla, Safari/Firefox, todos los formularios, datos largos o integraciones externas. Sin publicación.

Las secciones siguientes son checkpoints históricos; sus cifras y limitaciones de herramientas no describen esta ejecución.

## Checkpoint histórico tras Core, formularios y contratos
**147 pruebas correctas / 0 fallos**, 38,09 s, suite completa `tests.html`, sin errores de consola registrados. Las 97 pruebas anteriores se conservan. `?verbose` imprime cada PASS; sin ese parámetro el resultado final no se oculta por el límite de logs de la herramienta.

Añadido: selector y menú Core; FormSafety; estadísticas diarias/Pearson/gaps; reversión grocery e historia de metas manual/importación; conversión mexicana histórica y VTIMEZONE/UNTIL; UI por módulos; vínculos child/$ref/idempotencia/undo; Salud cerrar/reabrir y ventana de preparación; Vision preferences; rango personalizado/calendario alineado; editor de reflexión de cuatro pasos; consentimiento y exclusión de lectura entre módulos.

Incidencias intermedias corregidas: fixture de actividad sin level/evidence (129/1); schema JSON con llaves incompletas (139/1); consentimiento comparado con booleano en vez de `on` de FormData (133/10, nueve fallos derivados del modal que permanecía abierto). Se corrigieron fixtures válidos o código, nunca se quitaron aserciones ni se desactivó FormSafety. La última ejecución completa pasó también ZIP/recarga/IndexedDB.

Evidencia visual y límites detallados en la sección vigente de `RC_REPORT.md`. ALVENTO corregido: 390/1280 claros. Editor Bitácora: Emociones 390 claro/1280 oscuro. Otras capturas previas son checkpoints, no certificación automática de todos los cambios. Salud nuevo sigue pendiente de captura completada por saturación/interrupción.

## Referencia histórica: resultado inicial del Prompt FINAL
**97 pruebas correctas, 0 fallos**, suite completa con las 77 pruebas anteriores y 20 nuevas pruebas RC. Ejecución: `tests.html` → aplicación real en iframe QA, Chromium headless, 36,28 s, sin errores de consola registrados. No es una certificación de todo el Prompt FINAL.

Nuevas verificaciones: migración 3→4 determinista y preservación, backup pre-v4 único y fallo de cuota, privacidad/dedupe/merge/replace/cancel/undo de reflexión, revisión UI sin escritura, Agenda e historial recurrente, exportación ICS, vínculos e importación por referencias, contexto sin campos sensibles, metas nutricionales no confirmadas, gasto de despensa explícito e idempotente, formularios y vistas nuevas.

Incidencia resuelta: 96/1 en una ejecución intermedia. El importador sobrescribía el extremo `source` de un vínculo con los metadatos del lote. Se corrigió el código y el caso pasó sin alterar su aserción.

Las expectativas de esquema y cantidad de rutas se actualizaron a 4 y 16, respectivamente, por los requisitos nuevos; no se retiró ninguna prueba de dominio anterior. ZIP/restauración/recarga se han reforzado para comparar las colecciones RC además de las de Granja; esa ampliación también pasó en la ejecución final de 97/0, incluyendo el ZIP del manifiesto actualizado.

Capturas RC comprobadas: Agenda y Bitácora claras, Nutrición oscura, ambas en móvil real de 390 px y escritorio de 1280 px; Subir/reflexión en móvil. URLs en `RC_REPORT.md`. El primer intento del modal Contexto móvil devolvió saturación; posteriormente se completaron y revisaron capturas del modal oscuro en móvil y escritorio. Se comprueba la vista inicial, no todos sus estados de scroll/preview. No se certifican los restantes anchos, zoom o tecnologías asistivas.

## Referencia histórica: 77 pruebas del incremento Neural
**77 pruebas correctas, 0 fallos**, ejecución completa de `tests.html` mediante navegador de pruebas. Tiempo informado: 33,35 s. Sin errores de consola en esa ejecución. Es un checkpoint del incremento, **no una certificación de v4 completa**.

Entorno: aplicación real en iframe de `tests.html`, `index.html?qa=tests-UUID#inicio`, almacenamiento separado de los datos personales. Sin compilación. Pruebas existentes: 59; Neural/formularios: 13; catálogo: 5. El nombre de algunas pruebas conserva “v3” porque el esquema sigue siendo 3.

## Verificaciones
- Finanzas en centavos; pagos y relaciones idempotentes.
- Migraciones v1/v2/v3, respaldo previo y preservación del estado ante fallos.
- Importación: validación, preview sin escritura, dedupe, undo y protección de modificaciones posteriores.
- Motor porcino: servicio nunca confirma por tiempo, revisión positiva, parto/destete, corrección auditada, salud y venta.
- Alimentación: ejemplos A–E, gramos enteros, ración faltante, FIFO, stock inicial, compra/Finanzas y reversión protegida.
- Nueve vistas de Granja, formularios operativos reales y cinco apartados de alimento.
- Inicio Neural: reloj de México, entrada de sesión, Omitir/foco, un intervalo de reloj tras rerenders, cancelación RAF, movimiento reducido/pausa y actividad sin duplicados.
- Granja Neural: etiquetas, tarjetas y acciones permitidas por Pig.
- Comida: SVG/tabla con valores exactos y estado vacío, sin escribir consumos.
- Hitos: filas, reordenación, preservación de metadatos, confirmación de eliminación y cancelación sin escritura.
- Alta visual: tarjetas de tipo, sexo propuesto, guardado mínimo sin eventos/gastos y fecha histórica/evidencia conservadas al editar.
- Salud visual: elección explícita, chips, urgencia manual, búsqueda, cancelación y seguimiento conservado. No cambia animales, eventos ni transacciones.
- Catálogo: 16 referencias exactas, anteriores intactas, dedupe normalizado, revisión de Monensina/Racto, respaldo real idempotente y fallo de cuota sin sobrescribir el original.
- Fotos IndexedDB, edición de perfil sin perder foto, ZIP de datos, restauración real con imágenes, ZIP de código y recarga.
- La prueba del código comprueba todos los archivos enumerados en `project-files.json`, además de asegurar ausencia de `data.json` personal.

## Incidencias encontradas
1. Sidebar superpuesto al Inicio desktop: corregido el ancho/desplazamiento del shell y comprobado en 1280 y 390 px.
2. Exportación secuencial del código agotaba el tiempo: sustituida por hasta seis solicitudes concurrentes, con cancelación y plazo. La suite vuelve a completar descarga y recarga.
3. Primera prueba de foco dio **67 correctas / 1 fallo**: el iframe estaba dentro de un details cerrado y no podía recibir foco. Se corrigió el montaje de la prueba (abrir su contenedor durante el caso, sin eliminar las aserciones). La ejecución vigente verifica foco real en Omitir y retorno al botón inicial.
4. Rail móvil aparecía en tres filas por heredar flex-wrap. Corrección acotada: `flex-wrap: nowrap`. Captura posterior confirma una sola fila horizontal.
5. La silueta del hero heredaba altura genérica de iconos: altura automática explícita, comprobada en Comida desktop.
6. Hubo llamadas interrumpidas, saturación del servicio de navegador y una ejecución que agotó la espera inicial. Esas llamadas no se contabilizan como pruebas aprobadas; el resultado completo posterior es el indicado arriba.

## Capturas efectivamente revisadas
Las imágenes usan datos QA explícitos en Granja, nunca el inventario del usuario.

| Pantalla | Ancho / tema | Captura y alcance |
|---|---|---|
| Inicio | 1280, claro | https://www.genspark.ai/api/files/s/tFPbtTCj — shell sin solapamiento |
| Inicio | 390, claro | https://www.genspark.ai/api/files/s/hOnF65Jk — hero/reloj, sin desbordamiento; captura larga limitada por servicio |
| Granja / Cerdos | 1280, claro | https://www.genspark.ai/api/files/s/Z7K3apBh — posterior a los ajustes; silueta proporcionada, rail de una fila, tres columnas de tarjetas sin recortes |
| Granja / Cerdos | 390, claro | https://www.genspark.ai/api/files/s/RUJGJNiq — posterior al ajuste, rail de una fila y tarjetas legibles |
| Granja / Comida | 1280, oscuro | https://www.genspark.ai/api/files/s/iGwNNzKB — silueta, rail de una fila, previsión/gráfica/KPIs |
| Granja / Comida | 390, oscuro | https://www.genspark.ai/api/files/s/Ne9BW1vn — posterior a los ajustes; Comida seleccionada visible, rail de una fila, gráfica/datos/controles legibles |

## Formularios reales revisados
Los lanzadores cargan el `index.html` real y sus mismos scripts/CSS al ancho real del navegador; solo abren el formulario bajo una clave QA aislada.

| Formulario | Móvil 390 px | Escritorio 1280 px |
|---|---|---|
| Alta animal | https://www.genspark.ai/api/files/s/uHHaGeK1 | https://www.genspark.ai/api/files/s/FhN3v7tw |
| Salud | https://www.genspark.ai/api/files/s/0FCTatkB | https://www.genspark.ai/api/files/s/8ZRVAsRW |
| Hitos (filas visibles) | https://www.genspark.ai/api/files/s/3wcdxHKQ | https://www.genspark.ai/api/files/s/WbPaYgSl |

Se corrigió el ancho insuficiente del selector Categoría; las capturas posteriores muestran «General» completo. Sin JSON expuesto ni desbordamientos en los formularios capturados.

## Pendiente de validación final
Estados extensos, texto extremo, navegación completa con teclado, zoom y lectores de pantalla; 360/430/768/1024/1440/1920 y navegadores Safari/Firefox. Faltan las capturas v4 de Gym, Libros, ALVENTO y Contenido en ambos anchos. Los flujos aún no implementados (links/migración4/wizards, etc.) no están cubiertos ni se presentan como aprobados.

No se desplegó ni comprobó una URL de producción: no existe un despliegue solicitado para esta entrega.
