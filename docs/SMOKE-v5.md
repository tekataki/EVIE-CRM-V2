# Prueba de humo v5 (manual, 15–20 min)

Preparar: cuenta dueño, una cuenta miembro, una ventana de incógnito para el invitado. Consola de red abierta.

## Niveles de IA
1. Ajustes de EVIE → «Herramientas de Ivi» → Nivel de IA: elegir **Chispa**. Recargar: sigue en Chispa.
2. Decir «Ivi, modo enfoque» → cambia el **modo de trabajo** (insignia «Enfoque»), el nivel sigue en Chispa.
3. «Usa profundo solo para esta pregunta: ¿qué riesgos tiene subir precios a SOMA?» → respuesta con `tier.id=profundo`
   (red: `/api/ai/chat`); la siguiente pregunta vuelve a Chispa.

## Invitado 72 h
4. Dueño: crear invitación tipo invitado (`POST /api/auth/invites {kind:'guest'}`). Incógnito: «Entrar con invitación»
   con nombre + código → entra sin contraseña. Panel muestra «Invitado · quedan ~72 h». Escenas: no aparecen (403).
5. Reusar el mismo código → «ya se usó». Usar el código en «Crear mi cuenta» → rechazado (es de invitado).
6. Dueño: revocar (`POST /api/auth/guest/<id>/revoke`) → la sesión del invitado cae en la siguiente petición.

## Tareas y Pendientes
7. «Ivi, agrega una tarea para <cliente>: enviar propuesta mañana» → aparece una vez en Pendientes (no duplicada con el
   seguimiento del cliente si coincide el texto). «¿Qué tareas tengo con <cliente>?» → la lista. «Completa la tarea propuesta».

## Preparar mi día
8. «Ivi, prepara mi día: llamar a Intensity 30 min, gimnasio a las 7, revisar contrato» → panel «Mi día» con bloques,
   eventos fijos marcados y avisos. Nada guardado aún (red: solo `plan/propose`). «Aprobar y guardar» → tareas creadas;
   aprobar otra vez no duplica. «¿Qué sigue?» → bloque actual/siguiente. Nunca menciona escribir en Google Calendar.

## Escenas
9. Crear escena «Modo SOMA», frase «modo soma», pasos `navigate negocios`, `set_ai_tier enfoque`, `show_card pendientes`.
   Decir «Ivi, modo SOMA» → navega, cambia nivel, abre tarjeta; resumen completo/parcial. Intentar frase «ivi» → rechazada.

## Ruta
10. «Abre el mapa» → abre la sección (no calcula). «¿Cuánto tardo de aquí a <lugar> en coche?» → pide ubicación,
    responde km/min y «no incluye tráfico en tiempo real». Lugar ambiguo → botones de candidatos.

## Memoria
11. «Recuerda que el proyecto SOMA cierra en noviembre» → «¿Te acuerdas de qué hablamos sobre SOMA?» → lo cita.
    «Corrige: SOMA cierra en diciembre» → historial. Incógnito activo → no guarda ni consulta. Exportar JSON.

## Dictado largo
12. «Ivi, modo dictado» → hablar > 1 minuto → «Terminar» → texto editable completo, sin repeticiones en las costuras;
    si menciona «paga/borra/agrega», aviso de alto impacto y no se envía solo.

## Palabra clave y ciclo de vida
13. Palabra clave apagada por defecto. Activarla → «Ivi» abre un turno; mientras Ivi habla, decir «Ivi» no re-dispara.
14. Consola: `document.addEventListener('evie:lifecycle',e=>console.log(e.detail))` → etapas con `request_id`, sin texto.

## Métricas y presupuesto
15. `GET /api/ai/metrics` → p50/p95 por etapa, gasto de hoy y topes; ningún contenido.
