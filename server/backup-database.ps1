param(
    [string]$Source = "server/restaurant.db",
    [string]$DestinationDir = "server/backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Database file not found: $Source"
}

New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $DestinationDir "restaurant-$timestamp.db"
Copy-Item -LiteralPath $Source -Destination $backupPath -Force

Write-Output "Backup created: $backupPath"
