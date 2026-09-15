#!/bin/sh

set -eu

BINARY=${1:-}
EXPECTED_CLIENT_ID=${2:-}

fail() {
  printf 'lineater installed-auth smoke: %s\n' "$*" >&2
  exit 1
}

[ -n "$BINARY" ] || fail "binary path is required"
[ -x "$BINARY" ] || fail "binary is not executable: $BINARY"
[ -n "$EXPECTED_CLIENT_ID" ] || fail "expected public client ID is required"

root=$(mktemp -d 2>/dev/null || mktemp -d -t lineater-auth-smoke) || fail "could not create temporary directory"
pid=""
cleanup() {
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf "$root"
}
trap cleanup EXIT HUP INT TERM

mkdir -m 700 "$root/home" "$root/bin" "$root/config" "$root/data" "$root/state"
cat > "$root/bin/xdg-open" <<'OPENER'
#!/bin/sh
set -eu
umask 077
printf '%s' "$1" > "$LINEATER_AUTH_URL_CAPTURE"
OPENER
chmod 755 "$root/bin/xdg-open"

capture="$root/authorization-url"
env -u LINEATER_LINEAR_CLIENT_ID -u LINEATER_LINEAR_REDIRECT_URI -u LINEATER_LINEAR_SCOPES \
  HOME="$root/home" \
  XDG_CONFIG_HOME="$root/config" \
  XDG_DATA_HOME="$root/data" \
  XDG_STATE_HOME="$root/state" \
  LINEATER_AUTH_URL_CAPTURE="$capture" \
  PATH="$root/bin:${PATH:-/usr/bin:/bin}" \
  "$BINARY" auth login >"$root/stdout" 2>"$root/stderr" &
pid=$!

attempt=0
while [ ! -s "$capture" ] && kill -0 "$pid" 2>/dev/null && [ "$attempt" -lt 100 ]; do
  attempt=$((attempt + 1))
  sleep 0.05
done

[ -s "$capture" ] || {
  detail=$(tr '\n' ' ' < "$root/stderr" | cut -c1-300)
  fail "fresh installation did not open OAuth authorization: $detail"
}

EXPECTED_CLIENT_ID="$EXPECTED_CLIENT_ID" CAPTURE_PATH="$capture" bun -e '
  const url = new URL(await Bun.file(Bun.env.CAPTURE_PATH).text());
  const expectedClientId = Bun.env.EXPECTED_CLIENT_ID;
  const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
  requireValue(url.origin + url.pathname === "https://linear.app/oauth/authorize", "unexpected authorization endpoint");
  requireValue(url.searchParams.get("client_id") === expectedClientId, "packaged client ID is missing or incorrect");
  requireValue(url.searchParams.get("redirect_uri") === "http://127.0.0.1:45432/oauth/callback", "unexpected callback URL");
  requireValue(url.searchParams.get("response_type") === "code", "authorization code flow is missing");
  requireValue(url.searchParams.get("code_challenge_method") === "S256", "PKCE S256 is missing");
  requireValue((url.searchParams.get("code_challenge")?.length ?? 0) >= 43, "PKCE challenge is invalid");
  requireValue((url.searchParams.get("state")?.length ?? 0) >= 32, "OAuth state is invalid");
  requireValue(url.searchParams.get("scope") === "read,write", "unexpected OAuth scope set");
  requireValue(!url.searchParams.has("client_secret"), "authorization URL contains a client secret");
'

kill "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true
pid=""

printf 'Fresh-install OAuth authorization smoke test passed.\n'
