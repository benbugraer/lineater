import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import initialMigration from "../drizzle/0000_far_selene.sql" with { type: "text" };
import viewerMigration from "../drizzle/0001_free_vampiro.sql" with { type: "text" };
import labelTeamMigration from "../drizzle/0002_crazy_avengers.sql" with { type: "text" };
import issueUrlMigration from "../drizzle/0003_fearless_shard.sql" with { type: "text" };
import issueIdentityMigration from "../drizzle/0004_volatile_inertia.sql" with { type: "text" };
import issueUrlBackfillMigration from "../drizzle/0005_issue_url_backfill.sql" with { type: "text" };

interface EmbeddedMigration {
  readonly tag: string;
  readonly folderMillis: number;
  readonly sql: string;
}

// Keep this ordered exactly like drizzle/meta/_journal.json. SQL is embedded so
// the standalone Bun binary does not depend on source files at runtime.
const migrations: readonly EmbeddedMigration[] = [
  { tag: "0000_far_selene", folderMillis: 1788978958932, sql: initialMigration },
  { tag: "0001_free_vampiro", folderMillis: 1789072031173, sql: viewerMigration },
  { tag: "0002_crazy_avengers", folderMillis: 1789082166476, sql: labelTeamMigration },
  { tag: "0003_fearless_shard", folderMillis: 1789130915289, sql: issueUrlMigration },
  { tag: "0004_volatile_inertia", folderMillis: 1789132584877, sql: issueIdentityMigration },
  { tag: "0005_issue_url_backfill", folderMillis: 1789133345700, sql: issueUrlBackfillMigration },
];

const statements = (sql: string): readonly string[] =>
  sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

const migrationHash = (sql: string): string => createHash("sha256").update(sql).digest("hex");

const legacyMigrationApplied = (sqlite: Database, tag: string): boolean => {
  const legacyTable = sqlite.query<{ readonly name: string }, []>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__lineater_migrations'",
  ).get();
  if (!legacyTable) return false;
  return sqlite.query<{ readonly id: string }, [string]>(
    "SELECT id FROM __lineater_migrations WHERE id = ? LIMIT 1",
  ).get(tag) !== null;
};

export const applyMigrations = (sqlite: Database): void => {
  // This table matches Drizzle's SQLite migrator metadata contract.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      "id" integer PRIMARY KEY AUTOINCREMENT,
      "hash" text NOT NULL,
      "created_at" numeric NOT NULL
    );
  `);

  // BEGIN IMMEDIATE serializes migration writers before inspecting metadata.
  // The application invokes this once, before repositories or the TUI start.
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    for (const migration of migrations) {
      const hash = migrationHash(migration.sql);
      const applied = sqlite
        .query<{ readonly hash: string }, [number]>(
          "SELECT hash FROM __drizzle_migrations WHERE created_at = ? LIMIT 1",
        )
        .get(migration.folderMillis);

      if (applied) {
        if (applied.hash !== hash) {
          throw new Error(`Applied migration ${migration.tag} differs from the embedded Drizzle migration`);
        }
        continue;
      }

      if (legacyMigrationApplied(sqlite, migration.tag)) {
        sqlite.query<void, [string, number]>(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        ).run(hash, migration.folderMillis);
        continue;
      }

      for (const statement of statements(migration.sql)) sqlite.exec(statement);
      sqlite.query<void, [string, number]>(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      ).run(hash, migration.folderMillis);
    }
    sqlite.exec("COMMIT");
  } catch (cause) {
    sqlite.exec("ROLLBACK");
    throw cause;
  }
};
