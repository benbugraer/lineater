import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { Issue } from "../domain";
import { BrowserService, ClipboardService } from "../services";
import { copyIssueIdentifier, openIssueInBrowser } from "./issue-terminal-actions";

const issue: Issue = {
  id: "issue-1", teamId: "team-1", identifier: "ENG-1", url: "https://linear.app/acme/issue/ENG-1/example", number: 1,
  title: "Example", description: null, priority: 0, stateId: "state-1", assigneeId: null, projectId: null,
  cycleId: null, labelIds: [], sortOrder: 1, completedAt: null, canceledAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("issue terminal actions", () => {
  test("copies only the stable issue identifier", async () => {
    const copied: string[] = [];
    await Effect.runPromise(copyIssueIdentifier(issue).pipe(Effect.provide(
      Layer.succeed(ClipboardService, { copy: (text) => Effect.sync(() => { copied.push(text); }) }),
    )));
    expect(copied).toEqual(["ENG-1"]);
  });

  test("opens only trusted HTTPS Linear issue URLs", async () => {
    const opened: URL[] = [];
    const BrowserTest = Layer.succeed(BrowserService, { open: (url) => Effect.sync(() => { opened.push(url); }) });
    await Effect.runPromise(openIssueInBrowser(issue).pipe(Effect.provide(BrowserTest)));
    expect(opened[0]?.toString()).toBe(issue.url);
    await expect(Effect.runPromise(openIssueInBrowser({ ...issue, url: "https://linear.app.attacker.test/ENG-1" }).pipe(
      Effect.provide(BrowserTest),
    ))).rejects.toThrow("untrusted");
  });
});
