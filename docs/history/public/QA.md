# QA · EVIE CRM V2

## Phase 3 · 19/09/2026

Verificación del código compartido: 177 pruebas heredadas, 22 Node, 20 de Agenda/fallback web; 13 comprobaciones Electron desde código y 13 desde paquete Linux, con micrófono sintético. Matriz de 1.152 layouts sin incidencias, teclado/foco y zoom CSS 200 % comprobados. Se añaden 8 comprobaciones de gráficos WebGL, pausa y fallback. Consultar fechas y límites en evidence/ del repositorio.

La aceptación de voz física, Whisper/Ollama/SAPI reales, Acrylic y Squirrel corresponde a docs/WINDOWS_ACCEPTANCE.md. No hay instalador Windows certificado ni producción.

## Resultado histórico · 18/09/2026

**177 pruebas funcionales correctas, 0 fallos y 0 errores de consola**. Matriz Playwright: **1.152 comprobaciones, 0 incidencias**, nueve anchuras de 360 a 1920 px, ambos temas y cuatro modos de movimiento sobre 16 rutas. Se generaron 51 capturas. Verificados Enter/Escape y restauración del foco; zoom CSS 200 % de Inicio móvil sin desbordamiento.

Corregida la transición del margen lateral que provocaba overflow al pasar de escritorio a móvil. Ejecutores con código de salida de error ante pruebas, consola o layout fallidos. Evidencias: `evidence/final-suite.json` y `evidence/visual-matrix.json` en el repositorio; alcance preciso en `TEST_REPORT.md`.

No certifica todos los requisitos, diálogos, datos largos, accesibilidad completa, zoom nativo, voz real ni servicios externos. Sin despliegue. Las cifras inferiores son evidencia histórica.

## Resultado histórico del incremento RC
**147 pruebas correctas, 0 fallos**, ejecución completa en 38,09 s, sin errores de consola registrados. Conserva las 97 anteriores y añade Core, Forms, Insights y Modules. ZIP, restauración y recarga comparan también Agenda, vínculos, nutrición, despensa y compras. No certifica el Prompt FINAL completo. Evidencias recientes, fallos intermedios corregidos y límites en la sección vigente de `RC_REPORT.md` y `TEST_REPORT.md`.

Capturas y límites vigentes en `TEST_REPORT.md` y `RC_REPORT.md`: Agenda, Bitácora y Nutrición en 390/1280 px, Subir en móvil y modal Contexto en móvil/escritorio. Los lanzadores QA usan la aplicación real con almacenes separados. No hay pruebas certificadas de todos los anchos, lectores de pantalla o zoom.

Referencia Neural anterior al esquema 4: 77/0. No se ha desplegado nada.

Lo que sigue conserva la referencia histórica de Granja v3.

## Ejecución histórica v3

`tests.html`, navegador headless, aplicación real con clave QA aleatoria: **59 pruebas correctas, 0 fallos**, sin errores de consola (51,59 s). Ninguna prueba modifica el almacén personal. Las 36 verificaciones base se mantienen; se actualizaron las expectativas reproductivas erróneas y el esquema esperado. Se añadieron 23 verificaciones.

### Cobertura base
Arranque y quince rutas; centavos/saldo, fechas mexicanas, recurrencias y aprendizaje; bitácora; migración/fallo sin sobrescribir original; JSON inválido, versiones, contaminación de prototipos, límites, referencias, preview sin escritura, commit, dedupe y undo protegido; abonos SOMA; Symmetry parcial y rangos; libros y cancelación de formularios; ALVENTO stock/venta/reversión; contenido, escenas y snapshots; fusión de rutas; IndexedDB, foto de perfil, temas/fichas; esquemas; exportación de código; recarga.

### Granja y alimentación
- Servicio queda pendiente, sin confirmación por tiempo. Solo revisión positiva confirma; inconclusa conserva y negativa abre. Repetición de celo registrada.
- Parto y destete idempotentes; corrección append-only y evidencia de salud conservada. No se inventa el semental Canelo.
- Caso A: 346,5 kg, 9 costales, $2.592, sobrante 13,5 kg.
- Caso B: 742,5 kg, 19 costales, $5.472, sobrante 17,5 kg.
- Caso C: 1.485 kg, 38 costales, $10.944, sobrante 35 kg.
- Caso D: comienza con 17,5 kg, compra 19 costales y conserva 35 kg.
- Caso E: dos productos, gestación/lactancia, transición prevista etiquetada e inventarios separados. Los supuestos existen solo en QA.
- Falta de regla produce configuración incompleta, override individual, meses de 28/29 días y colchón.
- FIFO entre lotes, ofrecido/sobrante/desperdicio, exclusión de reservado/caducado, rechazo de inventario insuficiente.
- Compra/gasto idempotente y precio/peso histórico de compra conservados al cambiar catálogo.
- Existencia inicial no crea gasto. Anulación de compra ajusta lote/gasto y rechaza lotes con movimientos posteriores.
- Maternidad detecta 4 ocupaciones frente a capacidad 3 sin mutar estados.
- Migración v2→v3 conservadora/repetible y copia previa real; resto del CRM preservado.
- Importación de compra: preview, commit, dedupe y undo atómico.
- Nueve vistas y cinco apartados de alimento renderizan sin texto undefined.
- Formularios reales: alta → celo → servicio → revisión; producto → ración → compra → consumo.
- ZIP de datos incluye colecciones v3 e imágenes. Restauración por su formulario real recupera Granja e IndexedDB.
- ZIP del código contiene scripts/estilos nuevos y no incluye datos personales; recarga conserva todas las colecciones de Granja.

## Revisión visual actual

Se renderizó la aplicación real, no una maqueta ni un iframe con ancho simulado. Los lanzadores preparan exclusivamente datos QA y redirigen a `index.html?qa=visual-farm#granja` o `index.html?qa=visual-feed#granja`.

| Vista | Viewport CSS | Resultado | Captura |
|---|---|---|---|
| Cerdos claro | 1280 × 800 | Tres estados y botones contextuales legibles, sin solapamientos/código expuesto | https://www.genspark.ai/api/files/s/NbMdNWP0 |
| Cerdos claro | 390 × 844 | Tarjetas apiladas, pestañas con scroll interno, sin overflow de página | https://www.genspark.ai/api/files/s/3sKmF94l |
| Alimentación oscura | 1280 × 800 | Controles, KPIs y desglose legibles | https://www.genspark.ai/api/files/s/wwtluLj7 |
| Alimentación oscura | 390 × 844 | Fechas/botón, tarjetas y desglose sin superposiciones ni overflow | https://www.genspark.ai/api/files/s/f5dZII4y |

Una captura móvil falló inicialmente por saturación del servicio; se repitió y obtuvo la captura anterior. Las capturas móviles tienen resolución física escalada, pero usan un viewport CSS de 390 px.

## Límites de esta validación

No certifica el cumplimiento de todo el documento maestro. Rendimiento multifactor, costos reales imputados y previsión avanzada siguen pendientes en CHECKLIST.md. El coste de consumo de Previsión es teórico al precio confirmado inicial; no es la valoración histórica FIFO. Se excluyen lotes no utilizables al inicio, pero no se simula su caducidad futura durante el rango.

No se ejecutaron NPM, build, lint de framework, typecheck, W3C ni pruebas en dispositivos físicos. No se ha cubierto cada diálogo en todos los anchos 360/430/768/1024/1440, Safari/Firefox reales, lector de pantalla, zoom 200%, errores de cuota ni todas las combinaciones de ZIP corrupto. No hay garantía de arranque offline ni bloqueo multiusuario.

No hubo despliegue; no existe URL de producción verificada. Todo se probó en la vista previa del proyecto.
