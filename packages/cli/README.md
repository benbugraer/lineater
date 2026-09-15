# @lineater/cli

`@effect/cli` adapter for the `lineater` executable. Commands call the same core use cases as the TUI.

- no arguments opens the TUI
- `auth login|status|logout`, `sync`, `viewer`, `teams`, `states`, `issues`, `issue`, `create`, `update`, `comment`, `projects`, and `cycles`
- `--json` writes only valid JSON to stdout
- `--offline` reads the local SQLite cache
- diagnostics belong on stderr
