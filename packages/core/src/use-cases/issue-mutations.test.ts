import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { Issue } from "../domain";
import { LinearApiError } from "../errors";
import { CommentRepository, IssueRepository, LinearService, type CommentRepositoryShape, type IssueRepositoryShape, type LinearServiceShape } from "../services";
import { addIssueComment } from "./add-issue-comment";
import { createIssue } from "./create-issue";
import { updateIssue } from "./update-issue";

const now = new Date("2026-03-01T10:00:00.000Z");
const issue: Issue = {
  id: "issue-1", teamId: "team-1", identifier: "ENG-1", number: 1, title: "Original",
  description: null, priority: 0, stateId: "todo", assigneeId: null, projectId: null,
  cycleId: null, labelIds: [], sortOrder: 1, completedAt: null, canceledAt: null,
  createdAt: now, updatedAt: now,
};
const page = Effect.succeed({ items: [], endCursor: null, hasNextPage: false });
const makeLinear = (overrides: Partial<LinearServiceShape>): LinearServiceShape => ({
  viewer: Effect.dieMessage("unused"), users: () => page, teams: () => page,
  workflowStates: () => page, issues: () => page, issue: () => Effect.succeed(null),
  projects: () => page, cycles: () => page, labels: () => page, comments: () => page,
  createComment: () => Effect.dieMessage("unused"), createIssue: () => Effect.dieMessage("unused"),
  updateIssue: () => Effect.dieMessage("unused"), changeIssueStatus: () => Effect.dieMessage("unused"),
  initialReadModel: Effect.dieMessage("unused"), ...overrides,
});
const runWith = <A, E>(effect: Effect.Effect<A, E, IssueRepository | LinearService>, linear: LinearServiceShape, saved: Issue[]) => {
  const repository: IssueRepositoryShape = {
    count: Effect.succeed(0), findByIdentifier: () => Effect.succeed(null), list: () => Effect.succeed([]),
    save: (value) => Effect.sync(() => { saved.push(value); }), updateState: () => Effect.void,
  };
  return Effect.runPromise(effect.pipe(Effect.provide(Layer.merge(
    Layer.succeed(IssueRepository, repository), Layer.succeed(LinearService, linear),
  ))));
};

describe("issue mutations", () => {
  test("creates through Linear before committing the returned issue to cache", async () => {
    const saved: Issue[] = [];
    const created = { ...issue, title: "Created" };
    await expect(runWith(createIssue({ teamId: " team-1 ", title: " Created ", priority: 2 }), makeLinear({
      createIssue: (input) => {
        expect(input.teamId).toBe("team-1");
        expect(input.title).toBe("Created");
        return Effect.succeed(created);
      },
    }), saved)).resolves.toEqual(created);
    expect(saved).toEqual([created]);
  });

  test("rejects invalid create input without calling Linear", async () => {
    let called = false;
    await expect(runWith(createIssue({ teamId: "team-1", title: "   " }), makeLinear({
      createIssue: () => { called = true; return Effect.succeed(issue); },
    }), [])).rejects.toThrow("cannot be empty");
    expect(called).toBeFalse();
  });

  test("optimistically updates and commits the canonical Linear response", async () => {
    const saved: Issue[] = [];
    const updated = { ...issue, title: "Canonical", priority: 2, updatedAt: new Date("2026-03-01T11:00:00.000Z") };
    await expect(runWith(updateIssue(issue, { title: " Draft ", priority: 2 }), makeLinear({
      updateIssue: (_id, input) => {
        expect(input).toEqual({ title: " Draft ", priority: 2 });
        return Effect.succeed(updated);
      },
    }), saved)).resolves.toEqual(updated);
    expect(saved[0]?.title).toBe("Draft");
    expect(saved[1]).toEqual(updated);
  });

  test("creates a non-empty comment and caches the canonical result", async () => {
    const saved: string[] = [];
    const comment = { id: "comment-1", issueId: issue.id, userId: "user-1", body: "Confirmed", createdAt: now, updatedAt: now };
    const repository: CommentRepositoryShape = {
      listByIssue: () => Effect.succeed([]),
      save: (value) => Effect.sync(() => { saved.push(value.id); }),
    };
    const program = addIssueComment(issue.id, "  Confirmed  ").pipe(Effect.provide(Layer.merge(
      Layer.succeed(CommentRepository, repository),
      Layer.succeed(LinearService, makeLinear({ createComment: (_issueId, body) => {
        expect(body).toBe("Confirmed");
        return Effect.succeed(comment);
      } })),
    )));
    await expect(Effect.runPromise(program)).resolves.toEqual(comment);
    expect(saved).toEqual(["comment-1"]);
  });

  test("rolls cache back when Linear rejects an update", async () => {
    const saved: Issue[] = [];
    const failure = new LinearApiError({ reason: "permission", message: "Denied" });
    await expect(runWith(updateIssue(issue, { assigneeId: "user-2" }), makeLinear({
      updateIssue: () => Effect.fail(failure),
    }), saved)).rejects.toThrow("Denied");
    expect(saved.at(-1)).toEqual(issue);
  });
});
