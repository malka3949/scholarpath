$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"')
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

$password = $env:POSTGRES_SUPERUSER_PASSWORD
if (-not $password) {
  Write-Host "Missing POSTGRES_SUPERUSER_PASSWORD in .env"
  Write-Host "Add the postgres superuser password from PostgreSQL installation, then run: npm run db:setup"
  exit 1
}

$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
if (-not (Test-Path $psql)) {
  $psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
}
if (-not $psql) {
  Write-Host "psql not found. Install PostgreSQL or add it to PATH."
  exit 1
}

$env:PGPASSWORD = $password
$sqlFile = Join-Path $PSScriptRoot "setup-postgres.sql"

& $psql -U postgres -h localhost -f $sqlFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$dbExists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='scholarpath'"
if ($dbExists -ne "1") {
  & $psql -U postgres -h localhost -c "CREATE DATABASE scholarpath OWNER scholarpath"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& $psql -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE scholarpath TO scholarpath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Database setup complete."
Write-Host "Next: npm run db:migrate && npm run db:seed"
