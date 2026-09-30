param([ValidateSet('Install','Remove','Stop')][string]$Action = 'Install')
$ErrorActionPreference = 'Stop'
$botDirectory = Split-Path -Parent $PSScriptRoot
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'Arkiental Discord X Embed Bot.lnk'
if ($Action -eq 'Install') {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $scriptPath = Join-Path $PSScriptRoot 'run.ps1'
    $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $scriptPath + '" -Background'
    $shortcut.WorkingDirectory = $botDirectory
    $shortcut.Description = 'Start the Discord X embed bot at Windows sign-in and restart it after a crash.'
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Host 'Windows sign-in startup is installed for this account.'
} elseif ($Action -eq 'Remove') {
    if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
    Write-Host 'Windows sign-in startup removed. Use stop.bat to stop a running bot.'
} else {
    $runtimeDirectory = Join-Path $botDirectory 'runtime'
    New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
    Set-Content -LiteralPath (Join-Path $runtimeDirectory 'stop') -Value 'stop' -Encoding ascii
    Write-Host 'Stop requested. The bot will shut down without restarting. Startup remains installed.'
}
