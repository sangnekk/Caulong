param([ValidateRange(1, 65535)][int]$Port = 8000)

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
if (-not (Test-Path (Join-Path $root '.env'))) { throw 'Missing .env. Copy .env.example, run php artisan key:generate and php artisan migrate.' }
if (-not (Test-Path (Join-Path $root 'public/build/manifest.json'))) { throw 'Missing build. Run npm ci then npm run build.' }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is in use. Check http://127.0.0.1:$Port; do not launch another server."
}
Push-Location $root
try {
    Write-Host "Open http://127.0.0.1:$Port/ or http://127.0.0.1:$Port/products" -ForegroundColor Cyan
    Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
    & $php artisan serve --host=127.0.0.1 --port=$Port --no-reload
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
