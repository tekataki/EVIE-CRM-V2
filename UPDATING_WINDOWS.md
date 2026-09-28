# Actualizar EVIE CRM V2 a 2.1.0 en Windows

## Estado y límites

Esta entrega contiene código fuente actualizado. No contiene un instalador Windows construido ni certificado en este entorno Linux. La actualización sobre una instalación real debe pasar `WINDOWS_ACCEPTANCE.md` antes de distribuirse. No desinstales ni borres el perfil para actualizar.

## Identidad invariable

- Nombre de aplicación y producto: `EVIE CRM V2`.
- App ID: `com.evie.crm.v2`.
- Origen: `evie://app` (entrada `evie://app/index.html`).
- Perfil: `%APPDATA%\EVIE-CRM-V2`.
- Assets IA: `%LOCALAPPDATA%\EVIE\ai` y las rutas personalizadas ya guardadas.
- Instalador: `EVIE-CRM-V2-Setup.exe`.
- Clave de datos: `dali-os-local-v1`; imágenes: IndexedDB `dali-os-local-v1-media`.
- El Store personal sigue en esquema 4. No se renombra ni se crea un segundo libro financiero.

## Antes de actualizar

1. En la instalación existente exporta **Configuración → Respaldo completo ZIP con imágenes**. Guarda una copia fuera del perfil.
2. Anota versión, cantidad de registros, imágenes de referencia, modelo/voz seleccionados, rutas Whisper y aplicaciones autorizadas.
3. Cierra EVIE, incluida la bandeja. Copia el directorio completo `%APPDATA%\EVIE-CRM-V2` a una carpeta de respaldo fechada mientras EVIE está cerrado. Incluye los subdirectorios de Chromium, localStorage e IndexedDB; no copies solo el JSON.
4. Conserva `%LOCALAPPDATA%\EVIE\ai` y los archivos de IA personalizados. La actualización no los descarga, reemplaza ni elimina.

## Construir y actualizar

En Windows x64, con Node 22.12 o posterior, en el código completo:

```powershell
npm ci
npm run test:desktop
npm run dev:desktop
# Cierra la ventana de desarrollo antes de empaquetar.
npm run make:win
Get-FileHash .\out\make\squirrel.windows\x64\EVIE-CRM-V2-Setup.exe -Algorithm SHA256
```

Ejecuta `out\make\squirrel.windows\x64\EVIE-CRM-V2-Setup.exe` como el mismo usuario de la instalación anterior, sin desinstalarla. El empaquetado conserva el nombre Squirrel `evie_crm_v2`. No ejecutes simultáneamente desarrollo e instalación: comparten el perfil estable. Un build sin firma puede mostrar SmartScreen; verifica su origen/hash, no desactives Defender.

## Migración conservadora

- `desktop-settings.json` versión 1 se respalda **byte por byte** como `desktop-settings.pre-2.1.0.<timestamp>.json` antes de guardarse como versión 2.
- Se preservan propiedades anteriores, aplicaciones, grants, carpetas, voz y rutas de IA. La opacidad antigua .28–.85 se convierte a 0–100. La configuración no se abre automáticamente y `setupDone` se marca verdadero en la migración.
- Un archivo corrupto o de una versión posterior provoca un error y se conserva: no se sustituye silenciosamente por un perfil vacío.
- Antes de la primera escritura del adaptador de Ivy se guarda un snapshot JSON en `<storageKey>-pre-2.1.0`. Si falta espacio para ese snapshot, se rechaza la escritura. No sustituye el respaldo ZIP con imágenes.
- No hay migración de IndexedDB ni borrado/reconstrucción del Store personal.
- Los grants antiguos se conservan como datos. Acciones nuevas requieren su alcance exacto; un grant antiguo genérico no desbloquea escrituras ni cierre de aplicaciones.

## Comprobación posterior

1. Comprueba registros, imágenes, Agenda, Finanzas y rutas de IA. No importes un respaldo encima de datos correctos solo por haber actualizado.
2. No debe aparecer «Prepara Ivy en tu equipo» al arrancar. Abre manualmente **Diagnóstico de equipo** o **Volver a ejecutar configuración**.
3. Consulta los modelos instalados. Elige explícitamente el seleccionado, Rápido o Más preciso y guarda; no hay fallback ni descarga automáticos.
4. Autoriza una vez el micrófono en EVIE y verifica el permiso independiente de Windows. Tras reiniciar debe mantenerse el consentimiento. Revocarlo detiene la sesión.
5. Comprueba los dos ejemplos Finanzas/Agenda de `UPDATE_2_1_REPORT.md` con datos de prueba y confirma solo el registro correcto.
6. Revisa el catálogo y los permisos persistentes antes de autorizar nuevas acciones. Prueba Papelera solo con un archivo desechable.
7. Exporta un nuevo ZIP completo y conserva también el anterior.

## Rollback sin perder información

Cierra EVIE y conserva primero una copia fechada del perfil actual, incluso si presenta un fallo. Para volver a 2.0, usa el instalador/código anterior y restaura **la copia completa del perfil tomada con esa versión**, no solo sus preferencias. La versión antigua no entiende la nueva escala de opacidad. Si necesitas conservar registros creados después de actualizar, exporta un ZIP desde 2.1 antes de volver y evalúa su importación con una copia de prueba. Nunca borres el perfil ni los modelos como paso de reparación.

Si no hay respaldo íntegro o falla la migración, detén la actualización y conserva los archivos para diagnóstico; no inicialices otro perfil. Esta guía describe el procedimiento previsto, no acredita una prueba real del instalador.
