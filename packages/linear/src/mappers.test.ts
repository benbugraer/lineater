import { describe, expect, test } from "bun:test";
import { mapComment, mapIssue, mapLabel, mapProject, type CommentSource, type IssueSource, type LabelSource, type ProjectSource } from "./mappers";

const now = new Date("2026-02-03T04:05:06.000Z");

describe("Linear SDK mappers", () => {
  test("maps SDK issue fields into the stable core model", () => {
    const source: IssueSource = {
      id: "issue-1",
      teamId: "team-1",
      identifier: "ENG-42",
      url: "https://linear.app/acme/issue/ENG-42/ship-lineater",
      number: 42,
      title: "Ship Lineater",
      description: undefined,
      priority: 2,
      stateId: "state-1",
      assigneeId: undefined,
      projectId: undefined,
      cycleId: undefined,
      labelIds: ["label-1"],
      sortOrder: 123.5,
      completedAt: undefined,
      canceledAt: undefined,
      createdAt: now,
      updatedAt: now,
    };

    expect(mapIssue(source)).toEqual({
      id: "issue-1",
      teamId: "team-1",
      identifier: "ENG-42",
      url: "https://linear.app/acme/issue/ENG-42/ship-lineater",
      number: 42,
      title: "Ship Lineater",
      description: null,
      priority: 2,
      stateId: "state-1",
      assigneeId: null,
      projectId: null,
      cycleId: null,
      labelIds: ["label-1"],
      sortOrder: 123.5,
      completedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  test("rejects incomplete required Linear relationships", () => {
    const source: IssueSource = {
      id: "issue-1",
      teamId: undefined,
      identifier: "ENG-42",
      url: "https://linear.app/acme/issue/ENG-42/broken-relation",
      number: 42,
      title: "Broken relation",
      description: null,
      priority: 0,
      stateId: "state-1",
      assigneeId: undefined,
      projectId: undefined,
      cycleId: undefined,
      labelIds: [],
      sortOrder: 0,
      completedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    expect(() => mapIssue(source)).toThrow("missing required team relation id");
  });

  test("maps label scope and issue comments without SDK leakage", () => {
    const label: LabelSource = { id: "label-1", teamId: "team-1", name: "Bug", color: "#ff0000", createdAt: now, updatedAt: now };
    const comment: CommentSource = { id: "comment-1", issueId: "issue-1", userId: "user-1", body: "Confirmed", createdAt: now, updatedAt: now };
    expect(mapLabel(label, "workspace-1").teamId).toBe("team-1");
    expect(mapComment(comment)).toEqual({ ...comment, issueId: "issue-1", userId: "user-1" });
  });

  test("normalizes timeless project dates to UTC", () => {
    const source: ProjectSource = {
      id: "project-1",
      name: "Launch",
      description: "",
      state: "started",
      startDate: "2026-02-01",
      targetDate: null,
      createdAt: now,
      updatedAt: now,
    };
    expect(mapProject(source, "workspace-1").startDate?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(mapProject(source, "workspace-1").description).toBeNull();
  });
});
