# @lineater/tui

OpenTUI React adapter for Lineater's keyboard-first terminal interface. It consumes core use cases and never calls Linear, SQLite, `fetch`, or the OS credential store directly.

## Screens

- First-run OAuth authorization, actionable authentication errors, and expired-session recovery that preserves pending composer drafts
- Responsive issue workspace with a compact, collapsible Linear-style sidebar, dense two-line issue rows, and detail preview
- Compact dynamic Kanban board built from the selected team's workflow states, ordered by Linear's manual `sortOrder`
- Linear-style create/edit composer for title, Markdown description, team, status, priority, assignee, labels, project, and cycle
- Cached issue comments with an in-TUI Markdown comment composer
- Search, command palette, complete team/state/project/cycle/assignee/priority/label filters, metadata pickers, help overlay, sync and mutation notices
- Persistent settings overlay for theme, startup view, and cached-first automatic sync
- Safe `$LINEATER_EDITOR` / `$EDITOR` / `$VISUAL` support for long descriptions and comments
- System clipboard identifier copy (`y`) and allowlisted Linear web opening (`o`)
- Explicit minimum-size screen for terminals below 58×18

## Responsive layout

- Wide (`>=124` columns): sidebar, issue list, detail preview
- Medium (`86–123`): issue list and detail preview
- Narrow (`58–85`): one pane with open/back navigation
- Kanban renders a sliding window of four, three, or one compact workflow columns

Press `Shift+S` or `,` to open settings. Linear Dark remains the default; Linear Light, Catppuccin Latte/Frappé/Macchiato/Mocha, Tokyo Night, Nord, and Solarized Light are included. Theme changes preview immediately and preferences are persisted through the core preferences boundary rather than direct filesystem access from the TUI.

Normal-mode bindings can be overridden with the `keybindings` object in config; unknown commands are ignored and `Ctrl+C` remains available. Press `[` to collapse or expand the sidebar on wide layouts. In board view, press `Shift+V` to choose visible workflow columns (for example, hide completed states) without changing Linear data. Press `f` for composable issue filters and `x` inside the panel to clear them.

All keyboard input is routed through `@opentui/keymap` named commands. `gg` uses sequence handling, and shifted `H`/`L` moves issues optimistically through dynamic workflow columns. Renderer, keymap layers, OAuth callback fibers, and React roots are cleaned up on every exit path.
