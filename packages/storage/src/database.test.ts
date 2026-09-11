import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { CacheService, CommentRepository, IssueRepository, ReadModelRepository, getStartupStatus, type CacheHealth, type InitialReadModel } from "@lineater/core";
import { makeTemporaryDirectory, type TemporaryDirectory } from "@lineater/testkit";
import { Effect } from "effect";
import { stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeStorageLayer } from "./index";

const temporaryDirectories: TemporaryDirectory[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(({ cleanup }) => cleanup()));
});

describe("SQLite storage", () => {
  test("applies migrations and enables safe SQLite pragmas", async () => {
    const temporaryDirectory = await makeTemporaryDirectory();
    temporaryDirectories.push(temporaryDirectory);
    const databasePath = join(temporaryDirectory.path, "cache", "lineater.db");
    const layer = makeStorageLayer({ databasePath });

    const status = await Effect.runPromise(
      Effect.scoped(getStartupStatus.pipe(Effect.provide(layer))),
    );

    expect(status).toEqual({ cacheReady: true, cachedIssueCount: 0 });
    expect((await stat(databasePath)).mode & 0o777).toBe(0o600);

    const sqlite = new Database(databasePath, { readonly: true });
    try {
      const tableNames = sqlite
        .query<{ readonly name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all()
        .map(({ name }) => name);

      expect(tableNames).toEqual(expect.arrayContaining([
        "__drizzle_migrations",
        "comments",
        "cycles",
        "issue_labels",
        "issues",
        "labels",
        "projects",
        "sync_state",
        "teams",
        "users",
        "workflow_states",
        "workspaces",
      ]));
      expect(sqlite.query<{ readonly journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode).toBe("wal");
      expect(sqlite.query<{ readonly total: number }, []>("SELECT count(*) AS total FROM __drizzle_migrations").get()?.total).toBe(6);
    } finally {
      sqlite.close();
    }
  });

  test("refuses symbolic-link database targets", async () => {
    const temporaryDirectory = await makeTemporaryDirectory();
    temporaryDirectories.push(temporaryDirectory);
    const target = join(temporaryDirectory.path, "target.db");
    const databasePath = join(temporaryDirectory.path, "lineater.db");
    await writeFile(target, "not-a-database");
    await symlink(target, databasePath);
    await expect(Effect.runPromise(
      Effect.scoped(getStartupStatus.pipe(Effect.provide(makeStorageLayer({ databasePath })))),
    )).rejects.toThrow("symbolic link");
  });

  test("persists and queries the initial read model transactionally", async () => {
    const temporaryDirectory = await makeTemporaryDirectory();
    temporaryDirectories.push(temporaryDirectory);
    const databasePath = join(temporaryDirectory.path, "lineater.db");
    const now = new Date("2026-01-02T03:04:05.000Z");
    const model: InitialReadModel = {
      workspace: { id: "workspace-1", name: "Acme", urlKey: "acme", createdAt: now, updatedAt: now },
      viewer: { id: "user-1", workspaceId: "workspace-1", name: "Ada Lovelace", displayName: "Ada", email: "ada@example.com", avatarUrl: null, active: true, createdAt: now, updatedAt: now },
      users: [],
      teams: [{ id: "team-1", workspaceId: "workspace-1", key: "ENG", name: "Engineering", createdAt: now, updatedAt: now }],
      workflowStates: [
        { id: "state-1", teamId: "team-1", name: "Todo", type: "unstarted", color: "#888888", position: 1, createdAt: now, updatedAt: now },
        { id: "state-2", teamId: "team-1", name: "In Progress", type: "started", color: "#5e6ad2", position: 2, createdAt: now, updatedAt: now },
      ],
      projects: [],
      cycles: [],
      labels: [{ id: "label-1", workspaceId: "workspace-1", teamId: "team-1", name: "Bug", color: "#ff0000", createdAt: now, updatedAt: now }],
      issues: [{ id: "issue-1", teamId: "team-1", identifier: "ENG-1", url: "https://linear.app/acme/issue/ENG-1/first-issue", number: 1, title: "First issue", description: null, priority: 2, stateId: "state-1", assigneeId: "user-1", projectId: null, cycleId: null, labelIds: ["label-1"], sortOrder: 1, completedAt: null, canceledAt: null, createdAt: now, updatedAt: now }],
      syncedAt: now,
    };

    const program = Effect.gen(function* () {
      const readModel = yield* ReadModelRepository;
      const issueRepository = yield* IssueRepository;
      const originalIssue = model.issues[0];
      if (!originalIssue) throw new Error("Missing issue fixture");
      yield* readModel.saveInitialReadModel({
        ...model,
        issues: [originalIssue, { ...originalIssue, id: "deleted-issue", identifier: "ENG-2", url: "https://linear.app/acme/issue/ENG-2/deleted", number: 2 }],
      });
      yield* readModel.saveInitialReadModel({ ...model, issues: [{ ...originalIssue, title: "Updated issue" }] });
      yield* issueRepository.updateState("issue-1", "state-2");
      const commentRepository = yield* CommentRepository;
      yield* commentRepository.save({ id: "comment-1", issueId: "issue-1", userId: "user-1", body: "Looks good", createdAt: now, updatedAt: now });
      yield* readModel.mergeIssues([{ ...originalIssue, title: "Incrementally updated", stateId: "state-2", updatedAt: new Date(now.getTime() + 1_000) }], new Date(now.getTime() + 2_000));
      return {
        count: yield* issueRepository.count,
        issue: yield* issueRepository.findByIdentifier("ENG-1"),
        cached: yield* readModel.loadInitialReadModel,
        comments: yield* commentRepository.listByIssue("issue-1"),
      };
    });

    const result = await Effect.runPromise(Effect.scoped(program.pipe(Effect.provide(makeStorageLayer({ databasePath })))));
    expect(result.count).toBe(1);
    expect(result.issue?.title).toBe("Incrementally updated");
    expect(result.issue?.stateId).toBe("state-2");
    expect(result.cached?.workspace.name).toBe("Acme");
    expect(result.cached?.viewer.displayName).toBe("Ada");
    expect(result.cached?.issues).toHaveLength(1);
    expect(result.cached?.issues[0]?.labelIds).toEqual(["label-1"]);
    expect(result.cached?.issues[0]?.url).toBe("https://linear.app/acme/issue/ENG-1/first-issue");
    expect(result.cached?.syncedAt).toEqual(new Date(now.getTime() + 2_000));
    expect(result.cached?.labels[0]?.name).toBe("Bug");
    expect(result.comments.map(({ body }) => body)).toEqual(["Looks good"]);
  });

  test("refuses to start when an applied migration hash was altered", async () => {
    const temporaryDirectory = await makeTemporaryDirectory();
    temporaryDirectories.push(temporaryDirectory);
    const databasePath = join(temporaryDirectory.path, "lineater.db");
    const start = () => Effect.runPromise(
      Effect.scoped(getStartupStatus.pipe(Effect.provide(makeStorageLayer({ databasePath })))),
    );

    await start();
    const sqlite = new Database(databasePath);
    sqlite.query("UPDATE __drizzle_migrations SET hash = 'tampered'").run();
    sqlite.close();

    await expect(start()).rejects.toThrow("differs from the embedded Drizzle migration");
  });

  test("migration startup is idempotent", async () => {
    const temporaryDirectory = await makeTemporaryDirectory();
    temporaryDirectories.push(temporaryDirectory);
    const databasePath = join(temporaryDirectory.path, "lineater.db");

    const start = () => Effect.runPromise(
      Effect.scoped(
        Effect.all([
          CacheService.pipe(Effect.flatMap((service) => service.healthCheck)),
          IssueRepository.pipe(Effect.flatMap((repository) => repository.count)),
        ]).pipe(Effect.provide(makeStorageLayer({ databasePath }))),
      ),
    );

    const expected: [CacheHealth, number] = [
      { ready: true, journalMode: "wal", foreignKeys: true },
      0,
    ];
    await expect(start()).resolves.toEqual(expected);
    await expect(start()).resolves.toEqual(expected);
  });
});
