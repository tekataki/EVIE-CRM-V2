# PROMPT MAESTRO DE EVOLUCIÓN — DALI CRM v2

## Instrucción principal

Actúa como un equipo senior completo formado por: arquitecto de software, desarrollador full-stack, diseñador de producto UI/UX, ingeniero de datos, especialista en seguridad y privacidad, especialista en accesibilidad y responsable de QA.

Tu trabajo no es explicar cómo podría hacerse ni entregar otra beta. Debes **evolucionar el proyecto DALI existente hasta convertirlo en una aplicación web personal tipo CRM, funcional, coherente, estable y realmente utilizable**, trabajando directamente sobre los archivos adjuntos.

El producto es una **página web personal tipo CRM y centro de mando**, no un sistema operativo real. Puedes conservar “DALI OS” como nombre de marca si ya forma parte de la identidad visual, pero en textos descriptivos, metadatos y documentación debes llamarlo “CRM personal”, “espacio personal” o “centro de mando”. No inventes ventanas, terminales, exploradores de archivos ni patrones de sistema operativo.

La experiencia final debe sentirse hecha específicamente para Dali: rápida, privada, elegante, minimalista, responsive, con tema claro y oscuro, y capaz de reunir su vida personal, negocios, entrenamiento, aprendizaje, rancho, libros, contenido y metas visuales sin convertirse en un dashboard genérico.

---

## 0. Resultado obligatorio

Debes entregar una versión terminada que:

1. Conserve todo lo que ya funciona en DALI.
2. Migre los datos existentes sin borrarlos, duplicarlos ni reinterpretarlos silenciosamente.
3. Añada y conecte los nuevos módulos descritos en este documento.
4. Reemplace el enfoque de “rutinas dentro de DALI” por “estadísticas importadas desde Symmetry”.
5. Implemente un importador JSON universal con vista previa, validación, deduplicación y deshacer.
6. Porte la lógica útil de GranjaControl al stack actual de DALI, sin mezclar frameworks.
7. Funcione de verdad en móvil, tablet y PC.
8. No deje botones decorativos, pantallas falsas, funciones sin conectar, datos inventados ni errores en consola.
9. Incluya migraciones, estados vacíos, manejo de errores, accesibilidad, respaldo y pruebas.
10. Quede listo para que el usuario lo abra y lo use, aunque todavía no haya conectado un backend.

No finalices diciendo solamente “la base está lista”, “queda pendiente conectar” o “esto es un MVP”. Termina todas las funciones locales definidas como prioridad P0 y P1. Las integraciones externas que necesiten credenciales pueden quedar como adaptadores documentados, pero nunca deben bloquear la aplicación local.

---

## 1. Archivos adjuntos y orden de autoridad

Recibirás, como mínimo:

- Un ZIP con la versión actual de DALI.
- Un ZIP de GranjaControl creado en Bolt.
- Capturas de DALI en escritorio y móvil.
- Capturas de GranjaControl.
- Capturas de una sesión de Symmetry y su detalle de ejercicios.
- Capturas del mapa corporal del gimnasio y de una ruta de aprendizaje.

Trata los adjuntos con esta prioridad cuando exista un conflicto:

1. Este documento y los requisitos explícitos del usuario.
2. Los datos reales ya guardados por DALI.
3. La lógica que ya funciona correctamente en DALI.
4. El ZIP de GranjaControl como referencia funcional.
5. Las capturas como referencia visual y de interacción.
6. Tus decisiones técnicas, siempre que sean reversibles y estén justificadas.

Las capturas no son especificaciones de datos perfectas. No inventes información que no sea visible. Si una captura está cortada, conserva los campos desconocidos como null, marca la importación como parcial y muestra una advertencia.

---

## 2. Protocolo obligatorio antes de modificar código

Antes de programar:

1. Descomprime e inspecciona ambos ZIP completos.
2. Ejecuta la versión actual de DALI y recorre todas sus rutas.
3. Identifica almacenamiento, esquema, validaciones, navegación, formularios, temas, estilos, relaciones e importación de respaldos.
4. Ejecuta o inspecciona GranjaControl y separa:
   - reglas de negocio que sí deben portarse;
   - elementos visuales que solo son referencia;
   - código dependiente de React, Vite, NPM o Supabase que no puede copiarse literalmente;
   - fallas de seguridad o integridad que no deben heredarse.
5. Crea internamente un inventario de “conservar / corregir / migrar / añadir”.
6. Crea un respaldo de prueba antes de ejecutar cualquier migración.
7. Implementa directamente después del análisis. No gastes una respuesta completa en un plan sin código.

Solo pregunta al usuario si falta una credencial o una decisión que haga imposible continuar. Para nombres de campos, distribución, componentes y decisiones menores, elige una solución profesional y reversible.

No publiques ni despliegues el sitio durante esta tarea salvo que el usuario lo pida expresamente. Si Genspark Hosted Deploy, Cloudflare o cualquier proveedor exige un plan de pago, termina y entrega primero el código completo y un ZIP descargable. El hosting no debe frenar el desarrollo ni provocar que abandones módulos.

---

## 3. Restricciones técnicas vinculantes

La aplicación actual usa:

- HTML Vanilla.
- CSS.
- JavaScript Vanilla.
- Tailwind CSS mediante CDN.
- Librerías adicionales mediante CDN con versión fijada.
- Archivos estáticos sin compilación.

Mantén ese stack. **No uses Node.js, NPM, PNPM, Yarn, Bun, React, Vue, Next.js, Vite ni un bundler. No crees package.json ni un paso de build.**

Los archivos actuales relevantes son:

- **index.html**
- **config.js**
- **domain.js**
- **store.js**
- **forms.js**
- **views.js**
- **app.js**
- **styles.css**
- **icon.svg**
- **requirements.txt**

Puedes añadir archivos Vanilla separados cuando reduzcan complejidad, por ejemplo:

- **migrations.js**
- **importer.js**
- **media-store.js**
- **farm-domain.js**
- **gym-domain.js**
- **schemas/dali-import.schema.json**
- **schemas/dali-gym-session.schema.json**
- **schemas/dali-learning-route.schema.json**
- **samples/**
- **README.md**

No conviertas todo en un único archivo enorme. Evita funciones globales con responsabilidades mezcladas. Conserva el patrón actual cuando sea razonable y separa dominio, persistencia, importación, renderizado y formularios.

El ZIP de GranjaControl usa React, Vite, TypeScript, hooks, Tailwind por NPM y Supabase. **No copies su estructura ni sus dependencias al proyecto DALI.** Porta manualmente sus reglas y flujos al stack Vanilla/CDN de DALI.

---

## 4. Lo que ya existe y no debe romperse

La versión actual de DALI ya contiene:

- Inicio.
- Finanzas.
- Gimnasio.
- Objetivos.
- SOMA.
- Aprendizaje.
- Bitácora personal.
- Mi perfil.
- Tema claro y oscuro.
- Sidebar en escritorio, drawer y navegación inferior en móvil.
- Persistencia local.
- Revisión optimista para evitar sobrescritura entre pestañas.
- Respaldo JSON.
- Importación de respaldos sin UUID duplicados.
- Papelera o borrado lógico.
- Abonos vinculados de manera idempotente con movimientos financieros.
- Renovación de objetivos recurrentes.
- Búsqueda global.

Preserva esas capacidades, salvo las funciones de ejecución de rutinas del gimnasio que este documento reemplaza explícitamente. No borres los datos antiguos de rutinas o sesiones: migra los datos utilizables y archiva los conceptos obsoletos como legado.

La importación de respaldo completo y el nuevo importador JSON universal son dos herramientas distintas:

- **Restaurar respaldo** reconstruye o mezcla el estado completo de DALI.
- **Subir / Importar JSON** crea o actualiza registros concretos enviados por ChatGPT.

No mezcles ambos flujos ni permitas que un JSON operativo se trate como respaldo.

---

## 5. Arquitectura de navegación

Reorganiza las secciones con metadatos explícitos. No insertes separadores comparando un índice fijo como “si idx === 7”. Cada sección debe ser un objeto con route, label, icon, group, searchTerms y mobilePriority.

### Grupo principal

1. Inicio
2. Finanzas
3. Gimnasio
4. Objetivos
5. SOMA
6. Aprendizaje
7. Bitácora personal
8. Granja
9. Libros
10. ALVENTO
11. Contenido
12. Vision Board

### Grupo de herramientas, visualmente separado

13. Subir

### Grupo de cuenta, al final

14. Mi perfil
15. Configuración

En escritorio:

- Sidebar fija, plegable y con scroll interno.
- Marca y controles de cuenta permanecen accesibles.
- Etiquetas de grupo discretas.
- Estado activo claro.
- El contenido no debe saltar al contraer la barra.

En móvil:

- Botón de tres líneas arriba a la izquierda.
- Drawer con todas las secciones y grupos.
- Navegación inferior limitada a cinco accesos frecuentes; no intentes meter quince iconos.
- Mantén Inicio, Finanzas, acción central Subir o Nuevo registro, Objetivos y Bitácora.
- Respeta safe-area en iOS/Android.
- Todas las funciones siguen disponibles desde el drawer.

Actualiza rutas, breadcrumbs, búsqueda global, quick actions, preferencias y widgets para reconocer todas las secciones nuevas.

---

## 6. Sistema de datos, migración y persistencia

### 6.1 Migración

El estado actual usa un esquema v1 y colecciones como transactions, bills, loans, goals, clients, routines, sessions, metrics, skills, studySessions y journal.

Crea una migración versionada y determinista:

- Nunca ejecutes la misma migración dos veces.
- Antes de migrar, valida el estado original.
- Genera una copia de seguridad recuperable.
- Migra sobre una copia, valida el resultado completo y solo entonces confirma una escritura.
- Si falla, conserva intacto el estado anterior y explica el error.
- Conserva campos desconocidos para no destruir datos de versiones futuras.
- No conviertas silenciosamente unidades monetarias, fechas ni pesos.
- Mantén las rutinas antiguas en una colección legacy o con archived_at; no las muestres como flujo principal.
- Convierte las sesiones antiguas terminadas al nuevo formato estadístico cuando exista información suficiente.
- Las sesiones incompletas pueden quedar archivadas como legado.

Incrementa version y cambia storageKey solo mediante una migración controlada. No “soluciones” el cambio creando un almacenamiento vacío.

### 6.2 Colecciones

Mantén las colecciones actuales y añade, como mínimo:

- importBatches
- farmAnimals
- farmEvents
- farmLitters
- farmHealthRecords
- farmSettings
- books
- alventoDrops
- alventoProducts
- contentItems
- visionItems
- mediaMetadata

Puedes usar una colección compartida de tasks/notifications si su modelo de enlaces es claro. No dupliques el libro mayor financiero en cada negocio.

Todo registro debe tener:

- id UUID.
- created_at ISO.
- updated_at ISO.
- deleted_at o archived_at cuando corresponda.
- source cuando provenga de JSON, migración o integración.
- import_batch_id cuando haya sido importado.
- user_id cuando se utilice backend.

### 6.3 Fechas, hora y moneda

- Zona horaria canónica: **America/Mexico_City**.
- Locale: **es-MX**.
- Moneda: **MXN**.
- Guarda instantes como ISO UTC y fechas de calendario como YYYY-MM-DD.
- No analices YYYY-MM-DD como UTC si eso puede mover el día.
- Todas las recurrencias deben conservar timezone.
- Conserva el formato monetario actual y usa números seguros; no uses strings como fuente de cálculo.
- No cambies la unidad de un monto histórico sin una migración explícita.

### 6.4 Imágenes y archivos

No guardes imágenes grandes como base64 dentro de localStorage. Implementa un almacén de medios con IndexedDB para modo local:

- blob original optimizado;
- thumbnail;
- media_id estable;
- nombre, MIME, tamaño, dimensiones y fecha;
- límite configurable;
- validación de image/jpeg, image/png y image/webp;
- compresión y redimensionado en cliente antes de guardar;
- eliminación de blobs huérfanos;
- revocación de object URLs;
- estado de error si la cuota está llena.

Los registros guardan media_id, no el archivo embebido.

Para respaldo completo local, usa una solución estática compatible con CDN, como JSZip con versión fijada, y exporta un ZIP con:

- data.json validado;
- media/;
- manifest.json;
- versión del esquema.

Conserva también una exportación JSON ligera que avise claramente que no contiene archivos binarios.

### 6.5 Backend opcional

La aplicación debe funcionar completamente en modo local sin fingir autenticación.

Si existe configuración real de Supabase:

- usa el cliente por CDN;
- usa únicamente clave pública/publishable en frontend;
- nunca uses service_role;
- exige autenticación real;
- añade user_id a todas las tablas;
- aplica RLS con auth.uid() = user_id para SELECT, INSERT, UPDATE y DELETE;
- usa buckets privados y rutas por usuario;
- crea migraciones SQL versionadas;
- sincroniza con una estrategia explícita y manejo de conflictos.

No copies las políticas de GranjaControl que permiten CRUD anónimo. No muestres “datos seguros en la nube” si no se ha probado autenticación, RLS y Storage.

---

## 7. Importador JSON universal — sección “Subir”

Esta es una función central, no un textarea decorativo.

### 7.1 Objetivo

El usuario podrá hablar con ChatGPT y describir pendientes, movimientos, objetivos, su día, un entrenamiento, una ruta de estudio u otros registros. ChatGPT devolverá JSON. El usuario pegará ese JSON o seleccionará un archivo .json en DALI y la aplicación distribuirá los registros a los módulos correctos.

DALI **no necesita una API de IA integrada** para este flujo. No inventes una conexión con ChatGPT. El puente es un contrato JSON explícito.

### 7.2 Interfaz

La página Subir debe ofrecer:

- Pegar JSON.
- Arrastrar o seleccionar archivo .json.
- Botón “Validar”.
- Botón “Cargar ejemplo”.
- Botón “Descargar esquemas”.
- Botón “Copiar instrucciones para ChatGPT”.
- Detección del tipo de documento.
- Vista previa agrupada por módulo.
- Resumen: crear, actualizar, omitir, advertencias y errores.
- Edición de campos ambiguos antes de confirmar.
- Selector de estrategia cuando aplique: fusionar, reemplazar dentro de una entidad o cancelar.
- Confirmación final.
- Historial de lotes importados.
- Botón “Deshacer lote”.

Nunca escribas datos al pegar, seleccionar archivo o validar. Solo guarda después de una confirmación explícita.

### 7.3 Formatos aceptados

Implementa adaptadores para:

1. **dali.crm.import**: operaciones de cualquier módulo.
2. **dali.gym.session**: entrenamiento proveniente de capturas.
3. **dali.learning.route**: ruta completa para una habilidad.

Todos se normalizan internamente a una lista de operaciones y pasan por el mismo motor de validación y confirmación.

### 7.4 Contrato general

Acepta una estructura como esta:

~~~json
{
  "format": "dali.crm.import",
  "schema_version": "2.0",
  "import_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-09-13T18:00:00.000Z",
  "timezone": "America/Mexico_City",
  "source": {
    "kind": "chatgpt_voice",
    "label": "Dictado personal"
  },
  "atomic": true,
  "operations": [
    {
      "operation_id": "op-recoger-hermana",
      "module": "objectives",
      "entity": "goal",
      "action": "upsert",
      "dedupe_key": "goal:recoger-hermana:daily:14-30",
      "needs_confirmation": false,
      "payload": {
        "title": "Ir por mi hermana",
        "description": "",
        "period": "daily",
        "priority": "high",
        "start_date": "2026-09-14",
        "recurrence": {
          "frequency": "daily",
          "interval": 1,
          "time_local": "14:30",
          "days_of_week": [],
          "day_of_month": null,
          "timezone": "America/Mexico_City",
          "end_date": null
        }
      }
    },
    {
      "operation_id": "op-corte-pelo",
      "module": "objectives",
      "entity": "goal",
      "action": "upsert",
      "dedupe_key": "goal:corte-pelo:monthly",
      "needs_confirmation": true,
      "payload": {
        "title": "Corte de pelo",
        "period": "monthly",
        "priority": "medium",
        "start_date": "2026-09-15",
        "recurrence": {
          "frequency": "monthly",
          "interval": 1,
          "time_local": null,
          "days_of_week": [],
          "day_of_month": 15,
          "timezone": "America/Mexico_City",
          "end_date": null
        }
      }
    }
  ]
}
~~~

La recurrencia nunca debe deducirse ciegamente. Si el dictado no especifica frecuencia, fecha u hora, ChatGPT debe usar null y needs_confirmation: true. DALI debe señalarlo en la vista previa.

### 7.5 Módulos y entidades permitidos

Usa una allowlist explícita:

- finance: transaction, bill, loan, payment.
- objectives: goal.
- soma: client, deliverable, installment, note.
- journal: entry.
- gym: session, body_metric, imported_rank.
- learning: skill, route, activity, study_session.
- farm: animal, event, litter, health_record, setting.
- books: book.
- alvento: drop, product, milestone.
- content: content_item, shot, metric_snapshot.
- vision: vision_item.
- profile: profile_patch, únicamente con confirmación reforzada.

No aceptes nombres de colecciones arbitrarios.

### 7.6 Seguridad e integridad

- JSON solamente; nunca eval, Function, scripts ni HTML ejecutable.
- Rechaza claves __proto__, prototype y constructor en cualquier profundidad.
- Profundidad máxima configurable.
- Tamaño máximo de archivo, por ejemplo 1 MB para operaciones JSON.
- Máximo de operaciones, por ejemplo 500.
- Límites de longitud para strings y arrays.
- Valida enums, UUID, fechas, horas, moneda, números finitos y rangos.
- Escapa todo el contenido al renderizar.
- Construye el nuevo estado sobre una copia.
- Resuelve referencias internas en una segunda pasada.
- Valida todo el estado resultante.
- Confirma una sola escritura atómica.
- Si una operación falla y atomic es true, no guardes ninguna.
- No importes montos negativos para representar gastos: usa type = expense y amount positivo.
- Un pago vinculado no puede superar el saldo pendiente.
- Las relaciones deben apuntar a registros existentes o creados en el mismo lote.

### 7.7 Idempotencia y deshacer

- import_id identifica el lote.
- operation_id es único dentro del lote.
- dedupe_key evita crear el mismo registro con un JSON nuevo.
- Si el mismo import_id se procesa otra vez, muestra “ya importado” y no dupliques.
- Guarda resultado, errores, timestamp y referencias de registros tocados.
- “Deshacer lote” restaura las versiones anteriores o archiva únicamente los registros creados por ese lote.
- No reviertas cambios posteriores del usuario sin advertencia; detecta updated_at y pide confirmación.

### 7.8 Plantilla general que DALI debe permitir copiar

Incluye una plantilla equivalente en “Copiar instrucciones para ChatGPT”:

> Convierte mi dictado en operaciones para mi CRM personal DALI. Devuelve exclusivamente un JSON válido con format dali.crm.import y schema_version 2.0; no añadas Markdown ni explicaciones. Usa la zona America/Mexico_City. Clasifica cada dato únicamente en los módulos permitidos. No inventes fechas, horas, cantidades, personas, recurrencias ni montos. Si falta algo importante, usa null y needs_confirmation = true. Usa import_id UUID, operation_id único y dedupe_key estable. Los gastos llevan amount positivo y type expense. Conserva mi texto original cuando sea una bitácora. Separa las tareas de una sola vez de las diarias, semanales, mensuales o anuales. Este es mi dictado: [PEGAR DICTADO].

La aplicación debe mostrar además una tabla breve de ejemplos de lenguaje natural y resultado esperado, dejando claro que:

- “todos los días a las 2:30” es daily con time_local 14:30;
- “el día 15 de cada mes” es monthly con day_of_month 15;
- “mañana” necesita convertirse a una fecha absoluta utilizando la zona declarada;
- “luego”, “algún día” o “cuando pueda” no tienen fecha y requieren confirmación;
- “me gasté 500 en gasolina” es expense, amount 500, category Gasolina;
- si no se entiende si algo es objetivo o recordatorio, no se guarda hasta que el usuario lo confirme.

---

## 8. Inicio — saludo, reloj y centro de mando

Mantén el diseño limpio actual y mejora la parte superior:

- Reloj en tiempo real de Ciudad Guzmán usando **America/Mexico_City**, no la zona horaria del dispositivo a ciegas.
- Hora con minutos y, opcionalmente, segundos discretos.
- Fecha completa en español.
- Actualización sin recargar la página.
- Saludo:
  - 05:00–11:59: “Buenos días, jefe.”
  - 12:00–18:59: “Buenas tardes, jefe.”
  - 19:00–04:59: “Buenas noches, jefe.”
- Si el usuario cambia su nombre preferido, permite “Buenos días, Dali” como opción configurable.

Debajo, muestra una frase breve de una lista local curada. Debe permanecer estable durante el día o la sesión; no cambiar en cada render. Evita frases humillantes, culpabilizadoras o de productividad tóxica.

Actualiza los widgets configurables para incluir:

- panorama financiero;
- objetivos de hoy;
- próximo pendiente;
- último entrenamiento importado;
- alertas de Granja;
- próximo lanzamiento de ALVENTO;
- contenido próximo;
- lectura actual;
- progreso de aprendizaje;
- recordatorio del Vision Board.

No muestres tarjetas vacías sin contexto. Cada módulo debe tener un estado vacío útil y una acción real.

---

## 9. Finanzas — conservar y corregir

Conserva movimientos, ingresos, gastos, periodos, pagos pendientes, préstamos, abonos, categorías, filtros, tarjeta bancaria y actividad reciente.

### 9.1 Tarjeta bancaria rectangular en móvil

La tarjeta actual se ve casi cuadrada en teléfono. Corrígela de manera explícita:

- Relación visual de tarjeta bancaria: **aspect-ratio: 1.586 / 1**.
- width: 100%.
- max-width coherente, aproximadamente 520 px.
- min-height: 0; no mantengas el min-height fijo que fuerza un cuadrado.
- En el grid móvil, la tarjeta ocupa todas las columnas: grid-column: 1 / -1.
- El chip, NFC, saldo y nombre deben escalar con clamp sin salirse.
- Mantén el diseño azul premium que ya gusta al usuario.
- Verifica 360, 390, 430, 768 y 1440 px.

No reemplaces la tarjeta por una simple estadística. Debe seguir pareciendo una tarjeta real, sin copiar marcas bancarias.

### 9.2 Un solo libro mayor

Granja y ALVENTO no deben mantener finanzas duplicadas. Amplía cada transacción con:

- business_unit: personal, soma, granja o alvento.
- related_entity_type.
- related_entity_id.
- category.
- tags.
- origin/import metadata.

Las secciones Granja y ALVENTO muestran vistas filtradas del libro mayor central. Crear un gasto desde Granja crea exactamente una transacción central vinculada. Repetir la acción o importar el mismo lote no duplica el movimiento.

---

## 10. Gimnasio — analítica importada desde Symmetry

### 10.1 Cambio de propósito

DALI ya no será la aplicación donde se crean rutinas o se ejecuta el entrenamiento. Symmetry seguirá siendo la herramienta para entrenar. DALI será el historial y centro de análisis.

Retira del flujo principal:

- creación de rutinas Upper, Pierna, Pecho/Espalda y Brazo;
- botón Entrenar;
- sesión activa;
- temporizador de descanso;
- edición de series durante el entrenamiento;
- sugerencias de próxima rutina.

No borres esos datos de usuarios existentes. Archiva routines y transforma sessions terminadas cuando sea posible. Actualiza Inicio, quick actions, búsqueda y perfil para que no apunten a funciones eliminadas.

El CTA principal del módulo será **“Importar entrenamiento JSON”** y llevará a Subir con el tipo gimnasio seleccionado.

### 10.2 Vistas

Incluye:

1. **Resumen**
   - última sesión;
   - sesiones en 7, 28 y 90 días;
   - tiempo total;
   - volumen reportado;
   - series;
   - frecuencia semanal;
   - músculos más y menos trabajados;
   - tendencia frente al periodo anterior.
2. **Historial**
   - lista por fecha;
   - filtros por tipo de sesión, ejercicio y rango;
   - ficha completa con ejercicios y series.
3. **Mapa corporal**
   - conserva y mejora el desglose frontal y posterior actual;
   - músculos seleccionables;
   - pecho, espalda, hombros, cuello, bíceps, tríceps, antebrazos, abdomen/core, glúteos, cuádriceps, isquiotibiales y pantorrillas;
   - intensidad basada en series importadas del periodo seleccionado;
   - lista equivalente para accesibilidad y pantallas pequeñas;
   - nunca lo presentes como diagnóstico ni como “recuperación” si solo mide registros.
4. **Rangos**
   - rangos importados por ejercicio;
   - rango por músculo, grupo y global solo cuando venga en el JSON;
   - historial de cambios cuando exista.
5. **Progreso corporal**
   - conserva peso y métricas corporales;
   - fotos privadas opcionales mediante media_id;
   - gráficas por periodo.

### 10.3 Rangos reales de Symmetry

La guía oficial de Symmetry describe estos nueve rangos:

1. Hierro
2. Bronce
3. Plata
4. Oro
5. Rubí
6. Esmeralda
7. Diamante
8. Campeón
9. Simétrico

De Hierro a Campeón existen divisiones I, II y III. Simétrico no tiene divisiones.

La misma guía explica cuatro alcances: ejercicio, músculo, grupo muscular y global; el rango global se desbloquea en Symmetry cuando hay al menos diez ejercicios con rango.

Fuente oficial para documentación interna:
https://symmetry.club/es/rangos

Regla crítica: Symmetry no publica su fórmula ni los cortes reales. **No intentes clonar su algoritmo, no inventes percentiles y no calcules un “rango Symmetry” a partir del volumen.** DALI solo mostrará un rango Symmetry cuando el usuario lo importe o confirme manualmente. Si falta, muestra “Sin rango importado”.

Puedes conservar una métrica propia de constancia, pero debe llamarse **“Constancia DALI”**, usar su propia escala y nunca confundirse visualmente con el rango de fuerza de Symmetry.

No copies logos, insignias ni assets de Symmetry. Diseña badges originales con el lenguaje visual de DALI y usa los nombres únicamente como datos importados.

### 10.4 Contrato de entrenamiento

Acepta:

~~~json
{
  "format": "dali.gym.session",
  "schema_version": "1.0",
  "import_id": "0e7baa8d-c87b-43d9-b57a-4f6f6aa2c646",
  "created_at": "2026-09-13T18:00:00.000Z",
  "timezone": "America/Mexico_City",
  "source": {
    "kind": "symmetry_screenshots",
    "images_count": 3
  },
  "session": {
    "source_workout_id": null,
    "date": "2026-09-07",
    "started_at": null,
    "title": "UPPER",
    "duration_seconds": 4380,
    "reported_volume_kg": 3753,
    "reported_total_sets": 11,
    "completeness": "partial",
    "muscle_distribution": [
      {"muscle": "chest", "label": "Pecho", "percent": 74},
      {"muscle": "shoulders", "label": "Hombros", "percent": 13},
      {"muscle": "triceps", "label": "Tríceps", "percent": 13}
    ],
    "exercises": [
      {
        "exercise_id": null,
        "name": "Press de banca inclinado",
        "equipment": "dumbbell",
        "primary_muscles": ["chest"],
        "secondary_muscles": ["shoulders", "triceps"],
        "rank": null,
        "sets": [
          {
            "set_number": 1,
            "weight": 18.1,
            "weight_unit": "kg",
            "reps": 10,
            "duration_seconds": null,
            "is_warmup": false,
            "is_failure": null
          }
        ]
      }
    ],
    "imported_ranks": [],
    "notes": "",
    "uncertainties": [
      "La captura no muestra todos los ejercicios ni todas las series."
    ]
  }
}
~~~

Este ejemplo es deliberadamente parcial. No lo uses como semilla de producción.

Validaciones:

- duration_seconds entero no negativo.
- peso finito no negativo.
- reps entero no negativo.
- total de series reportado separado del total calculado.
- reported_volume_kg separado de computed_volume_kg.
- Si ambos volúmenes existen y difieren más de una tolerancia configurable, muestra advertencia; no reemplaces el reportado.
- Los porcentajes musculares pueden tener tolerancia de redondeo; si no suman cerca de 100, advierte.
- No adivines si Symmetry cuenta una o dos mancuernas. Conserva el valor reportado y permite una nota.
- completeness: partial o complete.
- uncertainties siempre visibles en la vista previa.

Formato de rango importado:

~~~json
{
  "scope": "exercise",
  "target_key": "press-banca-inclinado-mancuerna",
  "target_label": "Press de banca inclinado",
  "tier": "Oro",
  "division": "II",
  "percentile": null,
  "source": "symmetry_screenshot",
  "observed_at": "2026-09-07"
}
~~~

Para tier = Simétrico, division debe ser null. No aceptes tiers fuera del catálogo salvo que schema_version posterior lo permita.

### 10.5 Plantilla que DALI debe permitir copiar para ChatGPT

Incluye en la ayuda del importador una instrucción equivalente a:

> Analiza todas las capturas de mi entrenamiento de Symmetry como un solo conjunto. Extrae únicamente lo visible: fecha, nombre de sesión, duración, volumen, series, distribución muscular, ejercicios, series, peso, unidad, repeticiones y rangos. No inventes datos cortados. Usa null para lo desconocido, completeness = partial si falta alguna parte y enumera uncertainties. Devuelve exclusivamente un JSON válido con format dali.gym.session y schema_version 1.0.

---

## 11. Granja — gestión porcina hoy, multiespecie después

### 11.1 Principio de diseño

Añade una sección llamada **Granja**. Debe heredar el sistema visual de DALI, no verse como otra aplicación pegada.

El ZIP GranjaControl es la referencia funcional. Porta sus mejores ideas:

- tarjetas por arete;
- estados Vacía, Gestación y Lactancia;
- progreso de gestación y lactancia;
- semental;
- notas;
- búsqueda y filtros;
- acciones Montar, Parir, Destetar y Vender;
- camadas;
- pendientes;
- salud;
- finanzas filtradas;
- alertas por fechas.

No portes React, Vite, hooks ni el cliente tal cual. Reimplementa en Vanilla y usa el store/motor de dominio de DALI.

Aunque hoy se administran cerdos, el modelo debe aceptar futuras especies sin rediseñar todo. Usa species = pig ahora; no muestres vacas, aves u otros animales como si ya existieran.

### 11.2 Contexto personal configurable

Usa estos datos como configuración inicial editable o contexto del negocio, nunca como registros individuales inventados:

- Rancho familiar.
- Aproximadamente 18 puercas.
- Objetivo: identificar las mejores 8 reproductoras.
- Meta de referencia: al menos 10 lechones por camada.
- Canelo es el semental activo para nuevas montas.
- Güero u otros sementales pueden conservarse únicamente como historial si aparecen en datos importados.
- Gasto de alimento de referencia: entre $5,344 y $5,500 MXN por quincena para 18 puercas.
- Precio de referencia por lechón: $1,200 MXN.
- Precio de referencia por kilo: $39–$40 MXN.
- Compra estimada de puerca: $3,500–$4,000 MXN.
- Costo de referencia monta a destete: aproximadamente $4,200 MXN más $500 de insumos.
- Ingreso de referencia de una camada de 10 lechones: $12,000 MXN.

Todos estos valores deben vivir en Farm Settings con effective_date y poder editarse. No los uses para afirmar rentabilidad real si faltan transacciones, camadas o costos registrados.

### 11.3 Modelo animal

Cada animal debe soportar:

- id UUID.
- species.
- role: sow, boar, piglet u otro futuro.
- ear_tag único por propietario y especie.
- name opcional.
- sex.
- birth_date.
- acquisition_date y acquisition_cost.
- status: active, sold, deceased, transferred, archived.
- reproductive_state: empty, gestation, lactation o not_applicable.
- current_state_since.
- sire_id y dam_id opcionales.
- photo_media_id.
- notes.
- source.

No uses hard delete como acción normal. Vender, fallecimiento, traslado y baja son eventos/estados con fecha, motivo y confirmación. El historial nunca debe desaparecer.

### 11.4 Eventos y ciclo reproductivo

Registra eventos append-only:

- heat_observed;
- mating;
- pregnancy_check;
- farrowing;
- weaning;
- health;
- medication;
- sale;
- death;
- transfer;
- note;
- state_correction.

La ficha actual se deriva del último evento válido, pero debe existir una corrección auditada para errores.

Configuración inicial sugerida a partir de GranjaControl:

- gestación esperada: 114 días;
- ciclo de celo para revisión: 21 días;
- lactancia/destete objetivo: 35 días;
- hitos de camada usados por la aplicación de referencia: hierro día 3, vitaminas día 15, castración día 20 y destete día 35.

Estos son recordatorios operativos configurables, no diagnósticos ni prescripciones. No recomiendes medicamentos, dosis o procedimientos médicos. Muestra “Confirma el protocolo con el veterinario responsable” y permite cambiar/desactivar cada hito.

Flujos:

- Montar: exige puerca activa, fecha y semental activo.
- Parir: exige o advierte sobre gestación; registra nacidos totales, nacidos vivos, muertos al nacer y notas; crea camada; cambia a lactancia.
- Destetar: registra fecha, destetados, bajas y destino; cambia a vacía.
- Remonta: registra un nuevo evento, no sobrescribe la monta anterior.
- Vender: registra evento, estado y opción de crear ingreso vinculado.

### 11.5 Pantallas

1. **Resumen**
   - activas, vacías, gestación, lactancia;
   - partos próximos;
   - tareas vencidas;
   - salud pendiente;
   - costo e ingreso del periodo;
   - selector de periodo.
2. **Animales**
   - búsqueda por arete/nombre;
   - filtros;
   - tarjetas compactas en móvil y tabla/tarjetas en escritorio;
   - progreso y alertas.
3. **Camadas**
   - madre, padre, fechas, nacidos, vivos, destetados, bajas, ingreso y costo vinculados.
4. **Calendario y pendientes**
   - próximos partos, destetes, revisiones y salud;
   - vista lista accesible además del calendario.
5. **Salud**
   - síntomas observados, profesional, tratamiento indicado, medicina, fecha, siguiente revisión/dosis y notas;
   - no ofrecer diagnóstico automático.
6. **Rentabilidad**
   - vista filtrada de Finanzas;
   - desempeño por puerca y camada;
   - supuestos visibles.
7. **Configuración**
   - protocolos, metas, precios de referencia y sementales activos.

### 11.6 Métricas correctas

Calcula solo con datos suficientes:

- promedio de nacidos vivos por camada;
- promedio de destetados por camada;
- mortalidad pre-destete = máximo de 0, nacidos vivos menos destetados, dividido entre nacidos vivos;
- días no productivos;
- intervalo entre partos;
- camadas por puerca;
- costo por camada;
- ingreso por camada;
- margen estimado;
- ranking de reproductoras.

Para seleccionar las “mejores 8”, muestra:

- muestra de camadas;
- promedio de nacidos vivos;
- promedio destetado;
- mortalidad;
- regularidad;
- costo/margen si existe;
- insignia “Datos insuficientes” cuando corresponda.

No clasifiques una puerca con una sola observación como mejor o peor sin advertir la muestra. La meta de 10 lechones es editable.

### 11.7 Integraciones internas

- Un pendiente de Granja aparece en Inicio y notificaciones.
- Una venta o gasto crea una transacción central con business_unit = granja.
- Un animal o camada puede enlazar transacciones sin duplicarlas.
- El importador universal acepta animales, eventos, camadas, salud y configuración.

---

## 12. Aprendizaje — rutas completas mediante JSON

Conserva la experiencia actual de “Ventas para SOMA”, sus siete niveles, progreso ponderado, sesiones de estudio, evidencias y proyecto final.

Dentro de cada habilidad, cerca de “Editar habilidad”, añade un botón principal secundario:

**Subir ruta JSON**

Debe abrir Subir con la habilidad actual preseleccionada.

### 12.1 Flujo

1. El usuario crea una habilidad, por ejemplo Psicología.
2. Pide a ChatGPT una ruta.
3. ChatGPT investiga y devuelve dali.learning.route.
4. DALI valida la ruta.
5. Muestra el diff.
6. El usuario elige:
   - fusionar actividades nuevas;
   - reemplazar la ruta conservando sesiones y evidencias;
   - cancelar.
7. Confirma y guarda atómicamente.

No borres progreso previo durante una fusión. Para reemplazar, conserva una versión recuperable.

### 12.2 Siete niveles

0. Fundamentos.
1. Nivel básico.
2. Aplicación práctica.
3. Nivel intermedio.
4. Nivel avanzado.
5. Dominio autónomo.
6. Proyecto final.

No limites cada nivel a dos elementos. Usa los necesarios para cubrir la habilidad sin relleno. Cada actividad debe tener resultado verificable.

### 12.3 Contrato de ruta

~~~json
{
  "format": "dali.learning.route",
  "schema_version": "1.0",
  "import_id": "0f53ad26-4a3f-4df1-8c32-bfcda01c8d89",
  "created_at": "2026-09-13T18:00:00.000Z",
  "timezone": "America/Mexico_City",
  "target": {
    "skill_id": null,
    "skill_title": "Psicología",
    "merge_strategy": "preview"
  },
  "route": {
    "category": "Ciencias sociales",
    "reason": "Comprender fundamentos y aplicar pensamiento crítico.",
    "weekly_minutes": 180,
    "disclaimer": "Esta ruta no otorga licencia ni habilita práctica clínica.",
    "levels": [
      {
        "level": 0,
        "title": "Fundamentos",
        "activities": [
          {
            "activity_key": "psi-0-historia-metodos",
            "title": "Historia, escuelas y método científico",
            "objective": "Distinguir las principales corrientes y evaluar afirmaciones psicológicas.",
            "type": "study_and_practice",
            "duration_minutes": 180,
            "points": 3,
            "prerequisites": [],
            "deliverable": "Mapa comparativo y análisis de una afirmación.",
            "success_criteria": [
              "Diferencia correlación y causalidad.",
              "Identifica al menos cuatro corrientes y sus límites."
            ],
            "evidence_required": true,
            "resources": []
          }
        ]
      }
    ],
    "final_project": {
      "activity_key": "psi-6-proyecto-final",
      "title": "Proyecto integrador",
      "deliverable": "Trabajo aplicado con fuentes, método, límites y reflexión ética.",
      "success_criteria": [
        "Integra los fundamentos de la ruta.",
        "Incluye evidencia verificable.",
        "Explica límites y consideraciones éticas."
      ],
      "points": 10,
      "evidence_required": true
    }
  }
}
~~~

El ejemplo muestra la forma, no una ruta completa.

### 12.4 Reglas de calidad

- activity_key estable y único.
- points enteros positivos.
- prerequisite keys existentes.
- enlaces reales si se incluyen recursos.
- no inventar libros, cursos, autores ni certificaciones.
- distinguir conocimiento, práctica y evaluación.
- incluir ética, límites y fuentes cuando la habilidad lo requiera.
- una ruta de psicología no debe presentarse como licencia profesional ni capacitación clínica.

Progreso:

- porcentaje = puntos completados / puntos totales;
- las actividades con evidencia requerida no cuentan como completas sin evidencia;
- sin proyecto final aprobado, el progreso visible se limita a 95%;
- añadir actividades puede reducir el porcentaje y debe explicarse;
- 100% exige proyecto final con evidencia.

### 12.5 Plantilla para ChatGPT

> Actúa como diseñador curricular y profesor. Crea una ruta progresiva y práctica para aprender [HABILIDAD] desde mi nivel [NIVEL] hasta dominio autónomo. Investiga fuentes fiables cuando haga falta. Divide en siete niveles: fundamentos, básico, práctica, intermedio, avanzado, dominio y proyecto final. Incluye actividades necesarias, prerequisitos, duración, puntos, entregable, criterios de éxito, evidencia y recursos reales. No prometas títulos ni licencias profesionales. Devuelve exclusivamente JSON válido con format dali.learning.route y schema_version 1.0.

---

## 13. Libros

Añade una sección **Libros** con dos objetivos: biblioteca personal y lista de futuras compras.

### 13.1 Estados

- wishlist;
- owned;
- reading;
- paused;
- finished;
- abandoned.

### 13.2 Campos

- title.
- author.
- cover_media_id.
- isbn opcional.
- status.
- format: físico, ebook o audiolibro.
- total_pages.
- current_page.
- progress_percent derivado.
- started_at.
- finished_at.
- rating de 1 a 5.
- short_review.
- lessons.
- brief_quotes con límites razonables.
- tags.
- purchase_priority.
- estimated_price.
- store_or_link.
- gifted_by opcional.

Flujo “Agregar libro”:

- subir/tomar foto de portada;
- recortar o generar thumbnail;
- escribir opinión breve;
- definir estado;
- guardar.

Vistas:

- resumen con terminados, leyendo, páginas del mes y wishlist;
- estantería visual;
- lista compacta;
- detalle;
- wishlist con prioridad y costo estimado;
- búsqueda y filtros;
- objetivo editable de lectura.

Contexto inicial:

- preferencia de 30–40 páginas al día;
- objetivo aproximado de un libro al mes;
- posibles títulos: Si lo crees, lo creas; Secretos de la mente millonaria; Vende como loco; Las 48 leyes del poder; No me puedes lastimar; La psicología del dinero; El arte de la guerra; El hombre en busca de sentido; De animales a dioses.

No marques ninguno como leído, comprado o deseado sin confirmación. Puedes ofrecerlos como sugerencias de onboarding descartables.

Respeta copyright: no almacenes ni generes capítulos completos; las citas deben ser breves y añadidas por el usuario.

---

## 14. ALVENTO — marca de ropa por drops

Añade una sección **ALVENTO** para planear, lanzar y medir cada drop.

El diseño debe respetar la estética general de DALI y transmitir una identidad premium, minimalista, streetwear, predominantemente negra y gris. No conviertas todo el CRM a esa estética; encapsúlala dentro del módulo.

### 14.1 Entidades

**Drop**

- name y sequence.
- status: idea, planning, production, content, scheduled, live, closed, archived.
- launch_at.
- countdown derivado.
- goal_units.
- goal_revenue.
- budget.
- notes.
- cover_media_id.

**Producto/SKU**

- drop_id.
- name.
- sku.
- category.
- color.
- size.
- unit_price.
- unit_cost.
- initial_stock.
- current_stock derivado.
- units_sold.
- photo_media_ids.
- status.

**Hito**

- title.
- due_at.
- owner.
- status.
- dependencies.
- notes.

### 14.2 Panel de drop

Muestra:

- contador hasta el lanzamiento;
- porcentaje de preparación;
- ventas totales;
- unidades vendidas;
- ingresos;
- costos;
- utilidad bruta;
- margen;
- stock;
- sell-through = unidades vendidas / stock disponible inicial;
- ticket promedio si hay pedidos;
- hitos atrasados y próximos;
- productos por talla/color;
- timeline de idea a cierre;
- fotos y assets.

Los valores se derivan de datos reales. Si no hay ventas, muestra cero o “Sin registros”; no inventes crecimiento.

### 14.3 Contexto ALVENTO

Puedes crear una plantilla de borrador editable para DROP 001 con:

- Hoodie Estructura 01 — referencia $1,290 MXN.
- Hoodie Doble Vía — referencia $1,490 MXN.
- Playera Corriente — referencia $590 MXN.
- prueba inicial de inventario: 2 + 2 hoodies y 3 playeras en tallas M/L.

Solo conviértelo en inventario activo si el usuario lo confirma. Identifica precios e inventario como “borrador” o “referencia”, no como venta real.

### 14.4 Integración financiera

- Una venta o costo puede generar un movimiento central con business_unit = alvento.
- Usa origin y dedupe_key para evitar duplicados.
- No descuentes stock dos veces al editar una venta.
- Una reversión restaura stock y movimiento vinculados de manera atómica.

No inventes integración con Shopify, Instagram, Mercado Pago u otra plataforma. Deja adaptadores visibles únicamente cuando existan credenciales y una prueba real.

---

## 15. Contenido — ideas y producción de videos

Añade una sección **Contenido** pensada para YouTube, YouTube Shorts, Instagram/Reels y TikTok.

### 15.1 Bandeja de ideas

Cada idea debe incluir:

- title.
- platform: youtube, youtube_shorts, instagram_reels, tiktok o multiple.
- format: long, short.
- series.
- episode_number.
- objective.
- audience.
- hook.
- premise.
- status.
- priority.
- target_publish_at.
- cadence_id opcional.
- notes.
- tags.

### 15.2 Ficha de producción

Incluye:

- idea central;
- hook de los primeros segundos;
- estructura narrativa;
- escenas/shot list ordenable de inicio a fin;
- guion;
- B-roll;
- ubicación;
- personas;
- props;
- CTA;
- referencias y links;
- archivos mediante media_id;
- checklist de grabación;
- checklist de edición;
- miniatura/título para YouTube;
- caption para contenido corto;
- fecha de grabación;
- fecha de publicación.

Pipeline:

1. Idea.
2. Investigación.
3. Guion.
4. Listo para grabar.
5. Grabando.
6. Edición.
7. Programado.
8. Publicado.
9. Analizado.

Permite Kanban en escritorio y lista accesible en móvil.

### 15.3 Series y cadencia

Incluye como serie inicial editable:

- **De cero hasta viajar por el mundo**.
- Contenido largo solamente para YouTube.
- Shorts/Reels/TikTok para crecimiento y distribución.

Debe ser posible abrir “Video 13”, ver todas sus ideas y recorrer escenas en orden mientras se graba.

Añade cadencia configurable por plataforma:

- frecuencia deseada;
- próximo vencimiento;
- contador;
- calendario;
- cumplimiento histórico.

No conviertas el contador en una presión visual agresiva.

### 15.4 Métricas tras publicar

- url publicada.
- published_at.
- views.
- average_watch_time.
- retention_percent.
- likes.
- comments.
- shares.
- saves.
- followers_gained.
- metric_observed_at.
- lesson.

Guarda snapshots para ver evolución; no sobrescribas el histórico. Si no existen APIs conectadas, el registro es manual o por JSON y debe decirlo claramente.

---

## 16. Vision Board — metas visuales

Añade una sección **Vision Board**, distinta de Objetivos.

Objetivos contiene acciones medibles y recurrentes. Vision Board contiene aspiraciones visuales y el motivo detrás de ellas.

Cada tarjeta debe tener:

- title.
- category: patrimonio, viaje, estilo de vida, negocio, experiencia, aprendizaje u otra.
- image_media_id.
- why.
- target_date opcional.
- target_cost opcional.
- related_goal_id opcional.
- saved_amount o progress opcional.
- status: someday, active, achieved, archived.
- position para ordenar.
- created_at.

Funciones:

- subir o tomar foto;
- recortar portada;
- reordenar con teclado y drag-and-drop progresivo;
- collage responsive;
- vista fullscreen;
- filtros;
- enlazar con objetivo o meta financiera;
- marcar como logrado sin borrarlo;
- frase motivadora estable;
- modo enfoque con una sola meta.

Ejemplos de onboarding, sin presentarlos como propiedad real:

- BMW M3 Competition.
- Departamento en Las Peñas.
- Equipo o gráfica deseada.

El tono debe inspirar sin avergonzar, manipular o comparar con otras personas.

---

## 17. Mi perfil

Conserva y mejora la sección actual.

Diseño:

- foto de perfil grande y centrada;
- nombre completo;
- nombre preferido;
- username opcional;
- descripción;
- ubicación;
- cumpleaños;
- edad calculada automáticamente, nunca guardada como valor fijo;
- próximo cumpleaños y días restantes;
- institución;
- idiomas;
- intereses;
- proyectos;
- metas personales editables;
- estadísticas derivadas reales.

La foto debe almacenarse mediante media_id. Añade cargar, cambiar y eliminar con confirmación.

No muestres información falsa. Los datos actuales deben migrarse y seguir siendo editables. No expongas datos sensibles en URLs, consola o mensajes de error.

En preferencias:

- tema;
- widgets de Inicio;
- formato horario;
- saludo;
- timezone;
- moneda;
- categorías;
- protocolos de Granja;
- exportación;
- modo de persistencia;
- papelera.

---

## 18. Objetivos, SOMA y Bitácora — conservar y conectar

### 18.1 Objetivos

Conserva diarios, semanales, mensuales y anuales.

- Reinicios derivados de period keys; no borres el historial al reiniciar.
- Recurrencias con timezone.
- Rachas y porcentaje sin culpabilización.
- Fecha, hora, prioridad, notas y origen.
- Importación JSON con vista previa.
- “Ir por mi hermana diariamente a las 14:30” y “corte de pelo mensual” deben poder modelarse sin convertir ambos en la misma recurrencia.

### 18.2 SOMA

Conserva pipeline, clientes, pagos, entregables, notas, contacto y WhatsApp.

- El botón Contactar abre un enlace wa.me correctamente normalizado.
- No afirmes que existe WhatsApp Business API si solo es deep link.
- Pagos y abonos siguen vinculados a Finanzas de manera idempotente.
- Universal Upload puede crear clientes, entregables, notas y pagos.
- No precargues deudas reales para Intensity o Alejandro sin confirmación.

### 18.3 Bitácora personal

Conserva captura por texto y voz cuando el navegador la soporte.

- El dictado se procesa fuera de DALI por ChatGPT si se desea.
- El importador puede recibir fecha, narrativa, personas, lugares, logros, dificultades, emociones, energía, productividad, aprendizajes, mejoras y etiquetas.
- No diagnostiques salud mental.
- Permite navegar por día, semana, mes y búsqueda.
- Distingue texto original de resumen estructurado.
- Nunca descartes el dictado original al guardar el resumen.

---

## 19. Diseño visual y responsive

La referencia principal es el DALI actual:

- blanco, azul eléctrico, azul marino y grises fríos;
- tipografía limpia;
- bordes suaves;
- tarjetas sobrias;
- buen uso de espacio;
- modo oscuro de alto contraste;
- microinteracciones discretas.

Granja puede usar verde como acento contextual; ALVENTO puede usar negro/grafito; alertas conservan rojo/ámbar. No conviertas cada módulo en una aplicación visualmente distinta.

Reglas:

- una familia de iconos;
- tokens CSS compartidos;
- WCAG AA;
- foco visible;
- navegación completa con teclado;
- targets táctiles mínimos de 48 × 48 px;
- prefers-reduced-motion;
- no depender solo del color;
- skeleton solo cuando hay carga real;
- estados vacío, cargando, error, offline, éxito y sin permisos.

### Escritorio

- desde 1024 px;
- sidebar fija/plegable;
- contenido con ancho máximo legible;
- grids de dos o tres columnas cuando aporten;
- tablas solo donde sean mejores que tarjetas.

### Tablet

- 768–1023 px;
- drawer o sidebar compacta;
- dos columnas cuando quepan;
- formularios táctiles.

### Móvil

- mínimo soportado 360 px;
- sin overflow horizontal;
- una columna;
- drawer;
- navegación inferior;
- diálogos como bottom sheets cuando convenga;
- botones pegajosos sin tapar contenido;
- safe-area;
- teclado numérico mediante inputmode para dinero, pesos, repeticiones y conteos;
- tablas transformadas en tarjetas o scroll interno deliberado, nunca página desbordada.

Prueba tema claro y oscuro en todos los anchos.

---

## 20. Rendimiento, privacidad y robustez

- No cargues todas las imágenes a resolución completa en listas.
- Usa thumbnails, lazy loading y object URLs revocados.
- Evita renderizar cientos de nodos innecesarios; pagina o virtualiza listas grandes.
- Debounce en búsqueda.
- No registres datos personales en console.log.
- Maneja cuota, JSON inválido, IndexedDB no disponible, navegación offline y CDN fallida.
- El modo local debe ser utilizable sin conexión después de cargar los assets necesarios, si decides añadir service worker.
- Si añades service worker, versiona caché y evita dejar una versión antigua atrapada.
- No uses localStorage para secretos.
- No uses innerHTML con contenido de usuario sin el helper de escape existente.
- Conserva control de revisión entre pestañas.
- Toda acción destructiva requiere confirmación y, cuando sea razonable, deshacer.

---

## 21. Contratos y archivos de esquema

Entrega JSON Schema válidos para:

- dali.crm.import 2.0.
- dali.gym.session 1.0.
- dali.learning.route 1.0.

Incluye ejemplos válidos e inválidos y pruebas del validador.

Si usas una biblioteca de validación como Ajv, cárgala por CDN con versión fijada y ofrece un validador mínimo local si el CDN no está disponible. No interpretes un schema como código.

El usuario debe poder descargar cada esquema desde la sección Subir.

Documenta una tabla de compatibilidad de schema_version. Una versión desconocida se rechaza de forma amable; nunca se intenta “adivinar”.

---

## 22. Implementación por fases sin abandonar trabajo

Trabaja en este orden:

### Fase 0 — seguridad

- respaldo;
- pruebas del estado actual;
- inventario;
- migración v1 → v2;
- adaptador de medios.

### Fase 1 — infraestructura transversal

- navegación por grupos;
- rutas;
- búsqueda;
- Subir;
- schemas;
- import batches;
- preview/diff/undo;
- manejo de imágenes.

### Fase 2 — correcciones y gimnasio

- tarjeta financiera rectangular;
- reloj/saludo;
- retirar ejecución de rutinas;
- sesión Symmetry JSON;
- historial;
- mapa muscular;
- rangos importados.

### Fase 3 — Granja

- modelo;
- ciclo;
- alertas;
- camadas;
- salud;
- rentabilidad vinculada.

### Fase 4 — crecimiento personal

- aprendizaje JSON;
- Libros;
- Vision Board;
- Perfil.

### Fase 5 — negocios y creación

- ALVENTO;
- Contenido;
- conexiones con Finanzas, Inicio y notificaciones.

### Fase 6 — endurecimiento

- migraciones;
- accesibilidad;
- responsive;
- rendimiento;
- backup completo;
- QA;
- documentación.

Si el entorno limita tiempo o tokens, conserva un checklist dentro del proyecto y continúa con P0/P1 antes de pulido P2. No marques una fase como completa si sus botones no funcionan.

---

## 23. Pruebas obligatorias

### 23.1 Migración y datos

- Abrir un estado v1 con movimientos, pagos, clientes, metas, aprendizaje y sesiones.
- Migrar una sola vez.
- Recargar y conservar todo.
- Fallar una migración artificial y verificar que el estado original siga intacto.
- Importar el mismo lote dos veces y obtener cero duplicados.
- Deshacer un lote sin borrar cambios posteriores ajenos.

### 23.2 Importador

- JSON general válido.
- Entrenamiento completo.
- Entrenamiento parcial.
- Ruta de aprendizaje válida.
- schema_version desconocida.
- JSON mal formado.
- monto inválido.
- referencia inexistente.
- operación duplicada.
- claves de prototype pollution.
- más de 500 operaciones.
- atomic true con una operación fallida.
- cancelar desde la vista previa y verificar cero cambios.

### 23.3 Gimnasio

- Importar la sesión visible de referencia del 7 de septiembre de 2026 como prueba aislada: UPPER, 1 h 13 min, 3,753 kg reportados y 11 series.
- No convertir ese caso de QA en datos del usuario.
- Comparar total reportado y calculado.
- Mostrar ejercicio con múltiples series.
- Mostrar captura parcial sin inventar las series ocultas.
- Filtrar 7, 28 y 90 días.
- Mostrar mapa frontal/posterior.
- Aceptar los nueve tiers y rechazar uno inventado.
- division null para Simétrico.

### 23.4 Granja

- Montar una puerca con Canelo.
- Calcular fecha esperada sin alterar el día por UTC.
- Registrar parto y crear una sola camada.
- Registrar destete.
- Crear alertas configurables.
- Remontar sin borrar el evento anterior.
- Vender y crear un solo ingreso.
- Revertir sin duplicar stock/finanzas.
- Archivar en vez de hard delete.
- Calcular métricas solo con muestras válidas.

### 23.5 Otros módulos

- Crear libro con portada y comprobar persistencia de IndexedDB.
- Cambiar página actual y derivar porcentaje.
- Crear drop, SKUs, stock y contador.
- Registrar venta y reversión.
- Crear Video 13 con shot list reordenable.
- Guardar snapshots de métricas.
- Crear item de Vision Board con foto.
- Cambiar foto de perfil.
- Importar una ruta y fusionarla conservando progreso.
- 100% de aprendizaje solo con proyecto final y evidencia.

### 23.6 Visual y accesibilidad

Revisa al menos:

- 360 × 800.
- 390 × 844.
- 430 × 932.
- 768 × 1024.
- 1024 × 768.
- 1440 × 900.

En claro y oscuro:

- cero overflow horizontal;
- tarjeta bancaria rectangular;
- drawer y bottom nav sin solaparse;
- sidebar usable con muchas secciones;
- modales visibles con teclado móvil;
- foco correcto;
- Escape cierra;
- labels accesibles;
- contraste AA;
- reduced motion;
- zoom al 200%;
- cero errores no controlados en consola.

Usa almacenamiento QA aislado, por ejemplo un query param, y no contamines los datos de producción durante pruebas.

---

## 24. Criterios de aceptación por módulo

Una sección solo se considera lista cuando:

- aparece en navegación, búsqueda y breadcrumbs;
- su ruta directa funciona al recargar;
- tiene CRUD o acciones completas;
- valida campos;
- persiste tras recargar;
- tiene estados vacío/error/éxito;
- funciona en 360 px y escritorio;
- funciona con teclado;
- respeta tema claro/oscuro;
- aparece en respaldo;
- acepta importación cuando corresponda;
- no duplica datos vinculados;
- tiene pruebas documentadas.

No uses números de ejemplo como si fueran métricas reales. Los datos demo viven únicamente en modo QA o se muestran como plantillas claramente marcadas.

---

## 25. Entrega final esperada

Al terminar:

1. Entrega todos los archivos modificados, no fragmentos.
2. Entrega un ZIP descargable del proyecto estático.
3. Incluye README con:
   - cómo abrirlo localmente;
   - cómo usar un servidor estático;
   - estructura de archivos;
   - almacenamiento local;
   - importación JSON;
   - respaldo y restauración;
   - medios;
   - configuración opcional de Supabase;
   - limitaciones reales.
4. Incluye CHANGELOG con migración y módulos añadidos.
5. Incluye schemas y samples.
6. Resume qué conservaste, migraste, añadiste y probaste.
7. Informa resultados concretos de lint o comprobaciones disponibles, pruebas y anchos revisados.
8. Enumera únicamente bloqueos reales que requieran credenciales.

No digas que algo funciona si no lo verificaste.

---

## 26. Lista final de “no hacer”

- No empezar desde cero.
- No sustituir Vanilla por React/Vite.
- No usar NPM.
- No borrar localStorage v1.
- No copiar políticas Supabase con acceso anónimo.
- No duplicar Finanzas dentro de Granja o ALVENTO.
- No mantener el gimnasio como ejecutor de rutinas.
- No calcular falsos rangos Symmetry.
- No inventar datos de capturas cortadas.
- No aplicar JSON sin vista previa.
- No usar eval.
- No aceptar colecciones arbitrarias.
- No guardar imágenes grandes en localStorage.
- No hard-delete de animales, camadas, pagos o historial.
- No usar la hora del dispositivo sin convertir a America/Mexico_City.
- No meter todas las secciones en la barra inferior móvil.
- No crear botones sin acción.
- No dejar lorem ipsum, números ficticios ni deuda ficticia.
- No afirmar que WhatsApp API, redes sociales, IA, Supabase o hosting están conectados sin una prueba real.
- No detenerte por un problema de despliegue.
- No entregar otra beta.

---

## 27. Decisión de producto que debe guiar todo

DALI debe reducir captura manual sin perder control.

El usuario puede dictar su realidad a ChatGPT, convertirla en JSON y llevarla al CRM, pero **DALI siempre valida, explica y pide confirmación antes de cambiar datos**. La automatización sirve para ahorrar tiempo; la vista previa y la trazabilidad sirven para evitar errores.

Construye la aplicación alrededor de ese equilibrio.
