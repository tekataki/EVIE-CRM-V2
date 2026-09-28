param([ValidateSet('focus','minimize','maximize','restore','close','volume','media')][string]$Action,[string]$Value)
$ErrorActionPreference='Stop'
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
 [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr hwnd,uint msg,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 public static bool Media(int code){IntPtr result;return SendMessageTimeout((IntPtr)0xffff,0x319,IntPtr.Zero,(IntPtr)(code<<16),2,1000,out result)!=IntPtr.Zero;}
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
 $codes=@{play=46;pause=47;next=11;previous=12;mute=8}
 if(-not $codes.ContainsKey($Value)){throw 'Invalid media action'}
 if(-not [EvieWindows]::Media($codes[$Value])){throw 'Windows did not acknowledge the media message'}
 '{"submitted":true,"note":"Control enviado; el reproductor decide si lo admite."}'
}
