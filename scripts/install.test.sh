#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TEST_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t lineater-installer-test)
cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$TEST_DIR/release/payload" "$TEST_DIR/bin"
cat > "$TEST_DIR/release/payload/lineater" <<'EOF'
#!/bin/sh
if [ "${1:-}" = "--version" ]; then
  printf '1.2.3\n'
  exit 0
fi
printf 'lineater fixture\n'
EOF
chmod 755 "$TEST_DIR/release/payload/lineater"
tar -C "$TEST_DIR/release/payload" -czf "$TEST_DIR/release/lineater-linux-x64.tar.gz" lineater
(
  cd "$TEST_DIR/release"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum lineater-linux-x64.tar.gz > checksums.txt
  else
    shasum -a 256 lineater-linux-x64.tar.gz > checksums.txt
  fi
)

LINEATER_DOWNLOAD_BASE="file://$TEST_DIR/release" \
LINEATER_VERSION="1.2.3" \
LINEATER_INSTALL_DIR="$TEST_DIR/bin" \
LINEATER_OS="linux" \
LINEATER_ARCH="x64" \
PATH="$TEST_DIR/bin:$PATH" \
sh "$ROOT_DIR/scripts/install.sh"

[ -x "$TEST_DIR/bin/lineater" ] || { printf 'installed executable is missing\n' >&2; exit 1; }
[ "$("$TEST_DIR/bin/lineater" --version)" = "1.2.3" ] || { printf 'installed executable returned the wrong version\n' >&2; exit 1; }

awk '{$1 = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; print}' \
  "$TEST_DIR/release/checksums.txt" > "$TEST_DIR/release/checksums.invalid"
mv "$TEST_DIR/release/checksums.invalid" "$TEST_DIR/release/checksums.txt"

if LINEATER_DOWNLOAD_BASE="file://$TEST_DIR/release" \
  LINEATER_INSTALL_DIR="$TEST_DIR/rejected" \
  LINEATER_OS="linux" \
  LINEATER_ARCH="x64" \
  sh "$ROOT_DIR/scripts/install.sh" >/dev/null 2>&1; then
  printf 'installer accepted an invalid checksum\n' >&2
  exit 1
fi
[ ! -e "$TEST_DIR/rejected/lineater" ] || { printf 'invalid artifact was installed\n' >&2; exit 1; }

if LINEATER_DOWNLOAD_BASE="file://$TEST_DIR/release" \
  LINEATER_INSTALL_DIR="$TEST_DIR/rejected-arch" \
  LINEATER_OS="linux" \
  LINEATER_ARCH="riscv64" \
  sh "$ROOT_DIR/scripts/install.sh" >/dev/null 2>&1; then
  printf 'installer accepted an unsupported architecture\n' >&2
  exit 1
fi

printf 'Installer integration test passed.\n'
