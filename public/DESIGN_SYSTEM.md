# Sistema visual DALI Neural · en desarrollo

## Dirección
CRM personal, no simulación de sistema operativo. Identidad propia, sin copiar marcas de ficción, GranjaControl o Symmetry. El movimiento y los gráficos acompañan registros reales; no implican telemetría ni inteligencia artificial conectada.

## Tokens y tipografía
`neural.css` añade tokens al CSS conservado: fondo claro #f3f6fb, superficie blanca, texto #14243a; oscuro #07111f / #0e1c2e / #eff5ff. Manrope para títulos y cifras, DM Sans para lectura; fallback sans-serif. Colores de módulo: azul general, esmeralda Granja, cian Gym, violeta aprendizaje/objetivos, tierra libros/bitácora y magenta contenido. Los colores no sustituyen etiquetas textuales.

## Componentes implementados
- Reloj global de 12 horas, fecha española y zona America/Mexico_City.
- Hero Inicio con núcleo CSS/Canvas original y briefing de listas reales.
- Paneles con borde tenue, radio 20 px, controles de al menos 44 px y foco visible.
- Granja con SVG original, indicadores, rail horizontal con scroll, tarjetas de animal y secundarios mediante details/summary accesible sin hover.
- Gráfico SVG de demanda teórica con tabla alternativa exacta y altura contenida; no requiere Chart.js para leer datos.
- Editor de hitos con filas, controles nativos, orden por botones y confirmación de eliminación local.
- Formularios con divulgación progresiva de campos opcionales y bottom sheet móvil. Aún no equivale a un sistema completo de wizards/borradores.

## Componentes del incremento RC
`rc.css` añade componentes usando los tokens claros/oscuros existentes, sin nueva dependencia visual:
- Agenda: tarjetas con estado textual, acciones explícitas y semana de tarjetas apiladas en móvil; tres columnas en escritorio, sin comprimir siete días.
- Bitácora: tipografía editorial, intensidades independientes con `meter`, origen/confianza en texto, listas de reflexión y tabla accesible con n y periodo. Calendario con número de entradas y marca textual, no solo color.
- Alimentación: seis tarjetas de nutrientes en tres columnas de escritorio/dos móviles; guion para consumo desconocido y meta no activa sin confirmación.
- Importación: cuatro pasos visibles, bloque de reflexión antes de confirmar y editor/preview apilados en móvil.
- Contexto: checkboxes nativos, datos sensibles excluidos y preview monoespaciada con saltos seguros y scroll interno.
- Vínculos: búsqueda explícita, listas de registros y confirmación local al retirar; no hover obligatorio.

NeuralCare conserva tarjetas radio para selección animal, chips, prioridad manual y detalles opcionales. No se interpreta como un diagnóstico ni como wizard completo.

Estas capas no completan el rediseño visual de todos los módulos. DALI Core ya está implementado en `dali-core.css/js`: paletas claras/oscuras, estados azul/ámbar/coral con texto, control semántico, menú radial/sheet y pulso esmeralda para finalización real. Canvas cachea la paleta por tema/severidad. `form-safety.css/js` aporta aviso dirty, footer y revisión; `journal-editor.js` usa cuatro pasos sin guardado implícito. `insight-charts` añade SVG con huecos, tabla/distribución y puntos focusables; no se certifican aún todos los targets táctiles de puntos densos. `module-experience` añade capas visuales sobre los renderers existentes, sin reemplazar motores. ALVENTO tiene un solo hero editorial; estantería Libros y masonry Vision usan datos reales/placeholder, no assets inventados. Evidencias y QA pendiente en RC_REPORT.

## Movimiento y limpieza
CSS como base; Canvas solo decorativo. Completa/Sutil/Reducida, prefers-reduced-motion y pausa manual. Reloj, RAF, ResizeObserver y listener de puntero se limpian al rerender. Se detiene movimiento al ocultar pestaña. Bienvenida de 1600 ms (250 ms en reducida), botón Omitir, Escape, Tab contenido y restauración de foco.

## Responsive
Shell corregido desde 1024 px; estilos móviles a 767 px. Capturas efectivamente realizadas a 1280 y 390 px, no certificación de todos los anchos. El rail de Granja debe mantenerse en una fila desplazable. La vista móvil no depende de hover.

## Pendiente
Dock/paleta, navegación de teclado ampliada, wizards y borradores, diseño específico completo de todos los módulos, revisión de contraste y accesibilidad exhaustiva. Consultar `TEST_REPORT.md` antes de asumir que un componente está verificado.
