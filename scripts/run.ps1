param([switch]$Background)
$ErrorActionPreference = 'Stop'
$botDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $botDirectory
$mutex = New-Object System.Threading.Mutex($false, 'Local\ArkientalDiscordXEmbedBot')
$ownsMutex = $false
try {
    try { $ownsMutex = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { Write-Host 'The bot launcher is already running.'; exit 0 }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host 'Install Node.js 20.12 or newer from https://nodejs.org, then run start.bat.'
        exit 1
    }
    $nodeVersion = & node -p process.versions.node
    if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion -lt [version]'20.12.0') { Write-Host 'Node.js 20.12 or newer is required.'; exit 1 }
    if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
    # Registration is per user and does not need administrator access.
    & (Join-Path $PSScriptRoot 'startup.ps1') -Action Install
    & node (Join-Path $PSScriptRoot 'check-config.js')
    if ($LASTEXITCODE -ne 0) {
        if (-not $Background -and $LASTEXITCODE -eq 2) { Start-Process -FilePath 'notepad.exe' -ArgumentList @('"' + (Join-Path $botDirectory '.env') + '"') }
        exit 1
    }
    if (-not (Test-Path -LiteralPath 'node_modules/discord.js/package.json')) {
        & npm.cmd ci --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) { Write-Host 'Dependency installation failed. Check network access and run start.bat again.'; exit 1 }
    }
    if ($Background) { & node (Join-Path $PSScriptRoot 'supervisor.js') --background }
    else { & node (Join-Path $PSScriptRoot 'supervisor.js') }
    exit $LASTEXITCODE
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
