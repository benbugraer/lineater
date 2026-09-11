# Lineater

A fast, keyboard-first, scriptable, local-cache-backed Linear client for the terminal.

## Installation

Linux and macOS (x64 and arm64):

```bash
curl -fsSL https://raw.githubusercontent.com/benbugraer/lineater/master/scripts/install.sh | sh
```

The installer downloads the correct standalone executable, verifies its SHA-256 checksum, and installs it to `~/.local/bin/lineater`. Bun and Node.js are not required. See [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) for release operations and [`docs/SECURITY.md`](docs/SECURITY.md) for the threat model and release security checklist.

Open Lineater after installation:

```bash
lineater
```

On first launch, select **Authorize with Linear** inside the TUI. Lineater opens the system browser, completes OAuth 2.0 + PKCE, securely stores the credential, syncs the first read-model page, and transitions into the workspace without restarting.

## Development requirements

- Bun 1.3.14+
- Linux or macOS

## Development

```bash
bun install
bun run dev
```

The first run creates the cache at:

```text
$XDG_DATA_HOME/lineater/lineater.db
# fallback: ~/.local/share/lineater/lineater.db
```

Override it during development or tests with `LINEATER_DATABASE_PATH`.

Exit the TUI with `q` or `Ctrl+C`. `Esc` closes overlays or returns to the previous pane.

## Linear OAuth setup

Create an OAuth application in [Linear API settings](https://linear.app/settings/api/applications/new) and register this exact callback URL:

```text
http://127.0.0.1:45432/oauth/callback
```

Configure the public client ID—never package a client secret:

```bash
export LINEATER_LINEAR_CLIENT_ID="your-client-id"
bun run dev
```

You can instead create `~/.config/lineater/config.json` with `linearClientId`, `linearRedirectUri`, and `linearScopes`. The same non-sensitive file stores TUI preferences (`theme`, `defaultView`, `autoSync`, and named-command `keybindings`) selected from settings or edited directly. Plaintext token/secret keys and symbolic-link config targets are rejected. The default scopes are `read` and `write`; Lineater rejects `admin` and unknown scopes.

The primary login path is the TUI authorization screen; `lineater auth login` remains available for scripts and diagnostics. Login uses Authorization Code + PKCE (`S256`) and a cryptographically random `state`. The callback binds only to the configured loopback address, expires after five minutes, and accepts one matching callback. Access and rotating refresh tokens are stored only through `Bun.secrets` in macOS Keychain, Linux Secret Service, or Windows Credential Manager. There is deliberately no plaintext fallback.

### TUI keyboard map

```text
j / k       move down / up
h / l       move left / right
gg / G      first / last
Enter       open issue details or select
Esc         close or go back
n / e       create / edit issue
c           add a Markdown comment
s / a / p   status / assignee / priority
t           labels
P / C       project / cycle
/           search cached issues
f           team/state/project/cycle/assignee/priority/label filters
y / o       copy identifier / open issue in Linear
:           command palette
S / ,       settings and themes
?           help overlay
b           list / board
H / L       move issue across workflow states
Ctrl+E      edit long descriptions/comments in $EDITOR
Ctrl+S      save issue/comment composer
r           refresh from Linear
q           quit
```

Named normal-mode commands can be overridden without changing source code, for example:

```json
{
  "keybindings": {
    "app.settings": "ctrl+,",
    "issue.copyIdentifier": "ctrl+y"
  }
}
```

`Ctrl+C` remains an emergency quit binding. Invalid/unknown commands are ignored rather than executed.

The default appearance is Linear Dark. Settings include Linear Light, all four Catppuccin flavors (Latte, Frappé, Macchiato, Mocha), Tokyo Night, Nord, and Solarized Light. Changes preview immediately and persist atomically with `0600` permissions.

Issue filters compose over cached TUI data and map to Linear relation comparators in CLI queries; `x` clears the filter panel. Startup renders the last SQLite snapshot immediately, then performs cursor-paginated incremental issue sync with a two-minute overlap. Manual `r` performs a complete read-model reconciliation, including removal of stale/deleted cached issues.

Kanban columns come from each team's Linear workflow-state order; no status names or IDs are hardcoded. `H`/`L` applies an optimistic local move and rolls both UI and SQLite back if Linear rejects the mutation.

### Scriptable commands

```bash
bun run dev auth status
bun run dev auth logout
bun run dev sync
bun run dev viewer
bun run dev teams --json
bun run dev states --json
bun run dev issues --team TEAM_UUID --state STATE_UUID --priority 2 --label LABEL_UUID --json
bun run dev create "Issue title" --team TEAM_UUID --priority 2 --json
bun run dev update ENG-123 --title "Updated title" --assignee none --json
bun run dev comment ENG-123 "Markdown comment" --json
bun run dev issues --offline --priority 2 --json
bun run dev issue ENG-123 --json
bun run dev issue ENG-123 --offline --json
bun run dev projects --json
bun run dev cycles --json
```

## Verification

```bash
bun run lint
bun run typecheck
bun test
bun run test:installer
bun run build
bun run build:web
bun run profile:startup
```

Generate a migration after changing `packages/storage/src/schema.ts`:

```bash
bun run db:generate
```

Commit the generated SQL and Drizzle metadata together, then register the SQL file in `packages/storage/src/migrations.ts` so standalone binaries embed it.

Inspect the cache with Drizzle Studio:

```bash
bun run db:studio
# Optional alternate database:
LINEATER_DATABASE_PATH=/path/to/lineater.db bun run db:studio
```

Build all standalone release archives locally with:

```bash
bun run build:release
```

## Architecture

```text
apps/
  lineater/       Composition root and executable
  web/            Astro website
packages/
  core/           Domain models, service contracts, use cases
  linear/         Linear SDK / GraphQL adapters and mappers
  storage/        bun:sqlite, Drizzle schema, migrations, repositories
  auth/           OAuth 2.0 + PKCE and secure secret storage
  tui/            OpenTUI React adapter
  cli/            @effect/cli adapter
  config/         Paths and non-sensitive configuration
  testkit/        Shared test utilities
```

Dependency direction:

```text
apps/lineater → cli / tui → core ← storage / linear / auth
```

`core` has no knowledge of Linear SDK, OpenTUI, or SQLite. SQLite is a disposable local cache; Linear remains the source of truth.

## SQLite defaults

Every connection managed by `@lineater/storage` enables:

- `PRAGMA journal_mode = WAL`
- `PRAGMA foreign_keys = ON`
- `PRAGMA synchronous = NORMAL`
- `PRAGMA busy_timeout = 5000`

Schema migrations run before the application use cases and are idempotent.
