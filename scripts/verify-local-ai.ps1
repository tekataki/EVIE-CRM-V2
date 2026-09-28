$ErrorActionPreference='Continue'
$root=Join-Path $env:LOCALAPPDATA 'EVIE\ai'
Write-Host 'Windows:' [Environment]::OSVersion.VersionString
try {$models=Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5;Write-Host 'Ollama accesible en loopback';$models.models | Select-Object name,size}catch{Write-Warning 'Ollama no responde localmente. Inicia Ollama.'}
Write-Host 'Whisper CLI:' (Test-Path (Join-Path $root 'whisper\whisper-cli.exe'))
Write-Host 'Modelo small:' (Test-Path (Join-Path $root 'models\ggml-small.bin'))
Write-Host 'Modelo base:' (Test-Path (Join-Path $root 'models\ggml-base.bin'))
& (Join-Path $PSScriptRoot 'windows-tts.ps1') -Mode voices
Write-Host 'El microfono se prueba con consentimiento en EVIE > Configuracion > Probar microfono.'
Write-Host 'Estas rutas son las predeterminadas. Las rutas elegidas en EVIE se comprueban en Diagnostico.'
