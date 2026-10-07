# PROMPT DE IMPLEMENTACIÓN — EVOLUCIÓN DEL MÓDULO GRANJA PORCINA DE DALI

## Instrucción principal

Actúa como un equipo senior compuesto por: arquitecto de software, ingeniero frontend, diseñador de producto, especialista en sistemas local-first, analista de datos agropecuarios y consultor de operaciones porcinas. Trabaja directamente sobre el proyecto actual de **DALI**, mi CRM personal web. Tu misión no es crear otra aplicación ni entregar únicamente un análisis: debes **inspeccionar, implementar, probar y devolver el proyecto actualizado**, con una sección de Granja porcina completamente funcional, integrada al diseño y a la arquitectura existentes.

Esta solicitud es una **actualización incremental** del CRM ya construido. El proyecto actual de DALI es la fuente de verdad. Conserva todos sus módulos, datos, comportamiento, identidad visual, navegación, almacenamiento y compatibilidad. No empieces desde cero, no reemplaces el CRM con una plantilla y no lo conviertas en un “sistema operativo”. Es una página web privada tipo CRM, adaptable a móvil y computadora.

Implementa el alcance completo de este prompt en una sola fase coherente. No te detengas después de hacer un plan, un mockup o una parte superficial. Si encuentras ambigüedades no bloqueantes, toma la decisión más segura y reversible, documéntala y continúa. Pregunta únicamente si falta un dato que haga imposible preservar información real.

---

## 1. Material adjunto y orden de autoridad

Recibirás, como mínimo:

1. El ZIP más reciente del CRM DALI.
2. Un ZIP de una aplicación anterior llamada aproximadamente “GranjaControl”, creada como referencia funcional.
3. Un video vertical que muestra cómo se usan las tarjetas, filtros, modales y botones de la aplicación anterior.
4. Dos fotografías del tablero de precios de alimento MAFORNU.
5. Posiblemente un prompt maestro anterior de evolución de DALI.

Antes de editar código:

1. Descomprime y audita por completo ambos proyectos.
2. Identifica el stack real, el esquema de almacenamiento, migraciones, componentes reutilizables, tokens visuales, navegación y pruebas actuales.
3. Reproduce el video por cuadros suficientes para entender todos los estados y flujos, no solamente la primera pantalla.
4. Lee las fotografías de precios con cuidado y usa únicamente los valores señalados abajo; las fotos son evidencia visual de referencia, no una fuente permanente ni una autorización para inventar precios.
5. Genera una copia de seguridad del estado actual antes de migrar datos.

Orden de autoridad cuando haya conflictos:

1. Datos reales ya guardados por el usuario.
2. Código y diseño del CRM DALI actual.
3. Este prompt.
4. Prompt maestro anterior, si se adjunta.
5. Aplicación GranjaControl, video y capturas como referencia de comportamiento.

La aplicación anterior **no** es la base arquitectónica ni visual. De ella debes rescatar únicamente los flujos útiles: tarjetas por animal, chips de estado, filtros, acciones contextuales, modales/bottom sheets, seguimiento de camadas, tareas, salud y registro rápido. El resultado debe parecer una sección nativa de DALI.

---

## 2. Restricciones técnicas no negociables

Respeta el stack real del ZIP de DALI. Según la versión de referencia, es una aplicación estática y local-first basada en:

- HTML.
- CSS.
- JavaScript Vanilla.
- Tailwind mediante CDN del navegador.
- Lucide mediante CDN.
- Archivos servibles directamente, sin compilación.

Por lo tanto:

- No migres a React, Vue, Svelte, Next.js, Vite, Node, TypeScript ni otro framework.
- No agregues NPM, un bundler, un servidor obligatorio ni pasos de build.
- No copies dependencias ni configuración de Supabase del ZIP antiguo.
- Puedes crear módulos JavaScript Vanilla adicionales —por ejemplo `farm-domain.js`, `farm-feed.js`, `migrations.js` o `farm-tests.js`— si respetan la estructura real del proyecto y simplifican el dominio.
- Mantén la aplicación funcional al servir la carpeta raíz mediante un servidor estático sencillo.
- Conserva los módulos existentes y evita regresiones.
- No despliegues ni publiques la aplicación salvo que se solicite expresamente. Entrega el código y un ZIP final listo para revisar.
- No pongas secretos, tokens ni claves en el cliente.
- Si existe una integración opcional con Supabase, debe permanecer opcional y utilizar autenticación y RLS reales. Nunca uses políticas de CRUD anónimo. La sección Granja debe funcionar localmente sin Supabase.

El CRM utiliza persistencia local con control de versión, validación, respaldo/importación y borrado lógico. Extiende ese sistema: no crees un segundo almacenamiento paralelo improvisado.

---

## 3. Alcance del producto

La interfaz de esta versión estará dedicada **exclusivamente a cerdos**. No muestres selector de especie, categorías vacías para vacas/gallinas ni textos genéricos de “ganado”. Usa “Granja”, “Cerdos”, “Puercas”, “Camadas” y términos porcinos claros.

La estructura de datos puede quedar preparada discretamente para una futura expansión mediante `species: "pig"`, pero no construyas ahora pantallas multiespecie ni condiciones que estorben el uso actual.

Contexto operativo que debe representarse como configuración editable, no como registros ficticios:

- Rancho familiar ubicado en Ciudad Guzmán, Jalisco, México.
- El número de reproductoras cambia con el tiempo; nunca supongas ni siembres un inventario exacto.
- Referencia histórica aproximada: 16–18 cerdas reproductoras y algunos animales de engorda.
- Hay 3 jaulas/espacios de maternidad; la capacidad debe ser configurable.
- Se busca identificar con datos a las 8 reproductoras más productivas, con una meta de referencia de al menos 10 lechones por camada, sin automatizar ventas o descartes.
- “Canelo” es el semental activo conocido, pero solo consérvalo si ya existe en los datos o si el usuario lo importa; no dupliques ni fabriques animales.
- La práctica actual de destete usada como referencia es de 35 días; debe ser configurable y mostrarse como política del rancho, no como regla universal.
- La referencia económica histórica de alimento es aproximadamente $5,344–$5,500 MXN cada 15 días para alrededor de 18 cerdas. Úsala para validar el calculador, no para crear transacciones reales.

---

## 4. Dirección visual y experiencia de uso

Conserva exactamente la personalidad visual de DALI: minimalista, premium, limpia, tranquila y de alta legibilidad; azul profundo, blanco, grises fríos, bordes sutiles, radios coherentes, sombras ligeras, tipografía actual y modo claro/oscuro si ya existe.

Para Granja utiliza el verde solamente como color de acento semántico —salud, acción positiva, alimentación o lactancia— dentro del sistema de tokens de DALI. No conviertas toda la sección en una app verde/neón ni copies el fondo negro de GranjaControl.

Principios de interfaz:

- La sección debe sentirse parte del mismo CRM, no un iframe ni una aplicación pegada.
- Reutiliza encabezados, tarjetas, botones, campos, modales, toasts, tablas, chips, skeletons, estados vacíos y espaciado existentes.
- En escritorio, aprovecha una cuadrícula de resumen y paneles de dos columnas cuando aporte claridad.
- En móvil, usa una sola columna, tarjetas compactas, filtros horizontales desplazables y bottom sheets cómodos.
- Ningún botón puede ser decorativo: cada acción debe abrir un flujo, guardar correctamente, cancelar sin efectos o explicar por qué está deshabilitada.
- Cada acción exitosa debe mostrar confirmación breve; cada error debe explicar cómo corregirlo.
- Los formularios deben conservar valores si aparece un error de validación.
- Evita tablas anchas en móvil. Transfórmalas en tarjetas o listas de definición.
- Usa áreas táctiles de al menos 44 × 44 px y navegación por teclado en escritorio.
- Respeta `prefers-reduced-motion`.
- No debe existir scroll horizontal en 360, 390, 768, 1024 ni 1440 px.

Adapta del video de referencia:

- Resumen superior con conteos por estado.
- Buscador por arete/nombre.
- Chips de filtro.
- Tarjetas individuales con estado, progreso temporal, próxima acción y observaciones.
- Botones contextuales como Registrar celo, Montar/Servir, Revisar, Parir, Destetar, Salud, Nota y Vender.
- Botón claro para agregar un animal.
- Modales o bottom sheets por pasos, especialmente cómodos en móvil.

No copies errores de la referencia: una monta no equivale a gestación confirmada y ninguna fecha futura puede cambiar por sí sola un estado clínico o reproductivo.

---

## 5. Arquitectura de la sección Granja

Dentro de Granja crea navegación interna responsive. En escritorio puede ser una barra de pestañas; en móvil, chips o un selector compacto. No llenes la navegación global inferior con demasiados accesos.

Vistas obligatorias:

1. **Resumen**
2. **Cerdos**
3. **Reproducción**
4. **Camadas**
5. **Alimentación**
6. **Calendario y pendientes**
7. **Salud**
8. **Rendimiento**
9. **Configuración**

### 5.1 Resumen

Debe contestar en segundos: qué tengo, qué requiere atención hoy, cuánto alimento necesito y cómo va el rancho.

Incluye:

- Conteos reales por estado: vacías, en celo, servidas por confirmar, gestación confirmada, preparto y lactancia.
- Total de animales activos y camadas activas.
- Próximos eventos: revisión de retorno a celo, revisión de gestación, parto estimado, destete, tareas de camada, salud y compra de alimento.
- Alertas vencidas y próximas, diferenciadas por color y texto; nunca diagnostiques.
- Tarjeta compacta de alimentación con kg/día, días de cobertura, siguiente compra estimada y costo del periodo seleccionado.
- Ocupación proyectada de las 3 maternidades y advertencia de traslape cuando se supere la capacidad configurada.
- Indicadores de rendimiento con periodo y tamaño de muestra visibles.
- Acciones rápidas reales: Agregar cerdo, Registrar celo, Registrar compra de alimento, Registrar consumo/ajuste y Agregar pendiente.

### 5.2 Cerdos

Incluye lista/tarjetas, búsqueda, filtros y vista de detalle con línea de tiempo. Cada tarjeta debe mostrar solamente datos útiles:

- Arete o identificador grande.
- Nombre, si existe.
- Sexo y función: reproductora, primeriza, semental, lechón, crecimiento, desarrollo o engorda.
- Estado reproductivo cuando aplique.
- Día del ciclo o etapa y progreso temporal estimado.
- Último evento confirmado.
- Próxima ventana/acción.
- Observación breve.
- Acciones permitidas por estado.

Permite alta y edición segura, fotografía opcional, notas, peso opcional, fecha de nacimiento aproximada o exacta, origen, ubicación/corral, estado activo/vendido/fallecido/archivado y vínculos familiares si existen. Nunca exijas campos que el usuario razonablemente no conoce.

No borres físicamente un animal con historia. Usa archivado/borrado lógico y confirma las acciones destructivas.

### 5.3 Reproducción

Esta vista será el centro del ciclo de las reproductoras. Debe incluir tablero por estados, calendario de ventanas, historial y filtros. Implementa el modelo detallado en la siguiente sección.

### 5.4 Camadas

Conserva lo mejor de la referencia:

- Vínculo con madre y, si se conoce, padre.
- Fecha de parto real.
- Nacidos totales, nacidos vivos, nacidos muertos, momificados, adopciones/transferencias, bajas y destetados; todos opcionales y validados para evitar totales imposibles.
- Tareas configurables por edad. Como plantilla inicial editable del rancho: hierro día 3, vitaminas día 15, castración día 20 y destete día 35. No presentes medicación/dosis ni procedimientos como indicación veterinaria.
- Progreso, próximas tareas, atrasos y notas.
- Un parto debe crear como máximo una camada mediante una clave idempotente.

### 5.5 Calendario y pendientes

Combina eventos derivados y pendientes manuales. Permite filtrar por reproducción, camadas, alimentación y salud. Las fechas estimadas deben mostrar explícitamente “estimada”; las realizadas, “registrada”. Marcar una tarea no debe cambiar un estado reproductivo salvo mediante el evento de dominio correspondiente.

### 5.6 Salud

Registro operativo, no diagnóstico:

- Animal o camada.
- Fecha/hora.
- Observación, categoría, gravedad operativa y notas.
- Profesional responsable, si aplica.
- Tratamiento/producto y periodo de retiro solamente cuando el usuario lo capture de una indicación profesional.
- Próximo seguimiento.
- Archivos/fotos opcionales si el sistema actual soporta almacenamiento seguro.

Incluye aviso visible de que el CRM no sustituye al veterinario. No sugieras medicamentos, hormonas, dosis o tratamientos automáticos.

---

## 6. Ciclo reproductivo correcto e incorporación de “Celo”

### 6.1 Estados

Implementa estos estados internos para hembras reproductoras:

```text
open                     = Vacía / disponible
heat                     = Celo observado
served_pending_confirmation = Servida por confirmar
gestation_confirmed      = Gestación confirmada
prefarrowing             = Preparto (derivado visualmente de una gestación confirmada)
lactation                = Lactancia
postweaning              = Posdestete
not_applicable           = No aplica
```

No uses un único campo mutable como única verdad. El estado actual debe derivarse de una línea de tiempo de eventos append-only, con una caché recalculable si hace falta para rendimiento.

### 6.2 Eventos obligatorios

```text
heat_observed
heat_ended_without_service
service
pregnancy_check
return_to_heat
farrowing
weaning
reproductive_loss
health_observation
sale
death
transfer
note
state_correction
```

Campos comunes: `id`, `animalId`, `eventType`, `occurredAt`, `recordedAt`, `payload`, `source`, `idempotencyKey`, `createdAt`, `updatedAt`, `archivedAt` y versión de esquema. Las correcciones se registran como eventos nuevos que referencian el evento corregido; no destruyas la evidencia anterior.

### 6.3 Registrar celo

Desde una hembra vacía o posdestete, el botón **Registrar celo** abre un formulario/bottom sheet con:

- Fecha y hora observadas, con valor inicial “ahora” pero editable.
- Lista opcional de señales observadas: reflejo de inmovilidad/presión dorsal, aceptación del macho, monta a otras, inquietud/vocalización, orejas erectas, inflamación/flujo y “otra”. Son observaciones, no un diagnóstico.
- Exposición a semental: sí/no/no se sabe.
- Confianza del registro: baja/media/alta.
- Observador.
- Notas.
- Acción posterior opcional: solo guardar el celo o continuar a Registrar servicio.

Al guardar:

- Crea `heat_observed`.
- Cambia el estado derivado a `heat`.
- Muestra día/hora de inicio, duración transcurrida y próxima acción.
- No crea una monta ni una gestación.

### 6.4 Registrar servicio/monta

El botón debe llamarse **Montar / Servir** para que sea claro. Campos:

- Fecha y hora.
- Método: monta natural o inseminación artificial.
- Semental activo, con “Canelo” disponible solo si ya existe en los datos.
- Número de servicio dentro del mismo celo.
- Segundo servicio opcional como evento separado.
- Lote de semen/proveedor, solamente si aplica.
- Responsable y notas.

Al guardar `service`, el estado pasa a **Servida por confirmar**, nunca a gestación confirmada. Calcula y muestra:

- Ventana estimada de revisión por retorno a celo: desde 18 hasta 24 días después del servicio.
- Día central de referencia: 21 días.
- Fecha estimada de parto: 114 días después del servicio, todavía marcada como provisional.
- Recordatorio configurable de revisión/diagnóstico de gestación; si se incluye una plantilla de día 28, debe quedar como recordatorio operativo editable, no como diagnóstico automático.

### 6.5 Revisión de gestación y retorno a celo

En “Servida por confirmar” ofrece:

- **Registrar revisión**: fecha, resultado positivo/negativo/inconcluso, método, profesional y notas.
- Solo un resultado positivo registrado cambia a `gestation_confirmed`.
- Resultado negativo devuelve a `open` y conserva el historial.
- Resultado inconcluso mantiene `served_pending_confirmation` y crea un próximo seguimiento.
- **Registrar repetición de celo** crea `return_to_heat` y coloca a la hembra en `heat`; no borra el servicio anterior.
- **Remontar** crea un nuevo servicio vinculado al nuevo ciclo.

Una alerta vencida nunca cambia por sí sola el estado.

### 6.6 Gestación, preparto, parto y lactancia

- Usa 114 días como referencia configurable para la gestación porcina.
- `prefarrowing` puede ser una etiqueta derivada durante los días configurados previos al parto estimado; no debe reemplazar el hecho de que la gestación está confirmada.
- Muestra fecha de servicio real, días transcurridos, días estimados restantes y rango de atención.
- **Parir** solicita fecha/hora real y datos de camada. Crea un único evento y una única camada con idempotencia.
- Después del parto, el estado es `lactation`.
- El destete estimado usa 35 días por configuración inicial del rancho, editable.
- **Destetar** registra fecha, número destetado y notas; el estado pasa a `postweaning`.
- En posdestete, muestra una ventana informativa estimada de 3–7 días para observar retorno a celo, sin cambiar el estado automáticamente.

### 6.7 Botones contextuales por estado

Los botones visibles deben depender del estado y de reglas de dominio:

| Estado | Acciones principales |
|---|---|
| Vacía / posdestete | Registrar celo, Montar/Servir, Nota, Salud, Vender |
| Celo | Montar/Servir, Finalizar sin servicio, Nota, Salud |
| Servida por confirmar | Registrar revisión, Repetición de celo, Remontar, Nota, Salud |
| Gestación / preparto | Registrar control, Parir, Registrar pérdida/corrección, Nota, Salud |
| Lactancia | Destetar, Registrar datos de camada, Nota, Salud |
| No aplica | Nota, Salud, Transferir, Vender |

Si una acción no es válida, ocúltala o deshabilítala con una razón entendible. Repetir doble clic o reenviar un formulario no debe duplicar eventos.

---

## 7. Módulo de Alimentación

Construye una vista completa de **Alimentación** que calcule cuánto alimento comprar por semana, quincena, mes calendario o rango personalizado a partir de los animales activos y la etapa en la que se encontrarán cada día.

No debe ser una multiplicación superficial. Debe distinguir:

1. Necesidad teórica/configurada.
2. Cantidad realmente ofrecida o consumida.
3. Inventario utilizable.
4. Compra en costales enteros.
5. Sobrante que pasa al siguiente periodo.
6. Costo de consumo frente a desembolso de compra.

### 7.1 Etapas alimenticias

Soporta reglas configurables para:

- Reproductora vacía/abierta.
- Celo.
- Servida por confirmar.
- Gestación temprana.
- Gestación tardía.
- Preparto.
- Lactancia.
- Posdestete.
- Semental.
- Lechón lactante con alimento de iniciación opcional.
- Iniciación/destete.
- Crecimiento.
- Desarrollo.
- Engorda/finalización.

La aplicación determina la etapa por eventos y fechas, pero la **ración diaria** debe venir de una regla confirmada por el usuario, etiqueta del fabricante o profesional. Permite un valor general por etapa y una excepción por animal. Para lactancia admite modo fijo o una fórmula configurable que pueda considerar lechones lactantes, pero no incluyas como verdad una fórmula médica inventada.

Cada regla debe guardar:

- Etapa.
- Producto.
- Gramos por cabeza por día o fórmula.
- Rango de referencia opcional.
- Estado: borrador o confirmado.
- Fuente: medición del rancho, etiqueta, veterinario/nutriólogo o referencia general.
- Fecha efectiva.
- Notas.

Si falta una regla para una etapa ocupada, no inventes una cifra ni omitas silenciosamente esos animales. Muestra **“Configuración incompleta: faltan X animales/etapas”**, excluye esa parte del total y explica cómo resolverla.

### 7.2 Periodos y transición de etapas

Selector obligatorio:

- 7 días.
- 15 días.
- Mes calendario real, respetando 28/29/30/31 días.
- Rango personalizado.

Para cada día del periodo, determina la etapa prevista de cada animal. Divide el cálculo en segmentos si una cerda cambia de gestación a lactancia por un parto estimado o real, o si una camada pasa de una fase a otra. Las predicciones deben decir **“estimado”**. Los eventos reales sustituyen a la predicción desde su fecha.

### 7.3 Fórmulas exactas

Evita errores de punto flotante:

- Guarda dinero en centavos enteros MXN.
- Guarda pesos/cantidades en gramos enteros.
- El costal predeterminado de los productos porcinos de estas fotos es de `40,000 g`, pero conserva `bagWeightG` por producto para poder cambiarlo en el futuro.

Usa estas fórmulas:

```text
dailyRequiredG(day) = suma de rationGPerHeadDay aplicable a cada animal activo ese día

periodConsumptionG = suma de dailyRequiredG para todos los días del periodo

grossRequiredG = redondeo(periodConsumptionG × (1 + safetyBufferPercent / 100))

usableStockG = suma del inventario disponible y no vencido/apartado del producto

netToBuyG = max(0, grossRequiredG - usableStockG)

bagsToBuy = ceil(netToBuyG / bagWeightG)

purchaseG = bagsToBuy × bagWeightG

pricePerKg = pricePerBagCents / (bagWeightG / 1000)

purchaseCostCents = bagsToBuy × pricePerBagCents

consumptionCostCents = round(periodConsumptionG / 1000 × pricePerKg)

projectedEndingStockG = usableStockG + purchaseG - periodConsumptionG

daysOfCoverage = usableStockG / currentDailyRequiredG
```

Si hay varios productos, calcula cada producto por separado y después suma el costo. No mezcles kg de alimento de gestación con lactancia para redondear costales.

El porcentaje de colchón de seguridad debe ser editable, visible y 0% por defecto. No escondas merma dentro de la ración.

### 7.4 Pantalla de Alimentación

Debe incluir:

- Tarjetas KPI: kg/día, kg del periodo, costales por comprar, desembolso estimado, costo de consumo, inventario restante y días de cobertura.
- Selector de periodo y fecha inicial.
- Estado de configuración y advertencias.
- Desglose por producto y etapa: animales incluidos, días-animal, ración confirmada, kg requeridos, inventario, costales y costo.
- Lista “Qué comprar” con botón **Copiar lista de compra**.
- Inventario por producto/lote.
- Historial de compras, consumos, mermas y ajustes.
- Comparación planeado vs. real.
- Próxima fecha estimada de compra.
- Editor de productos, precios, tamaños de costal y reglas de ración.
- Botón **Registrar compra**, con confirmación antes de crear el movimiento y el gasto financiero.
- Botón **Registrar consumo o ajuste**, con motivo y evidencia opcional.

Cuando se registra una compra:

1. Crea un movimiento de inventario.
2. Crea o actualiza el lote.
3. Pregunta si se registra también como gasto en Finanzas.
4. Si se confirma, crea una única transacción central con `businessUnit: "granja"`, `origin: "farm_feed_purchase"` e `idempotencyKey`.
5. Repetir la acción no debe duplicar el gasto.

No construyas un segundo módulo financiero dentro de Granja. Las métricas de granja deben leer movimientos del libro mayor central filtrados por unidad de negocio/origen.

### 7.5 Medición real y mejora continua

Permite registrar:

- Cantidad ofrecida.
- Sobrante/rechazo.
- Merma/desperdicio.
- Consumo estimado derivado.
- Conteo real de animales alimentados.
- Días cubiertos.

Usa los datos para mostrar tendencias, no para prescribir dietas. El consumo medio observado puede calcularse como:

```text
averageIntake = totalFeedEaten / (numberOfAnimals × numberOfDays)
```

Etiqueta claramente cuando se trata de “desaparición de alimento” y puede incluir desperdicio.

### 7.6 Inventario y precios

Modelo mínimo:

```text
farmFeedProducts
farmFeedPriceHistory
farmFeedRules
farmFeedInventoryLots
farmFeedMovements
farmFeedForecastSnapshots (opcional; siempre recalculable)
```

Campos recomendados:

```json
{
  "product": {
    "id": "uuid",
    "brand": "MAFORNU",
    "name": "Reproductora gestación N",
    "form": "harina",
    "stageTags": ["open", "heat", "served_pending_confirmation", "gestation"],
    "bagWeightG": 40000,
    "active": true,
    "requiresComplianceReview": false,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "archivedAt": null
  },
  "price": {
    "id": "uuid",
    "productId": "uuid",
    "pricePerBagCents": 28800,
    "currency": "MXN",
    "effectiveDate": "2026-09-13",
    "status": "reference_needs_confirmation",
    "source": "photo_price_board",
    "notes": "Precio leído de fotografía; confirmar antes de usar en producción"
  }
}
```

Los movimientos son append-only. Un ajuste crea otro movimiento; no reescribe el pasado. Consume inventario por FIFO salvo que el usuario seleccione otro lote. No permitas inventario negativo sin una confirmación explícita y un movimiento de ajuste.

---

## 8. Catálogo inicial leído de las fotografías

Precarga estos productos solamente como **referencias pendientes de confirmación**, con fecha de observación `2026-09-13`, moneda MXN y costal de 40 kg. Antes de usarlos en cálculos oficiales, presenta una pantalla de revisión donde el usuario pueda corregir y activar cada precio.

### Línea tradicional — harina

| Producto | Precio por costal de 40 kg |
|---|---:|
| Iniciación cerdos | $335 MXN |
| Crecimiento cerdos | $320 MXN |
| Desarrollo cerdos | $309 MXN |
| Engorda cerdos | $303 MXN |
| Engorda cerdos Racto | $319 MXN |
| Reproductora gestación “N” | $288 MXN |
| Reproductora lactancia | $349 MXN |

### Línea Hi-Magra — harina

| Producto | Precio por costal de 40 kg |
|---|---:|
| Iniciación cerdos Hi-Magra | $354 MXN |
| Crecimiento cerdos Hi-Magra | $325 MXN |
| Engorda cerdos Racto Hi-Magra | $331 MXN |
| Reproductora gestación Hi-Magra | $301 MXN |
| Reproductora lactancia Hi-Magra | $367 MXN |

### Cerdos en pellet

| Producto | Precio por costal de 40 kg |
|---|---:|
| Iniciación cerdos MPG AVI | $294 MXN |
| Engorda cerdos MPG AVI | $241 MXN |

Reglas obligatorias para este catálogo:

- Calcula `pricePerKg`; no lo captures manualmente como fuente primaria.
- El usuario puede corregir nombre, presentación, peso y precio.
- Conserva historial de precios con fecha efectiva; un precio nuevo no cambia el costo histórico de compras anteriores.
- No actives automáticamente productos “Racto”, no los recomiendes y no construyas una lógica que dependa de ellos. Déjalos desactivados con `requiresComplianceReview: true` hasta que el usuario confirme producto, etiqueta, objetivo productivo y cumplimiento aplicable.
- Las materias primas fotografiadas —maíz, pasta de soya, canola, sorgo, salvado, etc.— pueden guardarse en un catálogo inactivo de referencia, pero **no formules dietas ni sustituciones**. La formulación requiere composición nutricional, etapa, objetivos y revisión de un especialista.
- Si la lectura visual de una cifra no coincide con esta tabla, muestra la discrepancia en el reporte final y no la cambies silenciosamente.

---

## 9. Ejemplos de control matemático obligatorios

Implementa pruebas deterministas para el calculador. Estos ejemplos validan la aritmética, no crean animales ni prescriben una ración.

### Caso A — semana

Supuestos de simulación:

- 18 reproductoras.
- 2.75 kg/cabeza/día como supuesto operativo editable.
- 7 días.
- 0 kg de inventario.
- 0% de colchón.
- Costal de 40 kg.
- $288 por costal.

Resultado esperado:

```text
Consumo: 18 × 2.75 × 7 = 346.5 kg
Compra: ceil(346.5 / 40) = 9 costales
Kg comprados: 360 kg
Desembolso: 9 × $288 = $2,592 MXN
Inventario final proyectado: 13.5 kg
```

### Caso B — quincena

```text
Consumo: 18 × 2.75 × 15 = 742.5 kg
Compra: ceil(742.5 / 40) = 19 costales
Kg comprados: 760 kg
Desembolso: 19 × $288 = $5,472 MXN
Inventario final proyectado: 17.5 kg
```

Este resultado queda dentro de la referencia histórica aproximada de $5,344–$5,500 MXN por 15 días. Muestra esa comparación únicamente como calibración.

### Caso C — 30 días

```text
Consumo: 18 × 2.75 × 30 = 1,485 kg
Compra: ceil(1,485 / 40) = 38 costales
Kg comprados: 1,520 kg
Desembolso: 38 × $288 = $10,944 MXN
Inventario final proyectado: 35 kg
```

### Caso D — inventario arrastrado

Repite el Caso B comenzando con 17.5 kg de inventario. El sistema debe descontarlo antes de redondear costales y conservar el nuevo sobrante. Nunca calcule cada periodo como si el almacén volviera a cero.

### Caso E — etapas mixtas

Crea una prueba sin datos persistidos con al menos:

- Gestación con un producto.
- Lactancia con otro producto.
- Una transición prevista dentro del periodo.
- Inventario separado por producto.

Comprueba que el calculador segmenta días-animal, no mezcla productos y etiqueta la porción futura como estimada.

La tasa de 2.75 kg/día de estos tests es una aproximación derivada del gasto histórico del rancho. No debe guardarse silenciosamente como recomendación veterinaria. En el onboarding puede existir una acción explícita: **“Usar temporalmente mi promedio histórico de 2.75 kg/día”**, con advertencia, fecha efectiva y posibilidad de reemplazarlo por medición/etiqueta/profesional.

---

## 10. Métricas para maximizar la operación sin inventar conclusiones

En **Rendimiento**, crea indicadores accionables con filtros de 30 días, 90 días, 12 meses y personalizado. Cada KPI debe mostrar fórmula, periodo, muestra y si faltan datos.

### Reproducción

- Servicios registrados.
- Repeticiones de celo dentro de la ventana esperada.
- Tasa de gestación confirmada sobre servicios con resultado conocido.
- Tasa de parto sobre servicios elegibles.
- Intervalo destete–primer celo/servicio.
- Días no productivos estimados, con definición visible.
- Nacidos totales, vivos y destetados por camada.
- Mortalidad predestete calculada solo si los datos son consistentes.
- Camadas por cerda por año.
- Lechones destetados por cerda por año.

### Alimentación y costos

- Kg y costo por animal/día por etapa.
- Planeado vs. ofrecido/consumido.
- Merma registrada.
- Costo de alimento por ciclo reproductivo.
- Costo de alimento por camada y por lechón destetado.
- Días de cobertura e historial de quiebres de inventario.
- Variación de precio por producto.

### Capacidad de maternidad

- Línea de tiempo de ocupación estimada/real de las 3 maternidades.
- Detecta periodos con más partos/lactancias previstos que espacios configurados.
- Propón revisar el calendario; no reprogrames montas ni acciones automáticamente.

### Selección de las mejores reproductoras

Crea una tabla comparativa para apoyar la meta de identificar a las 8 mejores cerdas. No llames “mala” a una cerda ni recomiendes venderla automáticamente. Usa un puntaje transparente y configurable basado en:

- Camadas elegibles.
- Nacidos vivos.
- Destetados.
- Supervivencia predestete.
- Repeticiones de celo.
- Intervalo entre partos/días no productivos.
- Costo de alimento por lechón destetado, solo cuando haya trazabilidad.

Muestra el tamaño de muestra y una etiqueta como “Datos insuficientes” cuando una cerda no tenga historial comparable. La meta de 10 lechones por camada es una referencia editable del rancho, no un umbral universal.

---

## 11. Modelo de datos y dominio

Extiende el esquema versionado existente, reutilizando colecciones ya presentes si las hay:

```text
farmAnimals
farmEvents
farmLitters
farmHealthRecords
farmTasks
farmFeedProducts
farmFeedPriceHistory
farmFeedRules
farmFeedInventoryLots
farmFeedMovements
farmSettings
```

### Animal mínimo

```json
{
  "id": "uuid",
  "species": "pig",
  "earTag": "string",
  "name": null,
  "sex": "female|male|unknown",
  "role": "breeding_sow|gilt|boar|piglet|nursery|grower|developer|finisher|other",
  "lifeStatus": "active|sold|dead|archived",
  "location": null,
  "birthDate": null,
  "birthDatePrecision": "exact|approximate|unknown",
  "photoRef": null,
  "notes": "",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "archivedAt": null
}
```

### Ajustes mínimos

```json
{
  "species": "pig",
  "timezone": "America/Mexico_City",
  "currency": "MXN",
  "gestationReferenceDays": 114,
  "returnToHeatWindowStartDays": 18,
  "returnToHeatWindowEndDays": 24,
  "postWeaningHeatWindowStartDays": 3,
  "postWeaningHeatWindowEndDays": 7,
  "weaningTargetDays": 35,
  "prefarrowingWindowDays": 7,
  "maternityCapacity": 3,
  "defaultBagWeightG": 40000,
  "defaultSafetyBufferPercent": 0
}
```

Las fechas de negocio se interpretan en `America/Mexico_City`. Guarda instantes con zona/UTC de forma consistente y evita que una fecha de parto, servicio o compra cambie de día por conversión incorrecta.

Todas las funciones de dominio deben ser puras y probables: derivar estado, validar transición, calcular ventanas, calcular ocupación, segmentar días-animal, calcular compra e indicadores. No disperses las reglas en listeners del DOM.

---

## 12. Migración y protección de datos

La actualización debe ser segura y determinista:

1. Detecta la versión del esquema actual.
2. Exporta/crea un respaldo antes de migrar.
3. Migra sobre una copia en memoria.
4. Valida claves, referencias, fechas, importes y colecciones.
5. Escribe una sola vez de forma atómica si todo es válido.
6. Si falla, conserva intactos los datos anteriores y muestra una recuperación entendible.

Reglas específicas:

- No borres datos de Finanzas, Gimnasio, Objetivos, SOMA, Aprendizaje, Bitácora, Libros, ALVENTO, Videos, Vision board, Perfil ni Upload.
- No siembres 18 cerdas, Canelo, camadas, compras ni movimientos ficticios en el almacenamiento real.
- Los ejemplos viven en pruebas/simulaciones aisladas.
- Convierte registros antiguos de `celo_date` en eventos `heat_observed` cuando exista evidencia suficiente.
- Si el sistema antiguo marca “gestación” únicamente porque hubo una monta, migra a `served_pending_confirmation`, salvo que exista un control positivo, parto posterior u otra evidencia inequívoca de gestación confirmada.
- Conserva el estado original en metadatos de migración y genera un reporte de elementos que requieren revisión.
- Deduplica por identificadores estables e `idempotencyKey`; no por coincidencias frágiles de texto.
- Mantén borrado lógico.
- Amplía exportación/importación JSON para incluir las nuevas colecciones y versión de esquema.
- El importador universal de DALI debe poder recibir registros de granja sin duplicados, mostrar previsualización y pedir confirmación antes de aplicar.

---

## 13. Integraciones dentro de DALI

### Inicio

Agrega a Inicio, sin saturarlo:

- Máximo una tarjeta compacta de Granja con pendientes urgentes, alimento por comprar o próximo parto/destete.
- Las alertas vencidas se priorizan sobre estadísticas decorativas.

### Finanzas

- Una compra de alimento puede crear un gasto central con categoría/unidad `Granja`.
- Una venta de animal o camada puede crear un ingreso central.
- Usa origen e idempotencia; no dupliques movimientos.
- Los costos de rendimiento deben leer esas transacciones centrales más los movimientos de inventario.

### Objetivos y pendientes

- Permite convertir una alerta o mejora operativa en objetivo/pendiente con vínculo de origen.
- Completar el objetivo no debe falsificar el evento de granja; debe registrarse el evento real por separado.

### Upload JSON

Amplía los esquemas aceptados para animales, eventos reproductivos, camadas, salud, productos, precios, reglas, inventario y movimientos. Incluye:

- Validación estructural y semántica.
- Vista previa de altas, cambios, duplicados, advertencias y rechazos.
- Aplicación atómica.
- Resultado descargable.
- Nunca ejecutar texto como código.

---

## 14. Seguridad, accesibilidad y confiabilidad

- Escapa todo contenido introducido por el usuario; no uses `innerHTML` inseguro.
- Valida tipos, rangos, fechas, referencias y cantidades antes de guardar.
- No permitas números negativos donde no tengan sentido.
- Evita duplicados por doble clic, reintento o importación repetida.
- Los botones destructivos requieren confirmación y explican el efecto.
- No muestres datos personales o del rancho en una publicación pública.
- Mantén acceso privado si el proyecto ya lo tiene. No finjas que `localStorage` es autenticación segura.
- No introduzcas llamadas externas silenciosas.
- Mantén contraste WCAG AA, etiquetas asociadas, foco visible, cierre de modal con Escape y restauración de foco.
- Presenta estados de carga, vacío, éxito, error y sin conexión.

---

## 15. Pruebas y criterios de aceptación

Agrega pruebas automatizadas compatibles con el stack, aunque sea mediante un runner JavaScript simple en navegador. Conserva y ejecuta las pruebas existentes.

Debe quedar demostrado:

### Reproducción

1. Registrar celo crea un solo evento y muestra el estado Celo.
2. Registrar una monta deja a la hembra “Servida por confirmar”, no “Gestación”.
3. La ventana posterior al servicio es de 18–24 días y el centro de referencia es 21.
4. Solo una revisión positiva confirma gestación.
5. Un resultado negativo o repetición de celo conserva el historial.
6. El parto estimado usa 114 días desde el servicio correspondiente.
7. Un parto crea una sola camada incluso con doble clic/reintento.
8. El destete usa el objetivo configurado y coloca a la cerda en posdestete.
9. Ningún estado cambia automáticamente por el paso del tiempo.

### Alimentación

10. Casos A, B, C, D y E dan exactamente los resultados esperados.
11. El mes usa el número real de días.
12. Una transición de etapa dentro del periodo divide correctamente días y productos.
13. El inventario se descuenta antes de redondear costales.
14. El sobrante pasa al siguiente periodo.
15. El costo de consumo y el desembolso de compra aparecen separados.
16. Un cambio de precio no altera compras históricas.
17. Una etapa sin ración confirmada muestra cálculo incompleto y nunca usa cero silenciosamente.
18. No se mezclan costales de productos distintos.
19. Registrar dos veces la misma compra no duplica inventario ni Finanzas.

### Datos y aplicación

20. Migrar dos veces produce el mismo resultado.
21. Importar dos veces el mismo JSON no duplica registros.
22. Un error de migración restaura/conserva el estado anterior.
23. Exportar y reimportar conserva referencias.
24. Los demás módulos siguen funcionando.
25. No hay errores de consola ni enlaces/botones muertos.
26. La aplicación funciona recargando la página y sin conexión después de cargar recursos disponibles.
27. Vista comprobada a 360, 390, 768, 1024 y 1440 px sin desbordamiento horizontal.
28. Navegación por teclado y modales accesibles.

Haz además una prueba manual completa con datos temporales aislados y elimínalos antes de entregar. No uses los datos reales para pruebas destructivas.

---

## 16. Fuentes técnicas y límites de las recomendaciones

Usa estas fuentes como base de dominio y verifica que las afirmaciones sigan vigentes. No copies grandes fragmentos; traduce los principios en reglas del producto:

- MSD Veterinary Manual, **Breeding Management of Pigs**: https://www.msdvetmanual.com/management-and-nutrition/management-of-reproduction-pigs/breeding-management-of-pigs
- University of Minnesota Extension, **Formulating farm-specific swine diets**: https://extension.umn.edu/agriculture/animals-and-livestock/swine/formulating-farm-specific-swine-diets
- Iowa Pork Industry Center, **National Swine Nutrition Guide**: https://www.ipic.iastate.edu/national-swine-nutrition-guide
- Pork Information Gateway, **Feeding the Gestating Sow**: https://porkgateway.org/resource/feeding-the-gestating-sow-2/
- USDA APHIS, recursos de salud y bioseguridad porcina: https://www.aphis.usda.gov/livestock-poultry-disease/swine

Principios que deben reflejarse:

- El ciclo estral porcino ronda 21 días, con rango frecuente de 18–24.
- La mayoría de las cerdas presenta celo 3–7 días después del destete, con variación por condición, lactancia, estación y manejo.
- La gestación de referencia es de aproximadamente 114 días.
- La necesidad de alimento cambia por etapa, tamaño, condición corporal, ambiente, salud, productividad, forma y calidad del alimento.
- Subalimentar puede reducir desempeño y sobrealimentar incrementa costo y puede afectar condición; por eso el CRM mide y permite ajustar, no prescribe una cantidad universal.
- El agua es esencial y puede limitar el consumo. Incluye en Configuración/Salud una verificación operativa de agua y comederos, sin convertirla en tratamiento.

No conviertas estas referencias generales en diagnóstico, dieta formulada, tratamiento, medicación, hormona o dosis. Las decisiones clínicas y la formulación final pertenecen a un veterinario o nutriólogo porcino que conozca los animales, el alimento y las condiciones locales.

---

## 17. Entrega obligatoria

Al terminar, entrega:

1. Proyecto DALI actualizado y funcional.
2. ZIP descargable con la versión completa.
3. Resumen concreto de archivos modificados/creados.
4. Versión de esquema antes y después.
5. Reporte de migración y datos que requieren revisión.
6. Lista de pruebas ejecutadas con resultados reales.
7. Instrucciones mínimas para ejecutar localmente.
8. Lista breve de decisiones o supuestos, especialmente precios y raciones pendientes de confirmar.
9. Cualquier limitación real que siga pendiente, sin declarar completa una función simulada.

Antes de responder, revisa la implementación visual y funcional. No respondas solo con recomendaciones, pseudocódigo, capturas o una promesa de continuar. No detengas el trabajo por despliegue, Cloudflare, Genspark Hosted Deploy, plan Plus o credenciales: **el despliegue no forma parte de esta tarea**. Termina primero el código local y el ZIP.

La definición de “terminado” es: puedo abrir el CRM, entrar a Granja, registrar un celo, registrar una monta sin que se confirme falsamente la gestación, dar seguimiento hasta parto y destete, calcular alimento por etapa y periodo, descontar inventario, obtener costales y costo con mis precios, registrar la compra una sola vez en Finanzas, revisar rendimiento y conservar todo después de recargar, tanto en móvil como en PC.

