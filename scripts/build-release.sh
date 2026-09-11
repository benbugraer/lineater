#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_DIR="${LINEATER_RELEASE_DIR:-$ROOT_DIR/release}"
APP_VERSION=$(cd "$ROOT_DIR" && bun -e 'import manifest from "./apps/lineater/package.json"; process.stdout.write(manifest.version)')
RELEASE_VERSION="${LINEATER_VERSION:-$APP_VERSION}"

fail() {
  printf 'lineater release build: %s\n' "$*" >&2
  exit 1
}

[ "$RELEASE_VERSION" = "$APP_VERSION" ] || fail "release version $RELEASE_VERSION does not match apps/lineater/package.json ($APP_VERSION)"
command -v bun >/dev/null 2>&1 || fail "Bun is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

if [ "$#" -eq 0 ]; then
  set -- linux-x64 linux-arm64 darwin-x64 darwin-arm64
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/.staging"

cleanup() {
  rm -rf "$OUTPUT_DIR/.staging"
}
trap cleanup EXIT HUP INT TERM

for platform in "$@"; do
  case "$platform" in
    linux-x64) bun_target="bun-linux-x64-baseline" ;;
    linux-arm64) bun_target="bun-linux-arm64" ;;
    darwin-x64) bun_target="bun-darwin-x64-baseline" ;;
    darwin-arm64) bun_target="bun-darwin-arm64" ;;
    *) fail "unknown target '$platform' (expected linux-x64, linux-arm64, darwin-x64, or darwin-arm64)" ;;
  esac

  stage="$OUTPUT_DIR/.staging/$platform"
  archive="$OUTPUT_DIR/lineater-$platform.tar.gz"
  mkdir -p "$stage"

  printf 'Building Lineater %s for %s...\n' "$RELEASE_VERSION" "$platform"
  (cd "$ROOT_DIR" && bun build apps/lineater/src/main.ts \
    --compile \
    --minify \
    --target="$bun_target" \
    --outfile="$stage/lineater")
  chmod 755 "$stage/lineater"
  tar -C "$stage" -czf "$archive" lineater
  rm -rf "$stage"
done

(
  cd "$OUTPUT_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum lineater-*.tar.gz > checksums.txt
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 lineater-*.tar.gz > checksums.txt
  else
    fail "sha256sum or shasum is required"
  fi
)

printf 'Release artifacts written to %s\n' "$OUTPUT_DIR"
