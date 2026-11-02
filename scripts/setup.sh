#!/usr/bin/env bash
# PriceLens one-command setup for macOS and Ubuntu.
# Installs Node.js and PostgreSQL when missing, creates .env, installs the
# project dependencies, creates the demo database and builds the frontend.
# Run from the project folder:
#   bash scripts/setup.sh

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n==> %s\n' "$1"; }
stop_setup() { printf '\nSetup stopped: %s\n' "$1" >&2; exit 1; }
trap 'stop_setup "the last command failed. Read the messages above, fix the problem and run this script again."' ERR

node_major() {
  if command -v node >/dev/null 2>&1; then node -p "process.versions.node.split('.')[0]"; else echo 0; fi
}

read_password() {
  local value
  read -r -s -p "$1: " value
  echo >&2
  printf '%s' "$value"
}

sql_literal() { printf "'%s'" "${1//\'/\'\'}"; }

OS="$(uname -s)"
password=""
installed_postgres=false

if [ "$OS" = "Darwin" ]; then
  if ! command -v brew >/dev/null 2>&1; then
    step 'Installing Homebrew (macOS package manager)'
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
  fi

  step 'Checking Node.js (22 or newer)'
  if [ "$(node_major)" -lt 22 ]; then
    brew install node@24
    brew link --overwrite --force node@24
  fi

  step 'Checking PostgreSQL'
  if ! brew list postgresql@17 >/dev/null 2>&1 && ! command -v psql >/dev/null 2>&1; then
    brew install postgresql@17
    installed_postgres=true
  fi
  if brew list postgresql@17 >/dev/null 2>&1; then
    brew services start postgresql@17 >/dev/null
    PSQL="$(brew --prefix postgresql@17)/bin/psql"
    CREATEUSER="$(brew --prefix postgresql@17)/bin/createuser"
    sleep 3
  fi
elif [ -f /etc/debian_version ]; then
  step 'Checking Node.js (22 or newer)'
  if [ "$(node_major)" -lt 22 ]; then
    sudo apt-get update
    sudo apt-get install -y curl ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  step 'Checking PostgreSQL'
  if ! command -v psql >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y postgresql-common
    sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
    sudo apt-get install -y postgresql-17
    installed_postgres=true
  fi
  sudo service postgresql start >/dev/null
else
  stop_setup "this script supports macOS and Ubuntu. On Windows run: powershell -ExecutionPolicy Bypass -File scripts\\setup.ps1"
fi
echo "Node.js $(node --version) is ready."

if [ ! -f .env ]; then
  if [ "$installed_postgres" = true ]; then
    password="$(read_password 'Choose a password for the PostgreSQL user "postgres" (remember it)')"
    [ -n "$password" ] || stop_setup 'the PostgreSQL password cannot be empty.'
    step 'Setting the password of the PostgreSQL user "postgres"'
    if [ "$OS" = "Darwin" ]; then
      "$CREATEUSER" -s postgres 2>/dev/null || true
      "$PSQL" -d postgres -c "ALTER USER postgres WITH PASSWORD $(sql_literal "$password");" >/dev/null
    else
      sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD $(sql_literal "$password");" >/dev/null
    fi
  else
    password="$(read_password 'Enter the password of the PostgreSQL user "postgres" on this computer')"
  fi
fi

step 'Creating the configuration file (.env)'
if [ -f .env ]; then
  echo '.env already exists; it was left unchanged.'
else
  escaped="${password//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      DB_PASSWORD=*) printf 'DB_PASSWORD="%s"\n' "$escaped" ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < .env.example > .env
  echo '.env created with your PostgreSQL password.'
fi

step 'Installing project dependencies'
npm --prefix backend ci
npm --prefix frontend ci

step 'Creating the PriceLens database with demo data'
npm --prefix backend run db:init

step 'Building the frontend'
npm --prefix frontend run build

printf '\nPriceLens is ready. Continue with step 3 of docs/SETUP.md to start it.\n'
