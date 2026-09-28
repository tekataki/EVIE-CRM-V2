# Read-only discovery. Never downloads, elevates or edits the registry.
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$items=New-Object System.Collections.Generic.List[object]
function Add-Exe([string]$file,[string]$name,[string]$source){
 try { $file=[Environment]::ExpandEnvironmentVariables($file.Trim('"')); if([IO.Path]::GetExtension($file) -ine '.exe' -or -not [IO.File]::Exists($file)){return}; $info=[Diagnostics.FileVersionInfo]::GetVersionInfo($file); $items.Add(@{kind='exe';path=$file;name=$name;source=$source;publisher=$info.CompanyName}) } catch {}
}
$wsh=New-Object -ComObject WScript.Shell
foreach($folder in @([Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'))){
 Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1500 | ForEach-Object {
  try { $link=$wsh.CreateShortcut($_.FullName); if([string]::IsNullOrWhiteSpace($link.Arguments)){Add-Exe $link.TargetPath $_.BaseName $_.FullName} } catch {}
 }
}
foreach($root in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths','HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths')){
 Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | ForEach-Object {try {$file=$_.GetValue('');Add-Exe $file ([IO.Path]::GetFileNameWithoutExtension($file)) $_.Name}catch{}}
}
Get-StartApps -ErrorAction SilentlyContinue | Where-Object AppID -match '^[A-Za-z0-9_.-]+![A-Za-z0-9_.-]+$' | ForEach-Object {$items.Add(@{kind='store';aumid=$_.AppID;name=$_.Name;source='Windows StartApps / AppUserModelID';publisher=''})}
foreach($exe in @('notepad.exe','calc.exe')){Add-Exe (Join-Path $env:SystemRoot ('System32\'+$exe)) $exe 'Windows System32'}
Add-Exe (Join-Path $env:SystemRoot 'explorer.exe') 'Explorador de archivos' 'Windows Explorer'
foreach($scheme in @('spotify','roblox','whatsapp','discord','steam','com.epicgames.launcher')){
 try{ $key=Get-Item -LiteralPath ('Registry::HKEY_CLASSES_ROOT\'+$scheme) -ErrorAction Stop;if($null -ne $key.GetValue('URL Protocol')){$items.Add(@{kind='protocol';protocol=$scheme;name=$scheme;source='Registered URI protocol';publisher=''})}}catch{}
}
ConvertTo-Json -InputObject @($items | Select-Object -First 2500) -Depth 4 -Compress
