[CmdletBinding()]
param(
    [string]$DatabaseHost = "localhost",
    [int]$DatabasePort = 5432,
    [string]$DatabaseName = "pricelens",
    [string]$DatabaseUser = "postgres",
    [string]$PsqlPath = $env:PSQL_PATH
)

$ErrorActionPreference = "Stop"

if (-not $PSBoundParameters.ContainsKey("DatabaseHost") -and $env:DB_HOST) {
    $DatabaseHost = $env:DB_HOST
}
if (-not $PSBoundParameters.ContainsKey("DatabasePort") -and $env:DB_PORT) {
    $DatabasePort = [int]$env:DB_PORT
}
if (-not $PSBoundParameters.ContainsKey("DatabaseName") -and $env:DB_NAME) {
    $DatabaseName = $env:DB_NAME
}
if (-not $PSBoundParameters.ContainsKey("DatabaseUser") -and $env:DB_USER) {
    $DatabaseUser = $env:DB_USER
}

if ($DatabaseName -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "DB_NAME must contain only letters, numbers and underscores and cannot start with a number."
}

if (-not $PsqlPath) {
    $psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCommand) {
        $PsqlPath = $psqlCommand.Source
    }
}

if (-not $PsqlPath) {
    $candidate = Get-ChildItem `
        "C:\Program Files\PostgreSQL" `
        -Recurse `
        -Filter "psql.exe" `
        -File `
        -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if ($candidate) {
        $PsqlPath = $candidate.FullName
    }
}

if (-not $PsqlPath -or -not (Test-Path -LiteralPath $PsqlPath)) {
    throw "psql was not found. Add PostgreSQL bin to PATH or set PSQL_PATH."
}

$createdbPath = Join-Path (Split-Path -Parent $PsqlPath) "createdb.exe"
if (-not (Test-Path -LiteralPath $createdbPath)) {
    throw "createdb.exe was not found beside psql.exe."
}

$schemaPath = Join-Path $PSScriptRoot "migrations\001_initial_schema.sql"
$seedPath = Join-Path $PSScriptRoot "seeds\001_demo_data.sql"

if (-not (Test-Path -LiteralPath $schemaPath)) {
    throw "Schema file not found: $schemaPath"
}
if (-not (Test-Path -LiteralPath $seedPath)) {
    throw "Seed file not found: $seedPath"
}

$previousPgPassword = $env:PGPASSWORD
if ($env:DB_PASSWORD) {
    $env:PGPASSWORD = $env:DB_PASSWORD
}

try {
    Write-Host "Checking database '$DatabaseName'..."
    $databaseExistsOutput = & $PsqlPath `
        -X `
        -h $DatabaseHost `
        -p $DatabasePort `
        -U $DatabaseUser `
        -d postgres `
        -tA `
        -v ON_ERROR_STOP=1 `
        -c "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"

    if ($LASTEXITCODE -ne 0) {
        throw "Could not connect to PostgreSQL. Check DB_HOST, DB_PORT, DB_USER and DB_PASSWORD."
    }

    $databaseExists = (@($databaseExistsOutput) -join "").Trim()
    if ($databaseExists -eq "1") {
        throw "Database '$DatabaseName' already exists. Use a clean database or choose another DB_NAME."
    }

    Write-Host "Creating database '$DatabaseName'..."
    & $createdbPath `
        -h $DatabaseHost `
        -p $DatabasePort `
        -U $DatabaseUser `
        $DatabaseName
    if ($LASTEXITCODE -ne 0) {
        throw "Database creation failed."
    }

    Write-Host "Applying schema..."
    & $PsqlPath `
        -X `
        -h $DatabaseHost `
        -p $DatabasePort `
        -U $DatabaseUser `
        -d $DatabaseName `
        -v ON_ERROR_STOP=1 `
        -f $schemaPath
    if ($LASTEXITCODE -ne 0) {
        throw "Schema application failed."
    }

    Write-Host "Loading demo seed data..."
    & $PsqlPath `
        -X `
        -h $DatabaseHost `
        -p $DatabasePort `
        -U $DatabaseUser `
        -d $DatabaseName `
        -v ON_ERROR_STOP=1 `
        -f $seedPath
    if ($LASTEXITCODE -ne 0) {
        throw "Seed loading failed."
    }

    $rowCountOutput = & $PsqlPath `
        -X `
        -h $DatabaseHost `
        -p $DatabasePort `
        -U $DatabaseUser `
        -d $DatabaseName `
        -tA `
        -v ON_ERROR_STOP=1 `
        -c "SELECT COUNT(*) FROM tracked_products tp JOIN users u ON u.user_id = tp.user_id WHERE u.email = 'demo@pricelens.local';"

    if ($LASTEXITCODE -ne 0) {
        throw "Validation query failed."
    }

    $rowCount = (@($rowCountOutput) -join "").Trim()
    if ($rowCount -ne "10") {
        throw "Validation failed: expected 10 tracked_products, found '$rowCount'."
    }

    Write-Host "PriceLens database initialized successfully."
    Write-Host "Walking-skeleton table: tracked_products"
    Write-Host "Expected demo row count: 10"
}
finally {
    if ($null -eq $previousPgPassword) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    else {
        $env:PGPASSWORD = $previousPgPassword
    }
}
