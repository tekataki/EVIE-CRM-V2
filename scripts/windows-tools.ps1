param([ValidateSet('focus','minimize','maximize','restore','close','volume','media','showdesktop','lock')][string]$Action,[string]$Value,[ValidateRange(1,10)][int]$Count=1)
$ErrorActionPreference='Stop'
# 2.5 · «muestra el escritorio» minimizes every window (Shell's own MinimizeAll); «bloquea la compu» locks the session
# (the person signs back in; nothing is closed or lost).
if($Action -eq 'showdesktop'){(New-Object -ComObject Shell.Application).MinimizeAll();'{"submitted":true}';exit 0}
if($Action -eq 'lock'){Add-Type -TypeDefinition 'using System.Runtime.InteropServices;public static class EvieLock{[DllImport("user32.dll")]public static extern bool LockWorkStation();}';if(-not [EvieLock]::LockWorkStation()){throw 'Windows did not lock the session'};'{"submitted":true}';exit 0}
if($Action -in @('focus','minimize','maximize','restore','close')){
 if(-not [IO.Path]::IsPathRooted($Value) -or $Value.StartsWith('\\\\') -or [IO.Path]::GetExtension($Value) -ine '.exe'){throw 'Invalid application target'}
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class EvieFocus {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd,int cmd);
}
'@
 $p=Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -ieq $Value } | Select-Object -First 1
 if(-not $p){throw 'Application has no active window'}
 if($Action -eq 'close'){if(-not $p.CloseMainWindow()){throw 'Application rejected close request'};'{"closeRequested":true,"note":"Normal close requested; application may still ask to save. No process was killed."}';exit 0}
 $commands=@{focus=9;restore=9;minimize=6;maximize=3}
 [void][EvieFocus]::ShowWindow($p.MainWindowHandle,$commands[$Action])
 if($Action -eq 'focus'){[void][EvieFocus]::SetForegroundWindow($p.MainWindowHandle);if([EvieFocus]::GetForegroundWindow() -ne $p.MainWindowHandle){throw 'Windows did not allow foreground focus'}}
 @{submitted=$true;action=$Action;pid=$p.Id}|ConvertTo-Json -Compress;exit 0
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class EvieWindows {
 // One real media/volume key press (as the keyboard key would send it), handled once by Windows.
 [DllImport("user32.dll")] static extern void keybd_event(byte vk,byte scan,uint flags,UIntPtr extra);
 public static bool Media(int vk){keybd_event((byte)vk,0,1,UIntPtr.Zero);keybd_event((byte)vk,0,3,UIntPtr.Zero);return true;}
 public static float Volume(float value){var enumerator=(IDeviceEnumerator)new DeviceEnumerator();IDevice device;Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0,1,out device));object obj;Guid iid=typeof(IAudioEndpointVolume).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out obj));var endpoint=(IAudioEndpointVolume)obj;Guid g=Guid.Empty;Marshal.ThrowExceptionForHR(endpoint.SetMasterVolumeLevelScalar(value,ref g));float actual;Marshal.ThrowExceptionForHR(endpoint.GetMasterVolumeLevelScalar(out actual));Marshal.ReleaseComObject(endpoint);Marshal.ReleaseComObject(device);Marshal.ReleaseComObject(enumerator);return actual;}
}
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDeviceEnumerator {[PreserveSig] int EnumAudioEndpoints(int a,int b,out IntPtr c);[PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out IDevice device);}
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDevice {[PreserveSig] int Activate(ref Guid iid,int clsctx,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)]out object obj);}
[ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioEndpointVolume {
 [PreserveSig] int RegisterControlChangeNotify(IntPtr p);[PreserveSig] int UnregisterControlChangeNotify(IntPtr p);[PreserveSig] int GetChannelCount(out uint n);[PreserveSig] int SetMasterVolumeLevel(float v,ref Guid g);[PreserveSig] int SetMasterVolumeLevelScalar(float v,ref Guid g);[PreserveSig] int GetMasterVolumeLevel(out float v);[PreserveSig] int GetMasterVolumeLevelScalar(out float v);
}
'@
if($Action -eq 'volume'){
 $n=0;if(-not [int]::TryParse($Value,[ref]$n) -or $n -lt 0 -or $n -gt 100){throw 'Invalid volume'}
 $actual=[EvieWindows]::Volume($n/100.0)
 @{volume=[math]::Round($actual*100)}|ConvertTo-Json -Compress
}else{
 # Virtual-key codes: play/pause 0xB3, next 0xB0, previous 0xB1, mute 0xAD, volume down 0xAE, volume up 0xAF.
 $codes=@{play=0xB3;pause=0xB3;playpause=0xB3;next=0xB0;previous=0xB1;mute=0xAD;volumedown=0xAE;volumeup=0xAF}
 if(-not $codes.ContainsKey($Value)){throw 'Invalid media action'}
 for($i=0;$i -lt $Count;$i++){[void][EvieWindows]::Media($codes[$Value]);if($Count -gt 1){Start-Sleep -Milliseconds 40}}
 '{"submitted":true,"note":"Control enviado; el reproductor decide si lo admite."}'
}
