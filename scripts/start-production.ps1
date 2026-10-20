# Runs the production build of the shop on this machine, in this one window: builds the
# Next.js app, caches Laravel's config/routes/views, then starts Laravel (port 8000), the
# Next.js server (port 3000), the queue worker and the scheduler together. Ctrl+C stops all.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-production.ps1
#   ... -SkipBuild    reuse the last build (nothing in frontend/ changed since)
param([switch]$SkipBuild)
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
        throw "Port $port is in use. Stop the other server (dev or production) first."
    }
}
Push-Location $root
try {
    if (-not $SkipBuild) {
        Write-Host 'Building the Next.js app (npm run build)...' -ForegroundColor Cyan
        npm run build
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } elseif (-not (Test-Path (Join-Path $root 'frontend/.next/BUILD_ID'))) {
        throw 'No build found. Run without -SkipBuild once.'
    }
    Write-Host 'Caching Laravel config, routes and views (php artisan optimize)...' -ForegroundColor Cyan
    & $php artisan optimize
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host ''
    Write-Host 'Open http://localhost:3000/ (store: /products, admin: /admin)' -ForegroundColor Green
    Write-Host 'Keep this terminal open. Press Ctrl+C to stop everything.'
    Write-Host 'After editing .env run: php artisan optimize:clear'
    $q = '"' + $php + '"'
    npx concurrently --kill-others --names 'laravel,next,queue,schedule' `
        --prefix-colors 'blue,green,magenta,yellow' `
        "$q artisan serve --port=8000" `
        'npm --prefix frontend run start' `
        "$q artisan queue:work" `
        "$q artisan schedule:work"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
