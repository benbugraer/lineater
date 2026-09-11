# @lineater/tui

OpenTUI React adapter for Lineater's keyboard-first terminal interface. It consumes core use cases and never calls Linear, SQLite, `fetch`, or the OS credential store directly.

## Screens

- First-run OAuth authorization and actionable authentication errors
- Responsive issue workspace with Linear-style sidebar, issue list, and detail preview
- Dynamic Kanban board built from the selected team's workflow states
- Linear-style create/edit composer for title, Markdown description, team, status, priority, assignee, labels, project, and cycle
- Cached issue comments with an in-TUI Markdown comment composer
- Search, command palette, metadata pickers, help overlay, sync and mutation notices
- Persistent settings overlay for theme, startup view, and cached-first automatic sync
- Safe `$LINEATER_EDITOR` / `$EDITOR` / `$VISUAL` support for long descriptions and comments
- Explicit minimum-size screen for terminals below 58×18

## Responsive layout

- Wide (`>=124` columns): sidebar, issue list, detail preview
- Medium (`86–123`): issue list and detail preview
- Narrow (`58–85`): one pane with open/back navigation
- Kanban renders a sliding window of three, two, or one workflow columns

Press `Shift+S` or `,` to open settings. Linear Dark remains the default; Linear Light, Catppuccin Latte/Frappé/Macchiato/Mocha, Tokyo Night, Nord, and Solarized Light are included. Theme changes preview immediately and preferences are persisted through the core preferences boundary rather than direct filesystem access from the TUI.

All keyboard input is routed through `@opentui/keymap` named commands. `gg` uses sequence handling, and shifted `H`/`L` moves issues optimistically through dynamic workflow columns. Renderer, keymap layers, OAuth callback fibers, and React roots are cleaned up on every exit path.
