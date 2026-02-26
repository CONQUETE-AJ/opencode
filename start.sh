#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required. Install Bun first: https://bun.sh/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing JS dependencies..."
  bun install
fi

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
if [ ! -x "$DATA_HOME/opencode/data-python/.venv/bin/python" ]; then
  echo "Setting up isolated Python DB environment..."
  bun run data:env
fi

exec bun run dev "$@"
