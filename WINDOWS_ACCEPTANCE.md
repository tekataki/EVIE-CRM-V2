# EVIE 2.1 · aceptación manual Windows

## 20 categorías de actualización — pendientes en Windows real

- [ ] 1. Venta Intensity: un ingreso de 100000 centavos en Finanzas, cero tareas.
- [ ] 2. Agenda mañana cobrarle a Intensity mil pesos: una tarea, cero movimientos.
- [ ] 3. Clientes duplicados: ninguna escritura antes de elegir ID y confirmar.
- [ ] 4. Actualizar/archivar Finanzas: centavos exactos; pagos/ventas vinculados protegidos.
- [ ] 5. Fallo de herramienta/lectura: no anunciar éxito ni repetir escrituras ciegamente.
- [ ] 6. Micrófono: pedir una vez, conservar al reiniciar y revocar; permiso Windows independiente.
- [ ] 7. VAD: voz y ~1100 ms silencio envían una vez; comprobar ruido real y anotar hardware.
- [ ] 8. Núcleo: clic inicia; otro clic durante captura/STT/modelo/TTS libera todo.
- [ ] 9. Escuchar → transcribir → pensar → hablar → escuchar tras fin real del WAV.
- [ ] 10. Amplitud real entrada/salida, estados diferenciados y movimiento reducido.
- [ ] 11. Opacidad 0/50/100 en 16 rutas, inputs, menús, diálogos, rail, dock y scroll; máximo oculta wallpaper reconocible.
- [ ] 12. 1366×768 y 1920×1080, Windows DPI 100/125/150/200 %, zoom y teclado sin recortes.
- [ ] 13. Sin onboarding automático; Diagnóstico y Volver a ejecutar configuración manuales.
- [ ] 14. Catálogo usuario/sistema, Win32, Start Menu sin argumentos, Store y protocolos; no inventar apps ausentes.
- [ ] 15. Autorizar/revocar por app/acción; persistir grants sin permitir reutilización tras revocar.
- [ ] 16. Rechazar comandos/rutas del modelo, admin, cambios de seguridad/registro/servicios, credenciales, compras y remote control.
- [ ] 17. Spotify búsqueda honesta; Roblox apertura; navegador búsqueda codificada; WhatsApp solo borrador confirmado, nunca envío automático.
- [ ] 18. Archivo elegido: preview/revalidación, rename/move mismo volumen sin sobrescribir y Papelera sin fallback destructivo.
- [ ] 19. Confirmación botón/audio «Sí, confirma»: token único, caducidad, cancelación y rechazo de replay/frase distinta.
- [ ] 20. Upgrade/rollback conserva perfil, IDs, registros, imágenes, ajustes, grants y modelos; respaldo previo y suites heredadas.

No marcar estos puntos usando resultados Linux o mocks. Los apartados siguientes detallan el entorno y las comprobaciones complementarias.

**Estado inicial: PENDIENTE.** No marcar por haber visto la web, ejecutado fixtures o empaquetado Linux. Registrar fecha, versión Windows, CPU/GPU/RAM, modelo Ollama, modelo Whisper, voz SAPI, hash del código/instalador y resultado de cada paso. Usar datos de prueba identificables y un respaldo previo. No registrar audio o datos privados sin consentimiento.

## Entorno

- Fecha / responsable: ____________________
- Windows / GPU / driver: ____________________
- Commit / Node / Electron: ____________________
- Ollama / Qwen / Whisper / voz instalada: ____________________
- Instalador / SHA-256: ____________________
- Respaldo previo completo con imágenes: ____________________

## Host e instalador

- [ ] `npm ci`, `npm run test:desktop`, `npm run dev:desktop` correctos como usuario normal.
- [ ] Segunda apertura enfoca la primera instancia, no crea dos perfiles ni dos escritores.
- [ ] Barra arrastrable, botones no arrastrables, minimizar, maximizar/restaurar y cerrar.
- [ ] Tamaño/posición persisten; desconectar una pantalla no deja la ventana inaccesible.
- [ ] Tray: abrir, escuchar, detener, diagnóstico y salir. Detener cancela audio/trabajo pendiente.
- [ ] Sin atajo global por defecto; habilitar/deshabilitar explícitamente y comprobar conflictos.
- [ ] `npm run make:win` termina y crea `out/make/squirrel.windows/x64/EVIE-CRM-V2-Setup.exe`.
- [ ] Instalar, abrir, cerrar, reabrir y comprobar registros/imágenes importados, sin pérdida.
- [ ] Instalar actualización preserva `%APPDATA%\EVIE-CRM-V2` y el origen `evie://app`.
- [ ] SmartScreen de build sin firma documentado; no se desactivaron protecciones.

## Apariencia, accesibilidad y rendimiento

- [ ] Crystal/Acrylic conserva resize; al máximo de opacidad no permite reconocer el wallpaper.
- [ ] Transparent experimental muestra wallpaper, no maximiza, controles funcionan sin click-through.
- [ ] Sólido no transparenta; fondos claros/oscuros siguen siendo legibles con slider y scrims.
- [ ] Núcleo blanco orgánico sin rectángulo: idle/listening/transcribing/thinking/speaking/executing/success/error.
- [ ] Hablar más fuerte mueve el núcleo/medidor de entrada; silencio reduce amplitud.
- [ ] Al reproducir WAV de SAPI, el núcleo reacciona al audio real y deja de hacerlo al detener.
- [ ] Cerdo 3D gira 360°, cambia perspectiva, responde al foco/hover y pausa fuera de viewport.
- [ ] Sin WebGL o con Movimiento reducido: SVG estático; no pantalla vacía.
- [ ] Cambiar rutas repetidamente no acumula escenas, listeners o audio; ocultar ventana pausa.
- [ ] Formularios, rail de Granja, pestañas y navegación conservados. Teclado y foco visibles.
- [ ] Lector de pantalla anuncia estados, botones y errores; no flashes rápidos.

## Voz local real (bloque obligatorio)

- [ ] Diagnóstico identifica loopback Ollama, modelo descargado, archivos Whisper, voz offline y Agenda.
- [ ] Denegar micrófono muestra error; volver a permitir recupera captura.
- [ ] Probar micrófono mueve el medidor sin transcribir/enviar; timeout descarta.
- [ ] Clic/Ctrl+Espacio inicia sesión; silencio envía, segundo clic/Detener termina y descarta. No hay escucha al inicio.
- [ ] Audio español real → Whisper produce texto correcto (incluidos nombres de productos).
- [ ] «Ivy, checa qué tengo hoy en el calendario»: lee registros reales de hoy, no inventa.
- [ ] «Cambia la cita de las cuatro para mañana a las cinco»: resuelve ID correcto y presenta antes/después exactos.
- [ ] Dos citas coincidentes: pide aclaración, sin escoger una arbitrariamente.
- [ ] Confirmar guarda una vez, lee/verifica resultado y solo entonces habla mediante SAPI.
- [ ] Cancelar confirmación no cambia bytes/revisión de datos.
- [ ] Crear evento/tarea y archivar evento por voz: confirma; borrar exige confirmación fuerte.
- [ ] Editar Agenda desde formulario durante propuesta: commit rechaza revisión obsoleta.
- [ ] Interrumpir durante STT/modelo/TTS no dispara respuesta tardía ni deja captura activa.
- [ ] Desconectar Ollama / quitar modelo / archivo Whisper inválido produce fallo honesto y guía de diagnóstico.
- [ ] TEMP se limpia después de éxito, error y cancelación normal. No se guardó audio por defecto.
- [ ] Sin voz española usa predeterminada con advertencia; voz, velocidad y volumen funcionan.

**Resultado del flujo completo real:** PENDIENTE / PASÓ / FALLÓ

Evidencia y observaciones (sin secretos): ____________________

## Controles Windows y seguridad

- [ ] Configurar Calculator/Spotify u otra app real usando selector; probar abrir y enfocar.
- [ ] Carpeta por alias abre la seleccionada, nunca una ruta generada por modelo.
- [ ] Volumen 0/50/100 se aplica y verifica; -1/101/texto se rechaza.
- [ ] Play/pause/next/previous/mute funcionan con reproductor compatible; mensaje enviado no se presenta como reproducción comprobada.
- [ ] Notificación local; mensaje de fallo si Windows no la admite.
- [ ] HTTPS de dominio exacto permitido; rechaza HTTP, javascript:, file:, credenciales y dominio engañoso.
- [ ] Pedir PowerShell/cmd, eliminación permanente, instalar software, cambiar registro o apagar PC se rechaza.
- [ ] Consola/renderer sin `require`, `process`, fs ni tokens; CSP sin scripts remotos.
- [ ] Auditoría contiene nombres de argumentos/resultados, no notas privadas, transcripciones ni tokens.
- [ ] Cancelar mientras confirmación está abierta impide commit posterior.

## Web/móvil y Google opcional

- [ ] 412 px y Samsung S25 Ultra físico: navegación, safe area, formularios y micrófono no se solapan.
- [ ] Web sólida; controles Windows deshabilitados; no pide a localhost del teléfono un modelo.
- [ ] Importar/exportar ZIP con imágenes mantiene registros; ZIP de código no se confunde con respaldo.
- [ ] Sin Google configurado, Agenda y voz local siguen disponibles.
- [ ] Opcional: OAuth Desktop por navegador/loopback; cifrado; desconectar elimina token local.
- [ ] No se anuncia sincronización Google ni escrituras remotas: es scaffold de lectura/conexión.

## Aceptación final

No declarar Phase 3 completa hasta que pase el flujo **español hablado → transcripción real → modelo local → herramienta validada → resultado verificado → respuesta hablada**, el instalador y los puntos Windows aplicables. Documentar cualquier fallo y su workaround, sin marcarlo como probado.
