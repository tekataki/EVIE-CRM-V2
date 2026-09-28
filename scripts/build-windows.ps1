$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT'){throw 'Compila el instalador en Windows x64'}
Set-Location (Split-Path $PSScriptRoot -Parent)
& npm.cmd ci
if($LASTEXITCODE -ne 0){throw 'npm ci fallo'}
& npm.cmd run test:desktop
if($LASTEXITCODE -ne 0){throw 'Pruebas desktop fallidas'}
& npm.cmd run make:win
if($LASTEXITCODE -ne 0){throw 'Forge no genero el instalador'}
$installer='out\make\squirrel.windows\x64\EVIE-CRM-V2-Setup.exe'
if(-not (Test-Path $installer)){throw 'No se encontro el instalador esperado'}
Write-Host 'Instalador personal sin firma:' (Resolve-Path $installer)
Write-Host 'SmartScreen puede advertir. No desactives protecciones; verifica origen y hash.'
Get-FileHash $installer -Algorithm SHA256
