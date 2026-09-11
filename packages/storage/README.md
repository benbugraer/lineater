# @lineater/storage

Disposable local cache implemented with `bun:sqlite` and Drizzle ORM. Linear remains the source of truth.

- schema: `src/schema.ts`
- generated migrations: `drizzle/`
- embedded standalone migration registry: `src/migrations.ts`
- transactional repositories: `src/repositories.ts`
- cached issue labels, label relations, and comments for offline detail views

Migrations run once in the application process before repositories are exposed. They acquire a SQLite `BEGIN IMMEDIATE` writer lock, execute transactionally, and use Drizzle-compatible `__drizzle_migrations` hash/timestamp metadata. The database file is restricted to mode `0600`.

Use `bun run db:generate` after schema changes and `bun run db:studio` to inspect the cache.
