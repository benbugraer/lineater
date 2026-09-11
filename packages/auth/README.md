# @lineater/auth

OAuth 2.0 Authorization Code + PKCE (`S256`) for Linear plus platform adapters for the browser and OS credential store.

Security properties:

- cryptographically random PKCE verifier and CSRF `state`
- exact, fixed loopback redirect URI and five-minute callback timeout
- no client secret in the distributed CLI
- access and rotating refresh tokens only in `Bun.secrets`
- no plaintext credential fallback
- refresh coalescing and one-minute expiry skew
- best-effort-safe revocation that retains credentials when a network failure makes revocation uncertain
