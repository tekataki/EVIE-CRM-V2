# EVIE CRM V2 · Informe v4 («refinamiento final»)

Rama `main`, a partir de `b63b539` (v3.2). Nada se desplegó ni se subió a GitHub desde el sandbox. Los pasos para publicar están en el §6.

## 1. Qué cambió (por área)

### Finanzas
- **Cuentas por movimiento.**
  - `evie_account` en cada ingreso o gasto, con insignia por fila y estado «Sin cuenta» (que se puede asignar).
  - Al crear un movimiento, el campo cuenta es obligatorio si existen cuentas.
- **Ivi registra en una cuenta.**
  - Ejemplos: «gasté 200 de mi dinero físico en comida» o «recibí 500 en BBVA».
  - Si hay varias cuentas y no dijiste cuál, pregunta «¿De cuál cuenta: BBVA o Dinero Físico?». Si solo hay una, la usa sin preguntar.
  - Se guarda **una vez** (`op_id` = id de la llamada del modelo, más una ventana de 2 min para frases repetidas), con confirmación breve y deshacer. «Deshaz lo último» también funciona.
- **Traspasos** («pasa 200 de efectivo a BBVA»): dos filas ligadas por `transfer_id`. Cambian los dos saldos y no cuentan como ingreso ni gasto.
- **Conciliación como línea base.**
  - «Ajustar saldo» guarda `{fecha, saldo, estimación previa}` en la cuenta y deja de crear «ingresos de ajuste».
  - Los ajustes antiguos aparecen en una lista de revisión.
- **Movimientos antiguos sin cuenta.** Se revisan uno por uno, nunca de forma silenciosa, y se explica si asignarlos cambiaría el saldo (doble conteo frente a una línea base posterior).
- **Crédito.** El límite no cuenta como efectivo. Si hay una cuenta «Dinero Físico» marcada como crédito, se ofrece corregirla a efectivo.
- **Compras y despensa** se mueven a su propia sección `#compras`, sin borrar datos. El paso «compras → gasto» sigue existiendo.

### Físico (reemplaza «Salud y gym»)
- **Rutas.** Nueva ruta `#fisico`. `#gimnasio`, `#gym` y `#salud` siguen funcionando, y las preferencias de menú (orden, ocultos, accesos móviles) se migran solas.
- **Cuerpo.** SVG **original** de frente y espalda con 16 regiones accesibles (teclado y lector de pantalla). Los resaltados usan rayas o puntos, más texto y leyenda, nunca solo color.
- **Silueta.** Neutra, hombros más anchos o caderas más anchas. La elige el usuario y nunca se infiere.
- **Por grupo.** Última vez, veces en 7 días y una franja de recuperación **orientativa** (~48–72 h). Se aclara que no es consejo médico y se citan ACSM 2026 y OMS/HHS (≥2 días por semana por grupo).
- **Por voz.** «Ivi, hoy entrené pecho y espalda» crea una sesión parcial en `gymSessions` sin inventar series. Repetir la frase no duplica; si se suman músculos, se fusionan en la sesión de voz del día. Ofrece deshacer y «Agregar ejercicios y series». Herramienta: `log_workout`.
- **Detalle.** Al tocar un músculo se ven las sesiones que lo incluyen, y se puede «Ajustar músculos» (`muscle_override`) con deshacer.
- **Pestañas secundarias.** Entrenamientos y Comidas y calorías conservan todos sus datos y la protección para menores.

### HUD
- **Varias tarjetas por frase**, en el orden dicho («abre Finanzas y Mascota Virtual», «clima y dime qué hora es», «abre Finanzas y temporizadores»).
  - Las tarjetas únicas se enfocan en lugar de duplicarse.
  - Hablar no cierra tarjetas.
  - Funcionan «cierra todas» y el desborde a bandeja en pantallas pequeñas (comportamiento de v3 conservado).
- **Investigación.**
  - Los hechos de las fuentes («Lo que dicen las fuentes») van separados de «Mi interpretación (no es un dato de las fuentes)».
  - Cada fuente muestra su fecha de publicación o «sin fecha visible».
  - Las fuentes y las imágenes se aceptan solo si las devolvió la búsqueda real (sin citas inventadas).

### Voz global
- **Temporizadores.**
  - Varios con nombre («pon un temporizador de 10 minutos para la pasta»), con pausar, reanudar y cancelar (con deshacer).
  - «¿Cuánto le queda…?» y «cancela todos». Si la petición es ambigua, pregunta cuál.
  - Persisten por marcas de tiempo, así que sobreviven a recargar la página.
  - Alarma suave hecha con Web Audio (sin archivos ni licencias).
  - Notificación del sistema solo si se concede el permiso desde un clic.
  - Tarjeta en el HUD. Herramientas `set_timer` y `control_timer`.
- **Un solo dueño del micrófono** (`EvieMic`): Ivi, Kisha o la escucha de «Ivi». Nunca graban dos a la vez, y la activación por voz se pausa mientras otro usa el micrófono.
- **Micrófono flotante** en módulos de escritorio. Se coloca a la izquierda del riel derecho. Se oculta en Inicio (el núcleo ya es el micrófono), en Kisha y en móvil (ahí está el orbe inferior).
- **«Escucha a Ivi»** (de v3, se conserva). Es opcional y **solo local**: si el navegador no reconoce voz en el dispositivo, lo explica y no envía audio.

### Ivi controla módulos
- **`edit_record`, una sola herramienta tipada** con operaciones permitidas:
  - `agenda.create`, `update`, `complete` y `delete` (borrado suave).
  - `soma.note` y `soma.stage`.
  - `learning.task` y `learning.done`.
- **Validación.** Revisa tipos, longitudes, fechas, horas y valores permitidos antes de escribir.
- **Ambigüedad.** Ante dos registros posibles, hace una sola pregunta («¿cuál?», con candidatos).
- **Seguridad.** Idempotencia por `op_id`, deshacer exacto (restaura el objeto anterior) y auditoría en `preferences.evieAudit` (últimas 200 entradas, solo títulos, nunca el texto de las notas). Sin JS, SQL, shell, URLs ni secretos arbitrarios.
- **Herramientas que ya existían.** Finanzas (`log_transaction`, `transfer_money`), Físico (`log_workout`) y Kisha/navegación siguen igual.
- **Estilo.** Cálido, usa el nombre preferido «de vez en cuando» y no emite etiquetas de voz ni corchetes. Kisha no bromea en temas sensibles.

### Kisha
- **Conversaciones largas.**
  - Turno de hasta 8000 caracteres (antes 2000).
  - Un turno normal de micrófono dura hasta 55 s (antes 45) y tolera pausas de 2,2 s.
  - Nuevo botón **«Relato largo»**: hasta 15 min, grabado en segmentos de 50 s que se transcriben en orden mientras sigues hablando. El texto aparece en el cuadro (**editable**) para revisarlo antes de enviar.
  - Si un segmento falla, se puede reintentar sin volver a grabar.
- **Contexto y costo acotados.**
  - Cada turno envía como máximo unos 20 000 caracteres de mensajes recientes (24 000 de límite en el servidor).
  - Lo anterior viaja en un **resumen continuo** de hasta 2400 caracteres, que se pide cada vez que quedan turnos fuera de la ventana.
- **Flujo de cierre.** El de concluir, revisar y guardar se conserva igual (nada se guarda sin tu confirmación).
- **Personaje SVG original**, más fiel a la referencia tricolor:
  - Manchas canela en cejas y mejillas, pecas en el hocico, orejas rosadas por dentro y collar blanco.
  - Nuevas poses: `greet`, `tilt`, `wag` y `sit`, además de las anteriores (`idle`, `listening`, `thinking`, `speaking` con boca sincronizada al audio real, `supportive`/calma, `resting` = echada).
  - La imagen de referencia **no** se incrusta.

### Shell
- **Vidrio esmerilado** en la barra lateral, el encabezado y el riel de contexto, con tema oscuro y claro. El encabezado de Inicio sigue transparente sobre el HUD.
- **Respaldo opaco** si el navegador no soporta `backdrop-filter` o se pide transparencia reducida.
- Sin cambios de posición, así que no tapa contenido.

## 2. Archivos

- **Nuevos — Finanzas:** `public/evie-finance.js`, `evie-finance-ui.js`, `evie-finance.css`.
- **Nuevos — Físico:** `fisico-core.js`, `fisico-body.js`, `fisico-view.js`, `fisico.css`.
- **Nuevos — voz y acciones:** `evie-timers.js`, `evie-timers.css`, `evie-mic.js`, `evie-mic.css`, `evie-actions.js`.
- **Nuevos — shell:** `evie-v4-shell.css`.
- **Nuevos — datos:** `scripts/supabase-export.mjs`, `scripts/supabase-restore.mjs`.
- **Nuevos — docs:** `docs/AUDIT-v4.md`, `docs/V4-REPORT.md`.
- **Nuevos — pruebas:**
  - Unitarias: `tests/finance-ivi`, `fisico`, `timers`, `actions`, `mic-kisha-long`.
  - E2E: `tools/e2e-finance`, `e2e-fisico`, `e2e-v4voice`, más `tools/regress-v4.sh`.
- **Parches reproducibles:** `tools/patches/v4_*.py`.
- **Modificados:**
  - Finanzas: `finance-core.js`, `views.js`, `forms.js`, `evie-modules.js`, `evie-life.js`.
  - Navegación y configuración: `config.js`, `app.js`, `index.html`, `ivy-command-bus.js`, `ivy-local-tools.js`, `neural-signals.js`, `sw-manifest.js`.
  - Gym y vistas: `gym-log.js`, `module-experience.js`, `rc-app.js`, `v2-views.js`.
  - Asistente, HUD y sonidos: `evie-assistant.js`, `evie-hud-cards.js`, `evie-sounds.js`.
  - Kisha (cliente): `kisha-character.js`, `kisha-core.js`, `kisha-view.js`, `kisha-voice.js`, `kisha.css`.
  - Servidor: `src/assistant.js`, `src/kisha.js`, `src/research.js`.
  - Pruebas existentes: `tests/accounts.test.cjs` (21 secciones), `tools/e2e-gym.mjs`, `tools/e2e-life.mjs` (cambios intencionales de ruta).

## 3. Pruebas (ejecutadas en el sandbox)

- **Unitarias:** `npm run test:desktop` da **291/291**.
- **E2E (Playwright, servidor `wrangler pages dev` local):**

| Suite | Resultado |
|---|---|
| finance | 17/17 a 1440 y 390 |
| fisico | 16/16 a 1440 y 390 |
| v4voice | 13/13 a 1440 y 390 |
| gym, hud, drafts, memory, map, login, v31, workspace, kisha, life | todas OK |

- **Defecto encontrado y corregido:** el botón «Relato largo» desbordaba a 390 px.
- **Registro completo:** `evidence/v4-regression-all.txt`.
- **Capturas:** `evidence/v4-fisico-{1440,390}.png` y `evidence/v4-shell-{dark,light}-{1440,390}.png`.

## 4. Limitaciones honestas

- **Web e iOS en segundo plano.**
  - Una página web no puede escuchar «Ivi» ni hacer sonar un temporizador con el navegador cerrado o suspendido (iOS, sobre todo).
  - Al volver, el temporizador se muestra como «terminó mientras no estabas».
  - En iPhone y iPad no hay escucha continua: hay que tocar el núcleo o el micrófono.
- **Notificaciones** solo con permiso dado desde un clic. En iOS requieren instalar la app en la pantalla de inicio (iOS 16.4+).
- **Temporizadores por dispositivo.** No se sincronizan a propósito: la alarma suena donde la creaste.
- **Relato largo.**
  - Necesita la cuenta EVIE con voz (Groq).
  - Consume el límite diario de voz (`stt_seconds`, 1800 s/día por defecto). Un relato de 15 min usa la mitad.
- **Personaje.** Kisha y el cuerpo de Físico son ilustraciones SVG originales y esquemáticas, no modelos 3D ni la imagen de referencia. Las animaciones respetan «reducir movimiento».
- **Recuperación muscular.** Es una referencia práctica (48–72 h), no una regla biológica ni consejo médico.
- **Ivi edita registros.** Se limita a las 8 operaciones listadas. Hábitos, Objetivos y Aprendizaje (rutas completas) siguen usando sus borradores con confirmación.
- **Supabase real.** No pude conectarme al proyecto (no hay credenciales en el sandbox). La auditoría se basa en las migraciones del repo; verifica con el §1 de `docs/AUDIT-v4.md`.

## 5. Migraciones

- **Ninguna requerida para v4** (ver `docs/AUDIT-v4.md` §5). Todo usa colecciones ya permitidas en `crm_records` y JSON de `user_preferences`.
- **D1** sin cambios.

## 6. Pasos manuales para publicar

1. **Respaldo** (en tu computadora):
   - Supabase: `node scripts/supabase-export.mjs ~/evie-respaldos`.
   - D1: `npx wrangler d1 export evie-auth --remote --output=evie-auth-<fecha>.sql`.
2. **Verifica en Supabase** (SQL Editor) que las cuatro migraciones de `migrations/supabase/` estén aplicadas (incluida `automations`).
3. **Código:** descomprime el zip sobre tu clon, o aplica los commits, y luego `git push origin main`.
4. **Compila y despliega:**
   - `npm ci && npm run build`
   - `npx wrangler d1 migrations apply evie-auth --remote` (no hay nuevas; es solo una comprobación)
   - `npx wrangler pages deploy dist --project-name <tu-proyecto>`
5. **Secretos:** no cambian. Si faltara alguno: `npx wrangler pages secret put NOMBRE --project-name <tu-proyecto>` (lista en `docs/AUDIT-v4.md` §4).
6. **Prueba en producción:**
   - **Finanzas:** «Ivi, gasté 200 pesos de mi dinero físico en comida» → una fila con insignia «Dinero Físico».
   - **Físico:** «Ivi, hoy entrené pecho y espalda» → Físico resaltado.
   - **Temporizador:** «pon un temporizador de 1 minuto» → suena.
   - **Aislamiento:** entra con la otra cuenta y comprueba que no ve esos datos.
7. **Rollback:** *Cloudflare → Deployments → Rollback*, o `git revert`. Datos: `node scripts/supabase-restore.mjs <respaldo>.json --apply`.
