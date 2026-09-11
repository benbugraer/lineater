import { Database } from "bun:sqlite";
import { CacheService, StorageError } from "@lineater/core";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Context, Effect, Layer } from "effect";
import { chmod, lstat, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { applyMigrations } from "./migrations";
import { schema } from "./schema";

export interface StorageOptions {
  readonly databasePath: string;
}

export interface StorageConnectionShape {
  readonly sqlite: Database;
  readonly db: BunSQLiteDatabase<typeof schema>;
}

export class StorageConnection extends Context.Tag("@lineater/storage/StorageConnection")<
  StorageConnection,
  StorageConnectionShape
>() {}

const toStorageError = (operation: string, cause: unknown): StorageError =>
  new StorageError({
    operation,
    message: cause instanceof Error ? cause.message : "Unknown storage failure",
    cause,
  });

const makeConnectionLayer = (options: StorageOptions) => Layer.scoped(
  StorageConnection,
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const databaseDirectory = dirname(options.databasePath);
        const existingDatabase = await lstat(options.databasePath).catch((cause: NodeJS.ErrnoException) => {
          if (cause.code === "ENOENT") return null;
          throw cause;
        });
        if (existingDatabase?.isSymbolicLink() || (existingDatabase && !existingDatabase.isFile())) {
          throw new Error("Database path must be a regular file, not a symbolic link");
        }
        const createdDirectory = await mkdir(databaseDirectory, { recursive: true, mode: 0o700 });
        if (createdDirectory !== undefined) await chmod(databaseDirectory, 0o700);
        const sqlite = new Database(options.databasePath, { create: true });
        await chmod(options.databasePath, 0o600);

        try {
          sqlite.exec("PRAGMA foreign_keys = ON;");
          sqlite.exec("PRAGMA journal_mode = WAL;");
          sqlite.exec("PRAGMA synchronous = NORMAL;");
          sqlite.exec("PRAGMA busy_timeout = 5000;");

          applyMigrations(sqlite);
          await Promise.all([
            chmod(options.databasePath, 0o600),
            chmod(`${options.databasePath}-wal`, 0o600).catch(() => undefined),
            chmod(`${options.databasePath}-shm`, 0o600).catch(() => undefined),
          ]);
          const db = drizzle(sqlite, { schema });

          return { sqlite, db } satisfies StorageConnectionShape;
        } catch (cause) {
          sqlite.close();
          throw cause;
        }
      },
      catch: (cause) => toStorageError("open-and-migrate", cause),
    }),
    ({ sqlite }) => Effect.sync(() => sqlite.close()),
  ),
);

export const CacheServiceLive = Layer.effect(
  CacheService,
  Effect.gen(function* () {
    const { sqlite } = yield* StorageConnection;

    return {
      healthCheck: Effect.try({
        try: () => {
          const journal = sqlite
            .query<{ readonly journal_mode: string }, []>("PRAGMA journal_mode")
            .get();
          const foreignKeys = sqlite
            .query<{ readonly foreign_keys: number }, []>("PRAGMA foreign_keys")
            .get();

          if (journal?.journal_mode.toLowerCase() !== "wal") {
            throw new Error(`Expected WAL journal mode, received ${journal?.journal_mode ?? "none"}`);
          }
          if (foreignKeys?.foreign_keys !== 1) {
            throw new Error("SQLite foreign key enforcement is disabled");
          }

          return { ready: true, journalMode: "wal" as const, foreignKeys: true as const };
        },
        catch: (cause) => toStorageError("health-check", cause),
      }),
    };
  }),
);

export const makeStorageConnectionLayer = (options: StorageOptions) => makeConnectionLayer(options);

export const makeCacheLayer = (options: StorageOptions) => CacheServiceLive.pipe(
  Layer.provide(makeConnectionLayer(options)),
);
