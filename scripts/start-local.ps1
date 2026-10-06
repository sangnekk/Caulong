# Starts the shop on this machine: Laravel (port 8000), its queue worker and the Next.js
# app in frontend/ (port 3000), all in this window.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$php = (Get-Command php -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
if (-not $php) {
    $php = @(
        'C:\Users\Laptop\.config\herd-lite\bin\php.exe',
        'C:\laragon\bin\php\php-8.4.12-nts-Win32-vs17-x64\php.exe'
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $php) { throw 'PHP not found. Install PHP 8.3+ or add php.exe to PATH.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node.js not found. Install Node.js 22 or add it to PATH.' }
if (-not (Test-Path (Join-Path $root '.env'))) { throw 'Missing .env. Copy .env.example, run php artisan key:generate and php artisan migrate.' }
if (-not (Test-Path (Join-Path $root 'node_modules'))) { throw 'Missing packages. Run npm install.' }
if (-not (Test-Path (Join-Path $root 'frontend/node_modules'))) { throw 'Missing frontend packages. Run npm --prefix frontend install.' }
foreach ($port in 8000, 3000) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is in use. Check http://localhost:3000; do not launch another server."
    }
}
Push-Location $root
try {
    Write-Host 'Open http://localhost:3000/ (store: /products, admin: /admin)' -ForegroundColor Cyan
    Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
    & $php artisan dev
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
