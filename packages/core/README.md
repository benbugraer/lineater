# @lineater/core

Framework-independent domain models, service contracts, typed errors, and application use cases. This package must not import Linear SDK, OpenTUI, or SQLite.

Issue creation, field updates, status movement, and comments are shared by CLI and TUI. Updates write optimistically to the cache and restore the complete previous issue when Linear rejects the mutation; creation and comments wait for Linear's canonical payload before caching.
