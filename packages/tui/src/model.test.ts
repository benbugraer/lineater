import { describe, expect, test } from "bun:test";
import type { InitialReadModel } from "@lineater/core";
import { createTestKeymap } from "@opentui/keymap/testing";
import { commandNames, composerBindingDefinitions, normalBindingDefinitions, normalBindings, normalBindingsFor } from "./keymap";
import { adjacentStatus, isAuthenticationFailure, layoutMode, moveIndex, orderedBoardIssues, orderedStates, visibleBoardStates, visibleIssues } from "./model";

const now = new Date("2026-01-01T00:00:00.000Z");
const model: InitialReadModel = {
  workspace: { id: "workspace", name: "Acme", urlKey: "acme", createdAt: now, updatedAt: now },
  viewer: { id: "viewer", workspaceId: "workspace", name: "Ada", displayName: "Ada", email: null, avatarUrl: null, active: true, createdAt: now, updatedAt: now },
  users: [],
  teams: [
    { id: "team-a", workspaceId: "workspace", key: "ENG", name: "Engineering", createdAt: now, updatedAt: now },
    { id: "team-b", workspaceId: "workspace", key: "DES", name: "Design", createdAt: now, updatedAt: now },
  ],
  workflowStates: [
    { id: "backlog", teamId: "team-a", name: "Backlog", type: "backlog", color: "#777777", position: 0, createdAt: now, updatedAt: now },
    { id: "done", teamId: "team-a", name: "Done", type: "completed", color: "#00ff00", position: 3, createdAt: now, updatedAt: now },
    { id: "todo", teamId: "team-a", name: "Todo", type: "unstarted", color: "#888888", position: 1, createdAt: now, updatedAt: now },
    { id: "started", teamId: "team-a", name: "In Progress", type: "started", color: "#5e6ad2", position: 2, createdAt: now, updatedAt: now },
    { id: "review", teamId: "team-a", name: "In Review", type: "started", color: "#00aa66", position: 1002, createdAt: now, updatedAt: now },
  ],
  issues: [
    { id: "one", teamId: "team-a", identifier: "ENG-1", url: "https://linear.app/acme/issue/ENG-1/build-sidebar", number: 1, title: "Build sidebar", description: null, priority: 2, stateId: "todo", assigneeId: "viewer", projectId: null, cycleId: null, labelIds: [], sortOrder: 1, completedAt: null, canceledAt: null, createdAt: now, updatedAt: now },
    { id: "two", teamId: "team-b", identifier: "DES-2", url: "https://linear.app/acme/issue/DES-2/polish-colors", number: 2, title: "Polish colors", description: null, priority: 3, stateId: "other", assigneeId: null, projectId: null, cycleId: null, labelIds: [], sortOrder: 2, completedAt: null, canceledAt: null, createdAt: now, updatedAt: now },
  ],
  labels: [],
  projects: [],
  cycles: [],
  syncedAt: now,
};

describe("TUI model", () => {
  test("recognizes only authentication failures that require fresh authorization", () => {
    expect(isAuthenticationFailure({ _tag: "AuthError", reason: "expired" })).toBe(true);
    expect(isAuthenticationFailure({ _tag: "AuthError", reason: "not-authenticated" })).toBe(true);
    expect(isAuthenticationFailure({ _tag: "LinearApiError", reason: "authentication" })).toBe(true);
    expect(isAuthenticationFailure({ _tag: "AuthError", reason: "exchange" })).toBe(false);
    expect(isAuthenticationFailure({ _tag: "LinearApiError", reason: "network" })).toBe(false);
    expect(isAuthenticationFailure(new Error("unknown"))).toBe(false);
  });

  test("selects a responsive layout without overflowing tiny terminals", () => {
    expect(layoutMode(57, 30)).toBe("too-small");
    expect(layoutMode(70, 24)).toBe("single");
    expect(layoutMode(100, 30)).toBe("medium");
    expect(layoutMode(140, 40)).toBe("wide");
  });

  test("filters cached issues by team and search query", () => {
    expect(visibleIssues(model, "team-a", "sidebar").map(({ id }) => id)).toEqual(["one"]);
    expect(visibleIssues(model, "team-a", "missing")).toEqual([]);
  });

  test("combines cached metadata filters without broadening team or search results", () => {
    expect(visibleIssues(model, null, "", {
      stateId: "todo", projectId: null, cycleId: null, assigneeId: "viewer", priority: 2, labelId: null,
    }).map(({ id }) => id)).toEqual(["one"]);
    expect(visibleIssues(model, null, "", {
      stateId: "todo", projectId: null, cycleId: null, assigneeId: "viewer", priority: 4, labelId: null,
    })).toEqual([]);
  });

  test("uses dynamic Linear workflow ordering for adjacent board status", () => {
    expect(orderedStates(model, "team-a").map(({ id }) => id)).toEqual(["backlog", "todo", "started", "review", "done"]);
    const issue = model.issues[0];
    if (!issue) throw new Error("Missing fixture issue");
    expect(adjacentStatus(model, issue, 1)?.id).toBe("started");
    expect(adjacentStatus(model, issue, -1)?.id).toBe("backlog");
  });

  test("orders board cards by Linear manual sort order with deterministic null fallback", () => {
    const issue = model.issues[0];
    if (!issue) throw new Error("Missing fixture issue");
    const issues = [
      { ...issue, id: "third", number: 3, sortOrder: null },
      { ...issue, id: "second", number: 2, sortOrder: 20 },
      { ...issue, id: "first", number: 1, sortOrder: 10 },
      { ...issue, id: "fourth", number: 4, sortOrder: null },
    ];
    expect(orderedBoardIssues(issues).map(({ id }) => id)).toEqual(["first", "second", "third", "fourth"]);
  });

  test("hides user-selected board columns without changing workflow order", () => {
    expect(visibleBoardStates(model, "team-a", new Set(["done"])).map(({ id }) => id)).toEqual(["backlog", "todo", "started", "review"]);
  });

  test("clamps Vim movement at collection boundaries", () => {
    expect(moveIndex(0, -1, 5)).toBe(0);
    expect(moveIndex(4, 1, 5)).toBe(4);
    expect(moveIndex(2, 1, 5)).toBe(3);
    expect(moveIndex(2, 1, 0)).toBe(0);
  });

  test("dispatches Vim sequences and shifted board movement", () => {
    const harness = createTestKeymap({ defaultKeys: true });
    const dispatched: string[] = [];
    const unregister = harness.keymap.registerLayer({
      bindings: normalBindingDefinitions,
      commands: commandNames.map((name) => ({ name, run: () => { dispatched.push(name); } })),
    });
    try {
      harness.host.press("g");
      harness.host.press("g");
      harness.host.press("h", { shift: true });
      harness.host.press("l", { shift: true });
      harness.host.press("[");
      harness.host.press("v", { shift: true });
      expect(dispatched).toEqual(["navigation.first", "board.moveLeft", "board.moveRight", "view.toggleSidebar", "view.boardColumns"]);
    } finally {
      unregister();
      harness.cleanup();
    }
  });

  test("dispatches both portable composer save shortcuts", () => {
    const harness = createTestKeymap({ defaultKeys: true });
    const dispatched: string[] = [];
    const unregister = harness.keymap.registerLayer({
      bindings: composerBindingDefinitions,
      commands: commandNames.map((name) => ({ name, run: () => { dispatched.push(name); } })),
    });
    try {
      harness.host.press("s", { ctrl: true });
      harness.host.press("return", { ctrl: true });
      expect(dispatched).toEqual(["composer.save", "composer.save"]);
    } finally {
      unregister();
      harness.cleanup();
    }
  });

  test("allows valid normal-mode key overrides while preserving emergency quit", () => {
    const bindings = normalBindingsFor({ "app.settings": "ctrl+,", "issue.copyIdentifier": "x", unknown: "z" });
    expect(bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "ctrl+,", cmd: "app.settings" }),
      expect.objectContaining({ key: "x", cmd: "issue.copyIdentifier" }),
      expect.objectContaining({ key: "ctrl+c", cmd: "app.quit" }),
    ]));
    expect(bindings).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: "y", cmd: "issue.copyIdentifier" })]));
    expect(bindings).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: "z", cmd: "unknown" })]));
  });

  test("routes every keybinding through a registered named command", () => {
    const names = new Set<string>(commandNames);
    expect(normalBindings.every(({ cmd }) => typeof cmd === "string" && names.has(cmd))).toBe(true);
    expect(normalBindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "j", cmd: "navigation.down" }),
      expect.objectContaining({ key: "k", cmd: "navigation.up" }),
      expect.objectContaining({ key: "gg", cmd: "navigation.first" }),
      expect.objectContaining({ key: ",", cmd: "app.settings" }),
      expect.objectContaining({ key: { name: "s", shift: true }, cmd: "app.settings" }),
      expect.objectContaining({ key: "[", cmd: "view.toggleSidebar" }),
      expect.objectContaining({ key: { name: "v", shift: true }, cmd: "view.boardColumns" }),
      expect.objectContaining({ key: { name: "h", shift: true }, cmd: "board.moveLeft" }),
      expect.objectContaining({ key: { name: "l", shift: true }, cmd: "board.moveRight" }),
    ]));
  });
});
