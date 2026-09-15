# @lineater/config

XDG paths, non-sensitive configuration, preference persistence, and file logging.

OAuth client ID precedence: `LINEATER_LINEAR_CLIENT_ID`, then `linearClientId` in `~/.config/lineater/config.json`, then the packaged public client ID in official binaries. Documentation placeholders are rejected. Redirect URIs must be an exact HTTP loopback URL with a fixed port. Scopes are allowlisted; `admin` is refused.

Config writes are atomic and mode `0600`. Token-like keys and symbolic-link config targets are rejected. Credentials never live in this file.
