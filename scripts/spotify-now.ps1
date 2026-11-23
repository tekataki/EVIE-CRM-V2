# EVIE para Windows · what Spotify is playing, read from its window title (read-only, Spotify's window only).
# Spotify titles its window «Artist - Song» while playing and «Spotify»/«Spotify Premium»/«Spotify Free» when idle.
# Output: one JSON line {"running":bool,"playing":bool,"title":"..."}.
$ErrorActionPreference='Stop'
$p=Get-Process -Name Spotify -ErrorAction SilentlyContinue|Where-Object{$_.MainWindowHandle -ne 0}|Select-Object -First 1
$t=if($p){[string]$p.MainWindowTitle}else{''}
@{running=[bool]$p;playing=([bool]$t -and $t -notmatch '^Spotify( (Premium|Free))?$');title=$t.Substring(0,[Math]::Min(120,$t.Length))}|ConvertTo-Json -Compress
