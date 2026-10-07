# EVIE Desktop 2.1 · instalación y desarrollo en Windows

Para actualizar una instalación existente, consulta primero [UPDATING_WINDOWS.md](UPDATING_WINDOWS.md): no desinstales ni importes encima de datos correctos.

Estado: código implementado; la aceptación final de voz, transparencia, controles Windows e instalador requiere un PC Windows. Las pruebas Linux y los fixtures no sustituyen esa aceptación. No hay APIs de pago en el modo predeterminado.

## 1. Preparar y conservar los datos

- Windows 10/11 x64; Acrylic depende de la versión de Windows y del compositor. Usa Sólido si no se admite.
- Node.js 22 LTS, versión **22.12 o posterior**, y npm. Descarga desde https://nodejs.org/.
- Descomprime el código completo en una carpeta propia, por ejemplo `C:\Users\TU_USUARIO\Projects\evie`. El ZIP de código exportado desde el navegador contiene únicamente la web, no el host Electron.
- Antes de cambiar de origen, exporta en el EVIE anterior **Configuración → Respaldo completo ZIP con imágenes**. Conserva una copia intacta. Nunca borres el perfil para solucionar problemas.
- Desktop usa `evie://app/index.html`, el perfil `%APPDATA%\EVIE-CRM-V2`, `localStorage['dali-os-local-v1']` y la base IndexedDB `dali-os-local-v1-media`. No copia perfiles Chrome ni sincroniza con tu teléfono. Importa el ZIP explícitamente en Desktop.

Abre PowerShell como usuario normal en la carpeta del proyecto:

```powershell
node --version
npm --version
npm ci
npm run test:desktop
npm run dev:desktop
```

No hace falta ejecutar el servidor web para Desktop. `scripts/dev-windows.ps1` automatiza instalación y apertura. Si tu política bloquea scripts, usa los comandos anteriores directamente; no desactives las protecciones del sistema.

## 2. Ollama y modelo local

1. Instala Ollama desde https://ollama.com/download/windows. Mantén su servicio escuchando en loopback; no abras el puerto 11434 al exterior.
2. Ejecuta `ollama --version` y `ollama list`.
3. Ejecuta `powershell -NoProfile -File .\scripts\setup-local-ai.ps1`. El script pide `DESCARGAR` antes de iniciar el modelo principal (aproximadamente 3–5 GB, sujeto al tamaño real anunciado por Ollama). No se descarga al arrancar EVIE.
4. Alternativamente, tras aceptar el tamaño tú mismo:

```powershell
ollama pull qwen3.5:4b
# Solo si no está disponible o necesitas el fallback:
ollama pull qwen3:4b
ollama list
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

En Configuración pulsa Consultar modelos instalados. Solo son compatibles los que Ollama declara con capacidades completion y tools. Elige y guarda explícitamente el modelo; Rápido y Más preciso usan sus selecciones guardadas. Ivy NO cambia de modelo, descarga ni usa fallback automáticamente. Si el seleccionado falta, informa el error sin ejecutar herramientas.

## 3. whisper.cpp local en español

La instalación es manual para no descargar ejecutables sin una verificación de confianza:

1. Abre la versión fijada https://github.com/ggml-org/whisper.cpp/releases/tag/v1.7.6.
2. Obtén `whisper-bin-x64.zip` de esa publicación oficial y extrae **todo** el archivo, incluidas las DLL. Comprueba la procedencia y el digest que publique GitHub para el asset si está disponible. Si no hay un digest verificable, no inventes uno ni uses mirrors desconocidos; puedes compilar esa etiqueta siguiendo la documentación oficial.
3. Coloca `whisper-cli.exe` y sus DLL en `%LOCALAPPDATA%\EVIE\ai\whisper\`.
4. Descarga `ggml-small.bin` multilingüe (aprox. 466 MiB) desde https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-small.bin. Alternativa más rápida: https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-base.bin (aprox. 142 MiB). No uses los modelos `.en`.
5. Antes de usarlo, compara `Get-FileHash RUTA_AL_MODELO -Algorithm SHA256` con el SHA-256/LFS oid de la página oficial de ese archivo. El nombre del archivo no es una verificación criptográfica.
6. Guarda el modelo en `%LOCALAPPDATA%\EVIE\ai\models\`.
7. En EVIE → Configuración → Equipo, voz y privacidad, selecciona el binario y el modelo con los selectores nativos. Si usas `base`, selecciónalo explícitamente.

Prueba sin grabar nada desde terminal:

```powershell
& "$env:LOCALAPPDATA\EVIE\ai\whisper\whisper-cli.exe" --help
powershell -NoProfile -File .\scripts\verify-local-ai.ps1
```

El script de verificación revisa rutas predeterminadas; Diagnóstico en la app revisa las rutas configuradas. Ver un archivo presente no garantiza que funcione: completa la prueba de voz real.

## 4. Voz offline y micrófono

1. Windows → Configuración → Hora e idioma → Voz/Idioma: instala una voz española si está disponible. Las voces modernas de Windows no siempre son visibles para SAPI de escritorio.
2. EVIE → Configuración → Cargar voces instaladas. Selecciona una voz disponible, velocidad y volumen, guarda y pulsa Probar voz.
3. Sin voz española SAPI, EVIE usa la predeterminada y muestra una advertencia; no descarga ni activa un proveedor cloud.
4. En Privacidad de Windows permite el micrófono para aplicaciones de escritorio. Pulsa Probar micrófono en EVIE y acepta el diálogo nativo.
5. El medidor debe responder a tu voz. El modo diagnóstico **no transcribe ni envía audio**: descarta al detener o tras 59 segundos.
6. Para hablar con Ivy, pulsa el núcleo, Escuchar o `Ctrl+Espacio`; una pausa real de 1.100 ms tras voz sostenida envía la frase. Tras la respuesta y finalizar el WAV, vuelve a escuchar. Otro clic o Detener descarta la captura y cancela trabajo pendiente. No escucha automáticamente. El atajo global requiere activación explícita.

Flujo real por comprobar: crea con el formulario una cita hoy a las 16:00. Di «Ivy, checa qué tengo hoy en el calendario». Después «Cambia la cita de las cuatro para mañana a las cinco». Revisa proveedor, ID, fecha/hora anterior y nueva en la preview de confirmación. Usa Confirmar o Decir «Sí, confirma»; el token sirve una sola vez para esa acción. Confirma y revisa Agenda. Si hay dos coincidencias, exige una aclaración; nunca aceptes un ID inventado. Repite cancelando para comprobar que no cambia nada.

## 5. Windows y apariencia

- Usa Buscar aplicaciones instaladas: Win32, accesos Start Menu sin argumentos, AppUserModelID Store y protocolos seguros registrados. Autoriza individualmente; no se autoriza una carpeta de ejecutables. También hay selector nativo de `.exe`.
- Cada entrada muestra nombre, fuente/editor, icono cuando Windows lo ofrece, capacidades y revocación. Store/protocolos solo apertura; Win32 también foco/minimizar/maximizar/restaurar y cierre normal confirmado.
- Spotify abre una búsqueda codificada y no afirma reproducción exacta. WhatsApp prepara un borrador con destinatario/mensaje completos confirmados; no envía. Opera puede abrirse como app; la búsqueda web usa el navegador predeterminado.
- Autoriza carpetas de destino y archivos individuales con el selector. Renombrar conserva extensión, mover no sobrescribe y solo admite el mismo volumen, Papelera no tiene fallback destructivo. Las rutas de sistema/perfil sensibles se rechazan.
- Permitir siempre se limita a acción/aplicación de bajo riesgo y se revoca en Configuración. Cierre, borradores, cambios CRM y cambios de archivo siempre requieren confirmación.
- Autoriza solo dominios HTTPS concretos. No se aceptan subdominios implícitos, credenciales en URL ni puertos arbitrarios.
- Crystal/Acrylic es predeterminado en Windows; el modo Transparente experimental es fijo y no maximizable. Sólido funciona como fallback.
- Cambiar el modo requiere reiniciar. Guarda formularios primero. Ajusta opacidad y brillo reducido; usa Movimiento reducido si necesitas una escena estática.
- Comprueba fondos claros/oscuros: la apariencia Linux o una captura web no demuestra transparencia del wallpaper Windows.

## 6. Construir e instalar sin servicio de pago

Cierra EVIE Desktop antes de probar o empaquetar. Desde el código completo:

```powershell
npm ci
npm run test:desktop
npm run make:win
Get-FileHash .\out\make\squirrel.windows\x64\EVIE-CRM-V2-Setup.exe -Algorithm SHA256
```

También puedes usar `powershell -NoProfile -File .\scripts\build-windows.ps1`.

Salida esperada de Electron Forge/Squirrel:

`out\make\squirrel.windows\x64\EVIE-CRM-V2-Setup.exe`

La ruta esperada no significa que ya exista un instalador entregado. Verifica que el comando termine y el archivo exista. Se genera además un ZIP mediante el maker ZIP. Instala como usuario normal. Un build personal sin firma puede mostrar SmartScreen; verifica origen/hash y no desactives Defender. La firma de código es opcional y no se incluye en el camino gratuito.

Tras instalar, abre, cierra y vuelve a abrir: comprueba tus registros e imágenes y exporta otro respaldo. Desarrollo e instalación usan el mismo perfil estable; no ejecutes ambos a la vez. No ejecutes las pruebas de Electron sobre tu perfil personal; el runner crea un perfil temporal aislado.

## 7. Pruebas web y Desktop

Terminal web (local Windows, fuera del sandbox): `npm run dev:web -- --host 127.0.0.1 --port 3000`. En otra terminal:

```powershell
npx playwright install chromium
npm test
npm run test:visual
npm run test:electron
```

`npm test` necesita la web en el puerto 3000 y usa stores QA aislados. `test:desktop` es la suite Node y no necesita servidor. `test:electron` necesita una sesión gráfica y EVIE cerrado. Nunca consideres los fixtures una prueba real de Whisper/Ollama/SAPI.

## Problemas frecuentes

- **Ollama offline:** inicia Ollama y revisa `/api/tags`; no cambies el endpoint a una IP remota.
- **Whisper no inicia:** comprueba x64, DLL contiguas, modelo y rutas configuradas. No confundas el modelo inglés con multilingüe.
- **PowerShell/SAPI bloqueado:** revisa la política aplicada a tu cuenta y la procedencia de los scripts con tu administrador. EVIE no usa ExecutionPolicy Bypass.
- **Sin voz española:** carga voces y prueba la predeterminada; instala una voz SAPI compatible.
- **Micrófono denegado:** revisa el permiso Windows y pulsa Autorizar micrófono en Configuración de EVIE. La decisión se conserva y es revocable. No se repite el diálogo ni se reintenta en bucle.
- **No se abre/focaliza una app:** configura un ejecutable real; Windows puede negar foco o el programa puede ser una app empaquetada sin `.exe` convencional. El resultado debe mostrar el fallo, no simular éxito.
- **Faltan datos:** verifica origen/perfil y restaura tu ZIP explícitamente. No borres `%APPDATA%\EVIE-CRM-V2`.
- **Pantalla sin transparencia:** usa Sólido y verifica Windows/compositor. No hay control del wallpaper en web.
- **Google:** consulta `GOOGLE_CALENDAR_SETUP.md`; sigue siendo opcional y no cambia la Agenda local.

Completa y fecha `WINDOWS_ACCEPTANCE.md` antes de declarar aceptada la actualización 2.1 en Windows. No aparece configuración al iniciar: usa manualmente Diagnóstico de equipo o Volver a ejecutar configuración.
