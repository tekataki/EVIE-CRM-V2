# EVIE CRM V2 · Informe del candidato local

## Phase 3 · 19/09/2026

Se conserva el CRM y se añade host Electron seguro sobre la misma UI, proveedores locales de voz/IA, herramientas permitidas, Google opcional scaffold, núcleo blanco y pig WebGL. Web sigue sin privilegios Windows. Las afirmaciones de integraciones desconectadas que aparecen abajo describen el checkpoint histórico, no el código Desktop actual.

La implementación no equivale a aceptación final: están pendientes voz real en español, Windows Acrylic/SAPI/controles, instalador y reapertura instalada. Evidencias Linux/web en evidence/; guía y checklist en docs/ del repositorio. Esquema 4 y clave dali-os-local-v1 preservados. No hay sync ni despliegue de producción.

## Estado histórico · 18/09/2026

Ivy está integrado sobre DALI y conserva esquema 4, la clave personal y los módulos existentes. No es IA generativa: ofrece comandos locales, consultas, propuestas confirmadas y voz opcional del navegador. IA externa, sincronización, calendarios, multimedia e Ivy Bridge siguen desconectados.

Verificación final de esta continuación: **177 pruebas funcionales correctas / 0 fallos**, sin errores de consola; **1.152 comprobaciones responsive / 0 incidencias**, 51 capturas. Se corrigió el overflow transitorio al cambiar el margen de escritorio a móvil. Detalles y límites en `TEST_REPORT.md`; resultados JSON en `evidence/` del repositorio.

Ya no aplica el bloqueo histórico de captura limitado a 390/1280: se usa Playwright con nueve viewports reales. La prueba de zoom realizada es CSS 200 %, no zoom nativo. No se certifican micrófono real, lector de pantalla, todos los diálogos ni navegadores físicos. Los pendientes avanzados de producto descritos más abajo no se dan por implementados con esta validación.

El frontend portable permanece en `public/`; Hono/Vite/Wrangler se utilizan para el transporte de vista previa. La persistencia local heredada no se ha migrado a nube. No se ha desplegado producción. Esta es una continuación verificada, no la aceptación de todos los documentos maestros.

## Checkpoint histórico tras Core, formularios y revisión de contratos

**En desarrollo; no es la entrega final del Prompt FINAL.** Esta sección prevalece sobre el checkpoint histórico de 97 pruebas que se conserva más abajo. Se continuó sobre el repositorio existente; no hubo reconstrucción, sustitución ni despliegue.

### Verificación más reciente
- `tests.html`: **147 correctas, 0 fallos**, 38,09 s, Chromium headless; sin errores de consola registrados en esa ejecución. No prueba ausencia universal de errores en caminos no ejercitados.
- Las 97 pruebas anteriores siguen presentes. El caso Cancelar se reforzó para confirmar el aviso de cambios y el descarte explícito, manteniendo la comprobación de cero escritura.
- Checkpoints posteriores: 107/0 Core; 115/0 Forms; 122/0 Insights; 123/0 DST; 130/0 Modules; 134/0 Salud/validaciones; 140/0 contratos; 143/0 editor y permiso entre módulos.
- Incidencias corregidas sin debilitar pruebas: fixture de actividad sin `level/evidence`; JSON Schema con llaves incompletas; consentimiento leído como booleano cuando FormData devuelve `on`. Este último mantenía el modal abierto y provocaba fallos posteriores de protección de borrador; se corrigió el código, no se desactivó la protección.

### Funciones añadidas y límites específicos

**Core y Salud.** Orb semántico grande, menú radial escritorio/sheet móvil, foco/Escape/trap y cleanup; razones operativas enlazadas y ponderaciones SOMA editables. Paleta Canvas cacheada por tema/severidad, sin leer estilos por frame. Preparación urgente requiere tarea pendiente/alta, fecha alcanzada, `preparation_required:true`, `origin_key` de una ventana estimada vigente del mismo animal dentro del umbral urgente. UI de tarea permite elegir esa ventana. Cerrar/reabrir Salud es explícito, audita `followup_history` y conserva observación/fecha/evidencia; un seguimiento cerrado deja de aparecer en las alertas. Cerrar no afirma recuperación. No cambia Pig, estados reproductivos, Feed ni Finanzas. Emociones excluidas del Core.

**Formularios.** FormSafety protege los formularios base y el pad: cerrar, Escape, navegación y beforeunload no guardan. El borrador permanece en el DOM. Revisión escapada, validez nativa y footer estable. Reemplazar un modal legacy síncrono usa confirmación nativa; no es autenticación ni guardado. `JournalEditor` añade cuatro pasos reales y edición de fecha/resumen/relato, emociones/basis/confianza/evidencia, los cuatro indicadores, listas/etiquetas, hechos, sugerencias y nota. Permite añadir/quitar filas sin escribir hasta confirmar. La revisión de un import solo actualiza preview; las acciones nuevas siguen desmarcadas. En fusión con una entrada ya guardada rigen las reglas de unión del importador; reemplazar requiere elegir esa estrategia. No hay borradores persistentes generales ni foto previa universal todavía.

**Estadísticas.** Promedio diario de valores conocidos, n de días y conteo de entradas; SVG con gaps, tabla exacta y distribución con intervalos correctos para decimales. Menos de tres días muestra puntos sin unirlos. Calendario alineado lunes–domingo y rango personalizado de consulta. Pearson interno requiere 14 días emparejados y variación. Comparaciones entre módulos desactivadas por defecto: `crossAssociation` retorna antes de leer las colecciones cuando no hay permiso. Al autorizar explícitamente se compara con volumen reportado Gym o minutos de Aprendizaje guardados. No se imputan ceros ni se recomiendan conductas; texto «Asociación observada; no demuestra causa». Se puede desactivar inmediatamente. No modifica el Core.

**Nutrición y despensa.** Seis tabs Gym; historia de metas al editar y al importar, preservando campos desconocidos. Reversión grocery confirmada e idempotente: soft delete de gasto original, `expense_history`, compra vuelve a borrador; no altera despensa. Impide restaurar una transacción revertida aisladamente. Se puede registrar otro gasto después, con un único gasto activo. La despensa no se convierte en un segundo FIFO.

**Agenda/ICS.** Timeline Hoy y marcador Ahora en el timer existente. Conversión con Intl/`America/Mexico_City`, no -06 fijo. Editor rechaza horas históricas inexistentes/ambiguas y conserva el timestamp si no se editó. Para recurrencias: omite horas inexistentes y usa la primera de una hora duplicada (política explícita RFC 5545). Core usa esa conversión. ICS no recurrente sigue UTC; recurrente con hora utiliza TZID y VTIMEZONE calculado con la base horaria del navegador; UNTIL respeta el día mexicano. Meses cortos usan BYMONTHDAY/BYSETPOS para conservar el clamp del motor. VTIMEZONE abarca desde el año inicial menos uno hasta el mayor entre fin explícito y año de exportación más dos; después se conserva el último offset conocido. No predice futuros cambios legislativos: conviene reexportar ante cambios de zona. Exportaciones con intervalo de zona superior a 500 años se rechazan, no se truncan. No se ha certificado importación real en Google/Apple/Outlook ni offsets históricos subminuto. No hay sincronización bidireccional.

**Vínculos/importador.** Extremos `{collection,id,child?:{collection,id}}`; children soportados: skills/tasks, clients/deliverables, contentItems/shots, siempre con ID. Dedupe por extremo completo, vínculo retirado permite quitar child sin cascada. `$ref` adelantado y reimportación resuelven el ID previo del child; actualizaciones conservan campos desconocidos y respetan create/update. Schema descargable documenta la forma; validación runtime comprueba parent/child. La navegación child ya enfoca el control de la actividad, entregable o escena correspondiente mediante segmentos adicionales de la misma ruta. La captura de Agenda permite seleccionar un vínculo y guarda pendiente/vínculo en una sola revisión. Other está disponible en Contenido. Estas ampliaciones forman parte de la suite final de este cierre: 147/0.

**Experiencias aditivas.** Home/Hoy Agenda; flujo financiero por periodo; anillo Objetivos; SOMA métricas/pipeline/abonos; Gym últimas sesiones/frecuencia/volumen/peso; ruta Aprendizaje; Libros estantería/cuadrícula/lista; ALVENTO hero con foto real opcional; Contenido etapas/filtros; Vision masonry/categorías/frases editables validadas; Perfil conteos. Los motores existentes conservan autoridad. Se retiró solo el banner decorativo duplicado de ALVENTO, no las acciones ni tarjetas.

### Evidencia visual reciente

Capturas reales, sin iframe para simular anchura. No certifican estados distintos a los capturados.

| Vista | Evidencia |
|---|---|
| ALVENTO claro 390, sin banner duplicado | https://www.genspark.ai/api/files/s/HAlimixd |
| ALVENTO claro 1280, sin banner duplicado | https://www.genspark.ai/api/files/s/kd8tkpGi |
| Editor Bitácora, paso Emociones, claro 390 | https://www.genspark.ai/api/files/s/ncvn9qoC |
| Editor Bitácora, paso Emociones, oscuro 1280 | https://www.genspark.ai/api/files/s/1ul4KjS3 |
| Inicio/Core claro 1280, checkpoint anterior | https://www.genspark.ai/api/files/s/GeBQ34BD |
| Inicio/Core oscuro 390, checkpoint anterior | https://www.genspark.ai/api/files/s/weYQ9jVt |
| Core atención abierto 1280, checkpoint anterior | https://www.genspark.ai/api/files/s/P9SQqUTL |
| Core urgente abierto oscuro 390, checkpoint anterior | https://www.genspark.ai/api/files/s/4tKPa3ss |
| Aviso de cambios 390, checkpoint anterior | https://www.genspark.ai/api/files/s/gBJ2CZOm |
| Preview de formulario 1280, checkpoint anterior | https://www.genspark.ai/api/files/s/bDAEw5zq |

Capturas completadas después de los reintentos:
- Salud 390 claro: https://www.genspark.ai/api/files/s/J6ygKH2v ; 1280 oscuro: https://www.genspark.ai/api/files/s/1tzWSEl9
- Agenda Hoy 390: https://www.genspark.ai/api/files/s/IOrKWOkb ; 1280: https://www.genspark.ai/api/files/s/pugK79Ah
- Estadísticas 390: https://www.genspark.ai/api/files/s/KOKOiwkw ; 1280: https://www.genspark.ai/api/files/s/d46FYSMa
- Calendario 390: https://www.genspark.ai/api/files/s/pHpFtdE1 ; 1280: https://www.genspark.ai/api/files/s/UP8L5YZu
Sin solapamientos/desbordamientos detectados en estas capturas. No certifican la matriz completa.

### Pendientes de implementación, NO bloqueos técnicos
1. Fotos previas al primer guardado y flujos avanzados de todos los módulos; auditoría de overlays ajenos a record-form/pad.
2. Agenda: chips, agrupación final de vencidos y contexto ampliado de enfoque. Tres sugerencias revisables y vínculos desde captura ya integrados.
3. Auditoría de vínculos en los demás formularios. Deep focus y mensajes para actividad/escena vinculada ya integrados.
4. Objetivos: racha auténtica/timeline; Gym: rendimiento por ejercicio; Granja: gráficas adicionales por etapa/cobertura/costo; SOMA: parcialidades solo con denominador real.
5. Libros cover-first; ALVENTO preparación/timeline y mejor producto solo con datos; Contenido storyboard (Other ya implementado); Vision foco/fullscreen; refinamientos de Finanzas y Aprendizaje.
6. Configuración organizada por grupos y Subir con progreso real/estados/a11y; QA de datos largos, vacíos y errores de todos los flujos.
7. ZIP final y aceptación. ZIP actual generado en navegador: `dali-neural-v4-en-desarrollo.zip`, a partir de `project-files.json`; no existe ZIP final estático con URL directa.

### Bloqueos de verificación reales
- La herramienta solo acepta `viewport="mobile"` (390 px) o `"desktop"` (1280 px). No permite 360/412/430/768/1024/1440/1920 como viewport real. No se reemplaza esa prueba con iframe/CSS.
- No hay herramientas de entrada física/lector de pantalla/zoom 200% ni importación interactiva en calendarios externos; no se certifican esas pruebas. Las pruebas DOM de teclado no equivalen a teclado físico o lector de pantalla.
- Saturación de captura devuelve literalmente `browserless sandbox renders are saturated on this pod`. Un intento fallido o interrumpido no constituye aprobación.

### Arquitectura y entrega
Esquema 4, catálogo 4 independiente, 16 rutas con Agenda como única nueva; HTML/CSS/JS clásicos con defer. Datos en `dali-os-local-v1`; medios IndexedDB `${storageKey}-media`. Historiales nuevos permanecen en sus colecciones existentes. No se han usado Table API, D1, Supabase, backend, credenciales ni nube. Sin URL de producción/API pública y sin despliegue. Rutas y parámetros en README; documentación de pruebas en TEST_REPORT.

---

## Checkpoint histórico: integración inicial de 97 pruebas

Lo siguiente describe ese checkpoint, no el estado vigente; sus pendientes ya resueltos no deben leerse como pendientes actuales.

## Estado
**Implementación en curso, no release candidate final ni aceptación completa del Prompt FINAL.** Documento rector: `requirements-rc.md`. Aplicación Vanilla sin compilación, sin backend, sin publicación y sin integración con IA o Supabase.

## Base y verificación
- Base comprobada antes de cambios: **77 correctas / 0 fallos**, 29,96 s.
- Tras añadir esquema 4 e interfaces: las mismas 77 pruebas pasaron.
- Suite ampliada: **97 correctas / 0 fallos**, 36,28 s, `tests.html`, Chromium headless, iframe con la aplicación real y almacenamiento QA aleatorio.
- Una ejecución intermedia produjo 96/1. La nueva prueba detectó que los metadatos de importación sobrescribían `entityLinks.source`. Se corrigió el importador; la prueba no fue eliminada ni debilitada.
- Se actualizaron únicamente las expectativas explícitas de versión/rutas: esquema 3→4 y 15→16 rutas. Todas las pruebas de dominio anteriores se conservan.
- Las comprobaciones reforzadas de ZIP, restauración y recarga comparan también las cinco colecciones nuevas y pasaron en la ejecución final de 97/0. El ZIP de código incluye los módulos RC, el informe y los lanzadores QA.

## Implementado
### Datos
- Migración v3→v4 sobre copia, validación completa, revisión optimista y escritura final única del estado principal. Clave **`dali-os-local-v1` conservada**.
- Respaldo previo `dali-os-local-v1-pre-v4`, creado una sola vez; si no se puede escribir, no se sustituye el estado principal. Las pruebas comprueban fallo de cuota e idempotencia.
- Colecciones `agendaItems`, `entityLinks`, `nutritionDays`, `pantryItems`, `groceryRuns`. Se incluyen en mezcla JSON, respaldo ZIP, restauración y exportación del código.
- Las entradas manuales mantienen texto y valores originales, sin inferir emociones históricas. Campos desconocidos conservados.
- Meta mensual SOMA separada de **1.500.000 centavos**; no sustituye los 3.300.000 centavos del perfil.
- El catálogo continúa con su propia revisión 4; el motor porcino y la semántica clínica no cambian.

### Agenda
- Única nueva ruta principal: `#agenda`, con fichas `#agenda/ID`.
- Captura, edición, Bandeja/Hoy/Semana/Calendario de 28 días/Completados, enfoque y exportación `.ics`.
- Semana apilada en móvil, sin siete columnas comprimidas.
- Repeticiones según vocabulario existente; ocurrencias derivadas sin sembrar registros. Completar conserva historial y no incrementa objetivos automáticamente.
- Las fechas sugeridas por una reflexión se conservan como nota, no como programación automática.
- Límites: no hay aún línea de tiempo con indicador de hora actual ni motor de sugerencias avanzado. El editor de horario utiliza el desfase actual de México (-06:00); todavía debe ampliarse la conversión de horarios históricos con horario de verano. `.ics` no es sincronización bidireccional.

### Bitácora
- Vistas Hoy, Estadísticas personales, Calendario emocional, Patrones y revisión, Archivo.
- Adaptador `dali.journal.entry` 1.0 dentro del importador atómico existente. Validadores, esquema descargable y ejemplo.
- Preview sin escritura; intensidades independientes, origen y confianza de extracción visibles. Revisión de valores antes de confirmar. Relato original omitido por defecto.
- Fusión/reemplazo recuperable, dedupe por fecha/origen/identificador externo, historial y undo protegido.
- Acciones sugeridas desmarcadas por defecto; solo las elegidas se crean al confirmar el lote.
- Datos desconocidos permanecen `null`; estadísticas solo desde reflexiones confirmadas, con tamaño de muestra y tabla. No se inventan días intermedios.
- Texto/voz manuales conservados, aviso de privacidad del proveedor de dictado. Sin audio almacenado ni diagnóstico.
- Límites: aún no hay líneas/sparklines de tendencias, asociaciones entre módulos ni editor visual completo de todos los campos de reflexión. El JSON sigue permitiendo corregirlos antes de validar. La vista Patrones declara que las comparaciones están desactivadas.

### Vínculos
- Búsqueda explícita de registros, creación confirmada y retirada confirmada. No duplica dinero, inventario, eventos ni progreso.
- Normalización de extremos `{collection,id}`, referencias validadas y prevención de autorrelación/duplicados.
- Importación `system/entity_link` con referencias entre operaciones y undo del lote.
- No hay cascada: retirar un vínculo no elimina ninguna entidad.
- Límites: las relaciones se hacen a registros completos, no todavía a todos los entregables/actividades anidados. La interfaz de vínculo está en fichas compatibles, Agenda y compras; no se ha añadido un selector a cada formulario del CRM.

### Gym / alimentación y despensa
- Se conservan entrenamiento e importaciones. Se añaden secciones de Alimentación y Despensa.
- Seis nutrientes, metas personales propuestas e inactivas hasta confirmar, consumos desconocidos vacíos, historial por día.
- Despensa con unidades explícitas, existencias, umbral, fechas, cadencia, precio, notas y foto local. Los días restantes solo se muestran si se introducen manualmente.
- Lista de compra revisable; gasto separado requiere importe y casilla de autorización. Idempotencia: una compra crea como máximo una transacción.
- No se actualiza inventario ni se completa un objetivo al guardar una lista o registrar gasto. No se dan recomendaciones médicas.
- Límites: no hay libro completo de versiones de metas nutricionales dentro del mismo día, ni una contabilidad de movimientos de despensa comparable al FIFO de Granja. No hay reversión dedicada de gasto de despensa todavía; no debe prometerse esa acción.

### Contexto y configuración
- Exportación `dali.context.export` 1.0, separada de respaldos, con módulos/rango y preview exacta antes de descargar/copiar.
- Narrativas, evidencia emocional, teléfonos y notas excluidos por defecto. Sin blobs ni archivos de medios.
- Accesos móviles configurables: exactamente cinco destinos distintos.
- Descarga de copia previa v4 y visibilidad del esquema. Meta SOMA editable separada.
- Importación mantiene confirmación explícita; revisar una reflexión informa que sigue sin guardar, no un falso mensaje de guardado.

## Capturas realmente verificadas
Los lanzadores `review-rc-*.html` cargan el **index real** en un almacén QA aislado. No duplican la aplicación ni simulan un ancho mediante CSS. Las fotos/filas QA no se escriben en el almacén del propietario.

| Vista | Móvil 390 px | Escritorio 1280 px |
|---|---|---|
| Agenda / semana clara | https://www.genspark.ai/api/files/s/jDqDaqWf | https://www.genspark.ai/api/files/s/DAgPs5gL |
| Bitácora / reflexión clara | https://www.genspark.ai/api/files/s/d98H2vgC | https://www.genspark.ai/api/files/s/SnENDVTl |
| Nutrición / oscura | https://www.genspark.ai/api/files/s/Ux1KeJtz | https://www.genspark.ai/api/files/s/ZO5HQYi2 |
| Subir / reflexión | https://www.genspark.ai/api/files/s/HSCCYxMK | Pendiente |
| Contexto / modal oscuro | https://www.genspark.ai/api/files/s/vbWsH3Sp | https://www.genspark.ai/api/files/s/JZV6vak9 |

El primer intento de Contexto móvil falló por saturación; las capturas posteriores sí se completaron. La revisión móvil corresponde al viewport inicial del modal, no a todos sus estados de scroll o preview.

Estas capturas no certifican 360/412/430/768/1024/1440/1920, zoom 200%, lectores de pantalla o todos los estados y temas. No se afirma esa cobertura.

## Pendiente del Prompt FINAL
- DALI Core grande, interactivo y sensible al tema, motor de severidad explicado y política SOMA configurable en funcionamiento. Los valores de preferencias del motor ya están preparados, **pero el motor de estado no existe todavía**.
- Héroes claros/oscuros finales, GSAP/movimiento adicional y limpieza probada de recursos nuevos.
- Cierre seguro general de formularios, borradores y wizards completos.
- Experiencias finales de Finanzas, Objetivos, SOMA, Aprendizaje, Libros, ALVENTO, Contenido y Vision; capas avanzadas de Agenda/Bitácora/Gym descritas arriba.
- Matriz visual y de accesibilidad completa; pruebas ampliadas de error/cuota en todos los caminos nuevos y refinamiento de calendarios históricos.
- ZIP final y declaración de aceptación: el ZIP actual sigue llamándose `dali-neural-v4-en-desarrollo.zip` y se genera desde Configuración. No existe artefacto estático final con URL directa.

## Uso y recuperación
1. Abrir `index.html` por HTTPS/localhost y exportar un ZIP personal de respaldo.
2. Abrir Agenda, capturar un pendiente real y confirmar fecha si se conoce.
3. En Bitácora, copiar instrucciones y descargar esquema; usar ChatGPT por separado.
4. Llevar el JSON a Subir, validar, revisar inferencias/acciones y confirmar el lote explícitamente.
5. Exportar ZIP con imágenes periódicamente. La copia pre-v4 se descarga desde Configuración. Mezclar JSON no es un downgrade ni reemplazo completo: para recuperación completa se usa un ZIP válido mediante el restaurador existente.

No hay URL de producción, API pública ni despliegue. OAuth, Google Calendar bidireccional, Supabase, autenticación y sincronización siguen fuera de esta fase.
