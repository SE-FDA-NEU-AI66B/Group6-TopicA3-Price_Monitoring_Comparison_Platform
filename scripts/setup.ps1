# PriceLens one-command setup for Windows.
# Installs Node.js and PostgreSQL when missing, creates .env, installs the
# project dependencies, creates the demo database and builds the frontend.
# Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Write-Step($message) { Write-Host "`n==> $message" -ForegroundColor Cyan }

function Stop-Setup($message) {
  Write-Host "`nSetup stopped: $message" -ForegroundColor Red
  exit 1
}

function Update-Path {
  $env:PATH = [Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('PATH', 'User')
}

function Invoke-Checked($description, [scriptblock]$command) {
  & $command
  if ($LASTEXITCODE -ne 0) { Stop-Setup "$description failed. Read the messages above, fix the problem and run this script again." }
}

function Get-NodeMajor {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return 0 }
  return [int](node -p "process.versions.node.split('.')[0]")
}

function Read-Password($prompt) {
  $secure = Read-Host $prompt -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Stop-Setup 'winget is not available. Install "App Installer" from the Microsoft Store, then run this script again.'
}

Write-Step 'Checking Node.js (22 or newer)'
if ((Get-NodeMajor) -lt 22) {
  Invoke-Checked 'Installing Node.js' {
    winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-source-agreements --accept-package-agreements
  }
  Update-Path
  if ((Get-NodeMajor) -lt 22) { Stop-Setup 'Node.js was installed but is not visible yet. Close this window, open a new PowerShell window and run the script again.' }
}
Write-Host "Node.js $(node --version) is ready."

Write-Step 'Checking PostgreSQL'
$postgresService = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($postgresService) {
  Write-Host "PostgreSQL is already installed ($($postgresService.Name))."
  if ($postgresService.Status -ne 'Running') {
    Write-Host 'Starting PostgreSQL (Windows may ask for permission)...'
    Start-Process powershell -Verb RunAs -Wait -ArgumentList "-Command Start-Service $($postgresService.Name)"
  }
  $password = if (Test-Path .env) { $null } else { Read-Password 'Enter the password of the PostgreSQL user "postgres" on this computer' }
} else {
  $password = Read-Password 'Choose a password for the new PostgreSQL user "postgres" (remember it)'
  if (-not $password) { Stop-Setup 'The PostgreSQL password cannot be empty.' }
  Write-Host 'Installing PostgreSQL 17. This takes a few minutes; Windows may ask for permission.'
  Invoke-Checked 'Installing PostgreSQL' {
    winget install --id PostgreSQL.PostgreSQL.17 --exact --accept-source-agreements --accept-package-agreements `
      --override "--mode unattended --unattendedmodeui minimal --superpassword `"$password`" --serverport 5432"
  }
}

Write-Step 'Creating the configuration file (.env)'
if (Test-Path .env) {
  Write-Host '.env already exists; it was left unchanged.'
} else {
  $escaped = $password.Replace('\', '\\').Replace('"', '\"')
  (Get-Content .env.example) -replace '^DB_PASSWORD=.*$', "DB_PASSWORD=`"$escaped`"" | Set-Content .env
  Write-Host '.env created with your PostgreSQL password.'
}

Write-Step 'Installing project dependencies'
Invoke-Checked 'Installing backend dependencies' { npm --prefix backend ci }
Invoke-Checked 'Installing frontend dependencies' { npm --prefix frontend ci }

Write-Step 'Creating the PriceLens database with demo data'
Invoke-Checked 'Creating the database (check the PostgreSQL password in .env)' { npm --prefix backend run db:init }

Write-Step 'Building the frontend'
Invoke-Checked 'Building the frontend' { npm --prefix frontend run build }

Write-Host "`nPriceLens is ready. Continue with step 3 of docs/SETUP.md to start it." -ForegroundColor Green
