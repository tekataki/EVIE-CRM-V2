$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT'){throw 'Este script requiere Windows'}
Set-Location (Split-Path $PSScriptRoot -Parent)
& npm.cmd ci
if($LASTEXITCODE -ne 0){throw 'npm ci fallo'}
& npm.cmd run dev:desktop
if($LASTEXITCODE -ne 0){throw 'No se pudo iniciar EVIE'}
