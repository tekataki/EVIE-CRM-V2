# PROMPT MAESTRO DE REDISEÑO E IMPLEMENTACIÓN
## DALI NEURAL INTERFACE v4 — Genspark + GPT-6 Astra

> **Este prompt es una orden de implementación sobre un proyecto existente. No es una solicitud de ideas, wireframes ni un nuevo proyecto.**

---

## 0. MISIÓN

Actúa como un equipo senior integrado por:

- director de producto;
- diseñador principal de UI/UX;
- director de arte digital;
- ingeniero frontend experto en HTML, CSS y JavaScript Vanilla;
- especialista en motion design y visualización de datos;
- arquitecto de software local-first;
- especialista en accesibilidad;
- ingeniero de QA;
- analista de operaciones porcinas, únicamente para validar la lógica ya existente del módulo Granja.

Trabaja **directamente sobre el ZIP más reciente de DALI que adjunto**. Debes inspeccionarlo completo, modificarlo, probarlo y devolver un nuevo ZIP funcional.

El producto es una **página web privada tipo CRM personal y centro de mando**, no un sistema operativo. Puede conservar “DALI OS” como marca si ya aparece en el proyecto, pero no construyas ventanas falsas, terminales, escritorios, exploradores de archivos ni patrones de sistema operativo.

La base actual ya funciona. El objetivo de esta actualización es transformarla visualmente y convertirla en una experiencia:

- cinematográfica;
- futurista;
- premium;
- dinámica;
- altamente personal;
- agradable de usar todos los días;
- clara en móvil y computadora;
- coherente entre módulos, pero con una esencia distinta en cada sección.

Debe sentirse como el centro de mando personal de un superhéroe moderno: inteligente, vivo y poderoso, con energía tipo interfaz avanzada/JARVIS, **pero con una identidad completamente original**. No copies personajes, trajes, logos, tipografías, sonidos, interfaces ni propiedad intelectual de Marvel, Spider-Man, Iron Man, Symmetry u otras marcas.

### Resultado emocional obligatorio

Al abrir DALI, la reacción buscada es: **“esto fue creado específicamente para mí y se siente increíble”**, no “esto es otro dashboard administrativo”.

### Resultado técnico obligatorio

Conserva la lógica, los datos, las relaciones, los cálculos, la navegación y las funciones actuales que ya son correctas. Rediseña profundamente la capa visual y de interacción; mejora flujos puntuales donde se describe, pero no reemplaces el dominio funcional con una maqueta.

No termines con un plan. **Implementa todo lo posible, ejecuta las pruebas y entrega el proyecto actualizado.**

---

## 1. MATERIAL ADJUNTO Y ORDEN DE AUTORIDAD

Recibirás algunos o todos estos archivos:

1. ZIP más reciente de DALI.
2. Captura actual de Inicio en escritorio.
3. Captura actual de Granja, especialmente la vista Salud.
4. Captura actual de Contenido.
5. ZIP antiguo de GranjaControl construido en Bolt.
6. Video vertical de GranjaControl mostrando tarjetas, filtros y acciones.
7. Fotografías del tablero de precios MAFORNU.
8. Capturas de Symmetry.
9. Imágenes personales opcionales: modelos de ALVENTO, foto de perfil, libros y Vision Board.
10. Prompts o requisitos anteriores del proyecto, si se adjuntan.

Cuando exista un conflicto, respeta este orden:

1. Datos reales ya guardados por el usuario.
2. Requisitos explícitos de este prompt.
3. Lógica funcional y tests del ZIP actual de DALI.
4. Prompts anteriores del proyecto.
5. Material de referencia visual o funcional.
6. Tus decisiones de diseño, siempre que sean reversibles y no inventen datos.

Las capturas actuales evidencian un problema concreto: la aplicación es limpia y funcional, pero demasiadas pantallas repiten el mismo patrón de título pequeño, botón azul, pestañas rectangulares y panel vacío enorme. Corrige esa monotonía sin perder claridad.

Las capturas y videos son referencias, no fuentes de verdad para crear registros. **No siembres animales, transacciones, clientes, sesiones, libros, objetivos ni cifras ficticias en el almacenamiento real.**

---

## 2. PROTOCOLO OBLIGATORIO ANTES DE EDITAR

Antes de tocar código:

1. Descomprime el ZIP actual en una carpeta de trabajo nueva.
2. Lee `README`, checklist, requisitos, migraciones, schemas y tests.
3. Ejecuta la aplicación y recorre todas las rutas en tema oscuro y claro.
4. Inspecciona todos los archivos, no solo `index.html` y `styles.css`.
5. Localiza qué renderers están realmente activos. En la versión auditada, `PigApp` sustituye `V2Views.farm` mediante `PigViews.render`; no rediseñes por error un renderer legado que ya no se usa.
6. Identifica almacenamiento, versión de esquema, migraciones, IndexedDB, importador JSON, multimedia y relaciones.
7. Ejecuta la suite actual antes de modificar. La versión de referencia reporta **59 pruebas superadas**; verifica el número real del ZIP recibido y úsalo como línea base.
8. Crea una copia de seguridad interna del proyecto y un respaldo de datos de prueba antes de una migración.
9. Haz un inventario interno de:
   - conservar sin cambios;
   - mejorar visualmente;
   - simplificar en interacción;
   - migrar;
   - probar.
10. Empieza a implementar en la misma sesión. No consumas toda la respuesta en describir el plan.

Si el ZIP recibido difiere de la auditoría descrita aquí, manda el código real. Adapta nombres y módulos con cuidado en lugar de reemplazar archivos completos a ciegas.

---

## 3. RESTRICCIONES TÉCNICAS NO NEGOCIABLES

El proyecto actual es una aplicación estática/local-first basada en:

- HTML;
- CSS;
- JavaScript Vanilla;
- Tailwind por CDN del navegador;
- Lucide por CDN;
- almacenamiento local versionado;
- IndexedDB para medios;
- archivos servibles sin compilación.

### Debes conservar ese stack

- No uses React, Vue, Svelte, Angular, Next.js, Vite, Astro, Node, TypeScript, NPM, Yarn, PNPM, Bun ni bundlers.
- No crees `package.json` ni un paso de build.
- No reescribas todo en una SPA distinta.
- Puedes crear módulos Vanilla separados si reducen complejidad, por ejemplo:
  - `motion-system.js`;
  - `visual-system.js`;
  - `charts.js`;
  - `entity-links.js`;
  - `home-experience.js`;
  - `farm-visuals.js`;
  - `module-themes.js`.
- Mantén versiones fijadas de cualquier CDN nuevo.
- Si añades una librería, documenta por qué existe y crea un fallback sin romper el uso básico.

### Librerías permitidas para esta actualización

Puedes usar:

- **GSAP Core** mediante CDN con versión fijada para secuencias, entrada, salida y microinteracciones complejas.
- **Chart.js** mediante CDN con versión fijada para gráficas Canvas responsivas basadas exclusivamente en datos reales.
- **View Transition API** cuando exista soporte, con fallback CSS/JS cuando no exista.
- Canvas 2D o WebGL Vanilla para el visual ambiental protagonista de Inicio, con fallback SVG/CSS estático.

No añadas bibliotecas redundantes. No uses plugins de pago. No dependas de un recurso remoto que pueda desaparecer para que la navegación o los formularios funcionen.

### Supabase no se implementa todavía

Esta fase termina primero el producto local. Por ahora:

- conserva `localStorage`, IndexedDB, exportación e importación;
- no conectes Supabase;
- no pidas claves;
- no publiques;
- no añadas autenticación falsa;
- no introduzcas `service_role`, tokens o secretos en el navegador;
- no copies las políticas anónimas del proyecto antiguo.

Puedes dejar un documento `SUPABASE_READINESS.md` con un futuro mapeo de tablas, usuario propietario, Storage y RLS, pero **no escribas integración cloud todavía**.

---

## 4. PRINCIPIOS QUE GOBIERNAN TODO EL REDISEÑO

### 4.1 No destruir para “mejorar”

- Conserva cada función que hoy sí sirve.
- Conserva IDs, fechas, relaciones y datos desconocidos.
- No vacíes el store por cambiar la versión.
- No cambies cálculos correctos por animaciones.
- No conviertas botones reales en botones decorativos.
- No muestres métricas inventadas para llenar espacios.
- No escondas una función importante solo porque el nuevo diseño sea más minimalista.

### 4.2 Creatividad con jerarquía

No pongas neón, blur, partículas y movimiento en todo. La experiencia debe tener un protagonista por pantalla y una jerarquía clara:

1. identidad del módulo;
2. dato o acción más importante;
3. señales y estadísticas secundarias;
4. historial y configuración.

### 4.3 Lo vacío también debe estar diseñado

Elimina los rectángulos gigantes casi vacíos. Cada estado vacío debe incluir:

- una ilustración original o composición SVG/CSS contextual;
- explicación de una línea;
- una acción primaria real;
- como máximo una acción secundaria;
- sin datos de demostración guardados.

### 4.4 Todo en español

La interfaz visible será español de México. Traduce los valores internos, sin cambiar sus claves persistidas:

- `sow` → Reproductora;
- `gilt` → Primeriza;
- `boar` → Semental;
- `piglet` → Lechón;
- `nursery` → Iniciación / destete;
- `grower` → Crecimiento;
- `developer` → Desarrollo;
- `finisher` → Engorda;
- `open` → Vacía / disponible;
- `heat` → Celo observado;
- `served_pending_confirmation` → Servida por confirmar;
- `gestation_confirmed` → Gestación confirmada;
- `prefarrowing` → Preparto;
- `lactation` → Lactancia;
- `postweaning` → Posdestete.

Nunca enseñes al usuario strings internos como `sow`, `boar`, `roll`, `showboard`, `piglet`, `null`, claves UUID crudas ni JSON salvo dentro de herramientas técnicas claramente identificadas.

### 4.5 Datos honestos

- Si no hay información, di “Todavía no hay datos suficientes”.
- Si una estadística es estimada, muestra “Estimado”.
- Si un precio viene de una foto, muestra “Referencia por confirmar”.
- Si una importación está incompleta, lista incertidumbres.
- Si una gráfica tiene menos datos de los necesarios, usa un estado vacío diseñado; no inventes una curva.

---

## 5. CONCEPTO VISUAL: “DALI NEURAL INTERFACE”

Construye un sistema visual original denominado internamente **DALI Neural Interface**.

### 5.1 Sensación

- centro de mando personal;
- tecnología elegante, no militar;
- superheroico sin cosplay;
- preciso, sobrio y aspiracional;
- profundidad mediante capas, no mediante ruido;
- datos que parecen vivos;
- formas geométricas con líneas de energía sutiles;
- contraste alto y superficies de vidrio/mica con moderación.

### 5.2 Paleta base sugerida

Adáptala a los tokens actuales en lugar de imponer hexadecimales duplicados por todo el CSS:

| Uso | Oscuro | Claro |
|---|---|---|
| Fondo profundo | `#07111F` / `#091426` | `#F5F7FB` |
| Superficie | `#0F1D31` | `#FFFFFF` |
| Superficie elevada | `#152740` | `#F0F4FA` |
| Borde | azul grisáceo translúcido | gris azulado suave |
| Primario | azul eléctrico `#2F6BFF` | azul profundo accesible |
| Energía secundaria | cian `#4FDDF8` | cian oscuro accesible |
| Éxito / granja | verde `#36D98B` | verde oscuro |
| Atención | ámbar `#F6B94A` | ámbar oscuro |
| Peligro | coral `#FF5F78` | rojo accesible |
| Aprendizaje | violeta `#A77BFF` | violeta profundo |

Comprueba contraste WCAG AA. No uses texto azul grisáceo demasiado tenue sobre fondo azul oscuro.

### 5.3 Superficies y profundidad

- Bordes de 1 px con brillo interior tenue.
- Sombras profundas pero suaves; evita sombras negras sucias.
- Gradientes tonales y radiales lentos, no arcoíris.
- Textura de cuadrícula o líneas de datos a opacidad muy baja solo en héroes y fondos especiales.
- Glassmorphism únicamente en overlays, héroes y controles flotantes; no en cada tarjeta.
- Radios coherentes con el diseño actual.
- Contadores monoespaciados o tabulares para evitar saltos de anchura.

### 5.4 Tipografía

- Conserva la fuente actual si es sólida.
- Si añades una fuente display, usa una sola y cárgala con fallback.
- Títulos grandes y con personalidad; textos de trabajo muy legibles.
- Usa `font-variant-numeric: tabular-nums` para reloj, dinero, pesos y contadores.
- Evita mayúsculas largas. Úsalas solo para etiquetas pequeñas de sistema.

### 5.5 Identidad original por módulo

Cada módulo comparte navegación, espaciado, tipografía y componentes base, pero recibe un acento, textura y visual protagonista propio. No debe parecer que se pegaron quince plantillas distintas.

---

## 6. SISTEMA DE MOVIMIENTO

Divide el movimiento en tres capas.

### A. Movimiento ambiental

- Un solo elemento vivo protagonista por pantalla.
- Lento, sutil y no bloqueante.
- Ejemplos: orbitar nodos, pulso de una línea, barrido HUD, parallax mínimo, grano luminoso.
- Nunca animes constantemente todas las tarjetas.

### B. Movimiento de navegación

- Entrada/salida de vistas: 250–450 ms.
- Usa View Transition API si está disponible.
- Fallback con opacidad + `translateY`/`scale` pequeño.
- Los elementos compartidos pueden mantener continuidad visual.
- La navegación debe seguir siendo inmediata; la animación acompaña, no retrasa.

### C. Retroalimentación

- Botones: respuesta de 120–220 ms.
- Tarjetas: elevación o brillo leve al hover/focus.
- Guardado: confirmación clara, breve y accesible.
- Contadores: animar solo al entrar y únicamente desde el valor anterior al real.
- Éxito, error y advertencia no pueden depender solo del color.

### Reglas de ingeniería de movimiento

- Respeta `prefers-reduced-motion: reduce` tanto en CSS como en JavaScript.
- Proporciona movimiento reducido sin perder información.
- Pausa el Canvas/WebGL cuando `document.hidden === true`.
- Cancela `requestAnimationFrame`, observers, timers y timelines anteriores al salir o volver a renderizar.
- Destruye instancias de Chart.js antes de recrearlas.
- No acumules listeners por navegación.
- Evita animar `width`, `height`, `top` o `left` continuamente; prioriza `transform` y `opacity`.
- El sitio debe seguir usándose aunque GSAP, Chart.js o el visual Canvas fallen al cargar.

---

## 7. SHELL GLOBAL Y ENCABEZADO

### 7.1 Reloj global grande

En **todos los apartados**, coloca en el encabezado un reloj visible, elegante y suficientemente grande:

- formato de 12 horas;
- hora y minutos grandes;
- segundos opcionales más pequeños y discretos;
- `a. m.` / `p. m.`;
- fecha completa en español;
- zona horaria fija `America/Mexico_City`;
- actualización sin recarga;
- implementación con `Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour12: true, ... })`;
- nunca depender a ciegas de la zona del dispositivo.

En móvil, condensa el reloj sin esconderlo: hora grande en una línea y fecha corta debajo. En escritorio puede compartir espacio con breadcrumb, título y controles de cuenta.

### 7.2 Sidebar y navegación móvil

Conserva todas las rutas actuales. Mejora la navegación:

- iconos con contenedor sutil y estado activo con halo/rail animado;
- transiciones de expansión fluidas;
- grupos: Mi espacio, Herramientas y Mi cuenta;
- sidebar plegable en escritorio;
- drawer completo en móvil;
- navegación inferior solo con cinco acciones prioritarias;
- respeta safe-area;
- tooltips cuando la barra esté contraída;
- el foco y el estado activo siempre deben ser visibles.

### 7.3 Dock de acciones contextuales

Reemplaza filas de botones diminutos por un **dock de acciones** contextual:

- una acción primaria evidente;
- dos o tres secundarias visibles cuando haya espacio;
- el resto en “Más acciones”;
- en móvil puede ser un botón flotante que abre un bottom sheet;
- cada módulo define sus acciones reales;
- no uses un menú radial si dificulta la accesibilidad.

### 7.4 Búsqueda y paleta de comandos

Conserva la búsqueda y mejora `Cmd/Ctrl + K`:

- buscar registros y módulos;
- abrir acciones comunes;
- mostrar icono, tipo y destino;
- navegación por teclado;
- resultados escapados y seguros;
- nunca ejecutar texto del usuario como código.

---

## 8. NUEVO SISTEMA DE FORMULARIOS: RÁPIDO, VISUAL Y SIN ABURRIR

El problema actual no son solo los colores: al pulsar “Agregar”, muchos formularios muestran demasiados campos de golpe. Sustituye ese patrón por **divulgación progresiva**.

### 8.1 Dos niveles

1. **Registro rápido**: solo datos indispensables.
2. **Más detalles**: campos opcionales agrupados y colapsados.

### 8.2 Wizards para flujos complejos

Cuando haya más de seis decisiones relevantes, usa pasos cortos:

- indicador visual de progreso;
- una pregunta o grupo lógico por paso;
- atrás / continuar;
- resumen antes de guardar;
- borrador conservado si se cierra accidentalmente;
- no perder valores ante un error;
- último foco restaurado al cerrar;
- Escape cierra solo cuando no cause pérdida sin advertencia.

### 8.3 Controles visuales

Usa según el dato:

- tarjetas seleccionables con icono;
- chips multiselección;
- controles segmentados;
- pad numérico para dinero;
- stepper para cantidades pequeñas;
- calendario visual para fechas;
- carga de imagen con preview y recorte;
- selección por tarjetas con foto/arete;
- sliders solo cuando la precisión no sea crítica;
- texto libre solo donde realmente sea necesario.

Cada control debe conservar un input accesible y funcionar con teclado. No sacrifiques semántica por apariencia.

### 8.4 Bottom sheets y modales

- Móvil: bottom sheet de altura adaptable, arrastre opcional, encabezado fijo y CTA visible.
- Escritorio: modal centrado o panel lateral según complejidad.
- Fondo con blur moderado.
- Transición limpia con GSAP/CSS.
- Focus trap, `aria-modal`, título asociado, Escape y restauración de foco.
- No uses un panel blanco/genérico enorme para todos los flujos.

### 8.5 Validación

- valida al continuar y al guardar;
- error junto al campo y resumen si hay varios;
- mensaje en español que diga cómo corregirlo;
- no borres la captura del usuario;
- deshabilita doble submit y usa idempotencia.

---

## 9. INICIO — EXPERIENCIA “WELCOME, BOSS” Y CENTRO DE MANDO

Inicio debe ser el momento visual más memorable, sin convertirse en una pantalla de carga molesta.

### 9.1 Entrada cinematográfica por sesión

La primera vez que se abre DALI en una sesión:

1. fondo oscuro con una línea de energía o pulso;
2. aparece **“WELCOME, BOSS”** y debajo **“Bienvenido, jefe.”**;
3. dos paneles se separan suavemente hacia izquierda y derecha;
4. detrás se revela el centro de mando;
5. duración total aproximada 1.2–1.8 segundos;
6. botón visible “Omitir”;
7. opción en Configuración para repetir la entrada;
8. guarda solo el estado de sesión en `sessionStorage`;
9. no se repite al navegar entre módulos;
10. con movimiento reducido, usa una aparición breve sin paneles móviles.

No hagas un falso arranque de sistema operativo.

### 9.2 Héroe JARVIS original

Crea un visual original vivo con Canvas/SVG/CSS:

- núcleo/orbe de energía azul-cian;
- anillos, nodos y líneas que reaccionan levemente al puntero o movimiento del dispositivo;
- pulso tranquilo constante;
- sin rostro, logos ni assets copiados;
- fondo de cuadrícula radial muy tenue;
- fallback estático elegante;
- controles “Pausar movimiento” y “Repetir entrada” en Configuración.

En el mismo héroe muestra:

- saludo por horario: “Buenos días, jefe.”, “Buenas tardes, jefe.” o “Buenas noches, jefe.”;
- reloj de Ciudad Guzmán;
- fecha;
- una frase breve y útil estable durante el día, no distinta en cada render;
- una acción principal contextual.

### 9.3 Contenido útil debajo

No vuelvas a mostrar “todo” en una cuadrícula plana de tarjetas iguales. Organiza Inicio como un briefing:

1. **Lo que requiere tu atención**: máximo cinco señales priorizadas por fecha/urgencia.
2. **Tus próximas tres acciones**: objetivos, pendientes, seguimientos o compromisos reales.
3. **Pulso del día**: Finanzas, Gym, SOMA, Granja, aprendizaje y contenido; widgets configurables.
4. **Actividad conectada**: acciones recientes derivadas de los módulos, sin duplicar registros.

Las alertas reales vencidas deben pesar más que una estadística decorativa. Cada señal lleva directamente al registro correspondiente.

---

## 10. CONEXIONES ENTRE MÓDULOS

DALI debe sentirse como un ecosistema, no como carpetas independientes.

### 10.1 Modelo de enlaces

Añade una colección versionada `entityLinks` o equivalente:

```json
{
  "id": "uuid",
  "from": {"module": "goals", "collection": "goals", "id": "uuid"},
  "to": {"module": "gym", "collection": "gymMetrics", "id": "uuid"},
  "linkType": "supports",
  "metadata": {},
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "archivedAt": null
}
```

Reglas:

- enlace explícito, manual o confirmado por el usuario;
- reversible;
- no duplica registros;
- no cambia estados de otro módulo sin una acción de dominio real;
- muestra “Relacionado con” mediante chips navegables;
- conserva fuente y auditoría.

### 10.2 Enlaces prioritarios

- **Objetivos ↔ Gimnasio**: una meta vinculada a calorías, agua, peso, entrenamiento o descanso alimenta el indicador de adherencia; completar un objetivo no relacionado no altera Gym.
- **Aprendizaje ↔ SOMA**: una actividad o evidencia puede vincularse a un cliente, entrega o capacidad comercial.
- **Contenido ↔ ALVENTO**: una pieza puede pertenecer a un drop o campaña.
- **Libros ↔ Aprendizaje**: un libro puede apoyar una habilidad o nivel.
- **Vision Board ↔ Objetivos**: una meta visual puede enlazar objetivos medibles.
- **Granja ↔ Finanzas**: compras y ventas usan el libro mayor central con idempotencia.
- **Todos ↔ Inicio**: Inicio deriva señales; no mantiene copias.

### 10.3 Actividad derivada

Crea un `activityFeed` derivado o recalculable. No escribas una segunda copia de cada operación solo para Inicio. Cada entrada indica origen, fecha, acción y vínculo.

Si es necesaria una migración de esquema, hazla de la versión real a la siguiente versión disponible; no asumas ciegamente un número. Debe ser idempotente, respaldada y reversible.

---

## 11. ESENCIA VISUAL Y MEJORAS POR MÓDULO

### 11.1 Finanzas

Identidad: azul cobalto, esmeralda, superficies bancarias premium.

- Conserva movimientos, pagos, préstamos, periodos, filtros y pad numérico.
- En móvil, la tarjeta debe mantener forma bancaria rectangular con `aspect-ratio: 1.586 / 1`, `width: 100%`, `min-height: 0` y ocupar toda la fila.
- Anima el saldo al entrar desde su valor anterior al valor real, sin simular números.
- Añade flujo de efectivo, composición de gasto y tendencia por periodo con Chart.js.
- Si no hay datos, muestra un estado útil; no dibujes curvas falsas.
- Las categorías pueden usar icono y color accesible.
- Registrar dinero abre primero el pad; concepto, categoría y detalles aparecen después.
- Mantén un solo libro mayor para Personal, SOMA, Granja y ALVENTO.

### 11.2 Gimnasio

Identidad: grafito, cian, violeta y azul de fuerza; mapa corporal protagonista.

DALI no ejecuta rutinas. Symmetry sigue siendo la app de entrenamiento. DALI analiza estadísticas importadas.

- Conserva importación JSON, historial, mapa corporal, rangos importados y métricas.
- Elimina/oculta del flujo principal cualquier creador de rutinas, temporizador o botón “Entrenar”. No borres legado.
- Héroe con silueta corporal SVG frontal/posterior y zonas de calor basadas en series importadas.
- Gráficas reales de:
  - volumen reportado;
  - duración;
  - series;
  - sesiones por semana;
  - peso corporal;
  - distribución muscular;
  - constancia DALI.
- Valores personales editables: peso, altura, meta calórica, agua y otros ya soportados. No inventes los que falten.
- Una meta de calorías vinculada desde Objetivos puede mostrar adherencia en Gym.
- Los rangos de Symmetry solo se muestran si fueron importados; nunca calcules su fórmula.
- Mantén los nombres de rango existentes del proyecto y badges originales DALI.
- CTA principal: “Importar entrenamiento JSON”.
- El detalle de una sesión debe sentirse como expediente deportivo, no como formulario administrativo.

### 11.3 Objetivos

Identidad: anillos de progreso, horizontes temporales y sensación de avance.

- Conserva diarios, semanales, mensuales y anuales.
- Usa una línea temporal por horizonte y anillos con porcentajes reales.
- Completar una meta produce feedback elegante, no confeti excesivo.
- Permite “Relacionado con” y muestra el efecto en módulos enlazados.
- Reinicios recurrentes conservan historial; no destruyas evidencia.
- El formulario empieza con título + horizonte; recurrencia, relación y detalles se abren después.

### 11.4 SOMA

Identidad: medianoche, ciruela y borgoña; relaciones, entregas y flujo de valor.

- Conserva clientes, pagos/abonos, pendientes, notas, WhatsApp y entregables.
- Héroe de pipeline con clientes activos, cobro pendiente y próxima entrega.
- Tarjetas de cliente con fase, progreso de pagos, pendientes y última interacción.
- Botón Contactar abre `wa.me` con teléfono normalizado; no afirmes que existe una API empresarial si solo es enlace.
- Vista cronológica de relación y entregables.
- Actividades de Aprendizaje pueden vincularse a habilidades aplicadas en SOMA.

### 11.5 Aprendizaje

Identidad: violeta, azul y constelación neuronal.

- Conserva la ruta de Fundamentos → Básico → Aplicación → Intermedio → Avanzado → Dominio → Proyecto final.
- Convierte la lista plana en mapa de etapas o constelación, sin perder la vista lista accesible.
- Progreso ponderado real y porcentaje claro.
- Importar ruta JSON sigue siendo una acción principal.
- Cada actividad puede adjuntar evidencia, sesión de estudio y vínculo con un proyecto real.
- SOMA puede mostrar qué habilidad lo apoya; no deduzcas conexiones sin confirmación.

### 11.6 Bitácora personal

Identidad: calmada, íntima, degradados desenfocados y papel digital.

- Entrada por voz/texto y desglose estructurado.
- Calendario de días con estado de ánimo/productividad real.
- Vista día con Personal, Trabajo, Gym, Aprendizaje y Lecciones si esos datos existen.
- Microanimación de escritura/onda de voz solo mientras graba o procesa.
- No analices salud mental ni diagnostiques.
- Mantén fotos privadas y exportables si el sistema ya las admite.

### 11.7 Libros

Identidad: marfil cálido, ámbar y azul noche; biblioteca digital con profundidad.

La pantalla actual no debe abrir un formulario de catorce campos.

Nuevo flujo “Agregar libro”:

1. **Primero**: tomar/subir foto de portada o continuar sin foto.
2. **Datos rápidos**: título, autor opcional y estado mediante tarjetas:
   - Quiero comprar;
   - Por leer;
   - Leyendo;
   - Terminado;
   - Pausado.
3. **Después**: opinión breve o “Lo que me dejó”.
4. **Más detalles** colapsado: fechas, páginas, rating, etiquetas, compra, precio, ISBN u otros campos existentes.

Vistas:

- estantería visual con portadas;
- lectura actual;
- terminados;
- lista de compras;
- estadísticas reales por año/mes;
- búsqueda y filtros;
- estado vacío ilustrado.

Una portada puede vincularse a Aprendizaje. No descargues portadas de Internet sin permiso; usa la imagen subida o un placeholder original.

### 11.8 ALVENTO

Identidad: negro, marfil, acero, editorial de moda.

- Conserva drops, productos, prendas, ventas, fechas y cuenta regresiva.
- Héroe full-bleed con fotografía de modelos subida por el usuario.
- Overlay oscuro legible y desenfoque/gradiente adaptativo.
- La imagen debe poder cambiarse, recortarse, reposicionarse y eliminarse.
- Nunca hardcodees una URL temporal ni incrustes un asset ajeno.
- Muestra próximo drop, días restantes, estado, prendas, ventas y stock.
- Vista por drops con timeline editorial.
- Contenido puede vincular videos/campañas a un drop.
- Finanzas se filtra por `businessUnit: alvento`; no dupliques el libro mayor.

### 11.9 Contenido

Identidad: violeta/magenta/cian, estudio creativo y storyboard.

- Sustituye el rectángulo vacío por un hero/estado vacío tipo estudio con cámara, timeline y fotogramas originales.
- Organiza ideas en pipeline: Idea → Investigación → Guion → Grabación → Edición → Programado → Publicado.
- Permite Shorts/Reels/TikTok, video largo y episodio de serie.
- Vista Kanban en escritorio y tarjetas apiladas en móvil.
- Detalle con hook, objetivo, escenas, planos, guion, CTA, plataforma y resultados.
- Timeline visual para escenas.
- Contadores de frecuencia solo a partir de contenido registrado.
- Enlace opcional con ALVENTO, SOMA, aprendizaje o una serie.

### 11.10 Vision Board

Identidad: cinematográfica, imágenes a gran formato, luz y profundidad.

- Conserva subida de fotos.
- Mejora “Agregar meta visual” con upload/drag-and-drop, preview y recorte.
- Masonry responsive con gradientes legibles.
- Focus mode inmersivo: imagen, por qué importa, fecha objetivo, progreso y objetivos vinculados.
- Frases motivadoras curadas y no culpabilizadoras.
- No uses imágenes genéricas si el usuario ya subió una real.

### 11.11 Subir

Identidad: portal de datos, líneas de escaneo y validación visual.

- Conserva preview, validación, deduplicación, confirmación, atomicidad y resultado descargable.
- Divide el flujo en Pegar/subir → Analizar → Revisar cambios → Confirmar → Resultado.
- Anima el “escaneo” sin fingir que algo sigue procesando cuando ya terminó.
- Muestra altas, actualizaciones, duplicados, advertencias y rechazos.
- Nunca evalúes ni ejecutes el JSON.

### 11.12 Perfil y Configuración

Identidad más calmada y personal.

- Foto de perfil grande al centro con editor y fallback inicial.
- Preserva datos actuales: nombre, edad, cumpleaños, ubicación, institución, intereses, proyectos y preferencias.
- No inventes datos vacíos.
- Perfil muestra estadísticas reales agregadas.
- Configuración incluye:
  - tema;
  - intensidad de movimiento: Completa / Sutil / Reducida;
  - reproducir entrada Welcome Boss;
  - personalizar Inicio;
  - exportar/importar respaldo;
  - privacidad y almacenamiento;
  - datos del reloj y zona horaria.

---

## 12. GRANJA — REDISEÑO PROFUNDO Y FUNCIONAL

Este es el módulo prioritario de la actualización. Debe quedar radicalmente mejor sin perder el dominio técnico ya construido.

### 12.1 Alcance

Por ahora la interfaz es **100% para cerdos**. No muestres otras especies ni un selector que estorbe. La estructura interna puede conservar `species: "pig"` para una futura ampliación.

Conserva y prueba:

- animales y aretes;
- ciclo reproductivo basado en eventos;
- celo;
- servicio/monta;
- revisión de gestación;
- gestación confirmada;
- preparto;
- parto y camada;
- lactancia;
- destete;
- salud;
- pendientes/calendario;
- alimento, precios, inventario y movimientos;
- rentabilidad/rendimiento;
- vínculos con Finanzas;
- importación/exportación;
- idempotencia;
- borrado lógico.

No regreses al error “monta = gestación”. El estado se deriva de eventos y una revisión positiva confirma gestación. El tiempo por sí solo nunca cambia un estado clínico o reproductivo.

### 12.2 Identidad visual

Usa verde esmeralda, azul profundo, tonos tierra muy discretos y cian de datos. Crea una estética de “rancho inteligente”:

- silueta original de cerdo/reproductora en SVG o ilustración propia;
- líneas de seguimiento y etiquetas tipo arete;
- gráficos de ciclo y alimentación;
- textura de topografía o parcelas a baja opacidad;
- no uses caricaturas infantiles;
- no copies el fondo negro/neón de GranjaControl;
- debe sentirse nativo de DALI.

### 12.3 Héroe de Granja

La parte superior debe contestar inmediatamente:

- cuántos cerdos activos hay;
- cuántas reproductoras están vacías, en celo, servidas, en gestación, preparto y lactancia;
- cuál es el siguiente evento importante;
- cuántos días de alimento hay;
- si existe un riesgo de capacidad de maternidad;
- qué requiere atención hoy.

Visual sugerido: silueta lateral de una reproductora con anillos o nodos alrededor; cada nodo representa una etapa real y se ilumina con el conteo actual. En móvil se transforma en una banda horizontal compacta.

No muestres cero gigantes repetidos si todavía no hay animales. Presenta una bienvenida útil con “Agregar primer cerdo” y “Importar registros”.

### 12.4 Navegación interna

Reorganiza visualmente las nueve vistas actuales:

1. Resumen
2. Cerdos
3. Reproducción
4. Camadas
5. **Comida** — etiqueta visible; internamente puede conservar módulos `feed`
6. Agenda
7. Salud
8. Rendimiento
9. Ajustes

En escritorio usa un rail/selector con icono, nombre, pequeño contador o estado. En móvil usa una tira horizontal desplazable con snap o un selector visual. No dejes nueve botones rectangulares pequeños sin jerarquía.

### 12.5 Tarjetas de animales

Cada tarjeta debe parecer un expediente vivo:

- arete muy visible;
- foto o silueta;
- nombre opcional;
- función en español;
- estado reproductivo;
- anillo/barra de progreso de etapa;
- día actual y fecha próxima;
- última observación;
- alerta de salud si existe;
- una acción primaria contextual;
- menú de acciones secundarias.

Hover/focus: elevación mínima, borde luminoso y revelado de acciones. Móvil: controles siempre accesibles, sin depender del hover.

No sobrecargues la tarjeta con todo el historial. El clic abre un panel de detalle con timeline de eventos.

### 12.6 Agregar cerdo — flujo simplificado

No muestres todos los campos de golpe.

**Paso 1 — Identidad**

- Arete/identificador, obligatorio.
- Tipo mediante tarjetas ilustradas:
  - Reproductora;
  - Primeriza;
  - Semental;
  - Lechón;
  - Iniciación/destete;
  - Crecimiento;
  - Desarrollo;
  - Engorda;
  - Otro.
- Sexo derivado cuando sea inequívoco, pero editable si corresponde.

**Paso 2 — Opcional**

- nombre;
- foto;
- fecha de nacimiento exacta/aproximada/desconocida;
- origen;
- corral/ubicación.

**Paso 3 — Más detalles**

- adquisición y costo;
- madre/padre;
- peso;
- notas.

No pidas “estado reproductivo” al crear. Se deriva de los eventos. Permite guardar después del paso 1.

### 12.7 Acciones reproductivas

Convierte las acciones válidas por estado en botones grandes, visuales y claros:

- Registrar celo;
- Montar / Servir;
- Registrar revisión;
- Repetición de celo;
- Parir;
- Destetar;
- Nota;
- Salud;
- Vender.

Los eventos actuales y reglas del dominio mandan. No reimplementes la lógica en listeners del DOM.

Muestra de forma visual:

- ventana 18–24 días tras servicio para retorno a celo;
- centro de referencia día 21;
- gestación estimada de 114 días;
- preparto configurable, referencia 7 días;
- destete objetivo configurable, referencia 35 días;
- posdestete 3–7 días como ventana informativa.

Todo lo estimado lleva esa palabra. Ninguna alerta cambia el estado sola.

### 12.8 Salud — formulario visual

Mantén el registro operativo y elimina la sensación de tabla genérica.

Flujo:

1. Seleccionar animal mediante búsqueda y tarjetas por arete.
2. Seleccionar observaciones con chips:
   - Apetito;
   - Respiración;
   - Digestivo;
   - Movilidad;
   - Piel;
   - Lesión;
   - Reproducción;
   - Otro.
3. Nivel operativo: observación / requiere seguimiento / urgente, sin diagnóstico automático.
4. Silueta opcional para señalar zona del cuerpo.
5. Descripción, fecha y foto opcional.
6. “Seguimiento profesional” colapsado:
   - profesional;
   - indicación capturada por el usuario;
   - producto/medicina;
   - fecha siguiente;
   - notas.

Texto visible: “DALI organiza observaciones y seguimientos; no sustituye la evaluación veterinaria.” No prescribas medicamentos ni dosis.

### 12.9 Camadas, agenda y rendimiento

- Camadas: tarjetas con madre, padre si existe, parto, nacidos, vivos, bajas, destetados y tareas.
- Agenda: timeline/carril temporal con lista accesible; real vs estimado diferenciados.
- Rendimiento: gráficas con periodo y muestra; nacidos vivos, destetados, supervivencia, repeticiones, intervalo, alimento y margen solo cuando existan datos.
- Ranking de reproductoras: tabla/visual comparativo con tamaño de muestra y “Datos insuficientes”; no recomiendes vender automáticamente.
- Capacidad de maternidad configurable; referencia histórica: tres espacios. Muestra traslapes previstos, no reprogrames eventos.

### 12.10 Ajustes

Sustituye cualquier textarea de JSON para hitos o protocolos por un editor visual de filas:

- nombre;
- día relativo;
- activo/inactivo;
- categoría;
- nota;
- reordenar;
- eliminar con confirmación.

El JSON puede existir internamente y en exportación, pero no como interfaz normal.

---

## 13. GRANJA → COMIDA: CALCULADOR, INVENTARIO Y PRECIOS

La pestaña visible se llamará **Comida** y el subtítulo puede ser **Alimento e inventario**.

Conserva el motor actual en gramos y centavos, FIFO, precios históricos y movimientos append-only. No lo sustituyas por un cálculo aproximado visual.

### 13.1 Objetivo de la pantalla

Responder en segundos:

- cuánto alimento se necesita hoy;
- cuánto se requiere en 7 días, 15 días, mes calendario o rango personalizado;
- qué etapas lo consumen;
- qué productos se usarán;
- cuánto inventario hay;
- cuántos costales enteros comprar;
- cuánto dinero saldrá;
- cuánto alimento quedará;
- cuándo será la próxima compra.

### 13.2 Composición visual

1. **Visual de etapas**: anillo o barras con número real de animales en gestación, lactancia, vacías, crecimiento, engorda, etc.
2. **Selector de periodo**: 7 días / 15 días / Mes real / Personalizado.
3. **KPIs**: kg/día, kg del periodo, costales, compra, costo consumido, inventario final y cobertura.
4. **Gráfica apilada**: consumo por etapa/producto a lo largo del periodo.
5. **Lista “Qué comprar”** con botón Copiar.
6. **Inventario** por producto/lote.
7. **Precios** con estado Pendiente / Confirmado / Revisión especial.
8. **Historial** de compra, consumo, merma y ajuste.
9. **Planeado vs real** cuando exista evidencia suficiente.

### 13.3 Reglas de cálculo

- Determina la etapa de cada animal en cada día del periodo.
- Segmenta si cambia de etapa dentro del rango.
- Usa raciones confirmadas por el usuario, etiqueta o profesional.
- Si falta una regla, muestra “Configuración incompleta” y animales/etapas excluidos; no uses cero silenciosamente.
- Calcula por producto separado.
- Descuenta inventario antes de redondear costales.
- Arrastra sobrante al periodo siguiente.
- Distingue costo consumido de desembolso de compra.
- Dinero en centavos enteros.
- Cantidades en gramos enteros.
- Costal predeterminado 40 kg, pero editable por producto.
- Colchón de seguridad visible y 0% por defecto.
- Mes calendario usa 28/29/30/31 días reales.

Fórmulas que deben conservarse/probarse:

```text
dailyRequiredG(day) = suma de la ración aplicable a cada animal activo ese día
periodConsumptionG = suma de dailyRequiredG de cada día
grossRequiredG = round(periodConsumptionG × (1 + safetyBufferPercent / 100))
usableStockG = inventario disponible utilizable
netToBuyG = max(0, grossRequiredG - usableStockG)
bagsToBuy = ceil(netToBuyG / bagWeightG)
purchaseG = bagsToBuy × bagWeightG
purchaseCostCents = bagsToBuy × pricePerBagCents
consumptionCostCents = round(periodConsumptionG × pricePerBagCents / bagWeightG)
projectedEndingStockG = usableStockG + purchaseG - periodConsumptionG
daysOfCoverage = usableStockG / currentDailyRequiredG
```

### 13.4 Control histórico de ejemplo, no recomendación

Mantén un test aislado:

```text
18 reproductoras × 2.75 kg/día × 15 días = 742.5 kg
ceil(742.5 / 40) = 19 costales
19 × $288 = $5,472 MXN
sobrante proyectado = 17.5 kg
```

La tasa 2.75 kg/día es una aproximación histórica para prueba/calibración, **no una recomendación nutricional**, y no debe sembrarse como regla confirmada sin acción expresa.

### 13.5 Catálogo MAFORNU ya existente — conservar

Mantén las referencias actuales como `reference_needs_confirmation`, inactivas hasta confirmación:

| Línea | Producto | Presentación | Precio MXN |
|---|---|---:|---:|
| Tradicional harina | Iniciación cerdos | 40 kg | 335 |
| Tradicional harina | Crecimiento cerdos | 40 kg | 320 |
| Tradicional harina | Desarrollo cerdos | 40 kg | 309 |
| Tradicional harina | Engorda cerdos | 40 kg | 303 |
| Tradicional harina | Engorda cerdos Racto | 40 kg | 319 |
| Tradicional harina | Reproductora gestación N | 40 kg | 288 |
| Tradicional harina | Reproductora lactancia | 40 kg | 349 |
| Hi-Magra harina | Iniciación cerdos Hi-Magra | 40 kg | 354 |
| Hi-Magra harina | Crecimiento cerdos Hi-Magra | 40 kg | 325 |
| Hi-Magra harina | Engorda cerdos Racto Hi-Magra | 40 kg | 331 |
| Hi-Magra harina | Reproductora gestación Hi-Magra | 40 kg | 301 |
| Hi-Magra harina | Reproductora lactancia Hi-Magra | 40 kg | 367 |
| Pellet | Iniciación cerdos MPG AVI | 40 kg | 294 |
| Pellet | Engorda cerdos MPG AVI | 40 kg | 241 |

Conserva historial de precio y la fuente. No cambies silenciosamente $349 aunque la foto pueda parecer ambigua; es el valor aprobado en el proyecto actual hasta que el usuario lo edite.

### 13.6 Nuevas referencias de la fotografía del 16/09/2026

Añade estas entradas al catálogo como **inactivas, pendientes de confirmación y no asignadas a una ración**. No dupliques si ya existen; usa claves deterministas o deduplicación normalizada. Fecha de observación: `2026-09-16`.

| Categoría | Producto | Presentación | Precio MXN |
|---|---|---:|---:|
| Preiniciador | PIGGO F1 “K” | 25 kg | 662 |
| Preiniciador | PIGGO F2 “F” | 25 kg | 562 |
| Preiniciador | PIGGO F3 “K” | 25 kg | 507 |
| Materia prima | Maíz grano amarillo | 40 kg | 310 |
| Materia prima | Maíz grano blanco | 40 kg | 310 |
| Materia prima | Maíz molido amarillo | 40 kg | 310 |
| Materia prima | Maíz quebrado amarillo | 40 kg | 310 |
| Materia prima | Pasta de canola | 40 kg | 306 |
| Materia prima | Pasta de soya | 40 kg | 420 |
| Materia prima | Salvado de trigo | 25 kg | 196 |
| Materia prima | Sorgo en grano | 40 kg | 295 |
| Materia prima | Sorgo molido | 40 kg | 295 |
| Materia prima | Trigo en grano | 40 kg | 386 |
| Mineral/sustituto | Palmalife | 25 kg | 775 |
| Mineral | Suplemento mineral estándar con fósforo | 25 kg | 285 |
| Mineral | Suplemento mineral para engorda con monensina | 20 kg | 240 |

Reglas:

- `status: "reference_needs_confirmation"`;
- `source: "photo_price_board"`;
- calcula precio/kg, no lo captures como fuente primaria;
- no incluyas alimentos para perro, gato, gallos, conejos, bovinos ni otros productos que no correspondan al alcance porcino;
- no formules dietas a partir de materias primas;
- no sugieras sustituciones;
- no actives productos Racto ni con monensina;
- márcalos `requires_compliance_review: true`;
- la ortografía de “monensina” debe poder corregirse en revisión si la etiqueta física dice otra cosa;
- una confirmación crea nuevo historial de precio, no sobrescribe compras pasadas.

### 13.7 Registrar compra

Flujo visual:

1. seleccionar producto por tarjeta;
2. elegir costales y fecha;
3. mostrar kg, precio por costal, precio/kg y total;
4. indicar lote/vencimiento opcional;
5. preguntar si se crea el gasto central en Finanzas;
6. mostrar resumen;
7. confirmar una sola vez.

Debe crear movimiento/lote e, idealmente confirmado, una única transacción con `businessUnit: "granja"`, origen e `idempotencyKey`. Doble clic o reintento no duplica inventario ni gasto.

---

## 14. IMÁGENES Y RECURSOS VISUALES

### 14.1 Política de imágenes

- Prioriza fotos del usuario en Perfil, ALVENTO, Libros y Vision Board.
- Procesa imágenes mediante el `MediaStore`/IndexedDB ya existente.
- Mantén límites, compresión, miniaturas y exportación actuales.
- No uses URLs temporales como almacenamiento permanente.
- No incrustes base64 gigantes dentro del store principal.
- Añade `alt` o texto equivalente cuando la imagen comunique información.

### 14.2 Recursos originales que puedes crear

Si tu entorno puede generar imágenes, crea recursos originales coherentes, sin logos ajenos:

- fondo abstracto DALI/Inicio con núcleo de energía;
- ilustración elegante de cerdo para Granja;
- composición de biblioteca para estados vacíos;
- cámara/storyboard para Contenido;
- texturas de módulo discretas.

Guárdalos localmente en una carpeta organizada como `assets/visuals/` y optimiza a WebP/AVIF con fallback cuando corresponda.

Para los elementos que deben responder a datos —mapa corporal, ciclo porcino, gráficas— usa SVG/Canvas/HTML, no una imagen raster estática.

### 14.3 ALVENTO

Si no se adjunta una foto de modelos, construye el componente y un placeholder editorial original, pero deja claro “Añade tu foto de campaña”. No inventes modelos que aparenten ser una campaña real de la marca.

---

## 15. RESPONSIVE: MÓVIL Y COMPUTADORA SON PRIMERA CLASE

Verifica al menos:

- 360 × 800;
- 390 × 844;
- 430 × 932;
- 768 × 1024;
- 1024 × 768;
- 1440 × 900;
- 1920 × 1080;
- la resolución amplia de las capturas adjuntas.

Requisitos:

- sin scroll horizontal;
- sin texto cortado;
- sin CTAs tapados por la navegación inferior;
- safe-area móvil;
- targets táctiles mínimos 44 × 44 px;
- tablas transformadas en tarjetas/listas en móvil;
- héroes reconfigurados, no solo encogidos;
- reloj legible;
- modales cómodos;
- tarjeta financiera rectangular;
- Canvas dimensionado con `devicePixelRatio` y redimensionamiento seguro;
- gráficas con contenedor propio y leyendas adaptables.

El usuario prioriza mucho la calidad visual y tiene dispositivos capaces. Aun así, no aceptes fugas de memoria, loops duplicados, bloqueos, batería drenada o animaciones que hagan ilegible la interfaz.

---

## 16. ACCESIBILIDAD, PRIVACIDAD Y SEGURIDAD

- WCAG AA en contraste, foco y navegación.
- Foco visible con estética DALI.
- Landmarks, headings y orden de lectura correctos.
- Botones reales, no `div` clicables sin semántica.
- Tooltips accesibles.
- No depender solo de color, hover o movimiento.
- Toda visualización tiene resumen textual o lista equivalente.
- `prefers-reduced-motion` y selector manual.
- Escapa contenido del usuario; no uses `innerHTML` inseguro.
- Valida URLs, archivos, tipos, tamaños y JSON.
- No uses `eval`, `Function` ni ejecución de contenido importado.
- No hagas llamadas externas silenciosas.
- No expongas información privada al publicar demos.
- LocalStorage no debe describirse como autenticación segura.
- Salud animal es registro, no diagnóstico.

---

## 17. MIGRACIÓN Y PROTECCIÓN DE DATOS

Si añades `entityLinks`, preferencias visuales, fondos o nuevos precios:

1. detecta la versión actual;
2. respalda;
3. migra sobre una copia;
4. valida referencias y tipos;
5. confirma de forma atómica;
6. conserva campos desconocidos;
7. no repite migración;
8. no siembra registros ficticios;
9. genera reporte si algo requiere revisión;
10. rollback si falla.

Las nuevas preferencias visuales deben tener defaults seguros y no necesitar migrar cada registro.

Los nuevos precios se deduplican y permanecen inactivos. No conviertas una referencia de foto en una compra.

---

## 18. ORDEN DE IMPLEMENTACIÓN

Trabaja en este orden sin abandonar las fases posteriores:

### Fase 1 — Base visual global

- tokens;
- componentes;
- header y reloj;
- movimiento;
- modal/bottom sheet;
- formularios progresivos;
- estados vacíos;
- Chart.js/GSAP con fallback;
- tema claro/oscuro.

### Fase 2 — Inicio

- Welcome Boss;
- visual JARVIS original;
- briefing y widgets conectados;
- actividad derivada.

### Fase 3 — Granja prioritaria

- shell y navegación;
- tarjetas;
- alta simplificada;
- reproducción;
- salud;
- Comida;
- precios nuevos;
- gráficas y rendimiento;
- tests.

### Fase 4 — Módulos restantes

- Finanzas;
- Gimnasio;
- Objetivos;
- SOMA;
- Aprendizaje;
- Bitácora;
- Libros;
- ALVENTO;
- Contenido;
- Vision Board;
- Subir;
- Perfil/Configuración.

### Fase 5 — Conexiones y QA

- entityLinks;
- actividad;
- responsive;
- accesibilidad;
- temas;
- migraciones;
- regresión completa.

No declares “terminado” después de Fase 1 o Fase 3. Si existe un límite real de ejecución, deja el proyecto compilable/usable, documenta exactamente lo implementado y continúa en la siguiente respuesta desde una lista de trabajo concreta; no reemplaces lo pendiente con promesas vagas.

---

## 19. PRUEBAS OBLIGATORIAS

Conserva y ejecuta todas las pruebas existentes. Añade pruebas deterministas para lo nuevo.

### 19.1 Datos y regresión

- Migrar dos veces da el mismo resultado.
- El estado anterior sobrevive a un fallo de migración.
- Exportar/importar conserva medios y relaciones según las capacidades actuales.
- No desaparece ningún módulo.
- No se duplican registros por doble clic.
- No hay errores de consola al recorrer todas las rutas.

### 19.2 Movimiento y navegación

- Welcome Boss se muestra una vez por sesión.
- Omitir funciona.
- Repetir desde Configuración funciona.
- Movimiento reducido desactiva lo no esencial.
- Navegar repetidamente no multiplica RAF, timelines, listeners ni Charts.
- Fallo de GSAP/Chart.js conserva una interfaz utilizable.

### 19.3 Reloj

- Formato 12 horas.
- `America/Mexico_City` aunque el dispositivo use otra zona.
- Fecha española correcta.
- No crea un timer duplicado por cada render.

### 19.4 Formularios

- Registro rápido guarda con mínimos válidos.
- Más detalles conserva información.
- Atrás no borra valores.
- Error no cierra ni vacía el formulario.
- Teclado y lector de pantalla pueden completar el flujo.

### 19.5 Granja

- Estado derivado y eventos siguen correctos.
- Monta no confirma gestación.
- Revisión positiva sí confirma.
- Parto/destete idempotentes.
- Etiquetas internas nunca aparecen en inglés.
- Alta rápida no exige datos desconocidos.
- Salud no diagnostica.
- Timeline y botones contextuales reflejan el estado real.

### 19.6 Comida

- Casos actuales del motor siguen pasando.
- 18 × 2.75 × 15 produce 742.5 kg, 19 costales, $5,472 y 17.5 kg de sobrante bajo los supuestos del test.
- Inventario se descuenta antes de costales.
- Mes calendario usa días reales.
- Etapas mixtas se segmentan.
- Productos no se mezclan.
- Falta de ración muestra cálculo incompleto.
- Nuevas referencias no quedan activas.
- Racto y monensina requieren revisión.
- Registrar compra dos veces no duplica inventario ni Finanzas.

### 19.7 Responsive y visual

- Prueba todos los anchos definidos.
- Tema oscuro y claro.
- Scroll, safe-area, foco, modales y navegación.
- Tarjeta financiera rectangular.
- Capturas de QA por cada módulo en escritorio y móvil.
- Revisa estados: vacío, con pocos datos, con muchos datos, error, carga y contenido largo.

---

## 20. CRITERIOS DE ACEPTACIÓN VISUAL

La tarea no está terminada si ocurre cualquiera de estos casos:

- Inicio sigue siendo solo una cuadrícula de tarjetas idénticas.
- Granja sigue mostrando nueve botones rectangulares secos y un panel vacío gigante.
- “Agregar animal” enseña todos los campos simultáneamente.
- Salud sigue siendo una tabla/formulario genérico sin controles visuales.
- Libros muestra un formulario largo al primer clic.
- Contenido conserva el rectángulo vacío actual.
- ALVENTO no permite una imagen real de campaña.
- El reloj solo aparece pequeño en Inicio o usa 24 horas.
- Las gráficas contienen datos falsos.
- Las animaciones se repiten molestas en cada navegación.
- En móvil se rompe el layout.
- Se alteran o pierden datos.
- Algún módulo parece otra aplicación pegada.
- Se presenta como sistema operativo.

La tarea sí está terminada cuando:

- DALI se siente vivo desde el primer segundo;
- Inicio tiene un momento cinematográfico breve y un briefing útil;
- todos los módulos comparten un sistema sólido;
- cada sección conserva su esencia;
- las acciones de uso frecuente son rápidas y visuales;
- Granja es agradable, clara y operativamente confiable;
- Comida responde cuánto comprar sin inventar raciones;
- el proyecto sigue siendo local-first y seguro;
- las pruebas y QA están documentados.

---

## 21. ENTREGA FINAL OBLIGATORIA

Entrega:

1. ZIP completo actualizado.
2. `README.md` actualizado con ejecución y estructura.
3. `CHANGELOG_DALI_V4.md` con archivos y funciones modificadas.
4. `DESIGN_SYSTEM.md` con tokens, componentes, motion y personalidad por módulo.
5. `MIGRATION_REPORT.md` con versión origen/destino, colecciones y comprobaciones.
6. `TEST_REPORT.md` con comandos/procedimiento, número de pruebas y resultado.
7. `SUPABASE_READINESS.md` opcional, solo planificación futura.
8. Capturas de QA de Inicio, Granja/Comida, Gym, Libros, ALVENTO y Contenido en móvil y escritorio.
9. Inventario de assets nuevos y su licencia/origen.

En el mensaje final informa de manera concreta:

- qué cambiaste;
- qué preservaste;
- qué migración se ejecutó;
- cuántas pruebas pasaron;
- qué supuestos quedaron pendientes de confirmación;
- cómo abrir el proyecto;
- enlace al ZIP.

No afirmes que Supabase, IA, WhatsApp API, Symmetry, redes sociales o hosting están conectados si no existe una integración verificada.

---

## 22. REFERENCIAS TÉCNICAS Y DE DIRECCIÓN

Usa estas fuentes como orientación, no como plantillas para copiar:

- GSAP para secuencias e interacción: https://gsap.com/
- View Transition API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Movimiento reducido: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- `Intl.DateTimeFormat`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- Chart.js: https://www.chartjs.org/
- Patrón de preguntas/formularios progresivos: https://design-system.service.gov.uk/patterns/question-pages/
- WCAG, animación por interacción: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- Linear y Raycast únicamente como referencia de jerarquía, densidad y pulido; no copies su marca ni layout: https://linear.app/ y https://www.raycast.com/

---

## 23. ORDEN FINAL

Inspecciona el proyecto real, protege los datos, implementa este rediseño completo y comprueba cada flujo. No reemplaces funcionalidad por imágenes, no conviertas DALI en un sistema operativo y no entregues otra beta visual sin lógica.

Quiero una página web CRM personal extraordinaria: una herramienta que pueda abrir todos los días, entender en segundos y disfrutar al usar. Conserva el cerebro que DALI ya tiene y construye por fin la experiencia visual que merece.

**Empieza ahora por auditar el ZIP, ejecutar las pruebas y trabajar directamente sobre sus archivos.**
