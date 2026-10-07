# Historial de cambios

## 3.0.0 · Granja porcina · 2026-09-14

- Integrada la extensión en la aplicación existente: nueve vistas y formularios con controles contextuales.
- Corregida la semántica clínica: una monta no confirma gestación; únicamente una revisión positiva registrada. Preparto y fechas futuras son estimaciones, no mutaciones automáticas.
- Migración conservadora v2→v3 con respaldo previo y reporte; conserva módulos y datos anteriores.
- Alimentación: reglas confirmadas, cálculo entero, pruebas A–E, inventario FIFO, existencia inicial sin gasto, consumo/merma y compra con un único gasto opcional. Anulación de compra protegida si hubo movimientos posteriores.
- Integrados salud desde eventos, pendientes, calendario, capacidad de maternidad y métricas básicas con muestras explícitas.
- Ampliados importador, esquema, ejemplo, manifiesto del código y ZIP de datos. Restauración ZIP real verificada.
- Resultado: 59 pruebas correctas, 0 fallos. Revisión visual de Cerdos y Alimentación en 1280/390 px, claro/oscuro respectivamente.
- Referencias inactivas: no se crean animales, raciones activas, compras ni gastos de muestra en el almacén personal. Datos de pruebas exclusivamente en espacios QA.
- No se declara terminado todo el documento maestro: el puntaje multifactor, costos imputados y simulación avanzada siguen en CHECKLIST.md. Sin despliegue.

## 2.0.0 · Evolución local

### Conservado
Finanzas, SOMA, Objetivos, Aprendizaje, Bitácora y perfil; marca y diseño original; libro mayor en centavos; revisión entre pestañas; almacenamiento local y acciones recuperables.

### Migrado
El esquema v1 pasa a v2 sobre una copia validada. Se mantiene `dali-os-local-v1` para no iniciar un almacén vacío. La copia anterior queda en `-pre-v2`. Las rutinas y sesiones originales permanecen archivadas; las sesiones finalizadas se convierten en estadísticas parciales sin crear rangos Symmetry.

### Añadido
Navegación de 15 secciones; importación operativa con tres formatos, confirmación, lotes y rollback; seis áreas nuevas (Granja, Libros, ALVENTO, Contenido, Vision Board y Subir); medios IndexedDB, respaldo ZIP y exportación del código; reloj mexicano y saludos; calendario de recurrencia con intervalos y día mensual; pruebas de dominio y UI.

### Corregido
Tarjeta bancaria de ancho completo y proporción rectangular en móvil. Cancelar formularios ya no dispara un submit implícito. Editar el perfil conserva la fotografía. Deshacer importaciones detecta ediciones posteriores. El progreso de aprendizaje se limita al 95% sin proyecto final y excluye actividades sin evidencia requerida.

### No terminado
El alcance detallado pendiente figura en CHECKLIST.md. Este incremento no certifica cumplimiento total del documento maestro, seguridad multiusuario ni todos los navegadores/anchos. No hubo despliegue.
