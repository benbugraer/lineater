import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { Issue } from "../domain";
import { LinearApiError } from "../errors";
import {
  IssueRepository,
  LinearService,
  type IssueRepositoryShape,
  type LinearServiceShape,
} from "../services";
import { changeIssueStatus } from "./change-issue-status";

const now = new Date("2026-01-02T03:04:05.000Z");
const issue: Issue = {
  id: "issue-1",
  teamId: "team-1",
  identifier: "ENG-1",
  number: 1,
  title: "Build keyboard-first TUI",
  description: null,
  priority: 2,
  stateId: "todo",
  assigneeId: null,
  projectId: null,
  cycleId: null,
  labelIds: [],
  sortOrder: 1,
  completedAt: null,
  canceledAt: null,
  createdAt: now,
  updatedAt: now,
};

const unusedPage = Effect.succeed({ items: [], endCursor: null, hasNextPage: false });
const makeLinear = (change: LinearServiceShape["changeIssueStatus"]): LinearServiceShape => ({
  viewer: Effect.dieMessage("unused"),
  users: () => unusedPage,
  teams: () => unusedPage,
  workflowStates: () => unusedPage,
  issues: () => unusedPage,
  issue: () => Effect.succeed(null),
  projects: () => unusedPage,
  cycles: () => unusedPage,
  labels: () => unusedPage,
  comments: () => unusedPage,
  createComment: () => Effect.dieMessage("unused"),
  createIssue: () => Effect.dieMessage("unused"),
  updateIssue: () => Effect.dieMessage("unused"),
  changeIssueStatus: change,
  initialReadModel: Effect.dieMessage("unused"),
});

const run = (change: LinearServiceShape["changeIssueStatus"], transitions: string[]) => {
  const repository: IssueRepositoryShape = {
    count: Effect.succeed(1),
    findByIdentifier: () => Effect.succeed(issue),
    list: () => Effect.succeed([issue]),
    save: () => Effect.void,
    updateState: (_issueId, stateId) => Effect.sync(() => { transitions.push(stateId); }),
  };
  return Effect.runPromise(changeIssueStatus(issue, "started").pipe(
    Effect.provide(Layer.merge(
      Layer.succeed(IssueRepository, repository),
      Layer.succeed(LinearService, makeLinear(change)),
    )),
  ));
};

describe("changeIssueStatus", () => {
  test("updates the cache optimistically and commits the server state", async () => {
    const transitions: string[] = [];
    const updated = { ...issue, stateId: "started", updatedAt: new Date("2026-01-02T04:00:00.000Z") };
    await expect(run(() => Effect.succeed(updated), transitions)).resolves.toEqual(updated);
    expect(transitions).toEqual(["started", "started"]);
  });

  test("rolls the cache back when Linear rejects the mutation", async () => {
    const transitions: string[] = [];
    const failure = new LinearApiError({ reason: "permission", message: "Mutation denied" });
    await expect(run(() => Effect.fail(failure), transitions)).rejects.toThrow("Mutation denied");
    expect(transitions).toEqual(["started", "todo"]);
  });
});
