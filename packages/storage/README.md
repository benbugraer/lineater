# @lineater/storage

Disposable local cache implemented with `bun:sqlite` and Drizzle ORM. Linear remains the source of truth.

- schema: `src/schema.ts`
- generated migrations: `drizzle/`
- embedded standalone migration registry: `src/migrations.ts`
- transactional repositories: `src/repositories.ts`
- cached issue labels, label relations, comments, and trusted Linear issue URLs for offline detail actions
- cursor-threshold incremental issue merges plus full-snapshot stale/deleted issue reconciliation

Migrations run once in the application process before repositories are exposed. They acquire a SQLite `BEGIN IMMEDIATE` writer lock, execute transactionally, and use Drizzle-compatible `__drizzle_migrations` hash/timestamp metadata. The database, WAL, and shared-memory files are restricted to mode `0600`; symbolic-link database targets are rejected. The issue identity constraint is team + number so switching between workspaces with overlapping identifiers cannot corrupt the cache.

Use `bun run db:generate` after schema changes and `bun run db:studio` to inspect the cache.
