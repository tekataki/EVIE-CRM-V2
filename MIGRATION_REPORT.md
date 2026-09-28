# Migración · informe del incremento Neural

## Situación actual
**Esquema principal 4 implementado y probado en almacenes QA.** La clave sigue siendo `dali-os-local-v1`. Al abrir un estado anterior se encadenan las migraciones conservadas y `RCData.migrate`, sobre una copia. Se valida el resultado completo y se guarda `dali-os-local-v1-pre-v4` una sola vez antes de sustituir el estado principal. Si falla la copia previa, no se escribe el estado principal. No se afirma haber inspeccionado el almacenamiento personal del propietario.

Se añaden cinco colecciones vacías: `agendaItems`, `entityLinks`, `nutritionDays`, `pantryItems`, `groceryRuns`; preferencias de privacidad/accesos/umbrales y meta SOMA de 1.500.000 centavos. Se conservan todos los campos desconocidos y la meta personal del perfil. Bitácoras manuales mantienen sus valores, con origen manual si no lo tenían; no se calculan emociones desde texto histórico.

La migración 3→4 no usa reloj ni UUID nuevos: añade una entrada de migración con clave fija. Es determinista e idempotente para la misma entrada. Las migraciones históricas 1→2→3 y la revisión de catálogo conservan sus fechas de auditoría originales. Permanecen los respaldos `-pre-v2`, `-pre-v3` y `-pre-catalog-v4`. ZIP/JSON/importación/recarga incluyen los nuevos modelos. La importación de vínculos conserva el extremo `source`, separado de los metadatos del lote.

Recuperación: Configuración permite descargar la copia pre-v4. Es una copia JSON del estado anterior, no un respaldo de imágenes ni un botón de downgrade. Para reemplazo completo se conserva el restaurador ZIP con respaldo previo. No hay Supabase, sincronización ni despliegue. Detalles y límites en `RC_REPORT.md`.

## Extensiones compatibles posteriores dentro de esquema 4
No se cambió la clave ni se añadió otra migración de versión. `entityLinks` admite `child` opcional (skills/tasks, clients/deliverables, contentItems/shots). El importador resuelve IDs nested existentes antes de aplicar referencias y conserva campos no suministrados. Historias opcionales: `farmHealthRecords.followup_history`, `nutritionDays.target_history`, `groceryRuns.expense_history`; se escriben solo tras acciones explícitas. `preferences.visionLines`, `somaStageWeights` y `journalPrivacy.crossModule` se validan cuando existen. Comparaciones entre módulos apagadas sin consentimiento explícito. Las historias y relaciones se incluyen en los respaldos existentes; no se sincronizan fuera del navegador. Suite actual 147/0, incluidos tests de reimportación/undo y respaldo general.

## Referencia histórica: cambios compatibles con el esquema 3
- Preferencias opcionales `motion` y `motionPaused`. No requieren reemplazar las preferencias existentes.
- Hitos conservan `day`, `title`, `enabled` y propiedades adicionales; editor guarda `category` y `note` en el mismo registro de configuración. Las propiedades anteriores se copian, no se descartan.
- El nombre visible de Alimentación/Calendario/Configuración cambia a Comida/Agenda/Ajustes. Identificadores `feed`, `calendar`, `settings` y `preferences.farmView` se conservan.
- Medios continúan en IndexedDB mediante `media_id`, sin base64 en localStorage.
- Entrada: una clave de sessionStorage; no se almacena actividad duplicada.
- Alta visual: datos opcionales de precisión de nacimiento y procedencia. Salud: `observation_categories`, `operational_level` y `body_region`, sin modificar estados reproductivos.

## Sin modificaciones automáticas
No se siembran animales, compras, consumos, raciones activas, gestaciones o transacciones por el rediseño. Las 14 referencias existentes siguen como estaban. **Las 16 referencias del 16/09/2026 ya están incorporadas**, inactivas y pendientes de confirmación. `farm_catalog_version: 4` identifica esta revisión del catálogo, sin cambiar el esquema principal 3. `catalog_updates` registra la incorporación. Se usan IDs deterministas y dedupe por nombre normalizado/peso; no se sobrescriben productos existentes ni precios confirmados.

`Store.init` valida una copia y guarda `dali-os-local-v1-pre-catalog-v4` antes de sustituir un estado existente. Si falla el respaldo, conserva el original. Una segunda carga no duplica referencias; aumenta la revisión solo al aplicar la actualización. El respaldo está disponible en Granja → Ajustes → Respaldo previo al catálogo. Los navegadores nuevos no tienen un estado previo que respaldar.

Monensina y Racto requieren revisión expresa. Las pruebas verifican gramos/centavos exactos, $349 de lactancia tradicional, dedupe, idempotencia y fallo al guardar el respaldo.

## Pendiente después de la base 4
Completar relaciones con registros anidados, políticas de actualización deterministas de progreso, historial detallado de metas nutricionales y ampliación de QA. La base `entityLinks`, migración respaldada y soporte de importación/restauración ya están implementados. La revisión de catálogo descrita arriba es histórica: no debe confundirse su versión 4 con la del estado principal actual.

## Entorno
Sin D1, Table API, Supabase, sincronización ni despliegue. Pruebas y capturas usan claves `qa` aisladas. El ZIP de código no contiene registros personales; para conservar registros e imágenes se utiliza el respaldo ZIP de datos, separado.
