#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$ROOT_DIR/apps/mobile/ios/LiftProg.xcworkspace"
SCHEME="LiftProg"
TEAM_ID="4PL22H8UY3"
MARKETING_VERSION="${IOS_MARKETING_VERSION:-1.0.0}"
BUILD_NUMBER="${IOS_BUILD_NUMBER:-$(date -u +%Y%m%d%H%M%S)}"
OUTPUT_ROOT="${IOS_RELEASE_DIR:-$ROOT_DIR/.artifacts/testflight/$BUILD_NUMBER}"
ARCHIVE_PATH="$OUTPUT_ROOT/LiftProg.xcarchive"
EXPORT_PATH="$OUTPUT_ROOT/export"
EXPORT_OPTIONS="$ROOT_DIR/scripts/ios/ExportOptions-TestFlight.plist"
UPLOAD=true
EXISTING_ARCHIVE=""

if [[ "${1:-}" == "--archive-only" ]]; then
  UPLOAD=false
elif [[ "${1:-}" == "--upload-existing" ]]; then
  if [[ -z "${2:-}" || -n "${3:-}" ]]; then
    echo "Usage: npm run ios:testflight:upload -- /path/to/LiftProg.xcarchive" >&2
    exit 2
  fi
  EXISTING_ARCHIVE="$2"
  ARCHIVE_PATH="$EXISTING_ARCHIVE"
  OUTPUT_ROOT="$(dirname "$ARCHIVE_PATH")"
  EXPORT_PATH="$OUTPUT_ROOT/export"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: npm run ios:testflight | npm run ios:archive | npm run ios:testflight:upload -- /path/to/LiftProg.xcarchive" >&2
  exit 2
fi

if [[ ! "$BUILD_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "IOS_BUILD_NUMBER must contain only digits." >&2
  exit 2
fi

mkdir -p "$OUTPUT_ROOT"

if [[ -z "$EXISTING_ARCHIVE" ]]; then
  echo "Archiving Lift Prog $MARKETING_VERSION ($BUILD_NUMBER)"
  echo "Output: $OUTPUT_ROOT"

  EXPO_NO_DOTENV=1 \
  NODE_ENV=production \
  LOCAL_DEV_USER_ID= \
  EXPO_PUBLIC_MOBILE_LOCAL_DEV_USER_ID= \
  EXPO_PUBLIC_WORKOUT_API_BASE_URL=https://lift.makon.dev \
  EXPO_PUBLIC_AUTH_BASE_URL=https://lift.makon.dev \
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    CODE_SIGN_STYLE=Automatic \
    MARKETING_VERSION="$MARKETING_VERSION" \
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
    archive

  if [[ "$UPLOAD" == false ]]; then
    echo "Archive created: $ARCHIVE_PATH"
    exit 0
  fi
elif [[ ! -d "$ARCHIVE_PATH" ]]; then
  echo "Archive does not exist: $ARCHIVE_PATH" >&2
  exit 2
fi

ARCHIVE_BUILD_NUMBER="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$ARCHIVE_PATH/Info.plist")"
ARCHIVE_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleShortVersionString' "$ARCHIVE_PATH/Info.plist")"

echo "Uploading Lift Prog $ARCHIVE_VERSION ($ARCHIVE_BUILD_NUMBER) to App Store Connect"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates

echo "Upload accepted for Lift Prog $ARCHIVE_VERSION ($ARCHIVE_BUILD_NUMBER)"
