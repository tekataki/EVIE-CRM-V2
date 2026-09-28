$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'EVIE\ai'
Write-Host 'EVIE - instalacion local sin APIs de pago. No se cambian permisos ni protecciones.'
$ollama=Get-Command ollama -ErrorAction SilentlyContinue
if(-not $ollama){Write-Host 'Instala Ollama desde https://ollama.com/download/windows y vuelve a ejecutar este script.'}else{
 Write-Host 'qwen3.5:4b requiere aproximadamente 3-5 GB de descarga (puede variar). Revisa el tamano mostrado por Ollama. No inicia sin confirmar.'
 if((Read-Host 'Escribe DESCARGAR para autorizar ollama pull qwen3.5:4b') -ceq 'DESCARGAR'){
  & $ollama.Source pull 'qwen3.5:4b'
  if($LASTEXITCODE -ne 0){Write-Warning 'No se descargo el modelo principal. Puedes autorizar el fallback.'
   if((Read-Host 'Escribe FALLBACK para descargar qwen3:4b (aprox. 2.5-4 GB)') -ceq 'FALLBACK'){& $ollama.Source pull 'qwen3:4b';if($LASTEXITCODE -ne 0){throw 'Fallo al descargar fallback'}}
  }
 }
}
New-Item -ItemType Directory -Force -Path (Join-Path $root 'whisper'),(Join-Path $root 'models') | Out-Null
Write-Host 'Whisper: instalacion manual verificada, no se descargan binarios sin checksum conocido.'
Write-Host 'Fuente fijada: https://github.com/ggml-org/whisper.cpp/releases/tag/v1.7.6'
Write-Host 'Extrae whisper-bin-x64.zip completo (incluidas DLL) en:' (Join-Path $root 'whisper')
Write-Host 'Modelos oficiales: https://huggingface.co/ggerganov/whisper.cpp/tree/main'
Write-Host 'Descarga ggml-small.bin multilingue (~466 MiB), o ggml-base.bin (~142 MiB). No uses .en.'
Write-Host 'Comprueba SHA-256 con Get-FileHash contra el oid SHA256 de Git LFS mostrado por el repositorio antes de usarlo.'
Write-Host 'Guarda el modelo en:' (Join-Path $root 'models')
Write-Host 'Si usas base, seleccionalo desde Configuracion > Equipo, voz y privacidad.'
Write-Host 'Guia completa: docs/WINDOWS_SETUP.md. Verifica despues con scripts/verify-local-ai.ps1.'
