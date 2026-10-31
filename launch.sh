#!/usr/bin/env bash
# Next Toppers Desktop Client Launcher
set -e

export PATH="/home/divyam/.nvm/versions/node/v22.23.4/bin:$PATH"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Launch Electron binary directly with Linux GPU sandbox flag
if [ -x "$DIR/node_modules/electron/dist/electron" ]; then
  exec "$DIR/node_modules/electron/dist/electron" "$DIR" --disable-gpu-sandbox "$@"
else
  exec npx electron "$DIR" --disable-gpu-sandbox "$@"
fi
