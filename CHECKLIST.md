# Seguimiento DALI CRM · Granja v3

Este documento distingue implementación local comprobada de alcance pendiente. No equivale a la aceptación total del prompt maestro.

## Prompt FINAL — estado actual
- [x] Base 77/0 comprobada antes de cambios.
- [x] Esquema 4, respaldo pre-v4 único, validación y migración determinista comprobados.
- [x] Agenda, Bitácora JSON revisable, vínculos, nutrición/despensa y contexto local integrados.
- [x] Suite ampliada a 147/0, 38,09 s; sin errores de consola registrados. Las 97 anteriores se conservan.
- [x] Capturas de Agenda/Bitácora/Nutrición en móvil 390 y escritorio 1280; Subir móvil.
- [x] README, informe RC, informe de migración y changelog actualizados.
- [x] DALI Core interactivo/theme-aware, selector explicado, SOMA separado, salud cerrable y preparación vinculada a ventana real.
- [x] Dirty guard/revisión, editor Bitácora por pasos, rango/gráficas, opt-in entre módulos y nuevos tests.
- [x] Vínculos anidados/$ref, historia de metas por importación y reversión grocery auditada.
- [x] Conversión histórica Agenda y exportación TZID/VTIMEZONE; interoperabilidad externa todavía no certificada.
- [x] ALVENTO sin banner duplicado, capturas claras en 390 y 1280.
- [ ] Cierre seguro, borradores y wizards generales completos.
- [ ] Refinamientos funcionales de Agenda/Bitácora/nutrición y relaciones anidadas.
- [ ] Rediseños restantes y gráficas avanzadas del Prompt FINAL.
- [ ] Matriz completa de temas/anchos/accesibilidad y ZIP final.

Alcance, evidencias y límites precisos en `RC_REPORT.md`. **El candidato final todavía no está completado.**

## Referencia histórica del incremento Neural previo
- [x] Inicio, reloj, entrada, movimiento y shell verificados.
- [x] Granja visual, gráfico de Comida y editor de hitos.
- [x] Alta rápida y Salud visual; modales revisados en móvil/escritorio.
- [x] 16 referencias inactivas nuevas, 14 anteriores conservadas y respaldo idempotente.
- [x] 77 pruebas correctas, 0 fallos, incluyendo ZIP e imágenes.
- [x] README, informes y manifiesto del código actualizados.
- [x] entityLinks y migración de esquema 4 (completados en el incremento RC posterior).
- [ ] Wizards, borradores y cierre seguro generales; dock y paleta avanzada.
- [ ] Rediseños específicos completos de los módulos restantes.
- [ ] Matriz completa de accesibilidad/capturas y entrega final v4.

La versión actual puede probarse, pero **el documento v4 no está completado**.

## Implementado
- [x] Conservación del proyecto Vanilla y copias de referencia del código v1.
- [x] Migración versionada, validación previa/posterior y respaldo anterior recuperable.
- [x] Quince rutas y navegación agrupada con scroll interno.
- [x] Importador con tres contratos, preview, confirmación, lote atómico, dedupe y deshacer protegido.
- [x] Retirada del gimnasio ejecutor del flujo principal; legado conservado.
- [x] Sesiones, métricas reportadas/calculadas, mapa esquemático y rangos importados.
- [x] Granja: ciclo reproductivo, camadas, venta/reversión, alertas, salud y configuración.
- [x] Finanzas compartidas por negocio; stock ALVENTO derivado con reversión.
- [x] CRUD de libros, drops/SKU/hitos, ideas/escenas/métricas y aspiraciones.
- [x] Imágenes comprimidas, miniaturas y recorte en IndexedDB.
- [x] Rutas de aprendizaje importadas conservan progreso/evidencia.
- [x] Perfil, reloj mexicano, saludo, widgets y tarjeta bancaria rectangular móvil.
- [x] Respaldo ZIP con medios y descarga del código desde Configuración.
- [x] Pruebas aisladas de dominio y flujos (véase QA.md).

## Funciones locales todavía pendientes respecto del documento completo

### Integridad y arquitectura
- [ ] Transacción de bloqueo entre pestañas mediante Web Locks; la revisión optimista actual detecta cambios secuenciales pero no es un bloqueo simultáneo garantizado.
- [ ] Validadores exhaustivos por cada payload/nested entity y JSON Schema completos de cada entidad; los esquemas actuales cubren la envoltura y estructura principal, con validación adicional en dominio.
- [ ] Detectar ciclos de prerequisitos y ampliar relaciones/uniqueness de entidades anidadas.
- [ ] Ampliar pruebas de ZIP corruptos, cuota llena, medios perdidos y fallos entre IndexedDB/localStorage.
- [ ] Paginación/virtualización para miles de registros e historial de lotes muy grande.

### Importador
- [ ] Diff campo a campo con editores de campos ambiguos individuales. Hoy muestra acciones/avisos y permite corregir el JSON completo.
- [ ] Deshacer selectivo con resolución interactiva de conflictos posteriores. Actualmente se cancela para no sobrescribirlos.
- [ ] Flujo dedicado de reversión y pago de cuotas SOMA importadas; el flujo actual de abono vinculado sí funciona.
- [ ] Instrucciones especializadas completas para cada módulo y selección avanzada de entidades destino.

### Gimnasio
- [ ] Frecuencia/comparación con periodo anterior y tendencias detalladas por ejercicio.
- [ ] Gráficas de peso y fotografías corporales con ficha propia; el peso numérico ya se registra.
- [ ] Historial visual de evolución de rangos y rangos de ejercicio inline.
- [ ] Filtro específico por ejercicio y rango de fechas personalizado.
- [ ] Sustituir mapa esquemático por geometría anatómica original más detallada, manteniendo accesibilidad.

### Granja
- [x] Nueve vistas, calendario mensual/lista y cierre individual de pendientes.
- [x] Celo, servicio pendiente, revisión positiva/negativa/inconclusa, parto, destete, pérdidas y correcciones auditadas; sin confirmación por tiempo.
- [x] Sementales existentes por ID y acciones de fallecimiento/traslado/archivo.
- [x] Filtro por estado, búsqueda, periodos de rendimiento y balance financiero del periodo.
- [x] Migración v2→v3 conservadora, respaldo previo y reporte de revisión.
- [x] Raciones confirmadas y excepciones; gramos/centavos; previsión por producto y etapa, meses reales, colchón, costales y sobrantes.
- [x] FIFO, existencia inicial, compras/gasto idempotente, consumo, merma, ajuste y anulación protegida.
- [x] Referencias MAFORNU inactivas, revisión explícita de Racto; ninguna dieta ni animal ficticio.
- [x] Importación de nuevas entidades con preview, dedupe, atomicidad y undo.
- [x] Casos matemáticos A–E y restauración ZIP real; 59 pruebas totales.
- [ ] Puntaje multifactor configurable para selección de 8 reproductoras; días no productivos y todas las tasas/anualizaciones del documento.
- [ ] Imputación trazable de costos reales por animal/ciclo/camada/lechón; planeado vs. consumido, quiebres e historial gráfico de precios.
- [ ] Simulación diaria de agotamiento con caducidades durante el periodo y reposiciones previstas. Hoy se descuenta inventario utilizable al inicio; cobertura con demanda del primer día.
- [ ] Versionado temporal completo de políticas/raciones y segmentación de precios dentro del rango.
- [ ] Transiciones por edad/peso de todas las etapas de engorda; programación avanzada de cuidados de camada y auditoría granular de ediciones.
- [ ] Reversión guiada de compras con consumos posteriores y resolución de correcciones encadenadas.

### Crecimiento y negocios
- [ ] Libros: meta de lectura configurable, resumen de páginas del mes y vista compacta separada.
- [ ] ALVENTO: preparación del drop, sell-through, margen completo con costos generales, pedidos/ticket medio, galería de SKUs y dependencias de hitos.
- [ ] Contenido: Kanban, calendario/cadencias por plataforma, checklist separado de grabación/edición y visualización completa de snapshots.
- [ ] Vision Board: drag-and-drop progresivo y fullscreen nativo. Hoy tiene orden por botones y diálogo de enfoque.
- [ ] Bitácora: vistas semanales/mensuales y filtros de fecha; búsqueda y entradas manuales ya operativas.
- [ ] Recurrencias: materializar todas las instancias intermedias no visitadas como no registradas. Actualmente conserva la instancia observada y avanza a la última fecha programada, sin inventar actividad.
- [ ] Sugerencias de onboarding adicionales con confirmación y métricas cruzadas avanzadas.

### QA y accesibilidad
- [ ] Revisar todos los módulos en 360, 430, 768, 1024 y 1440 px. Herramientas disponibles capturan 390 y 1280 px.
- [ ] Validación WCAG AA completa, lector de pantalla, zoom 200%, tamaños táctiles en todos los controles y teclado virtual real.
- [ ] Safari/iOS y Firefox físicos; permisos y dictado por voz reales.
- [ ] Pruebas de arranque offline y CDN caído. No hay service worker.

## Integraciones no configuradas
- Backend, autenticación por usuario, sincronización y políticas RLS: no implementados en este entorno estático.
- Symmetry, ChatGPT, redes sociales, pagos: no hay APIs conectadas. Importación manual JSON, nunca simulación.
- Hosted privado: no activado (la plataforma requiere Plus o superior). No se realizó deploy.
- Falta el ZIP/código src de GranjaControl para auditar sus reglas reales. Los adjuntos recibidos solo aportan configuraciones y capturas.
