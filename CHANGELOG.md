# Changelog

All notable changes to Lineater are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-12

### Added

- Keyboard-first OpenTUI workspace with cached-first list/detail and dynamic Kanban views.
- Complete issue creation, editing, status, priority, assignee, label, project, cycle, and comment workflows.
- Composable CLI commands with clean JSON output, offline reads, and server-side metadata filters.
- Persistent themes, startup preferences, automatic synchronization, and customizable named keybindings.
- Incremental cursor-based synchronization with transactional SQLite cache updates and stale issue reconciliation.
- Terminal-native clipboard, browser, and external editor actions without shell interpolation.
- Expired-session recovery that returns to authorization while preserving pending issue and comment drafts.
- Standalone Linux and macOS releases for x64 and ARM64 with SHA-256 verified installation.

### Security

- Zero-config login for official binaries through an embedded non-sensitive public client ID, verified by a fresh-install release smoke test.
- Documentation placeholder OAuth client IDs are rejected before a browser consent window is opened.
- Linear OAuth 2.0 authorization code flow with PKCE S256, strict loopback callbacks, state validation, refresh rotation, and OS-native credential storage.
- Restrictive config, database, temporary editor, and log permissions with symbolic-link target rejection.
- Trusted Linear URL validation, bounded OAuth responses, sanitized infrastructure errors, and non-retried mutations.
- Hardened release archives and installer checksum validation.

### Notes

- This is Lineater's first public preview release.
- Existing local caches are upgraded automatically through embedded transactional migrations.
- Linear remains the source of truth; the SQLite database is a disposable local cache.

[0.1.0]: https://github.com/benbugraer/lineater/releases/tag/v0.1.0
