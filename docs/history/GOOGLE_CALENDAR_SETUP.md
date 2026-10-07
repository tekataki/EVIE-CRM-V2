# Google Calendar opcional · cliente de escritorio

Ivy funciona primero con la Agenda local. No necesitas Google ni API de pago para usar Ollama/Whisper/SAPI. La conexión de esta fase proporciona OAuth y un proveedor de lectura; **no activa sincronización ni escrituras automáticas en Google**. Las herramientas `crm.*` siempre muestran y modifican LocalAgendaProvider.

## Preparación
1. Entra con tu cuenta en https://console.cloud.google.com/ y crea un proyecto personal, por ejemplo EVIE Personal.
2. APIs y servicios → Biblioteca → busca Google Calendar API → Habilitar.
3. Google Auth Platform (o Pantalla de consentimiento OAuth): completa Branding con nombre EVIE y tu correo de soporte/desarrollador.
4. En Audience elige External para una cuenta personal. Si está en Testing, añade tu propio correo como Test user. No publiques para terceros sin revisar los requisitos de Google.
5. En Data Access agrega el scope `https://www.googleapis.com/auth/calendar.events`. Permite leer y editar eventos; EVIE lo anuncia antes de consentir. Esta fase no necesita acceso a Gmail, contactos ni Drive.
6. Clients → Create client → **Desktop app**. No elijas Web application ni añadas orígenes JavaScript de navegador. Pon un nombre reconocible y descarga el archivo JSON de ese cliente.
7. No pegues el JSON, client_secret ni tokens en chat, Git, HTML o localStorage. Guárdalo temporalmente en una carpeta privada.

## Conectar en EVIE Desktop
1. Configuración → Equipo, voz y privacidad → Google Calendar → **Importar configuración OAuth**.
2. Selecciona el JSON descargado. El main process acepta únicamente el bloque `installed`, almacena la configuración cifrada con safeStorage y no devuelve secretos al renderer. El client ID no es secreto; el archivo completo se cifra por consistencia.
3. Pulsa **Conectar**, lee el alcance y confirma. Se abre tu navegador del sistema en accounts.google.com.
4. Selecciona tu cuenta de prueba y acepta. El callback usa `http://127.0.0.1:<puerto-efímero>/oauth/callback`, PKCE y state. No abras puertos del router ni desactives el firewall.
5. Vuelve a EVIE y ejecuta Diagnóstico. Debe mostrar `googleConnected:true`. Si aparece acceso bloqueado, revisa Test users, tipo Desktop y habilitación de Calendar API.
6. **Desconectar** elimina el token local. Para revocar completamente el acceso entra también en https://myaccount.google.com/permissions.

## Límites y mantenimiento
- `GoogleCalendarProvider` está en electron/calendar/google.cjs; ofrece listEvents y refresh automático del token. No se expone el token a la interfaz.
- No se ha probado con credenciales reales en este entorno. El flujo de consentimiento necesita validación en tu Windows.
- En proyectos External/Testing, Google puede caducar refresh tokens según su política. Reconecta si el refresh se rechaza.
- Si safeStorage no puede cifrar con el sistema operativo, EVIE no conecta ni escribe tokens en claro. Agenda local permanece disponible.
- La ampliación futura de create/update/delete remotos debe añadir selección explícita de proveedor, vista previa, confirmación y reconciliación por IDs; no basta con reutilizar la herramienta local sobre Google.
