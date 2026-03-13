#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run the prototype."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Dependencies not installed. Running npm install..."
  npm install
fi

echo "Starting Fantasy RPG prototype..."
echo "Open http://127.0.0.1:5173/ after the server is ready."

exec npm run dev -- --host 127.0.0.1
