#!/bin/sh

set -eu

REPOSITORY="${LINEATER_REPOSITORY:-benbugraer/lineater}"
VERSION="${LINEATER_VERSION:-latest}"
INSTALL_DIR="${LINEATER_INSTALL_DIR:-${HOME:-}/.local/bin}"
DOWNLOAD_BASE="${LINEATER_DOWNLOAD_BASE:-}"

fail() {
  printf 'lineater installer: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"
[ -n "$INSTALL_DIR" ] || fail "HOME is not set; provide LINEATER_INSTALL_DIR"

os_name="${LINEATER_OS:-$(uname -s)}"
case "$os_name" in
  Linux|linux) os="linux" ;;
  Darwin|darwin) os="darwin" ;;
  *) fail "unsupported operating system: $os_name (supported: Linux and macOS)" ;;
esac

arch_name="${LINEATER_ARCH:-$(uname -m)}"
case "$arch_name" in
  x86_64|amd64|x64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) fail "unsupported architecture: $arch_name (supported: x64 and arm64)" ;;
esac

asset="lineater-${os}-${arch}.tar.gz"
if [ -n "$DOWNLOAD_BASE" ]; then
  base="${DOWNLOAD_BASE%/}"
elif [ "$VERSION" = "latest" ]; then
  base="https://github.com/${REPOSITORY}/releases/latest/download"
else
  case "$VERSION" in
    v*) tag="$VERSION" ;;
    *) tag="v$VERSION" ;;
  esac
  base="https://github.com/${REPOSITORY}/releases/download/${tag}"
fi

tmp_dir=$(mktemp -d 2>/dev/null || mktemp -d -t lineater) || fail "could not create a temporary directory"
temporary_destination=""
cleanup() {
  rm -rf "$tmp_dir"
  if [ -n "$temporary_destination" ]; then
    rm -f "$temporary_destination"
  fi
}
trap cleanup EXIT HUP INT TERM

download() {
  source_url="$1"
  destination="$2"

  if [ -n "$DOWNLOAD_BASE" ]; then
    curl -fsSL --retry 3 --retry-delay 1 --connect-timeout 10 -o "$destination" "$source_url"
  else
    curl --proto '=https' --tlsv1.2 -fsSL --retry 3 --retry-delay 1 --connect-timeout 10 -o "$destination" "$source_url"
  fi
}

printf 'Downloading Lineater %s for %s/%s...\n' "$VERSION" "$os" "$arch"
download "$base/$asset" "$tmp_dir/$asset" || fail "could not download $asset"
download "$base/checksums.txt" "$tmp_dir/checksums.txt" || fail "could not download checksums.txt"

expected=$(awk -v file="$asset" '$2 == file || $2 == ("*" file) { print $1; exit }' "$tmp_dir/checksums.txt")
[ -n "$expected" ] || fail "checksums.txt does not contain $asset"

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$tmp_dir/$asset" | awk '{ print $1 }')
elif command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "$tmp_dir/$asset" | awk '{ print $1 }')
else
  fail "sha256sum or shasum is required to verify the download"
fi

[ "$actual" = "$expected" ] || fail "checksum verification failed for $asset"

tar -xzf "$tmp_dir/$asset" -C "$tmp_dir"
[ -f "$tmp_dir/lineater" ] || fail "release archive does not contain the lineater executable"
chmod 755 "$tmp_dir/lineater"
"$tmp_dir/lineater" --version >/dev/null 2>&1 || fail "downloaded executable failed its startup check"

mkdir -p "$INSTALL_DIR" || fail "could not create $INSTALL_DIR"
[ -w "$INSTALL_DIR" ] || fail "$INSTALL_DIR is not writable; set LINEATER_INSTALL_DIR to a writable directory"

temporary_destination=$(mktemp "$INSTALL_DIR/.lineater.tmp.XXXXXX") || fail "could not create a temporary file in $INSTALL_DIR"
cp "$tmp_dir/lineater" "$temporary_destination"
chmod 755 "$temporary_destination"
mv -f "$temporary_destination" "$INSTALL_DIR/lineater"
temporary_destination=""

printf 'Installed Lineater to %s/lineater\n' "$INSTALL_DIR"
case ":${PATH:-}:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    printf '\nAdd this directory to PATH, then restart your shell:\n  export PATH="%s:$PATH"\n' "$INSTALL_DIR"
    ;;
esac
printf '\nRun: lineater\n'
