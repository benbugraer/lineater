# @lineater/core

Framework-independent domain models, service contracts, typed errors, and application use cases. This package must not import Linear SDK, OpenTUI, or SQLite.

Issue querying/filtering, creation, field updates, status movement, comments, incremental synchronization, clipboard copy, and trusted browser-open actions are expressed as use cases shared by adapters. Updates write optimistically to the cache and restore the complete previous issue when Linear rejects the mutation; creation and comments wait for Linear's canonical payload before caching.
