import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { InitialReadModel, Issue } from "../domain";
import { LinearService, type LinearServiceShape, ReadModelRepository } from "../services";
import { syncIncrementalReadModel } from "./sync-incremental-read-model";

const syncedAt = new Date("2026-03-10T12:00:00.000Z");
const issue = (id: string, title: string): Issue => ({
  id, teamId: "team-1", identifier: `ENG-${id}`, url: `https://linear.app/acme/issue/ENG-${id}/example`, number: Number(id),
  title, description: null, priority: 0, stateId: "state-1", assigneeId: null, projectId: null, cycleId: null,
  labelIds: [], sortOrder: 1, completedAt: null, canceledAt: null, createdAt: syncedAt, updatedAt: syncedAt,
});
const cached: InitialReadModel = {
  workspace: { id: "workspace-1", name: "Acme", urlKey: "acme", createdAt: syncedAt, updatedAt: syncedAt },
  viewer: { id: "user-1", workspaceId: "workspace-1", name: "Ada", displayName: "Ada", email: null, avatarUrl: null, active: true, createdAt: syncedAt, updatedAt: syncedAt },
  users: [], teams: [], workflowStates: [], issues: [issue("1", "Old")], labels: [], projects: [], cycles: [], syncedAt,
};
const emptyPage = Effect.succeed({ items: [], endCursor: null, hasNextPage: false });
const makeLinear = (updatedIssues: LinearServiceShape["updatedIssues"]): LinearServiceShape => ({
  viewer: Effect.dieMessage("unused"), users: () => emptyPage, teams: () => emptyPage, workflowStates: () => emptyPage,
  issues: () => emptyPage, updatedIssues, issue: () => Effect.succeed(null), projects: () => emptyPage, cycles: () => emptyPage,
  labels: () => emptyPage, comments: () => emptyPage, createComment: () => Effect.dieMessage("unused"),
  createIssue: () => Effect.dieMessage("unused"), updateIssue: () => Effect.dieMessage("unused"),
  changeIssueStatus: () => Effect.dieMessage("unused"), initialReadModel: Effect.dieMessage("unused"),
});

describe("incremental read-model sync", () => {
  test("uses an overlap window, follows cursors, and merges one atomic delta", async () => {
    const calls: Array<{ since: Date; after?: string }> = [];
    const changed = issue("1", "Updated");
    let current = cached;
    const linear = makeLinear((since, after) => {
      calls.push({ since, after });
      return after
        ? Effect.succeed({ items: [changed], endCursor: null, hasNextPage: false })
        : Effect.succeed({ items: [], endCursor: "next", hasNextPage: true });
    });
    const RepositoryTest = Layer.succeed(ReadModelRepository, {
      saveIdentity: () => Effect.void,
      saveInitialReadModel: () => Effect.void,
      mergeIssues: (issues, nextSyncedAt) => Effect.sync(() => {
        current = { ...current, issues, syncedAt: nextSyncedAt };
      }),
      loadInitialReadModel: Effect.sync(() => current),
    });
    const result = await Effect.runPromise(syncIncrementalReadModel.pipe(
      Effect.provide(Layer.succeed(LinearService, linear)),
      Effect.provide(RepositoryTest),
    ));
    expect(calls.map(({ after }) => after)).toEqual([undefined, "next"]);
    expect(calls[0]?.since.toISOString()).toBe("2026-03-10T11:58:00.000Z");
    expect(result.issues[0]?.title).toBe("Updated");
    expect(result.syncedAt.getTime()).toBeGreaterThan(syncedAt.getTime());
  });
});
