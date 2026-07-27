#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$repo_root/docs/mobile-ui-atlas-states.tsv"
atlas_root="${1:-}"
strict=false
prune_intermediates=false
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/lift-prog-fontconfig-cache}"
label_font="Courier"

if [[ -z "$atlas_root" ]]; then
  echo "usage: $0 <atlas-root> [--strict] [--prune-intermediates]" >&2
  exit 2
fi

shift
for option in "$@"; do
  case "$option" in
    --strict)
      strict=true
      ;;
    --prune-intermediates)
      prune_intermediates=true
      ;;
    *)
      echo "unknown option: $option" >&2
      exit 2
      ;;
  esac
done

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick is required (missing: magick)." >&2
  exit 1
fi

screenshots="$atlas_root/screenshots"
labeled="$atlas_root/labeled"
sheets="$atlas_root/sheets"
coverage="$atlas_root/coverage.tsv"

mkdir -p "$screenshots" "$labeled" "$sheets"
rm -f "$labeled"/*.jpg "$sheets"/*.jpg

printf "id\tgroup\tname\tcapture\tstatus\tfile\n" > "$coverage"

missing_required=0
groups=()

while IFS=$'\t' read -r id group name capture notes; do
  [[ "$id" == "id" ]] && continue
  state_number="${id%%-*}"
  state_label="${state_number}  ${name}"

  if [[ ! " ${groups[*]-} " =~ " ${group} " ]]; then
    groups+=("$group")
  fi

  source_file=""
  if [[ -f "$screenshots/${id}.png" ]]; then
    source_file="$screenshots/${id}.png"
  elif [[ -f "$screenshots/${id}.jpg" ]]; then
    source_file="$screenshots/${id}.jpg"
  else
    source_file="$(
      find "$screenshots" -maxdepth 1 -type f \
        \( -iname "${id}-*.png" -o -iname "${id}-*.jpg" \) \
        | sort | head -n 1
    )"
  fi

  if [[ -z "$source_file" ]]; then
    if [[ "$capture" == "device" ]]; then
      coverage_status="device-required"
      placeholder_title="DEVICE EVIDENCE"
      placeholder_detail="Apple-owned surface"
    else
      coverage_status="missing"
      placeholder_title="CAPTURE MISSING"
      placeholder_detail="$capture"
      missing_required=$((missing_required + 1))
    fi

    printf "%s\t%s\t%s\t%s\t%s\t\n" \
      "$id" "$group" "$name" "$capture" "$coverage_status" >> "$coverage"
    output_file="$labeled/${id}-${group}.jpg"
    magick -size 600x1282 \
      xc:'#252525' \
      -gravity center \
      -fill '#8f8f8f' \
      -font "$label_font" \
      -pointsize 30 \
      -annotate +0-42 "$placeholder_title" \
      -pointsize 22 \
      -annotate +0+16 "$placeholder_detail" \
      -gravity south \
      -fill '#ffffff' \
      -pointsize 18 \
      -annotate +0+24 "$state_label" \
      -quality 90 \
      "$output_file"
  else
    output_file="$labeled/${id}-${group}.jpg"
    magick "$source_file" \
      -auto-orient \
      -resize '600x1200>' \
      -background '#171717' \
      -gravity south \
      -splice 0x82 \
      -fill '#ffffff' \
      -font "$label_font" \
      -pointsize 18 \
      -annotate +0+42 "$state_label" \
      -quality 90 \
      "$output_file"

    printf "%s\t%s\t%s\t%s\tcaptured\t%s\n" \
      "$id" "$group" "$name" "$capture" "$source_file" >> "$coverage"
  fi
done < "$manifest"

for group in "${groups[@]}"; do
  group_files=()
  while IFS= read -r file; do
    group_files+=("$file")
  done < <(find "$labeled" -maxdepth 1 -type f -name "*-${group}.jpg" | sort -V)
  [[ "${#group_files[@]}" -gt 0 ]] || continue

  page_size=12
  page_number=1
  for ((offset = 0; offset < ${#group_files[@]}; offset += page_size)); do
    page_files=("${group_files[@]:offset:page_size}")
    printf -v page_suffix "%02d" "$page_number"
    magick montage "${page_files[@]}" \
      -background '#171717' \
      -geometry '360x780+14+14' \
      -tile 3x4 \
      "$sheets/${group}-${page_suffix}-contact-sheet.jpg"
    page_number=$((page_number + 1))
  done
done

all_files=()
while IFS= read -r file; do
  all_files+=("$file")
done < <(find "$labeled" -maxdepth 1 -type f -name "*.jpg" | sort -V)
if [[ "${#all_files[@]}" -gt 0 ]]; then
  magick montage "${all_files[@]}" \
    -background '#171717' \
    -geometry '300x650+12+12' \
    -tile 4x \
    "$atlas_root/all-contact-sheet.jpg"

  page_size=16
  page_number=1
  for ((offset = 0; offset < ${#all_files[@]}; offset += page_size)); do
    page_files=("${all_files[@]:offset:page_size}")
    printf -v page_suffix "%02d" "$page_number"
    magick montage "${page_files[@]}" \
      -background '#171717' \
      -geometry '300x650+12+12' \
      -tile 4x4 \
      "$sheets/all-${page_suffix}-contact-sheet.jpg"
    page_number=$((page_number + 1))
  done
fi

echo "Coverage: $coverage"
echo "Sheets:   $sheets"
echo "Missing simulator states: $missing_required"

if [[ "$strict" == true && "$missing_required" -gt 0 ]]; then
  exit 1
fi

if [[ "$prune_intermediates" == true ]]; then
  rm -rf "$screenshots" "$labeled"
  rm -f "$atlas_root/captures.tsv" "$atlas_root/.DS_Store"
  echo "Pruned:    raw screenshots, labels, and capture intermediates"
fi
