import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { Issue } from "../domain";
import { IssueRepository, LinearService, type LinearServiceShape } from "../services";
import { getIssue, listIssues } from "./query-issues";

const now = new Date("2026-01-01T00:00:00Z");
const issue: Issue = {
  id: "1", teamId: "team", identifier: "ENG-1", url: "https://linear.app/acme/issue/ENG-1/example", number: 1,
  title: "Example", description: null, priority: 2, stateId: "todo", assigneeId: "user", projectId: "project",
  cycleId: "cycle", labelIds: ["label"], sortOrder: 1, completedAt: null, canceledAt: null,
  createdAt: now, updatedAt: now,
};
const emptyPage = Effect.succeed({ items: [], endCursor: null, hasNextPage: false });
const linear = (remoteIssue: Issue | null): LinearServiceShape => ({
  viewer: Effect.dieMessage("unused"), users: () => emptyPage, teams: () => emptyPage, workflowStates: () => emptyPage,
  issues: () => Effect.succeed({ items: [issue], endCursor: null, hasNextPage: false }), updatedIssues: () => emptyPage,
  issue: () => Effect.succeed(remoteIssue), projects: () => emptyPage, cycles: () => emptyPage, labels: () => emptyPage,
  comments: () => emptyPage, createComment: () => Effect.dieMessage("unused"), createIssue: () => Effect.dieMessage("unused"),
  updateIssue: () => Effect.dieMessage("unused"), changeIssueStatus: () => Effect.dieMessage("unused"), initialReadModel: Effect.dieMessage("unused"),
});
const RepositoryTest = Layer.succeed(IssueRepository, {
  count: Effect.succeed(1), findByIdentifier: () => Effect.succeed(issue), list: () => Effect.succeed([issue]),
  save: () => Effect.void, updateState: () => Effect.void,
});

describe("shared issue queries", () => {
  test("applies metadata filters to offline cache reads", async () => {
    const QueryTest = Layer.merge(RepositoryTest, Layer.succeed(LinearService, linear(null)));
    const result = await Effect.runPromise(listIssues({ teamId: "team", priority: 2, labelId: "label" }, { offline: true }).pipe(
      Effect.provide(QueryTest),
    ));
    expect(result).toEqual([issue]);
    const empty = await Effect.runPromise(listIssues({ priority: 4 }, { offline: true }).pipe(Effect.provide(QueryTest)));
    expect(empty).toEqual([]);
  });

  test("treats a remotely deleted issue as an empty result instead of crashing", async () => {
    const result = await Effect.runPromise(getIssue("eng-1", false).pipe(
      Effect.provide(Layer.merge(RepositoryTest, Layer.succeed(LinearService, linear(null)))),
    ));
    expect(result).toBeNull();
  });
});
