#!/usr/bin/env bash
# Sync platform model slot keys from minibot/.env.models into minikb.
# Usage: ./scripts/sync-models-env-from-minibot.sh [path-to-minibot-minibot-dir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/../minibot/minibot/.env.models}"
DST_MODELS="$ROOT/.env.models"
DST_ENV="$ROOT/.env"

if [[ ! -f "$SRC" ]]; then
  echo "Source not found: $SRC" >&2
  exit 1
fi

transform() {
  local line="$1"
  if [[ "$line" =~ ^MINIBOT_SERVER_ ]]; then
    local rest="${line#MINIBOT_SERVER_}"
    if [[ "$rest" == MODEL=* ]]; then
      echo "MINIKB_OPENAI_MODEL=${rest#MODEL=}"
    else
      echo "MINIKB_${rest}"
    fi
  fi
}

{
  echo "# Synced from $SRC — do not commit"
  while IFS= read -r line || [[ -n "$line" ]]; do
    out="$(transform "$line")"
    if [[ -n "$out" ]]; then
      echo "$out"
    fi
  done < "$SRC"
} > "$DST_MODELS"

append=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "${line// }" ]] && continue
  [[ "$line" =~ ^# ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  if grep -q "^${key}=" "$DST_ENV" 2>/dev/null; then
    current="$(grep "^${key}=" "$DST_ENV" | tail -1 | cut -d= -f2-)"
    if [[ -n "${current// }" ]]; then
      continue
    fi
  fi
  append+=("$line")
done < "$DST_MODELS"

if [[ ${#append[@]} -gt 0 ]]; then
  {
    echo ""
    echo "# --- platform models (synced from minibot) ---"
    printf '%s\n' "${append[@]}"
  } >> "$DST_ENV"
fi

echo "Wrote $DST_MODELS"
echo "Appended ${#append[@]} keys to $DST_ENV"
