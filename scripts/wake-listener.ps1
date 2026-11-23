# EVIE para Windows · wake word «Ivi», on this PC only.
# Windows' own speech recognizer (Windows.Media.SpeechRecognition) with a fixed list of phrases, in the system
# language (es-MX here). List constraints are recognized on the device: no audio leaves this process, and anything
# that is not one of the phrases comes back «rejected» and is dropped. EVIE only starts its normal (cloud) listening
# after a detection.
# Stdout: JSON lines only. {"type":"ready","language":"es-MX"} once, then {"type":"wake","text":"oye ivi","confidence":"High"}
# per detection; problems as {"type":"error","error":"..."} (fatal ones exit non-zero).
# -Seconds N stops after N seconds and -Probe only checks that the recognizer compiles (tests and diagnostics).
param([ValidateRange(0,86400)][int]$Seconds=0,[switch]$Probe)
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
 # Spoken variants of the name. «Y vi…» or «viví…» are not in the list, so they are rejected rather than mistaken for her.
 $phrases=if($spanish){@('ivi','ibi','ivy','oye ivi','oye ibi','hey ivi','ey ivi','ok ivi','okey ivi','hola ivi','evie','oye evie')}else{@('evie','eevee','ivy','hey evie','okay evie','hey ivy')}
 # Windows PowerShell sees the WinRT constraint list as a bare COM object: add through ICollection<T>.
 $collection=[System.Collections.Generic.ICollection``1].MakeGenericType([Windows.Media.SpeechRecognition.ISpeechRecognitionConstraint])
 [void]$collection.GetMethod('Add').Invoke($rec.Constraints,@([Windows.Media.SpeechRecognition.SpeechRecognitionListConstraint]::new([string[]]$phrases,'wake')))
 $compiled=Await ($rec.CompileConstraintsAsync()) ([Windows.Media.SpeechRecognition.SpeechRecognitionCompilationResult])
 if([string]$compiled.Status -ne 'Success'){Emit @{type='error';error='compile_'+[string]$compiled.Status};exit 3}
 $rec.Timeouts.InitialSilenceTimeout=[TimeSpan]::FromSeconds($(if($Seconds -gt 0){[Math]::Min(10,$Seconds)}else{30}))
 $rec.Timeouts.EndSilenceTimeout=[TimeSpan]::FromMilliseconds(450)
 $rec.Timeouts.BabbleTimeout=[TimeSpan]::FromSeconds(4)
 Emit @{type='ready';language=$tag;phrases=$phrases.Count}
 if($Probe){exit 0}
 $until=if($Seconds -gt 0){(Get-Date).AddSeconds($Seconds)}else{[DateTime]::MaxValue}
 $failures=0
 while((Get-Date) -lt $until){
  try{$r=Await ($rec.RecognizeAsync()) ([Windows.Media.SpeechRecognition.SpeechRecognitionResult]);$failures=0}
  catch{$failures++;Emit @{type='error';error=$_.Exception.InnerException.Message};if($failures -ge 5){exit 4};Start-Sleep -Seconds 2;continue}
  $status=[string]$r.Status;$conf=[string]$r.Confidence
  if($status -eq 'Success' -and $r.Text -and ($conf -eq 'High' -or $conf -eq 'Medium')){Emit @{type='wake';text=$r.Text;confidence=$conf}}
  elseif($status -eq 'MicrophoneUnavailable' -or $status -eq 'AudioQualityFailure'){Emit @{type='error';error=$status};Start-Sleep -Seconds 3}
 }
}catch{Emit @{type='error';error=$_.Exception.Message};exit 1}
