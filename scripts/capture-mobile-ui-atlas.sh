#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$repo_root/docs/mobile-ui-atlas-states.tsv"
atlas_root="${1:-}"
iphone_udid="${IPHONE_SIMULATOR_UDID:-}"
watch_udid="${WATCH_SIMULATOR_UDID:-}"
app_id="${MOBILE_APP_ID:-com.makon.liftprog}"
app_scheme="${MOBILE_APP_SCHEME:-com.makon.liftprog}"
metro_url="${ATLAS_METRO_URL:-}"
settle_seconds="${ATLAS_SETTLE_SECONDS:-0.9}"
boot_seconds="${ATLAS_BOOT_SECONDS:-4}"
from_state="${ATLAS_FROM_STATE:-1}"
only_states="${ATLAS_ONLY_STATES:-}"
watch_only=0
fresh_process=0
needs_dev_client_reconnect=0

if [[ -z "$atlas_root" ]]; then
  echo "usage: $0 <atlas-root> [--iphone <udid>] [--watch <udid>] [--metro-url <url>] [--watch-only] [--fresh-process] [--from <state-number>] [--only <id,id,...>]" >&2
  exit 2
fi

shift
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --iphone)
      iphone_udid="${2:?missing iPhone simulator UDID}"
      shift 2
      ;;
    --watch)
      watch_udid="${2:?missing Watch simulator UDID}"
      shift 2
      ;;
    --from)
      from_state="${2:?missing first state number}"
      shift 2
      ;;
    --only)
      only_states="${2:?missing comma-separated state IDs}"
      shift 2
      ;;
    --metro-url)
      metro_url="${2:?missing Metro URL}"
      shift 2
      ;;
    --watch-only)
      watch_only=1
      shift
      ;;
    --fresh-process)
      fresh_process=1
      shift
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
done

should_capture_state() {
  local id="$1"

  [[ -z "$only_states" ]] && return 0
  [[ ",$only_states," == *",$id,"* ]]
}

uses_native_keyboard() {
  case "$1" in
    26-workout-title-edit | \
      27-workout-note-edit | \
      28-body-weight-edit | \
      31-exercise-search | \
      32-exercise-create | \
      41-pinned-note-edit | \
      42-workout-exercise-note-edit | \
      43-set-note-edit | \
      89-body-weight-health-loading | \
      90-body-weight-error | \
      92-workout-note-new | \
      93-workout-note-existing | \
      95-exercise-search-empty | \
      135-auth-email-keyboard | \
      136-auth-code-keyboard | \
      137-exercise-note-keyboard)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

uses_native_action_sheet() {
  case "$1" in
    138-set-command-sheet | 139-rest-choice-sheet)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

show_native_software_keyboard() {
  if ! command -v osascript >/dev/null 2>&1; then
    echo "warning: osascript is unavailable; the native software keyboard may be hidden." >&2
    return
  fi

  osascript \
    -e 'tell application "Simulator" to activate' \
    -e 'tell application "System Events" to tell process "Simulator"' \
    -e 'set keyboardMenu to menu 1 of menu item "Keyboard" of menu 1 of menu bar item "I/O" of menu bar 1' \
    -e 'set hardwareItem to menu item "Connect Hardware Keyboard" of keyboardMenu' \
    -e 'set markValue to value of attribute "AXMenuItemMarkChar" of hardwareItem' \
    -e 'if markValue is missing value then' \
    -e 'click hardwareItem' \
    -e 'delay 0.2' \
    -e 'end if' \
    -e 'click hardwareItem' \
    -e 'end tell' >/dev/null
}

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command-line tools are required (missing: xcrun)." >&2
  exit 1
fi

if [[ "$watch_only" -eq 0 && -z "$iphone_udid" ]]; then
  iphone_udid="$(
    xcrun simctl list devices booted |
      sed -nE '/iPhone/{s/.*\(([0-9A-F-]{36})\).*/\1/p;q;}'
  )"
fi

if [[ "$watch_only" -eq 0 && -z "$iphone_udid" ]]; then
  echo "No booted iPhone simulator was found. Pass --iphone <udid>." >&2
  exit 1
fi

screenshots="$atlas_root/screenshots"
capture_log="$atlas_root/captures.tsv"
mkdir -p "$screenshots"
printf "id\tcapture\tdevice\tfile\n" > "$capture_log"

if [[ "$watch_only" -eq 0 ]] &&
  ! xcrun simctl get_app_container "$iphone_udid" "$app_id" app >/dev/null 2>&1; then
  echo "$app_id is not installed on iPhone simulator $iphone_udid." >&2
  echo "Build and run the current development app before capturing." >&2
  exit 1
fi

if [[ "$watch_only" -eq 0 ]]; then
  if [[ -n "$metro_url" ]]; then
    encoded_metro_url="${metro_url//:/%3A}"
    encoded_metro_url="${encoded_metro_url//\//%2F}"
    xcrun simctl openurl "$iphone_udid" \
      "$app_scheme://expo-development-client/?url=$encoded_metro_url"
    sleep "$boot_seconds"
  fi

  while IFS=$'\t' read -r id _group _name capture _notes; do
    [[ "$id" == "id" ]] && continue
    [[ "$capture" == "simulator" ]] || continue
    state_number="${id%%-*}"
    ((10#$state_number >= from_state)) || continue
    should_capture_state "$id" || continue

    output="$screenshots/$id.png"
    if [[ "$needs_dev_client_reconnect" -eq 1 && -n "$metro_url" ]]; then
      xcrun simctl openurl "$iphone_udid" \
        "$app_scheme://expo-development-client/?url=$encoded_metro_url"
      sleep "$boot_seconds"
      needs_dev_client_reconnect=0
    fi
    if [[ "$fresh_process" -eq 1 ]]; then
      xcrun simctl terminate "$iphone_udid" "$app_id" >/dev/null 2>&1 || true
    fi
    if uses_native_keyboard "$id"; then
      show_native_software_keyboard
    fi
    xcrun simctl openurl "$iphone_udid" "$app_scheme://ui-atlas/$id"
    sleep "$settle_seconds"
    xcrun simctl io "$iphone_udid" screenshot "$output" >/dev/null
    printf "%s\t%s\t%s\t%s\n" "$id" "$capture" "$iphone_udid" "$output" >> "$capture_log"
    echo "captured $id"
    if uses_native_action_sheet "$id"; then
      xcrun simctl terminate "$iphone_udid" "$app_id" >/dev/null 2>&1 || true
      needs_dev_client_reconnect=1
    fi
  done < "$manifest"
fi

if [[ -n "$watch_udid" ]]; then
  watch_app_id="${WATCH_APP_ID:-com.makon.liftprog.watchkitapp}"
  if ! xcrun simctl get_app_container "$watch_udid" "$watch_app_id" app >/dev/null 2>&1; then
    echo "$watch_app_id is not installed on Watch simulator $watch_udid." >&2
    exit 1
  fi

  while IFS=$'\t' read -r id _group _name capture _notes; do
    [[ "$id" == "id" ]] && continue
    [[ "$capture" == "watch-simulator" ]] || continue

    state_number="${id%%-*}"
    ((10#$state_number >= from_state)) || continue
    should_capture_state "$id" || continue
    output="$screenshots/$id.png"
    xcrun simctl terminate "$watch_udid" "$watch_app_id" >/dev/null 2>&1 || true
    xcrun simctl launch "$watch_udid" "$watch_app_id" \
      -uiAtlasState "$state_number" >/dev/null
    sleep "$settle_seconds"
    xcrun simctl io "$watch_udid" screenshot "$output" >/dev/null
    printf "%s\t%s\t%s\t%s\n" "$id" "$capture" "$watch_udid" "$output" >> "$capture_log"
    echo "captured $id"
  done < "$manifest"
fi

"$repo_root/scripts/build-mobile-ui-atlas.sh" "$atlas_root"

echo "Capture log: $capture_log"
