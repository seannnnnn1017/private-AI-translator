#!/usr/bin/env sh
set -eu

target="${1:-}"

case "$target" in
  firefox|chrome)
    cp "manifest.${target}.json" "manifest.json"
    printf 'Activated %s manifest in manifest.json\n' "$target"
    ;;
  *)
    echo "Usage: ./use-manifest.sh firefox|chrome" >&2
    exit 1
    ;;
esac
