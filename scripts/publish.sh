#!/bin/bash
set -euo pipefail

PLUGIN="${1:-}"
if [ -z "$PLUGIN" ]; then
  echo "Usage: scripts/publish.sh <plugin_dir_name>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC="$ROOT_DIR/$PLUGIN/src"

if [ ! -d "$PLUGIN_SRC" ]; then
  echo "Not found: $PLUGIN_SRC"
  exit 1
fi

(cd "$PLUGIN_SRC" && npm run build)

DEST_DIR="$ROOT_DIR/site/plugins/$PLUGIN"
mkdir -p "$DEST_DIR"
cp "$PLUGIN_SRC/dist/plugin.zip" "$DEST_DIR/plugin.zip"

echo "Published $PLUGIN -> site/plugins/$PLUGIN/plugin.zip"
