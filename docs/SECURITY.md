# Lineater security model

Lineater is a local terminal client. Linear remains the source of truth and SQLite is a disposable read cache.

## Authentication

- OAuth 2.0 Authorization Code with PKCE S256; official release binaries embed only the non-sensitive public client ID and never bundle a client secret.
- Cryptographically random verifier and state.
- Exact fixed-port loopback callback bound only to `localhost`, `127.0.0.1`, or `::1`.
- Wrong-state requests receive HTTP 400 without cancelling the legitimate pending callback.
- Callback bodies, query values, token responses, and stored credentials have explicit size/shape bounds.
- Access and rotating refresh tokens are stored only through `Bun.secrets`; no plaintext fallback exists.
- Logout revocation retains credentials when network failure makes revocation outcome uncertain.

## Local data

- Config contains non-sensitive settings only. Token/secret-like keys and symbolic-link config targets are rejected.
- Config writes are atomic and mode `0600`.
- SQLite, WAL, and SHM files are mode `0600`; symbolic-link database targets are rejected.
- SQLite uses foreign keys, WAL, `synchronous=NORMAL`, a busy timeout, transactional repositories, and integrity-checked embedded migrations.
- Cached data is scoped to the currently synchronized workspace and can be deleted/rebuilt without affecting Linear.

## External processes and URLs

- Browser, clipboard, and `$EDITOR` integrations use direct argv spawning without shell interpolation.
- Editor files live in a private temporary directory, use mode `0600`, and are always removed.
- Issue browser-open accepts only HTTPS URLs on the exact `linear.app` host.

## Network and mutations

- Reads have bounded timeouts, cursor pagination, and retries only for controlled network failures.
- Rate-limit, permission, authentication, GraphQL, network, and invalid-response errors remain distinct.
- Mutations are never automatically retried.
- Updates use cache/UI rollback; create and comment operations cache only canonical server responses.
- Unknown infrastructure exception details are not rendered directly to users.

## Reporting

Do not include tokens, OAuth codes, config files, database files, or private issue content in reports. Use GitHub security reporting for vulnerabilities and include only sanitized reproduction details.

## Verification

Run before release:

```bash
bun audit
bun run lint
bun run typecheck
bun test
bun run build
bun run build:web
LINEATER_RELEASE_LINEAR_CLIENT_ID="$LINEATER_LINEAR_CLIENT_ID" bun run build:release
bun run test:installer
mkdir -p /tmp/lineater-auth-smoke
tar -xzf release/lineater-linux-x64.tar.gz -C /tmp/lineater-auth-smoke
./scripts/auth-install-smoke.sh /tmp/lineater-auth-smoke/lineater "$LINEATER_LINEAR_CLIENT_ID"
```
