# EVIE para Windows · wake word «Ivi», on this PC only.
# Windows' own speech recognizer (Windows.Media.SpeechRecognition) with a fixed list of phrases, in the system
# language (es-MX here). List constraints are recognized on the device: no audio leaves this process, and anything
# that is not one of the phrases comes back «rejected» and is dropped. EVIE only starts its normal (cloud) listening
# after a detection.
# 2.5.1: many spoken variants (b/v sound the same in Spanish, «e» or «i» at the start, accents, «y vi», with oye/hey/ok…),
# and -Sensitivity high also accepts a LOW-confidence match when the utterance was short (≤ 1.6 s): a lone word that
# sounds like «Ivi» is almost always the name. Every recognized phrase is reported as "heard" for the diagnostics panel
# (only phrases from this list ever appear there: nothing else that is said is ever written out).
# Stdout: JSON lines only. {"type":"ready","language":"es-MX","phrases":n,"microphone":"…"} once, then
# {"type":"heard","text":"…","confidence":"Low","ms":620,"accepted":true} per recognized phrase and
# {"type":"wake","text":"oye ivi","confidence":"High"} per detection; problems as {"type":"error","error":"..."}.
# -Seconds N stops after N seconds and -Probe only checks that the recognizer compiles (tests and diagnostics).
param([ValidateRange(0,86400)][int]$Seconds=0,[switch]$Probe,[ValidateSet('high','normal')][string]$Sensitivity='high')
$ErrorActionPreference='Stop'
function Emit($obj){[Console]::Out.WriteLine(($obj|ConvertTo-Json -Compress));[Console]::Out.Flush()}
try{
 Add-Type -AssemblyName System.Runtime.WindowsRuntime
 [void][Windows.Media.SpeechRecognition.SpeechRecognizer,Windows.Media.SpeechRecognition,ContentType=WindowsRuntime]
 [void][Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]
 $asTask=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'}|Select-Object -First 1
 function Await($op,[Type]$type){$t=$asTask.MakeGenericMethod($type).Invoke($null,@($op));$t.Wait(-1)|Out-Null;$t.Result}
 $system=[Windows.Media.SpeechRecognition.SpeechRecognizer]::SystemSpeechLanguage
 $supported=@([Windows.Media.SpeechRecognition.SpeechRecognizer]::SupportedGrammarLanguages|ForEach-Object{$_.LanguageTag})
 $tag=if($supported -contains $system.LanguageTag){$system.LanguageTag}elseif($supported -contains 'es-MX'){'es-MX'}elseif($supported|Where-Object{$_ -like 'es-*'}){($supported|Where-Object{$_ -like 'es-*'})[0]}elseif($supported){$supported[0]}else{''}
 if(-not $tag){Emit @{type='error';error='unsupported'};exit 2}
 $rec=[Windows.Media.SpeechRecognition.SpeechRecognizer]::new([Windows.Globalization.Language]::new($tag))
 $spanish=$tag -like 'es-*'
 # How people actually say her name: «Ivi», «Ibi» (b = v), «Evi», «Ebi», «Evie», «Eevee», «Ivy», with or without an
 # accent, «y vi», and with a greeting in front. A short word that is NOT one of these is rejected by Windows.
 $names=if($spanish){@('ivi','ibi','evi','ebi','evie','eevee','ivy','iví','ibí','eví','ebí','y vi','i vi','hi vi')}else{@('evie','eevee','ivy','evey','eevie')}
 $greets=if($spanish){@('oye','hey','ey','ok','okey','hola','oiga')}else{@('hey','okay','ok','hi')}
 $core=if($spanish){@('ivi','ibi','evi','evie','iví')}else{@('evie','eevee','ivy')}
 $phrases=@($names)+@(foreach($g in $greets){foreach($n in $core){"$g $n"}})
 # Windows PowerShell sees the WinRT constraint list as a bare COM object: add through ICollection<T>.
 $collection=[System.Collections.Generic.ICollection``1].MakeGenericType([Windows.Media.SpeechRecognition.ISpeechRecognitionConstraint])
 [void]$collection.GetMethod('Add').Invoke($rec.Constraints,@([Windows.Media.SpeechRecognition.SpeechRecognitionListConstraint]::new([string[]]$phrases,'wake')))
 $compiled=Await ($rec.CompileConstraintsAsync()) ([Windows.Media.SpeechRecognition.SpeechRecognitionCompilationResult])
 if([string]$compiled.Status -ne 'Success'){Emit @{type='error';error='compile_'+[string]$compiled.Status};exit 3}
 $rec.Timeouts.InitialSilenceTimeout=[TimeSpan]::FromSeconds($(if($Seconds -gt 0){[Math]::Min(10,$Seconds)}else{30}))
 # Short pauses end an utterance quickly (her name is short) and long chatter resets sooner, so the next «Ivi» counts.
 $rec.Timeouts.EndSilenceTimeout=[TimeSpan]::FromMilliseconds(350)
 $rec.Timeouts.BabbleTimeout=[TimeSpan]::FromSeconds(3)
 # The microphone Windows uses (its default recording device), so the diagnostics can say which one is listening.
 $mic=''
 try{[void][Windows.Media.Devices.MediaDevice,Windows.Media.Devices,ContentType=WindowsRuntime];[void][Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
  $id=[Windows.Media.Devices.MediaDevice]::GetDefaultAudioCaptureId([Windows.Media.Devices.AudioDeviceRole]::Default)
  if($id){$mic=[string](Await ([Windows.Devices.Enumeration.DeviceInformation]::CreateFromIdAsync($id)) ([Windows.Devices.Enumeration.DeviceInformation])).Name}}catch{}
 Emit @{type='ready';language=$tag;phrases=$phrases.Count;microphone=$mic.Substring(0,[Math]::Min(80,$mic.Length));sensitivity=$Sensitivity}
 if($Probe){exit 0}
 $until=if($Seconds -gt 0){(Get-Date).AddSeconds($Seconds)}else{[DateTime]::MaxValue}
 $failures=0
 while((Get-Date) -lt $until){
  try{$r=Await ($rec.RecognizeAsync()) ([Windows.Media.SpeechRecognition.SpeechRecognitionResult]);$failures=0}
  catch{$failures++;Emit @{type='error';error=$_.Exception.InnerException.Message};if($failures -ge 5){exit 4};Start-Sleep -Seconds 2;continue}
  $status=[string]$r.Status;$conf=[string]$r.Confidence
  if($status -eq 'Success' -and $r.Text){
   $ms=[int]$r.PhraseDuration.TotalMilliseconds
   $accept=($conf -eq 'High' -or $conf -eq 'Medium' -or ($Sensitivity -eq 'high' -and $conf -eq 'Low' -and $ms -gt 0 -and $ms -le 1600))
   Emit @{type='heard';text=$r.Text;confidence=$conf;ms=$ms;accepted=$accept}
   if($accept){Emit @{type='wake';text=$r.Text;confidence=$conf}}
  }
  elseif($status -eq 'MicrophoneUnavailable' -or $status -eq 'AudioQualityFailure'){Emit @{type='error';error=$status};Start-Sleep -Seconds 3}
 }
}catch{Emit @{type='error';error=$_.Exception.Message};exit 1}
