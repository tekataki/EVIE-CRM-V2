param([ValidateSet('voices','speak')][string]$Mode='voices',[string]$InputFile,[string]$OutputFile)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
 $voices=@($s.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { @{name=$_.VoiceInfo.Name;culture=$_.VoiceInfo.Culture.Name} })
 if($Mode -eq 'voices'){ConvertTo-Json -InputObject $voices -Compress;exit 0}
 $p=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
 if($p.text.Length -gt 5000 -or $p.rate -lt -5 -or $p.rate -gt 5 -or $p.volume -lt 0 -or $p.volume -gt 100){throw 'Invalid speech parameters'}
 $selected=$voices | Where-Object name -eq $p.voice | Select-Object -First 1
 if(-not $selected){$selected=$voices | Where-Object culture -like 'es-*' | Select-Object -First 1}
 if($selected){$s.SelectVoice($selected.name)}
 $s.Rate=[int]$p.rate;$s.Volume=[int]$p.volume
 $s.SetOutputToWaveFile($OutputFile)
 $s.Speak([string]$p.text)
 $s.SetOutputToNull()
 @{voice=$s.Voice.Name;spanish=($s.Voice.Culture.Name -like 'es-*');warning=$(if($s.Voice.Culture.Name -notlike 'es-*'){'Instala una voz española en Configuración de Windows > Hora e idioma > Voz.'}else{''})}|ConvertTo-Json -Compress
} finally {$s.Dispose()}
