import type { Binding } from "@opentui/keymap";
import type { KeyEvent, Renderable } from "@opentui/core";

export const commandNames = [
  "navigation.down",
  "navigation.up",
  "navigation.first",
  "navigation.last",
  "navigation.left",
  "navigation.right",
  "issue.open",
  "issue.create",
  "issue.edit",
  "issue.comment",
  "issue.changeStatus",
  "issue.changeAssignee",
  "issue.changePriority",
  "issue.changeLabels",
  "issue.changeProject",
  "issue.changeCycle",
  "issue.copyIdentifier",
  "issue.openInBrowser",
  "composer.nextField",
  "composer.pickTeam",
  "composer.pickStatus",
  "composer.pickPriority",
  "composer.pickAssignee",
  "composer.pickLabels",
  "composer.pickProject",
  "composer.pickCycle",
  "composer.externalEditor",
  "composer.save",
  "picker.toggle",
  "app.back",
  "app.search",
  "app.filter",
  "filter.clear",
  "app.commandPalette",
  "app.settings",
  "app.help",
  "app.refresh",
  "app.quit",
  "view.toggle",
  "view.toggleSidebar",
  "view.boardColumns",
  "board.moveLeft",
  "board.moveRight",
] as const;

export type CommandName = typeof commandNames[number];

export const normalBindingDefinitions = [
  { key: "j", cmd: "navigation.down" },
  { key: "down", cmd: "navigation.down" },
  { key: "k", cmd: "navigation.up" },
  { key: "up", cmd: "navigation.up" },
  { key: "gg", cmd: "navigation.first" },
  { key: { name: "g", shift: true }, cmd: "navigation.last" },
  { key: "h", cmd: "navigation.left" },
  { key: "left", cmd: "navigation.left" },
  { key: "l", cmd: "navigation.right" },
  { key: "right", cmd: "navigation.right" },
  { key: "return", cmd: "issue.open" },
  { key: "n", cmd: "issue.create" },
  { key: "e", cmd: "issue.edit" },
  { key: "c", cmd: "issue.comment" },
  { key: "s", cmd: "issue.changeStatus" },
  { key: "a", cmd: "issue.changeAssignee" },
  { key: "p", cmd: "issue.changePriority" },
  { key: "t", cmd: "issue.changeLabels" },
  { key: { name: "p", shift: true }, cmd: "issue.changeProject" },
  { key: { name: "c", shift: true }, cmd: "issue.changeCycle" },
  { key: "y", cmd: "issue.copyIdentifier" },
  { key: "o", cmd: "issue.openInBrowser" },
  { key: "escape", cmd: "app.back" },
  { key: "/", cmd: "app.search" },
  { key: "f", cmd: "app.filter" },
  { key: ":", cmd: "app.commandPalette" },
  { key: ",", cmd: "app.settings" },
  { key: { name: "s", shift: true }, cmd: "app.settings" },
  { key: "?", cmd: "app.help" },
  { key: "r", cmd: "app.refresh" },
  { key: "q", cmd: "app.quit" },
  { key: "ctrl+c", cmd: "app.quit" },
  { key: "b", cmd: "view.toggle" },
  { key: "[", cmd: "view.toggleSidebar" },
  { key: { name: "v", shift: true }, cmd: "view.boardColumns" },
  { key: { name: "h", shift: true }, cmd: "board.moveLeft" },
  { key: { name: "l", shift: true }, cmd: "board.moveRight" },
] as const;

export const normalBindings: readonly Binding<Renderable, KeyEvent>[] = normalBindingDefinitions;

export const normalBindingsFor = (
  overrides: Readonly<Record<string, string>>,
): readonly Binding<Renderable, KeyEvent>[] => {
  const commandSet = new Set<string>(commandNames);
  const validOverrides = Object.entries(overrides)
    .filter(([command, key]) => commandSet.has(command) && key.trim().length > 0)
    .map(([command, key]) => ({ command: command as CommandName, key: key.trim() }));
  if (validOverrides.length === 0) return normalBindings;
  const overriddenCommands = new Set(validOverrides.map(({ command }) => command));
  const overriddenKeys = new Set(validOverrides.map(({ key }) => key.toLocaleLowerCase()));
  return [
    ...normalBindings.filter((binding) => {
      if (binding.key === "ctrl+c") return true;
      if (overriddenCommands.has(binding.cmd as CommandName)) return false;
      return typeof binding.key !== "string" || !overriddenKeys.has(binding.key.toLocaleLowerCase());
    }),
    ...validOverrides.map(({ command, key }) => ({ key, cmd: command })),
  ];
};

export const helpBindings: readonly Binding<Renderable, KeyEvent>[] = [
  { key: "escape", cmd: "app.back" },
  { key: "?", cmd: "app.help" },
  { key: "q", cmd: "app.quit" },
  { key: "ctrl+c", cmd: "app.quit" },
];

export const inputBindings: readonly Binding<Renderable, KeyEvent>[] = [
  { key: "escape", cmd: "app.back" },
  { key: "ctrl+c", cmd: "app.quit" },
  { key: "return", cmd: "issue.open" },
  { key: "down", cmd: "navigation.down" },
  { key: "up", cmd: "navigation.up" },
];

export const statusBindings: readonly Binding<Renderable, KeyEvent>[] = [
  ...inputBindings,
  { key: "j", cmd: "navigation.down" },
  { key: "k", cmd: "navigation.up" },
];

export const filterBindings: readonly Binding<Renderable, KeyEvent>[] = [
  { key: "escape", cmd: "app.back" },
  { key: "ctrl+c", cmd: "app.quit" },
  { key: "return", cmd: "issue.open" },
  { key: "j", cmd: "navigation.down" },
  { key: "down", cmd: "navigation.down" },
  { key: "k", cmd: "navigation.up" },
  { key: "up", cmd: "navigation.up" },
  { key: "h", cmd: "navigation.left" },
  { key: "left", cmd: "navigation.left" },
  { key: "l", cmd: "navigation.right" },
  { key: "right", cmd: "navigation.right" },
  { key: "x", cmd: "filter.clear" },
];

export const settingsBindings: readonly Binding<Renderable, KeyEvent>[] = [
  { key: "escape", cmd: "app.back" },
  { key: "ctrl+c", cmd: "app.quit" },
  { key: "return", cmd: "issue.open" },
  { key: "j", cmd: "navigation.down" },
  { key: "down", cmd: "navigation.down" },
  { key: "k", cmd: "navigation.up" },
  { key: "up", cmd: "navigation.up" },
  { key: "h", cmd: "navigation.left" },
  { key: "left", cmd: "navigation.left" },
  { key: "l", cmd: "navigation.right" },
  { key: "right", cmd: "navigation.right" },
];

export const composerBindingDefinitions = [
  { key: "escape", cmd: "app.back" },
  { key: "ctrl+c", cmd: "app.quit" },
  { key: "tab", cmd: "composer.nextField" },
  { key: "ctrl+t", cmd: "composer.pickTeam" },
  { key: "ctrl+o", cmd: "composer.pickStatus" },
  { key: "ctrl+p", cmd: "composer.pickPriority" },
  { key: "ctrl+a", cmd: "composer.pickAssignee" },
  { key: "ctrl+l", cmd: "composer.pickLabels" },
  { key: "ctrl+g", cmd: "composer.pickProject" },
  { key: "ctrl+y", cmd: "composer.pickCycle" },
  { key: "ctrl+e", cmd: "composer.externalEditor" },
  { key: { name: "return", ctrl: true }, cmd: "composer.save" },
  { key: "ctrl+s", cmd: "composer.save" },
] as const;

export const composerBindings: readonly Binding<Renderable, KeyEvent>[] = composerBindingDefinitions;

export const commentBindings: readonly Binding<Renderable, KeyEvent>[] = [
  { key: "escape", cmd: "app.back" },
  { key: "ctrl+c", cmd: "app.quit" },
  { key: "ctrl+e", cmd: "composer.externalEditor" },
  { key: { name: "return", ctrl: true }, cmd: "composer.save" },
  { key: "ctrl+s", cmd: "composer.save" },
];

export const pickerBindings: readonly Binding<Renderable, KeyEvent>[] = [
  { key: "escape", cmd: "app.back" },
  { key: "ctrl+c", cmd: "app.quit" },
  { key: "return", cmd: "issue.open" },
  { key: "space", cmd: "picker.toggle" },
  { key: "j", cmd: "navigation.down" },
  { key: "down", cmd: "navigation.down" },
  { key: "k", cmd: "navigation.up" },
  { key: "up", cmd: "navigation.up" },
];
