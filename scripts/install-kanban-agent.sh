#!/usr/bin/env sh
set -eu

KANBAN_HOME="${KANBAN_HOME:-$HOME/.kanban}"
KANBAN_REPO_URL="${KANBAN_REPO_URL:-https://github.com/sherault/kanban.git}"
KANBAN_REF="${KANBAN_REF:-main}"
APP_DIR="${KANBAN_APP_DIR:-$KANBAN_HOME/app}"

mkdir -p "$KANBAN_HOME"

if [ -f "$APP_DIR/scripts/kanban-agent-install.mjs" ]; then
  :
elif command -v git >/dev/null 2>&1; then
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch --depth 1 origin "$KANBAN_REF"
    git -C "$APP_DIR" checkout "$KANBAN_REF"
    git -C "$APP_DIR" pull --ff-only origin "$KANBAN_REF"
  else
    rm -rf "$APP_DIR"
    git clone --depth 1 --branch "$KANBAN_REF" "$KANBAN_REPO_URL" "$APP_DIR"
  fi
elif command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  curl -fsSL "https://github.com/sherault/kanban/archive/refs/heads/$KANBAN_REF.tar.gz" | tar -xz --strip-components=1 -C "$APP_DIR"
else
  echo "Install requires git, or curl plus tar." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Install requires Node.js 22 or newer." >&2
  exit 1
fi

exec node "$APP_DIR/scripts/kanban-agent-install.mjs" "$@"
