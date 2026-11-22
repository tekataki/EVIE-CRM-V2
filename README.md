# EVIE CRM V2

CRM personal con asistente de voz **EVIE** para 2 cuentas privadas. Web/PWA (PC y teléfono) + host Electron.
*Created by Alejandro Dali.*

## Qué incluye (v2.3)
- **EVIE**: núcleo neural interactivo en Inicio con subtítulos y caja de texto debajo; voz Groq (transcripción en español) → OpenAI (herramientas tipadas) → Fish Audio; respaldo gratis con voz del navegador; modos ("activa el modo enfoque"); activación por toque, orbe móvil, Ctrl+Espacio y doble aplauso opcional (solo con la página activa y permiso de micrófono). Toda escritura se propone y se confirma.
- **Cuentas**: registro por invitación (propietario + 1 invitado), sesiones selladas, datos aislados por cuenta (Supabase RLS + verificación en servidor).
- **Módulos**: Inicio, Agenda, Finanzas (cuentas/tarjeta con corte y pago, Compras y despensa), Hábitos, Salud y gym (calorías Mifflin–St Jeor), Objetivos, Negocios (SOMA, ALVENTO, Granja, Contenido y propios), Aprendizaje, Mascota Virtual (Kisha, ruta #mascota; alias #bitacora), Biblioteca, Vision Board, Tendencias (solo horas reales), Logros (25 insignias deterministas), Subir.
- **Conexiones**: Google Calendar solo lectura por cuenta (OAuth + PKCE). OpenAI/Groq/Fish con estado real. Gmail/Spotify: "más adelante", sin simulación.

## Mascota Virtual · Kisha (v2.5)
- **Qué es**: reemplaza la antigua Bitácora. Kisha, una Border Collie animada (SVG articulado original, sin assets externos), conversa contigo sobre tu día por voz o texto. Es una compañera de IA para reflexionar, no una terapeuta.
- **Flujo**: Iniciar conversación → Kisha saluda con tu nombre preferido → hablas o escribes → preguntas breves de seguimiento → **Concluir conversación** abre una **revisión** (título, resumen, momentos, intensidades sugeridas 0–100 editables, transcripción opcional) → **Guardar** o **Descartar**. Nada se escribe sin tu confirmación; un guardado por sesión (idempotente).
- **Estados de Kisha**: sentada respirando (espera), orejas al frente (escuchando), cabeza ladeada mirando arriba (pensando), boca sincronizada con la amplitud real del audio (hablando, solo mientras suena), curiosa, confundida, apoyo calmado (cejas suaves, ojos entrecerrados), contenta moderada (cola), tumbada descansando (pausa / fin). La IA solo puede sugerir un *cue* de una lista cerrada; la máquina de estados del cliente manda sobre escuchar/pensar/hablar/error. Respeta `prefers-reduced-motion` y hay botón para desactivar la animación.
- **API**: `POST /api/kisha/turn` (respuesta + cue, JSON Schema estricto, cuota `chat`, caché idempotente sellada 24 h por cuenta) y `POST /api/kisha/analyze` (borrador con citas textuales; descarta emociones sin evidencia; <8 palabras ⇒ «Sin datos suficientes», sin llamar al modelo). Voz: `/api/ai/stt` (Groq) y `/api/ai/tts` (Fish Audio). Personalización leída en el servidor del perfil de la cuenta autenticada.
- **Datos**: entradas confirmadas en la colección `journal` (`journal_version:4`, `source:'kisha'`, `source_entry_id:'kisha:<sesión>'`), sincronizadas por cuenta igual que el resto (Supabase/RLS). Borrador sin terminar solo en `localStorage` bajo una clave por cuenta. No se guarda audio. Registros anteriores (manuales e importados) se conservan en «Registros anteriores».
- **D1**: tabla `kisha_turns` (migración `0005_kisha.sql`, creada automáticamente por `ensureSchema`).
- **Pruebas**: `tests/kisha-server.test.cjs`, `tests/kisha-core.test.cjs`, `tools/e2e-kisha.mjs` (navegador, proveedores simulados), `tools/shot-kisha.mjs` (layout 320–1440, claro/oscuro).

## Novedades v3 · Neural Core
- **Inicio = Neural Core**: un único núcleo neural centrado, saludo «Bienvenido, [nombre preferido]», sin barra lateral ni panel derecho; estados idle/escuchando/transcribiendo/pensando/consultando/hablando/confirmación/error; texto, subtítulos y conversación completa como alternativas.
- **Tarjetas tipadas** (`public/evie-hud-cards.js`, `evie-hud.js`): finanzas, agenda, hábitos, objetivos, gimnasio, SOMA, aprendizaje, Kisha, pendientes, hora, hoy, capacidades, investigación, clima, ruta de aprendizaje, mensaje. Máx. 4, sin solaparse, cerrar nunca borra datos; voz, clic, teclado (Esc) y lector de pantalla.
- **EVIE más capaz**: investigación web con fuentes verificadas (solo URLs devueltas por la herramienta, fecha de publicación vs. evento, hora de consulta), clima Open-Meteo, intenciones locales sin coste (abrir/cerrar tarjetas, hora, capacidades, pendientes).
- **Activación**: clic en el núcleo, botón de micrófono, atajo, doble aplauso y palabra de activación opcional «Ivi/Evie» **solo si el navegador la procesa en el dispositivo** (nunca se envía audio a Groq para detectarla). Sonidos originales con volumen.
- **Google** con Supabase (PKCE, invitaciones, vinculación explícita, sin fusión por correo, traspaso a escritorio por `evie-crm://`).
- **SOMA**: calendarios de cobro recurrentes, cuotas, pagos parciales, proyección en Finanzas (separada del dinero recibido) y un cobro confirmado = exactamente un ingreso.
- **Pendientes** unificados (rojo/amarillo/verde, origen, deduplicados, zona horaria) en `#pendientes` y en la tarjeta.
- **Aprendizaje asistido**: ruta propuesta con fuentes → vista previa → confirmación → sin duplicados.
- **Escritorio Windows**: abrir Spotify/WhatsApp, teclas multimedia, mensaje prellenado con confirmación (IPC validado). En web estas acciones se muestran como no disponibles.

Configuración v3: ver `docs/SETUP.md §7`.

## Novedades v3.1
- **Acceso Google-first**: dos recorridos («Iniciar sesión» / «Crear mi cuenta»), pestañas operables con flechas, estados claros (`not_linked`, `not_invited`, `expired`, `disabled`, cancelado), transición con usuario y contraseña si Google no está configurado (sin bloqueo), onboarding con Ivi.
- **Workspace del HUD por cuenta**: las tarjetas no se pierden al hablar, re-renderizar, cambiar tema o volver de un módulo; sin desalojo (las que no caben van a una bandeja); cierre por nombre («cierra la tarjeta del clima», «finaliza esta tarjeta», «cierra todas»); una respuesta tardía no resucita una tarjeta cerrada; otra cuenta nunca ve tus tarjetas.
- **«¿Qué puedes hacer?»** abre una vista radial (hoja en móvil) generada del registro real de capacidades; no borra tarjetas.
- **Automatizaciones**: accesos directos a sitios (solo `http/https`, sin credenciales en URL, sin redes locales); se abren por voz o clic; en Windows con `open_url` validado.
- **Kisha**: composición abierta (sin panel rectangular) con subtítulos bajo el personaje; el arranque de la voz tiene tope de 8 s → si el navegador no reproduce, pasa a «Tocar para escuchar» en lugar de quedarse en el saludo.
- **Sonidos**: nuevo cue `open`; los cues se atenúan (−60 %) mientras EVIE o Kisha hablan y nunca se apilan (≥ 90 ms entre cues).
- **Pendiente**: rediseño fotorrealista de Kisha con poses generadas (bloqueado por créditos de generación de imágenes); la Kisha SVG actual sigue activa.

## Novedades v3.2
- **Sin parpadeos ni texto perdido**:
  - Antes, el refresco de sesión cada 60 s, la renovación de metas y la actualización del service worker re-renderizaban la página y borraban lo que escribías en *Configuración personalizada*.
  - Ahora, mientras editas, esas tareas se posponen (aviso visible). Los borradores, el foco, el cursor y el scroll se conservan.
  - Nada se sube sin que lo guardes, y no se recarga con cambios sin guardar.
- **Mapa · Ciudad Guzmán** (`#mapa`):
  - Stadia Maps (OpenStreetMap) a través del Worker, con MapLibre.
  - Búsqueda con desambiguación y rutas solo del proveedor.
  - Navegación en primer plano con precisión del GPS, recálculo con antirrebote, voz y botón Detener.
  - Sin historial de ubicación. Ver `docs/MAP.md`.
- **Memoria privada de Ivi**:
  - «recuerda / olvida / ¿recuerdas lo que te pregunté ayer?» y modo privado.
  - Panel con fuente, edición, exportación y borrado.
  - Cifrada por cuenta. Ver `docs/MEMORY.md`.
- **Configuración personalizada rediseñada**:
  - Paneles verticales: Cómo me habla Ivi / Quién soy / Lugar y hora / Memoria / Privacidad y datos / Salud (plegado).
  - Máximo 2 columnas, estado de guardado visible y vista previa que no tapa el formulario.

## Novedades v4
- **Finanzas por cuenta**:
  - Cada movimiento lleva su cuenta (BBVA, Dinero Físico…), con insignia y estado «Sin cuenta».
  - Ivi pregunta «¿De cuál cuenta…?» y, si solo hay una cuenta, la usa sola.
  - Traspasos sin ingreso ni gasto.
  - Un solo registro aunque se repita la petición, y siempre con deshacer.
  - Revisión de los movimientos antiguos sin cuenta, con explicación del doble conteo.
  - La conciliación es una línea base auditable.
  - El límite de crédito no cuenta como efectivo.
  - Compras y despensa pasan a su propia sección `#compras`.
- **Físico** (antes «Salud y gym»; `#gimnasio` sigue funcionando):
  - Cuerpo original de frente y espalda, con grupos musculares accesibles y una franja de recuperación orientativa.
  - «Ivi, hoy entrené pecho y espalda» se registra sin duplicar.
  - Mapeo ajustable y silueta elegible.
  - Entrenamientos y Comidas/calorías quedan como pestañas.
- **HUD**:
  - Varias tarjetas por frase («abre Finanzas y Mascota Virtual»).
  - Tarjeta de temporizadores.
  - En la investigación, los hechos de las fuentes van separados de la interpretación de EVIE.
- **Voz**:
  - Temporizadores reales: varios con nombre, pausa, reanudar, persistencia y alarma suave.
  - Un solo dueño del micrófono y micrófono flotante.
- **Ivi edita registros**:
  - `edit_record`: agenda, SOMA (nota y etapa) y Aprendizaje.
  - Solo operaciones permitidas, preguntas ante ambigüedad, deshacer y auditoría.
- **Kisha**:
  - «Relato largo» de hasta 15 min, transcrito por partes y editable.
  - Resumen continuo más amplio y sin bromas en temas sensibles.
  - Personaje más fiel a la referencia tricolor.
- **Shell de vidrio** (rieles y encabezado), en tema oscuro y claro.
- **Auditoría de datos**: `docs/AUDIT-v4.md`.
  - Scripts `scripts/supabase-export.mjs` y `supabase-restore.mjs`.
  - v4 no requiere migraciones.
- **Estado y pasos manuales**: `docs/V4-REPORT.md`.

## Novedades v5 (backend; diseño visual pendiente)
- **Niveles de IA** Chispa / Enfoque / Profundo por cuenta (distintos del modo de trabajo «Enfoque»), «solo para esta pregunta», fallback avisado y topes diarios de gasto.
- **Invitados 72 h**: «Entrar con invitación» (nombre + código, sin contraseña); acceso y datos se eliminan al vencer.
- **Tareas SOMA** canónicas integradas en Pendientes sin duplicados; voz para crear, completar y listar.
- **Preparar mi día** con aprobación explícita (nunca escribe en Google Calendar) y «¿qué sigue?».
- **Escenas** («Ivi, modo SOMA»), **rutas por voz**, **memoria v2** (tipos, proyecto, confianza, historial), **dictado largo** editable, palabra clave de un turno y eventos de ciclo de vida sin contenido.
- Panel de herramientas: Ajustes de EVIE → «Herramientas de Ivi» (o Alt+Shift+I).
- Documentación: `docs/BACKEND-v5.md`, `docs/V5-REPORT.md`, `docs/SMOKE-v5.md`, `docs/ANDROID-CONTRACT.md`, `docs/HANDOFF-SONNET-v5.md`.
- Pruebas: 343/343 unitarias, 14/14 E2E. **Desplegado** en https://evie-crm-v2.pages.dev (verificado 2026-11-21: los archivos en vivo son iguales a `main`, D1 con tablas v5, Supabase con las 5 migraciones). Estado: `docs/SUPABASE-SETUP.md`.

## Novedades v10 · Fase 4: Misión, Escuela, Independencia y Revisión del domingo (2026-11-22)
- **Misión** (Objetivos y Finanzas): meta de ahorro con nombre, monto y fecha límite (son datos tuyos, no del código).
  Cuenta regresiva, ahorro mensual necesario y proyección con tus **ingresos reales de SOMA** (promedio de 90 días × el
  % que destinas + aporte extra). **Escenarios** (+ingreso / −gasto) con su fecha estimada. El ahorro se registra con
  aportes o se liga al saldo real de una de tus cuentas. **Holograma 3D** (Three.js) de una moto deportiva que se arma
  pieza por pieza con tu avance (respaldo SVG con movimiento reducido). La **serie de contenido** (TikTok, Reels o
  Shorts) usa la sección Contenido. Se refleja en un objetivo normal que ven Inicio, el briefing e Ivi.
- **Escuela** (`#escuela`): materias con horario que se bloquea en Agenda, tareas y exámenes (también en Agenda),
  **tarjetas con repaso espaciado (SM-2)** y «Generar con Ivi» desde tus apuntes, **resúmenes en audio** (la IA los
  escribe y la voz de Ivi los lee) y calificaciones con promedio ponderado y «cuánto necesitas». Tus clases cuentan
  como compromisos del briefing (ventana para entrenar y «Sal ahora» para la primera clase).
- **Independencia** (Finanzas): meses de autonomía con tu dinero disponible y tus gastos reales, fondo de emergencia
  y renta sola vs. compartida; un clic los lleva como escenarios a tu Misión.
- **Revisión del domingo**: tu semana con datos reales (misión, entrenos, SOMA, finanzas, escuela y ánimo del diario
  solo si lo permitiste), 3 prioridades editables, análisis opcional de Ivi (`/api/weekly/review`, solo números) y
  «volverlas objetivos». Se abre sola el domingo desde las 17:00; también con «Ivi, revisión semanal».
- Sin migraciones: todo vive en `preferences` (la app de escritorio trae su propia copia del frontend y una colección
  nueva rompería la sincronización de versiones anteriores). Los episodios usan `contentItems`; las clases, `agendaItems`.
- Pruebas: `tests/mission-weekly.test.cjs`, `tests/school.test.cjs` y E2E `tools/e2e-mission.mjs`, `tools/e2e-school.mjs`.

## Novedades v10 · Fase 3: Briefing diario y Cabina SOMA (2026-11-22)
- **Briefing del día** (tarjeta del HUD y «Ivi, protocolo matutino»): clima, bloques de hoy (compromisos fijos +
  Agenda), ventana para entrenar antes de tu primer compromiso con los músculos que ya están listos, seguimientos de
  ventas vencidos, avance de tu misión y una frase útil en inglés que cambia cada día. «Escuchar» lo lee con la voz de
  Ivi (sin costo de IA). Se abre solo la primera vez que entras a Inicio antes de las 12:00 (se puede desactivar).
- **Mi horario**: hora de despertar, minutos de entreno y de traslado, punto de salida y compromisos fijos (hora, días
  y lugar). Vive en tus preferencias; nada personal está en el código.
- **«Sal ahora»**: si el compromiso tiene lugar, Ivi calcula el camino con tráfico (Mapa) y te avisa con una
  notificación cuándo salir. Funciona con EVIE abierta o en segundo plano; no hay servidor de push, así que con la app
  cerrada no llega el aviso.
- **Cabina SOMA** (`#soma`): matriz de necesidades (problema → solución → paquete con precio único y mensual),
  objeciones si/entonces con búsqueda, seguimientos con cadencia 2/5/10 días y mensajes sugeridos (cercano, directo,
  valor) para copiar o abrir en WhatsApp, resultados ganados/perdidos con motivo y tareas del socio.
- **Ficha del prospecto** (`#soma/<id>`): necesidades → paquetes recomendados, **dossier de visita** hecho por Ivi
  (problema probable, solución, paquete, objeciones, preguntas, cierre, siguiente paso y supuestos), **propuesta
  imprimible** en un clic, tareas yo/socio, ubicación en el Mapa con «Ver ruta» y cierre ganado/perdido.
- Servidor: `src/soma.js` (`/api/soma/dossier` con esfuerzo medio y `/api/soma/followup` con esfuerzo bajo, salidas
  estructuradas de Claude); necesita `ANTHROPIC_API_KEY`, limpia los datos del prospecto y cuenta para el tope diario.
  Sin migración nueva: los datos viven en `preferences` y en `clients.cabin`.
- Pruebas: `tests/soma-briefing.test.cjs` y E2E `tools/e2e-soma.mjs` (20 comprobaciones) a 390 y 1440 px, oscuro y claro.

## Novedades v10 · Fase 2: Claude, Chat con memoria e Ivi (2026-11-22)
- **Claude es el cerebro de Ivi** (`claude-opus-5-5`, SDK oficial `@anthropic-ai/sdk` en el Worker, `src/claude.js`).
  Niveles → esfuerzo: Chispa `low`, Enfoque `medium`, Profundo `high`. Pensamiento adaptativo, respuestas en
  streaming, **respaldo del servidor ante rechazos activado** (`fallbacks: "default"`), caché de prompt (la persona y
  el perfil se cachean; lo variable va después) y búsqueda web `web_search_20260209` con fuentes verificadas.
  Kisha usa salidas estructuradas; la investigación va en dos pasos (búsqueda citada → JSON) y solo conserva URLs que
  la búsqueda devolvió. Groq (voz a texto) y Fish Audio (voz de Ivi) siguen igual. OpenAI queda como respaldo con
  `EVIE_AI_PROVIDER=openai`. Costos con precios de Opus 5.5 ($4 / $20 por millón, lectura de caché $0.20); topes
  diarios por defecto con Claude: $3 por cuenta y $5 global (`EVIE_BUDGET_ACCOUNT_DAILY_USD`, `EVIE_BUDGET_GLOBAL_DAILY_USD`).
- **Sección Chat** (`#chat`): conversaciones con buscar, fijar, archivar, renombrar y borrar; Markdown con bloques de
  código y botón copiar; respuesta en vivo con **detener**, **regenerar** y **editar el último mensaje**; dictado por
  voz y **escuchar** la respuesta; selector de nivel; **chat privado** (sin memoria); móvil con cajón lateral.
  Todo vive en Supabase (`ai_conversations`, `ai_messages`) **cifrado en el Worker** y se sincroniza entre
  dispositivos con el sello `evie_chat_stamp`.
- **Memoria de largo plazo** (`ai_memories`, `ai_memory_events`, `ai_state`; `src/ai-memory.js`): después de cada
  intercambio Ivi propone agregar, actualizar (sin perder el historial) u olvidar recuerdos; cada tanto regenera un
  «perfil de memoria» que se inyecta en el chat, en Ivi por voz y en Kisha. «Ivi, recuerda / olvida…» también llega
  aquí. Nueva página **«Lo que Ivi sabe de ti»** (`#chat/memoria`): ver, agregar, editar, olvidar, recuperar e historial.
- **Persona Ivi** (`src/persona.js`): IA leal, breve y con humor seco, vocabulario de protocolos, separa lo confirmado
  de lo no confirmado y no se pasa de la raya en salud ni inversiones. **Modos** Asistente · Ventas · Gym · Estudio ·
  Noche que reordenan la barra de **«Sistemas en línea»** de Inicio (recuperación, seguimientos, hoy, escuela,
  misión) y las sugerencias; **ajustes de Ivi** (formalidad, humor, extensión, voz) y **protocolos**: matutino,
  cierre y preparar visita («Ivi, protocolo matutino», «prepara la visita a…»).
- Pruebas: `tests/claude.test.cjs`, `tests/chat.test.cjs` (PostgREST simulado sobre PGlite con la migración real),
  `tests/ai-chat-sql.test.cjs`, `tests/chat-md.test.cjs` (XSS) y E2E `tools/e2e-chat.mjs` a 390 y 1440 px.
- **Para activarlo:** Cloudflare → Workers & Pages → `evie-crm-v2` → Settings → Variables and Secrets → Production →
  agrega el secreto `ANTHROPIC_API_KEY` y vuelve a desplegar. `/api/runtime` mostrará `ai.provider: "claude"`.
- **Mientras no exista esa llave, todo funciona con OpenAI** (`OPENAI_API_KEY`, `src/openai.js`): el Chat responde en
  vivo por la Responses API con búsqueda web, la Cabina SOMA y el aprendizaje de memoria usan esquemas JSON estrictos,
  y Kisha e investigación siguen igual. Al agregar la llave de Claude el cambio es automático.

## Novedades v10 · Fase 1: Físico = Cuerpo + recuperación (2026-11-22)
- **Físico ya solo tiene «Cuerpo».** Se quitaron las pestañas «Entrenamientos» y «Comidas y calorías» (registro manual
  de series, calculadora de calorías y su campo de perfil). Los datos guardados **no se borraron**: solo dejaron de
  mostrarse. La despensa sigue en Compras.
- **Mapa de recuperación muscular** sobre el cuerpo 3D: **rojo** = entrenado hace menos de 24 h, **amarillo** = 24–48 h,
  **verde** = 48 h o más (listo otra vez), neutro = sin entrenar en 7 días. Leyenda con conteos, toca un músculo →
  «Último entrenamiento: lunes (hace 2 días) · listo para entrenar», tarjeta «Recuperación» (listos / descansando,
  últimos entrenamientos con corregir y borrar con deshacer) y botones rápidos «Entrené: Pecho · Espalda · … · Upper ·
  Push…». Conmutador **Recuperación | Medidas** (medidas y peso siguen igual).
- **Dile a Ivi qué entrenaste:** «el lunes entrené pecho y espalda», «hoy entrené upper en la mañana», «ayer pierna»,
  «antier brazo», «hace 3 días hice push». Se guarda un registro ligero en `gymSessions` con la hora (`trained_at`); si
  no dices la hora se usa tu hora habitual (ajustable). La herramienta `get_gym_summary` de Ivi ahora devuelve el mapa
  de recuperación («¿qué puedo entrenar hoy?»).
- **Tema claro de primera:** `public/evie-v8-light.css` lleva el mismo lenguaje v8 (profundidad, luz que sigue al
  cursor, fondo iluminado, botones, campos, barra lateral, dock) al tema claro.
- Pruebas: 390/391 unitarias (la única falla es la conocida de rutas protegidas de Windows), E2E `e2e-fisico` 24/24 a
  390 y 1440 px, más `life`, `finance`, `memory`, `v31` y `workspace` en verde.

## Novedades v9 · rediseño (2026-11-22)
- **Sistema de diseño v8** (`public/evie-v8.css` + `public/evie-v8.js`): fondo 3D con luces volumétricas, piso en
  perspectiva y grano; superficies con profundidad real (sombra ambiental + luz principal, brillo superior) y una luz
  que sigue al cursor; botones, campos, pestañas, diálogos, barra lateral y dock del celular rediseñados.
  Animaciones con **Motion** (motion.dev, versión sin React de Framer Motion, `public/vendor/motion.min.js`, MIT) y
  **GSAP**. Respeta «reducir movimiento».
- **Intro** «EVIE · Created by Alejandro Dali»: secuencia HUD con GSAP (escaneo, anillos, núcleo de luz, texto que se
  descifra y salida con destello). Una vez por sesión; un toque la salta.
- **Finanzas:** las cuentas son tarjetas físicas (chip, pago sin contacto, número realzado, titular, materiales por
  color, reflejo e inclinación 3D). Nuevos campos opcionales: últimos 4 dígitos y color. Gráficas con profundidad.
- **Kisha:** ahora es el Border Collie del dueño (`public/kisha/kisha-collie.webp`, fondo quitado) con parpadeo, boca
  que se abre con el volumen real de la voz, respiración, posturas por ánimo y un aura que reacciona a la voz.
- **Físico** (cuerpo + medidas y peso) y **Agenda** (más simple) — ver sus notas abajo.

## Novedades v8 (2026-11-22)
- **Correo + contraseña, o Google.** «Crear mi cuenta»: correo, contraseña y confirmación (o Google). «Iniciar
  sesión»: correo y contraseña, o «Continuar con Google» en un toque. Con el mismo correo es la misma cuenta.
- «¿Olvidaste tu contraseña?» → «Recuperar con Google». Protección contra quien registre tu correo antes que tú.
- Pruebas: `tests/v8-email-auth.test.cjs` (9) y `tools/e2e-login.mjs` (15 comprobaciones; 12 sin Google).

## Novedades v7 (2026-11-22)
- **Acceso solo con Google.** «Iniciar sesión» y «Crear mi cuenta» son Google; cualquier cuenta de Google crea su propio
  espacio (`EVIE_GOOGLE_SIGNUP=invite` lo cierra). Ya no hay registro con usuario y contraseña.
- **Pestaña pequeña «Tengo un código de invitación»** para invitados de prueba (72 h).
- **Cuentas anteriores:** «¿Ya tenías usuario y contraseña?» entra una vez y une la cuenta con Google; después la
  contraseña vieja se rechaza. Mientras Google no esté activo, ese formulario queda abierto (nadie se queda fuera).
- **Celular:** arreglado «No pudimos abrir tus datos · Colección v4 inválida: automations» (copias guardadas por
  versiones viejas). Nuevo botón «Volver a bajar mis datos de la nube» si una copia local no se puede leer.
- Pruebas: `tools/e2e-login.mjs` (11 comprobaciones) y `tools/e2e-v7.mjs` (reproduce el error del celular).

## Novedades v6 (2026-11-21)
- **Invitados de 72 h funcionando** sin clave secreta: estructura propia en Supabase (`evie_guests`, RLS restrictiva, limpieza con `pg_cron`).
- **Continuar con Google** se activa solo cuando el proveedor está encendido en Supabase; **«¿Olvidaste tu contraseña?» → Recuperar con Google**.
- **Sincronización entre dispositivos** cada 15 s y al volver a la app; **fotos** en la nube privada de cada cuenta.
- Detalle y pasos pendientes: `docs/SUPABASE-SETUP.md`. Pruebas: `tests/v6-backend.test.cjs`, `tools/e2e-v6.mjs`.

## Arquitectura
`public/` (frontend) + `src/` (API Hono) → `npm run build` → `dist/` con `_worker.js` → **Cloudflare Pages**. Datos: **Supabase** (`crm_records`, `user_preferences` con RLS). D1 `AUTH_DB` (`evie-auth`): sesiones, roles, invitaciones, uso de IA, tokens de conexiones.

API `/api`: `runtime`, `auth/*`, `memory/*`, `map/config|search|route`, `data/pull|push`, `ai/status|chat|stt|tts`, `connections`, `connections/google/start|callback|events|disconnect`.

## Configuración
**docs/SETUP.md** (Cloudflare, Supabase, cuentas, claves, costos, Google; §8 lista consolidada v3.2), **docs/MAP.md**, **docs/MEMORY.md** y `.dev.vars.example`.

## Pruebas
Pruebas de Node en 47 archivos (`tests/*.test.cjs`; ejecútalas archivo por archivo en máquinas con poca RAM), e2e `tools/e2e-chat.mjs`, `tools/e2e-soma.mjs`, `tools/e2e-drafts.mjs`, `e2e-memory.mjs`, `e2e-map.mjs`, `e2e-login.mjs`, `e2e-v31.mjs`, `e2e-hud.mjs`, `e2e-workspace.mjs`, `e2e-kisha.mjs`, `tools/e2e-life.mjs`, aislamiento en vivo `tools/verify-isolation.mjs`, QA visual `tools/shot.mjs` y `tools/qa-sweep.mjs`, privacidad `tools/check-privacy.mjs`.

## Restaurar la versión anterior
Tag `pre-v2.3-946d437` en GitHub, o *Cloudflare → Deployments → Rollback*.
