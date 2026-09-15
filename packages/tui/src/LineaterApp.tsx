/** @jsxImportSource @opentui/react */
import type { AppPreferences, Comment, CreateIssueInput, InitialReadModel, Issue, UpdateIssueInput } from "@lineater/core";
import type { KeyEvent, Renderable } from "@opentui/core";
import type { Command } from "@opentui/keymap";
import { useBindings } from "@opentui/keymap/react";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import type { TuiController } from "./controller";
import {
  commandNames,
  commentBindings,
  composerBindings,
  filterBindings,
  helpBindings,
  inputBindings,
  normalBindingsFor,
  pickerBindings,
  settingsBindings,
  statusBindings,
  type CommandName,
} from "./keymap";
import {
  activeIssueFilterCount,
  emptyIssueFilters,
  isAuthenticationFailure,
  layoutMode,
  moveIndex,
  orderedBoardIssues,
  orderedStates,
  replaceIssue,
  visibleBoardStates,
  visibleIssues,
  type ActivePane,
  type IssueFilters,
  type WorkspaceView,
} from "./model";
import {
  CommentComposerOverlay,
  FilterOverlay,
  HelpOverlay,
  InputOverlay,
  IssueComposerOverlay,
  type IssueDraft,
  type Overlay,
  PickerOverlay,
  type PickerKind,
  type PickerOption,
  SettingsOverlay,
  StatusOverlay,
} from "./Overlays";
import { themeById, ThemeProvider, themes } from "./theme";
import { type NavigationItem, WorkspaceScreen } from "./WorkspaceScreen";

interface LineaterAppProps {
  readonly controller: TuiController;
  readonly onExit: () => void;
}

type Phase = "booting" | "unauthenticated" | "authorizing" | "syncing" | "ready";
type Notice = { readonly tone: "info" | "error"; readonly message: string };

const defaultPreferences: AppPreferences = { theme: "linear", defaultView: "list", autoSync: true, keybindings: {} };

const priorities = [
  { id: "0", label: "No priority" },
  { id: "1", label: "Urgent" },
  { id: "2", label: "High" },
  { id: "3", label: "Medium" },
  { id: "4", label: "Low" },
] as const;

const paletteCommands: readonly { readonly command: CommandName; readonly label: string }[] = [
  { command: "issue.create", label: "Create a new issue" },
  { command: "issue.edit", label: "Edit selected issue" },
  { command: "issue.comment", label: "Comment on selected issue" },
  { command: "issue.changeAssignee", label: "Change assignee" },
  { command: "issue.changePriority", label: "Change priority" },
  { command: "issue.changeLabels", label: "Change labels" },
  { command: "issue.changeProject", label: "Change project" },
  { command: "issue.changeCycle", label: "Change cycle" },
  { command: "issue.copyIdentifier", label: "Copy issue identifier" },
  { command: "issue.openInBrowser", label: "Open issue in Linear" },
  { command: "view.toggle", label: "Toggle list / board view" },
  { command: "view.toggleSidebar", label: "Collapse / expand sidebar" },
  { command: "view.boardColumns", label: "Choose visible board columns" },
  { command: "app.refresh", label: "Refresh from Linear" },
  { command: "app.search", label: "Search issues" },
  { command: "app.filter", label: "Filter issues" },
  { command: "app.settings", label: "Open settings" },
  { command: "app.help", label: "Show keyboard shortcuts" },
  { command: "app.quit", label: "Quit Lineater" },
];

const applyIssuePatch = (issue: Issue, input: UpdateIssueInput): Issue => ({
  ...issue,
  ...(input.title !== undefined ? { title: input.title.trim() } : {}),
  ...(input.description !== undefined ? { description: input.description } : {}),
  ...(input.stateId !== undefined ? { stateId: input.stateId } : {}),
  ...(input.priority !== undefined ? { priority: input.priority } : {}),
  ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
  ...(input.labelIds !== undefined ? { labelIds: input.labelIds } : {}),
  ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
  ...(input.cycleId !== undefined ? { cycleId: input.cycleId } : {}),
  updatedAt: new Date(),
});

const wrapIndex = (current: number, delta: -1 | 1, length: number): number =>
  length <= 0 ? 0 : (current + delta + length) % length;

const safeMessage = (cause: unknown): string => {
  const message = typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string"
    ? cause.message
    : "The operation could not be completed.";
  return Array.from(message, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? "" : character;
  }).join("").slice(0, 240);
};

export function LineaterApp({ controller, onExit }: LineaterAppProps) {
  const { width, height } = useTerminalDimensions();
  const layout = layoutMode(width, height);
  const [phase, setPhase] = useState<Phase>("booting");
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [model, setModel] = useState<InitialReadModel | null>(null);
  const [view, setView] = useState<WorkspaceView>("list");
  const [activePane, setActivePane] = useState<ActivePane>("issues");
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [issueFilters, setIssueFilters] = useState<IssueFilters>(emptyIssueFilters);
  const [filterPanelIndex, setFilterPanelIndex] = useState(0);
  const filterPanelIndexRef = useRef(0);
  const [issueIndex, setIssueIndex] = useState(0);
  const [columnIndex, setColumnIndex] = useState(0);
  const [boardRowIndex, setBoardRowIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hiddenBoardStateIds, setHiddenBoardStateIds] = useState<ReadonlySet<string>>(() => new Set());
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [query, setQuery] = useState("");
  const [paletteQuery, setPaletteQuery] = useState("");
  const [overlayIndex, setOverlayIndex] = useState(0);
  const [settingsIndex, setSettingsIndex] = useState(0);
  const settingsIndexRef = useRef(0);
  const [syncing, setSyncing] = useState(false);
  const [cachedOnly, setCachedOnly] = useState(false);
  const [mutationIssueId, setMutationIssueId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [draft, setDraft] = useState<IssueDraft | null>(null);
  const [composerField, setComposerField] = useState<"title" | "description">("title");
  const [pickerKind, setPickerKind] = useState<PickerKind | null>(null);
  const [pickerOrigin, setPickerOrigin] = useState<"workspace" | "composer">("workspace");
  const [pickerLabelIds, setPickerLabelIds] = useState<readonly string[]>([]);
  const [commentsByIssue, setCommentsByIssue] = useState<Readonly<Record<string, readonly Comment[]>>>({});
  const [commentsLoading, setCommentsLoading] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const preferenceSaveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    Promise.all([controller.loadPreferences(), controller.bootstrap()]).then(([loadedPreferences, { session, cachedModel }]) => {
      if (!mounted) return;
      const normalizedPreferences = { ...loadedPreferences, theme: themeById(loadedPreferences.theme).id };
      setPreferences(normalizedPreferences);
      setView(normalizedPreferences.defaultView);
      if (!session) {
        setPhase("unauthenticated");
        return;
      }
      if (cachedModel) {
        setModel(cachedModel);
        if (normalizedPreferences.defaultView === "board" && cachedModel.teams.length > 0) {
          setFilterIndex(2);
          setNavigationIndex(2);
        }
        setPhase("ready");
      } else {
        setPhase("syncing");
      }
      if (cachedModel && !normalizedPreferences.autoSync) {
        setCachedOnly(true);
        return;
      }
      setSyncing(true);
      const synchronize = cachedModel ? controller.syncIncremental : controller.sync;
      synchronize().then((fresh) => {
        if (!mounted) return;
        setModel(fresh);
        if (normalizedPreferences.defaultView === "board" && fresh.teams.length > 0) {
          setFilterIndex(2);
          setNavigationIndex(2);
        }
        setPhase("ready");
        setCachedOnly(false);
        setSyncing(false);
      }).catch((cause: unknown) => {
        if (!mounted) return;
        setSyncing(false);
        if (isAuthenticationFailure(cause)) {
          setCachedOnly(Boolean(cachedModel));
          setAuthError("Your Linear session expired. Press Enter to authorize again.");
          setPhase("unauthenticated");
          return;
        }
        if (cachedModel) {
          setCachedOnly(true);
          setNotice({ tone: "error", message: `Linear unavailable · ${safeMessage(cause)}` });
        } else {
          setAuthError(safeMessage(cause));
          setPhase("unauthenticated");
        }
      });
    }).catch((cause: unknown) => {
      if (!mounted) return;
      setAuthError(safeMessage(cause));
      setPhase("unauthenticated");
    });
    return () => { mounted = false; };
  }, [controller]);

  const navigation = useMemo<readonly NavigationItem[]>(() => {
    if (!model) return [];
    return [
      { id: "all", label: "All issues", hint: "◫" },
      { id: "mine", label: "My issues", hint: "◉" },
      ...model.teams.map((team) => ({ id: `team:${team.id}`, label: team.name, hint: "●", color: themeById(preferences.theme).palette.accent })),
    ];
  }, [model, preferences.theme]);

  const activeFilter = navigation[filterIndex];
  const teamFilter = activeFilter?.id.startsWith("team:") ? activeFilter.id.slice(5) : null;
  const filteredIssues = useMemo(() => {
    if (!model) return [];
    const teamIssues = visibleIssues(model, teamFilter, query, issueFilters);
    return activeFilter?.id === "mine"
      ? teamIssues.filter(({ assigneeId }) => assigneeId === model.viewer.id)
      : teamIssues;
  }, [activeFilter?.id, issueFilters, model, query, teamFilter]);

  const allBoardStates = useMemo(
    () => model && view === "board" ? orderedStates(model, teamFilter) : [],
    [model, teamFilter, view],
  );
  const boardStates = useMemo(
    () => model && view === "board" ? visibleBoardStates(model, teamFilter, hiddenBoardStateIds) : [],
    [hiddenBoardStateIds, model, teamFilter, view],
  );
  const boardDisplayIssues = useMemo(() => {
    const visibleStateIds = new Set(boardStates.map(({ id }) => id));
    return orderedBoardIssues(filteredIssues.filter(({ stateId }) => visibleStateIds.has(stateId)));
  }, [boardStates, filteredIssues]);
  const boardState = boardStates[columnIndex];
  const boardIssues = boardState ? boardDisplayIssues.filter(({ stateId }) => stateId === boardState.id) : [];
  const selectedIssue = view === "board"
    ? boardIssues[boardRowIndex] ?? null
    : filteredIssues[issueIndex] ?? null;

  const focusBoardState = (stateId: string) => {
    const targetIndex = boardStates.findIndex(({ id }) => id === stateId);
    setColumnIndex(targetIndex >= 0 ? targetIndex : 0);
    setBoardRowIndex(0);
  };

  const pickerTeamId = draft?.teamId ?? selectedIssue?.teamId ?? teamFilter;
  const pickerOptions = useMemo<readonly PickerOption[]>(() => {
    if (!model || !pickerKind) return [];
    const currentIssue = selectedIssue;
    switch (pickerKind) {
      case "team":
        return model.teams.map(({ id, key, name }) => ({ id, label: `${key} · ${name}`, selected: id === draft?.teamId }));
      case "status":
        return orderedStates(model, pickerTeamId).map(({ id, name, color }) => ({ id, label: name, color, selected: id === (draft?.stateId ?? currentIssue?.stateId) }));
      case "priority":
        return priorities.map((option) => ({ ...option, selected: option.id === String(draft?.priority ?? currentIssue?.priority ?? 0) }));
      case "assignee":
        return [
          { id: "", label: "Unassigned", selected: (draft?.assigneeId ?? currentIssue?.assigneeId ?? null) === null },
          ...model.users.filter(({ active }) => active).map(({ id, displayName, name }) => ({ id, label: displayName || name, selected: id === (draft?.assigneeId ?? currentIssue?.assigneeId) })),
        ];
      case "labels": {
        const selected = new Set(pickerLabelIds);
        return model.labels
          .filter(({ teamId }) => teamId === null || teamId === pickerTeamId)
          .map(({ id, name, color }) => ({ id, label: name, color, selected: selected.has(id) }));
      }
      case "project":
        return [{ id: "", label: "No project", selected: (draft?.projectId ?? currentIssue?.projectId ?? null) === null }, ...model.projects.map(({ id, name }) => ({ id, label: name, selected: id === (draft?.projectId ?? currentIssue?.projectId) }))];
      case "cycle":
        return [{ id: "", label: "No cycle", selected: (draft?.cycleId ?? currentIssue?.cycleId ?? null) === null }, ...model.cycles.filter(({ teamId }) => teamId === pickerTeamId).map(({ id, name, number }) => ({ id, label: name ?? `Cycle ${number}`, selected: id === (draft?.cycleId ?? currentIssue?.cycleId) }))];
    }
  }, [draft, model, pickerKind, pickerLabelIds, pickerTeamId, selectedIssue]);

  const boardColumnOptions = allBoardStates.map(({ id, name, color }) => ({
    id,
    label: name,
    color,
    selected: !hiddenBoardStateIds.has(id),
  }));

  const filterRows = useMemo(() => {
    const state = model?.workflowStates.find(({ id }) => id === issueFilters.stateId);
    const project = model?.projects.find(({ id }) => id === issueFilters.projectId);
    const cycle = model?.cycles.find(({ id }) => id === issueFilters.cycleId);
    const assignee = model?.users.find(({ id }) => id === issueFilters.assigneeId);
    const label = model?.labels.find(({ id }) => id === issueFilters.labelId);
    return [
      { label: "Team / ownership", value: activeFilter?.label ?? "All issues", active: filterIndex !== 0 },
      { label: "Status", value: state?.name ?? "Any", active: issueFilters.stateId !== null },
      { label: "Project", value: project?.name ?? "Any", active: issueFilters.projectId !== null },
      { label: "Cycle", value: cycle?.name ?? (cycle ? `Cycle ${cycle.number}` : "Any"), active: issueFilters.cycleId !== null },
      { label: "Assignee", value: assignee?.displayName ?? "Any", active: issueFilters.assigneeId !== null },
      { label: "Priority", value: issueFilters.priority === null ? "Any" : priorities.find(({ id }) => id === String(issueFilters.priority))?.label ?? "Any", active: issueFilters.priority !== null },
      { label: "Label", value: label?.name ?? "Any", active: issueFilters.labelId !== null },
    ];
  }, [activeFilter?.label, filterIndex, issueFilters, model]);

  useEffect(() => {
    setIssueIndex((current) => moveIndex(current, 0, filteredIssues.length));
  }, [filteredIssues.length]);
  useEffect(() => {
    setColumnIndex((current) => moveIndex(current, 0, boardStates.length));
    setBoardRowIndex((current) => moveIndex(current, 0, boardIssues.length));
  }, [boardIssues.length, boardStates.length]);

  const filteredPalette = paletteCommands.filter(({ label, command }) => {
    const needle = paletteQuery.trim().toLocaleLowerCase();
    return !needle || label.toLocaleLowerCase().includes(needle) || command.toLocaleLowerCase().includes(needle);
  });

  const authorize = () => {
    if (phase !== "unauthenticated") return;
    setPhase("authorizing");
    setAuthError(null);
    controller.authorize().then((fresh) => {
      setModel(fresh);
      setPhase("ready");
      if (draft) setOverlay("composer");
      else if (commentBody.trim() && selectedIssue) setOverlay("comment");
      setNotice({ tone: "info", message: draft || commentBody.trim()
        ? "Session restored · review and save your pending changes"
        : `Connected to ${fresh.workspace.name}` });
    }).catch((cause: unknown) => {
      setAuthError(safeMessage(cause));
      setPhase("unauthenticated");
    });
  };

  const refresh = () => {
    if (phase !== "ready" || syncing) return;
    setSyncing(true);
    setNotice(null);
    controller.sync().then((fresh) => {
      setModel(fresh);
      setCachedOnly(false);
      setSyncing(false);
      setNotice({ tone: "info", message: `Synced ${fresh.issues.length} issues` });
    }).catch((cause: unknown) => {
      if (requestReauthorization(cause)) return;
      setCachedOnly(true);
      setSyncing(false);
      setNotice({ tone: "error", message: `Refresh failed · ${safeMessage(cause)}` });
    });
  };

  const requestReauthorization = (cause: unknown): boolean => {
    if (!isAuthenticationFailure(cause)) return false;
    setMutationIssueId(null);
    setSyncing(false);
    setOverlay("none");
    setAuthError("Your Linear session expired. Press Enter to authorize again, then retry the operation.");
    setPhase("unauthenticated");
    return true;
  };

  const loadComments = (issue: Issue) => {
    setCommentsLoading(issue.id);
    controller.loadComments(issue.id).then((comments) => {
      setCommentsByIssue((current) => ({ ...current, [issue.id]: comments }));
      setCommentsLoading((current) => current === issue.id ? null : current);
    }).catch((cause: unknown) => {
      setCommentsLoading((current) => current === issue.id ? null : current);
      if (requestReauthorization(cause)) return;
      setNotice({ tone: "error", message: `Comments unavailable · ${safeMessage(cause)}` });
    });
  };

  const saveComment = () => {
    if (!selectedIssue || mutationIssueId || !commentBody.trim()) {
      if (!commentBody.trim()) setNotice({ tone: "error", message: "Comment cannot be empty" });
      return;
    }
    const issue = selectedIssue;
    setMutationIssueId(issue.id);
    controller.addComment(issue.id, commentBody).then((comment) => {
      setCommentsByIssue((current) => ({ ...current, [issue.id]: [...(current[issue.id] ?? []), comment] }));
      setMutationIssueId(null);
      setCommentBody("");
      setOverlay("none");
      setNotice({ tone: "info", message: `Comment added to ${issue.identifier}` });
    }).catch((cause: unknown) => {
      if (requestReauthorization(cause)) return;
      setMutationIssueId(null);
      setNotice({ tone: "error", message: `Comment failed · ${safeMessage(cause)}` });
    });
  };

  const mutateIssue = (issue: Issue, input: UpdateIssueInput, successMessage: string) => {
    if (!model || mutationIssueId) return;
    const original = issue;
    if (view === "board" && input.stateId) focusBoardState(input.stateId);
    setModel(replaceIssue(model, applyIssuePatch(issue, input)));
    setMutationIssueId(issue.id);
    setOverlay("none");
    controller.updateIssue(original, input).then((updated) => {
      setModel((current) => current ? replaceIssue(current, updated) : current);
      setMutationIssueId(null);
      setNotice({ tone: "info", message: successMessage });
    }).catch((cause: unknown) => {
      setModel((current) => current ? replaceIssue(current, original) : current);
      if (view === "board") focusBoardState(original.stateId);
      if (requestReauthorization(cause)) return;
      setMutationIssueId(null);
      setNotice({ tone: "error", message: `Update rolled back · ${safeMessage(cause)}` });
    });
  };

  const openComposer = (mode: "create" | "edit") => {
    if (!model || mutationIssueId) return;
    const teamId = mode === "edit" ? selectedIssue?.teamId : teamFilter ?? selectedIssue?.teamId ?? model.teams[0]?.id;
    if (!teamId) {
      setNotice({ tone: "error", message: "A team is required to create an issue" });
      return;
    }
    const stateId = mode === "edit" ? selectedIssue?.stateId : orderedStates(model, teamId)[0]?.id;
    if (!stateId) {
      setNotice({ tone: "error", message: "No workflow state is available for this team" });
      return;
    }
    setDraft({
      mode,
      title: mode === "edit" ? selectedIssue?.title ?? "" : "",
      description: mode === "edit" ? selectedIssue?.description ?? "" : "",
      teamId,
      stateId,
      priority: mode === "edit" ? selectedIssue?.priority ?? 0 : 0,
      assigneeId: mode === "edit" ? selectedIssue?.assigneeId ?? null : null,
      projectId: mode === "edit" ? selectedIssue?.projectId ?? null : null,
      cycleId: mode === "edit" ? selectedIssue?.cycleId ?? null : null,
      labelIds: mode === "edit" ? selectedIssue?.labelIds ?? [] : [],
    });
    setComposerField("title");
    setOverlay("composer");
  };

  const openPicker = (kind: PickerKind, origin: "workspace" | "composer") => {
    if (!model || mutationIssueId) return;
    if (origin === "workspace" && !selectedIssue) return;
    if (kind === "team" && draft?.mode === "edit") {
      setNotice({ tone: "error", message: "Moving issues between teams is not supported yet" });
      return;
    }
    setPickerKind(kind);
    setPickerOrigin(origin);
    if (kind === "labels") setPickerLabelIds(origin === "composer" ? draft?.labelIds ?? [] : selectedIssue?.labelIds ?? []);
    const currentId = kind === "team" ? draft?.teamId
      : kind === "status" ? draft?.stateId ?? selectedIssue?.stateId
      : kind === "priority" ? String(draft?.priority ?? selectedIssue?.priority ?? 0)
      : kind === "assignee" ? draft?.assigneeId ?? selectedIssue?.assigneeId ?? ""
      : kind === "project" ? draft?.projectId ?? selectedIssue?.projectId ?? ""
      : kind === "cycle" ? draft?.cycleId ?? selectedIssue?.cycleId ?? ""
      : undefined;
    const source = kind === "team" ? model.teams.map(({ id }) => id)
      : kind === "status" ? orderedStates(model, draft?.teamId ?? selectedIssue?.teamId ?? null).map(({ id }) => id)
      : kind === "priority" ? priorities.map(({ id }) => id)
      : kind === "assignee" ? ["", ...model.users.filter(({ active }) => active).map(({ id }) => id)]
      : kind === "project" ? ["", ...model.projects.map(({ id }) => id)]
      : kind === "cycle" ? ["", ...model.cycles.filter(({ teamId }) => teamId === (draft?.teamId ?? selectedIssue?.teamId)).map(({ id }) => id)]
      : model.labels.filter(({ teamId }) => teamId === null || teamId === (draft?.teamId ?? selectedIssue?.teamId)).map(({ id }) => id);
    setOverlayIndex(Math.max(0, currentId ? source.indexOf(currentId) : 0));
    setOverlay("picker");
  };

  const applyPickerSelection = () => {
    const option = pickerOptions[overlayIndex];
    if (!option || !pickerKind) return;
    if (pickerKind === "labels") {
      if (pickerOrigin === "composer" && draft) {
        setDraft({ ...draft, labelIds: pickerLabelIds });
        setOverlay("composer");
      } else if (selectedIssue) {
        mutateIssue(selectedIssue, { labelIds: pickerLabelIds },  `${selectedIssue.identifier} labels updated`);
      }
      return;
    }
    if (pickerOrigin === "composer" && draft) {
      if (pickerKind === "team") {
        const stateId = model ? orderedStates(model, option.id)[0]?.id : undefined;
        if (!stateId) return;
        const validLabels = new Set(model?.labels.filter(({ teamId }) => teamId === null || teamId === option.id).map(({ id }) => id) ?? []);
        setDraft({ ...draft, teamId: option.id, stateId, cycleId: null, labelIds: draft.labelIds.filter((id) => validLabels.has(id)) });
      } else if (pickerKind === "status") setDraft({ ...draft, stateId: option.id });
      else if (pickerKind === "priority") setDraft({ ...draft, priority: Number(option.id) });
      else if (pickerKind === "assignee") setDraft({ ...draft, assigneeId: option.id || null });
      else if (pickerKind === "project") setDraft({ ...draft, projectId: option.id || null });
      else if (pickerKind === "cycle") setDraft({ ...draft, cycleId: option.id || null });
      setOverlay("composer");
      return;
    }
    if (!selectedIssue) return;
    if (pickerKind === "status") mutateIssue(selectedIssue, { stateId: option.id }, `${selectedIssue.identifier} status updated`);
    else if (pickerKind === "priority") mutateIssue(selectedIssue, { priority: Number(option.id) }, `${selectedIssue.identifier} priority updated`);
    else if (pickerKind === "assignee") mutateIssue(selectedIssue, { assigneeId: option.id || null }, `${selectedIssue.identifier} assignee updated`);
    else if (pickerKind === "project") mutateIssue(selectedIssue, { projectId: option.id || null }, `${selectedIssue.identifier} project updated`);
    else if (pickerKind === "cycle") mutateIssue(selectedIssue, { cycleId: option.id || null }, `${selectedIssue.identifier} cycle updated`);
  };

  const togglePickerOption = () => {
    if (pickerKind !== "labels") return;
    const option = pickerOptions[overlayIndex];
    if (!option) return;
    const labels = new Set(pickerLabelIds);
    if (labels.has(option.id)) labels.delete(option.id); else labels.add(option.id);
    const next = [...labels];
    setPickerLabelIds(next);
  };

  const saveComposer = () => {
    if (!model || !draft || mutationIssueId || !draft.title.trim()) {
      if (draft && !draft.title.trim()) setNotice({ tone: "error", message: "Issue title cannot be empty" });
      return;
    }
    setMutationIssueId(draft.mode === "create" ? "creating" : selectedIssue?.id ?? "editing");
    if (draft.mode === "create") {
      const input: CreateIssueInput = {
        teamId: draft.teamId,
        title: draft.title,
        description: draft.description || undefined,
        stateId: draft.stateId,
        priority: draft.priority,
        assigneeId: draft.assigneeId ?? undefined,
        projectId: draft.projectId ?? undefined,
        cycleId: draft.cycleId ?? undefined,
        labelIds: draft.labelIds,
      };
      controller.createIssue(input).then((created) => {
        setModel((current) => current ? { ...current, issues: [created, ...current.issues] } : current);
        setMutationIssueId(null);
        setDraft(null);
        setOverlay("none");
        setView("list");
        setIssueIndex(0);
        setNotice({ tone: "info", message: `${created.identifier} created` });
      }).catch((cause: unknown) => {
        if (requestReauthorization(cause)) return;
        setMutationIssueId(null);
        setNotice({ tone: "error", message: `Create failed · ${safeMessage(cause)}` });
      });
      return;
    }
    if (!selectedIssue) return;
    const original = selectedIssue;
    const input: UpdateIssueInput = {
      title: draft.title,
      description: draft.description || null,
      stateId: draft.stateId,
      priority: draft.priority,
      assigneeId: draft.assigneeId,
      projectId: draft.projectId,
      cycleId: draft.cycleId,
      labelIds: draft.labelIds,
    };
    if (view === "board") focusBoardState(draft.stateId);
    setModel(replaceIssue(model, applyIssuePatch(original, input)));
    controller.updateIssue(original, input).then((updated) => {
      setModel((current) => current ? replaceIssue(current, updated) : current);
      setMutationIssueId(null);
      setDraft(null);
      setOverlay("none");
      setNotice({ tone: "info", message: `${updated.identifier} updated` });
    }).catch((cause: unknown) => {
      setModel((current) => current ? replaceIssue(current, original) : current);
      if (view === "board") focusBoardState(original.stateId);
      if (requestReauthorization(cause)) return;
      setMutationIssueId(null);
      setNotice({ tone: "error", message: `Update rolled back · ${safeMessage(cause)}` });
    });
  };

  const applyFilter = (index: number) => {
    const item = navigation[index];
    if (!item) return;
    setFilterIndex(index);
    setNavigationIndex(index);
    setIssueIndex(0);
    setBoardRowIndex(0);
    setDetailOpen(false);
    if (view === "board" && !item.id.startsWith("team:")) {
      setView("list");
      setNotice({ tone: "info", message: "Board view requires one team · switched to list" });
    }
    setActivePane("issues");
  };

  const openFilters = () => {
    filterPanelIndexRef.current = 0;
    setFilterPanelIndex(0);
    setOverlay("filters");
  };

  const moveFilterField = (delta: -1 | 1) => {
    const next = moveIndex(filterPanelIndexRef.current, delta, filterRows.length);
    filterPanelIndexRef.current = next;
    setFilterPanelIndex(next);
  };

  const cycleFilterValue = (delta: -1 | 1) => {
    if (!model) return;
    const field = filterPanelIndexRef.current;
    if (field === 0) {
      const next = wrapIndex(filterIndex, delta, navigation.length);
      setIssueFilters(emptyIssueFilters);
      applyFilter(next);
      setOverlay("filters");
      return;
    }
    const unfiltered = null;
    const choices: readonly (string | number | null)[] = field === 1
      ? [unfiltered, ...orderedStates(model, teamFilter).map(({ id }) => id)]
      : field === 2
        ? [unfiltered, ...model.projects.map(({ id }) => id)]
        : field === 3
          ? [unfiltered, ...model.cycles.filter((cycle) => teamFilter === null || cycle.teamId === teamFilter).map(({ id }) => id)]
          : field === 4
            ? [unfiltered, ...model.users.filter(({ active }) => active).map(({ id }) => id)]
            : field === 5
              ? [unfiltered, 0, 1, 2, 3, 4]
              : [unfiltered, ...model.labels.filter((label) => teamFilter === null || label.teamId === null || label.teamId === teamFilter).map(({ id }) => id)];
    const current = field === 1 ? issueFilters.stateId
      : field === 2 ? issueFilters.projectId
      : field === 3 ? issueFilters.cycleId
      : field === 4 ? issueFilters.assigneeId
      : field === 5 ? issueFilters.priority
      : issueFilters.labelId;
    const next = choices[wrapIndex(Math.max(0, choices.indexOf(current)), delta, choices.length)] ?? null;
    setIssueFilters((filters) => field === 1 ? { ...filters, stateId: next as string | null }
      : field === 2 ? { ...filters, projectId: next as string | null }
      : field === 3 ? { ...filters, cycleId: next as string | null }
      : field === 4 ? { ...filters, assigneeId: next as string | null }
      : field === 5 ? { ...filters, priority: next as number | null }
      : { ...filters, labelId: next as string | null });
    setIssueIndex(0);
    setBoardRowIndex(0);
  };

  const clearFilters = () => {
    setIssueFilters(emptyIssueFilters);
    applyFilter(0);
    setOverlay("filters");
    setNotice({ tone: "info", message: "Issue filters cleared" });
  };

  const setIssueStatus = (issue: Issue, stateId: string) => {
    if (!model || mutationIssueId || issue.stateId === stateId) return;
    const original = issue;
    const optimistic = { ...issue, stateId, updatedAt: new Date() };
    if (view === "board") focusBoardState(stateId);
    setModel(replaceIssue(model, optimistic));
    setMutationIssueId(issue.id);
    setOverlay("none");
    controller.changeIssueStatus(original, stateId).then((updated) => {
      setModel((current) => current ? replaceIssue(current, updated) : current);
      setMutationIssueId(null);
      setNotice({ tone: "info", message: `${issue.identifier} moved successfully` });
    }).catch((cause: unknown) => {
      setModel((current) => current ? replaceIssue(current, original) : current);
      if (view === "board") focusBoardState(original.stateId);
      if (requestReauthorization(cause)) return;
      setMutationIssueId(null);
      setNotice({ tone: "error", message: `Move rolled back · ${safeMessage(cause)}` });
    });
  };

  const toggleView = () => {
    if (!model) return;
    if (view === "board") {
      setView("list");
      setActivePane("issues");
      return;
    }
    let nextFilter = filterIndex;
    if (!activeFilter?.id.startsWith("team:")) {
      nextFilter = navigation.findIndex(({ id }) => id.startsWith("team:"));
    }
    const nextTeamId = navigation[nextFilter]?.id.startsWith("team:")
      ? navigation[nextFilter]?.id.slice(5) ?? null
      : null;
    const states = visibleBoardStates(model, nextTeamId, hiddenBoardStateIds);
    if (nextFilter < 0 || !nextTeamId || states.length === 0) {
      setNotice({ tone: "error", message: "Board view needs a team with workflow states" });
      return;
    }
    setFilterIndex(nextFilter);
    setNavigationIndex(nextFilter);
    const issue = filteredIssues[issueIndex];
    setColumnIndex(Math.max(0, states.findIndex(({ id }) => id === issue?.stateId)));
    setBoardRowIndex(0);
    setView("board");
    setActivePane("issues");
  };

  const openSettings = () => {
    settingsIndexRef.current = 0;
    setSettingsIndex(0);
    setOverlay("settings");
  };

  const moveSettingsIndex = (delta: -1 | 1) => {
    const next = moveIndex(settingsIndexRef.current, delta, 3);
    settingsIndexRef.current = next;
    setSettingsIndex(next);
  };

  const changeSetting = (direction: -1 | 1) => {
    const selectedSetting = settingsIndexRef.current;
    setPreferences((current) => {
      let next: AppPreferences;
      if (selectedSetting === 0) {
        const currentIndex = Math.max(0, themes.findIndex(({ id }) => id === current.theme));
        const theme = themes[(currentIndex + direction + themes.length) % themes.length];
        if (!theme) return current;
        next = { ...current, theme: theme.id };
      } else if (selectedSetting === 1) {
        next = { ...current, defaultView: current.defaultView === "list" ? "board" : "list" };
      } else {
        next = { ...current, autoSync: !current.autoSync };
      }
      preferenceSaveQueue.current = preferenceSaveQueue.current
        .catch(() => undefined)
        .then(() => controller.savePreferences(next))
        .catch((cause: unknown) => {
          setNotice({ tone: "error", message: `Settings not saved · ${safeMessage(cause)}` });
        });
      return next;
    });
  };

  const copySelectedIssue = () => {
    if (!selectedIssue) return;
    controller.copyIssueIdentifier(selectedIssue).then(() => {
      setNotice({ tone: "info", message: `${selectedIssue.identifier} copied` });
    }).catch((cause: unknown) => setNotice({ tone: "error", message: safeMessage(cause) }));
  };

  const openSelectedIssueInBrowser = () => {
    if (!selectedIssue) return;
    controller.openIssueInBrowser(selectedIssue).then(() => {
      setNotice({ tone: "info", message: `Opened ${selectedIssue.identifier} in Linear` });
    }).catch((cause: unknown) => setNotice({ tone: "error", message: safeMessage(cause) }));
  };

  const toggleSidebar = () => {
    if (layout !== "wide") return;
    if (!sidebarCollapsed && activePane === "sidebar") setActivePane("issues");
    setSidebarCollapsed((collapsed) => !collapsed);
  };

  const openBoardColumns = () => {
    if (view !== "board" || allBoardStates.length === 0) return;
    const currentStateId = boardStates[columnIndex]?.id;
    setOverlayIndex(Math.max(0, allBoardStates.findIndex(({ id }) => id === currentStateId)));
    setOverlay("boardColumns");
  };

  const toggleBoardColumn = () => {
    const option = boardColumnOptions[overlayIndex];
    if (!option) return;
    if (option.selected && boardColumnOptions.filter(({ selected }) => selected).length <= 1) {
      setNotice({ tone: "error", message: "At least one board column must remain visible" });
      return;
    }
    setHiddenBoardStateIds((hidden) => {
      const next = new Set(hidden);
      if (next.has(option.id)) next.delete(option.id); else next.add(option.id);
      return next;
    });
    setColumnIndex(0);
    setBoardRowIndex(0);
  };

  const runPaletteSelection = () => {
    const selection = filteredPalette[overlayIndex];
    if (!selection) return;
    setOverlay("none");
    setPaletteQuery("");
    setOverlayIndex(0);
    switch (selection.command) {
      case "issue.create": openComposer("create"); break;
      case "issue.edit": openComposer("edit"); break;
      case "issue.comment": if (selectedIssue) { setCommentBody(""); setOverlay("comment"); } break;
      case "issue.changeAssignee": openPicker("assignee", "workspace"); break;
      case "issue.changePriority": openPicker("priority", "workspace"); break;
      case "issue.changeLabels": openPicker("labels", "workspace"); break;
      case "issue.changeProject": openPicker("project", "workspace"); break;
      case "issue.changeCycle": openPicker("cycle", "workspace"); break;
      case "issue.copyIdentifier": copySelectedIssue(); break;
      case "issue.openInBrowser": openSelectedIssueInBrowser(); break;
      case "view.toggle": toggleView(); break;
      case "view.toggleSidebar": toggleSidebar(); break;
      case "view.boardColumns": openBoardColumns(); break;
      case "app.refresh": refresh(); break;
      case "app.search": setOverlay("search"); break;
      case "app.filter": openFilters(); break;
      case "app.settings": openSettings(); break;
      case "app.help": setOverlay("help"); break;
      case "app.quit": onExit(); break;
      default: break;
    }
  };

  const actions: Record<CommandName, () => void> = {
    "navigation.down": () => {
      if (overlay === "filters") {
        moveFilterField(1);
      } else if (overlay === "settings") {
        moveSettingsIndex(1);
      } else if (overlay === "picker") {
        setOverlayIndex((current) => moveIndex(current, 1, pickerOptions.length));
      } else if (overlay === "boardColumns") {
        setOverlayIndex((current) => moveIndex(current, 1, boardColumnOptions.length));
      } else if (overlay === "status") {
        const states = model && selectedIssue ? orderedStates(model, selectedIssue.teamId) : [];
        setOverlayIndex((current) => moveIndex(current, 1, states.length));
      } else if (overlay === "palette") {
        setOverlayIndex((current) => moveIndex(current, 1, filteredPalette.length));
      } else if (activePane === "sidebar") {
        setNavigationIndex((current) => moveIndex(current, 1, navigation.length));
      } else if (view === "board") {
        setBoardRowIndex((current) => moveIndex(current, 1, boardIssues.length));
      } else {
        setIssueIndex((current) => moveIndex(current, 1, filteredIssues.length));
      }
    },
    "navigation.up": () => {
      if (overlay === "filters") {
        moveFilterField(-1);
      } else if (overlay === "settings") {
        moveSettingsIndex(-1);
      } else if (overlay === "picker") {
        setOverlayIndex((current) => moveIndex(current, -1, pickerOptions.length));
      } else if (overlay === "boardColumns") {
        setOverlayIndex((current) => moveIndex(current, -1, boardColumnOptions.length));
      } else if (overlay === "status") {
        const states = model && selectedIssue ? orderedStates(model, selectedIssue.teamId) : [];
        setOverlayIndex((current) => moveIndex(current, -1, states.length));
      } else if (overlay === "palette") {
        setOverlayIndex((current) => moveIndex(current, -1, filteredPalette.length));
      } else if (activePane === "sidebar") {
        setNavigationIndex((current) => moveIndex(current, -1, navigation.length));
      } else if (view === "board") {
        setBoardRowIndex((current) => moveIndex(current, -1, boardIssues.length));
      } else {
        setIssueIndex((current) => moveIndex(current, -1, filteredIssues.length));
      }
    },
    "navigation.first": () => {
      if (activePane === "sidebar") setNavigationIndex(0);
      else if (view === "board") setBoardRowIndex(0);
      else setIssueIndex(0);
    },
    "navigation.last": () => {
      if (activePane === "sidebar") setNavigationIndex(Math.max(0, navigation.length - 1));
      else if (view === "board") setBoardRowIndex(Math.max(0, boardIssues.length - 1));
      else setIssueIndex(Math.max(0, filteredIssues.length - 1));
    },
    "navigation.left": () => {
      if (overlay === "filters") {
        cycleFilterValue(-1);
      } else if (overlay === "settings") {
        changeSetting(-1);
      } else if (view === "board") {
        setColumnIndex((current) => moveIndex(current, -1, boardStates.length));
        setBoardRowIndex(0);
      } else if (layout === "wide") {
        setActivePane((current) => current === "detail" ? "issues" : sidebarCollapsed ? "issues" : "sidebar");
      } else {
        setActivePane("issues");
      }
    },
    "navigation.right": () => {
      if (overlay === "filters") {
        cycleFilterValue(1);
      } else if (overlay === "settings") {
        changeSetting(1);
      } else if (view === "board") {
        setColumnIndex((current) => moveIndex(current, 1, boardStates.length));
        setBoardRowIndex(0);
      } else if (layout === "wide") {
        setActivePane((current) => current === "sidebar" ? "issues" : "detail");
      } else if (layout === "medium") {
        setActivePane("detail");
      }
    },
    "issue.open": () => {
      if (phase === "unauthenticated") {
        authorize();
      } else if (overlay === "filters") {
        cycleFilterValue(1);
      } else if (overlay === "settings") {
        changeSetting(1);
      } else if (overlay === "search") {
        setOverlay("none");
      } else if (overlay === "palette") {
        runPaletteSelection();
      } else if (overlay === "status") {
        const states = model && selectedIssue ? orderedStates(model, selectedIssue.teamId) : [];
        const state = states[overlayIndex];
        if (selectedIssue && state) setIssueStatus(selectedIssue, state.id);
      } else if (overlay === "picker") {
        applyPickerSelection();
      } else if (overlay === "boardColumns") {
        setOverlay("none");
      } else if (activePane === "sidebar") {
        applyFilter(navigationIndex);
      } else if (selectedIssue) {
        setDetailOpen(true);
        setActivePane("detail");
        loadComments(selectedIssue);
      }
    },
    "issue.create": () => openComposer("create"),
    "issue.edit": () => openComposer("edit"),
    "issue.comment": () => {
      if (!selectedIssue || mutationIssueId) return;
      setCommentBody("");
      setOverlay("comment");
    },
    "issue.changeStatus": () => {
      if (!model || !selectedIssue || mutationIssueId) return;
      const states = orderedStates(model, selectedIssue.teamId);
      setOverlayIndex(Math.max(0, states.findIndex(({ id }) => id === selectedIssue.stateId)));
      setOverlay("status");
    },
    "issue.changeAssignee": () => openPicker("assignee", "workspace"),
    "issue.changePriority": () => openPicker("priority", "workspace"),
    "issue.changeLabels": () => openPicker("labels", "workspace"),
    "issue.changeProject": () => openPicker("project", "workspace"),
    "issue.changeCycle": () => openPicker("cycle", "workspace"),
    "issue.copyIdentifier": copySelectedIssue,
    "issue.openInBrowser": openSelectedIssueInBrowser,
    "composer.nextField": () => setComposerField((current) => current === "title" ? "description" : "title"),
    "composer.pickTeam": () => openPicker("team", "composer"),
    "composer.pickStatus": () => openPicker("status", "composer"),
    "composer.pickPriority": () => openPicker("priority", "composer"),
    "composer.pickAssignee": () => openPicker("assignee", "composer"),
    "composer.pickLabels": () => openPicker("labels", "composer"),
    "composer.pickProject": () => openPicker("project", "composer"),
    "composer.pickCycle": () => openPicker("cycle", "composer"),
    "composer.externalEditor": () => {
      const initial = overlay === "comment" ? commentBody : draft?.description;
      if (initial === undefined) return;
      const name = overlay === "comment" ? `${selectedIssue?.identifier ?? "issue"}-comment.md` : `${selectedIssue?.identifier ?? "new-issue"}-description.md`;
      controller.editText(initial, name).then((edited) => {
        if (edited === null) return;
        if (overlay === "comment") setCommentBody(edited);
        else setDraft((current) => current ? { ...current, description: edited } : current);
      }).catch((cause: unknown) => setNotice({ tone: "error", message: safeMessage(cause) }));
    },
    "composer.save": () => overlay === "comment" ? saveComment() : saveComposer(),
    "picker.toggle": () => overlay === "boardColumns" ? toggleBoardColumn() : togglePickerOption(),
    "app.back": () => {
      if (overlay === "picker" && pickerOrigin === "composer") {
        setOverlay("composer");
      } else if (overlay !== "none") {
        setOverlay("none");
        setPaletteQuery("");
        setDraft(null);
      } else if (detailOpen || activePane === "detail") {
        setDetailOpen(false);
        setActivePane("issues");
      } else if (query) {
        setQuery("");
      }
    },
    "app.search": () => {
      if (phase === "ready") {
        setOverlayIndex(0);
        setOverlay("search");
      }
    },
    "app.filter": () => {
      if (phase === "ready") openFilters();
    },
    "filter.clear": clearFilters,
    "app.commandPalette": () => {
      if (phase === "ready") {
        setPaletteQuery("");
        setOverlayIndex(0);
        setOverlay("palette");
      }
    },
    "app.settings": () => {
      if (phase === "ready") openSettings();
    },
    "app.help": () => setOverlay((current) => current === "help" ? "none" : "help"),
    "app.refresh": refresh,
    "app.quit": onExit,
    "view.toggle": toggleView,
    "view.toggleSidebar": toggleSidebar,
    "view.boardColumns": openBoardColumns,
    "board.moveLeft": () => {
      if (!model || view !== "board" || !selectedIssue) return;
      const target = boardStates[columnIndex - 1];
      if (target) setIssueStatus(selectedIssue, target.id);
    },
    "board.moveRight": () => {
      if (!model || view !== "board" || !selectedIssue) return;
      const target = boardStates[columnIndex + 1];
      if (target) setIssueStatus(selectedIssue, target.id);
    },
  };

  const commands: readonly Command<Renderable, KeyEvent>[] = commandNames.map((name) => ({
    name,
    run: () => {
      actions[name]();
      return true;
    },
  }));
  const customizedNormalBindings = useMemo(
    () => normalBindingsFor(preferences.keybindings),
    [preferences.keybindings],
  );
  const bindings = overlay === "none"
    ? customizedNormalBindings
    : overlay === "help"
      ? helpBindings
      : overlay === "filters"
        ? filterBindings
      : overlay === "settings"
        ? settingsBindings
      : overlay === "status"
        ? statusBindings
        : overlay === "composer"
          ? composerBindings
          : overlay === "comment"
            ? commentBindings
            : overlay === "picker" || overlay === "boardColumns"
              ? pickerBindings
              : inputBindings;

  useBindings(() => ({ commands, bindings, priority: 100 }), [commands, bindings]);

  if (layout === "too-small") {
    const palette = themeById(preferences.theme).palette;
    return (
      <ThemeProvider themeId={preferences.theme}>
        <box width="100%" height="100%" backgroundColor={palette.background} alignItems="center" justifyContent="center" flexDirection="column">
          <text fg={palette.accent}><strong>LINEATER</strong></text>
          <text fg={palette.text}>Terminal is too small</text>
          <text fg={palette.subtle}>Resize to at least 58 × 18 · current {width} × {height}</text>
          <text fg={palette.subtle}>q to quit</text>
        </box>
      </ThemeProvider>
    );
  }

  const content = phase !== "ready" || !model
    ? <AuthScreen phase={phase === "ready" ? "syncing" : phase} error={authError} />
    : (
      <WorkspaceScreen
        model={model}
        layout={layout}
        view={view}
        activePane={activePane}
        navigation={navigation}
        selectedNavigationIndex={navigationIndex}
        issues={view === "board" ? boardDisplayIssues : filteredIssues}
        selectedIssue={selectedIssue}
        selectedIssueIndex={issueIndex}
        selectedColumnIndex={columnIndex}
        boardStates={boardStates}
        hiddenBoardColumnCount={allBoardStates.length - boardStates.length}
        sidebarCollapsed={sidebarCollapsed}
        detailOpen={detailOpen}
        query={query}
        activeFilterCount={activeIssueFilterCount(issueFilters) + (filterIndex === 0 ? 0 : 1)}
        syncing={syncing}
        cachedOnly={cachedOnly}
        mutationIssueId={mutationIssueId}
        notice={notice}
        comments={selectedIssue ? commentsByIssue[selectedIssue.id] ?? [] : []}
        commentsLoading={commentsLoading === selectedIssue?.id}
      />
    );

  const statusStates = model && selectedIssue ? orderedStates(model, selectedIssue.teamId) : [];
  const composerTeam = model?.teams.find(({ id }) => id === draft?.teamId)?.name ?? "Unknown";
  const composerStatus = model?.workflowStates.find(({ id }) => id === draft?.stateId)?.name ?? "Unknown";
  const composerPriority = priorities.find(({ id }) => id === String(draft?.priority))?.label ?? "No priority";
  const composerAssignee = model?.users.find(({ id }) => id === draft?.assigneeId)?.displayName ?? "Unassigned";
  const composerProject = model?.projects.find(({ id }) => id === draft?.projectId)?.name ?? "None";
  const composerCycleRecord = model?.cycles.find(({ id }) => id === draft?.cycleId);
  const composerCycle = composerCycleRecord?.name ?? (composerCycleRecord ? `Cycle ${composerCycleRecord.number}` : "None");
  const composerLabels = draft?.labelIds.map((id) => model?.labels.find((label) => label.id === id)?.name).filter((name): name is string => Boolean(name)).join(", ") || "None";
  const pickerTitle = pickerKind === "team" ? "Choose team"
    : pickerKind === "status" ? "Choose status"
    : pickerKind === "priority" ? "Choose priority"
    : pickerKind === "assignee" ? "Choose assignee"
    : pickerKind === "project" ? "Choose project"
    : pickerKind === "cycle" ? "Choose cycle"
    : "Choose labels";
  return (
    <ThemeProvider themeId={preferences.theme}>
      <box width="100%" height="100%" position="relative">
      {content}
      {overlay === "help" ? <HelpOverlay /> : null}
      {overlay === "search" ? <InputOverlay kind="search" value={query} onInput={(value) => { setQuery(value); setIssueIndex(0); }} /> : null}
      {overlay === "palette" ? (
        <InputOverlay
          kind="palette"
          value={paletteQuery}
          onInput={(value) => { setPaletteQuery(value); setOverlayIndex(0); }}
          suggestions={filteredPalette.map(({ label }) => label)}
          selectedIndex={overlayIndex}
        />
      ) : null}
      {overlay === "status" ? <StatusOverlay states={statusStates} selectedIndex={overlayIndex} /> : null}
      {overlay === "comment" ? <CommentComposerOverlay value={commentBody} saving={mutationIssueId !== null} onInput={setCommentBody} /> : null}
      {overlay === "composer" && draft ? (
        <IssueComposerOverlay
          draft={draft}
          field={composerField}
          team={composerTeam}
          status={composerStatus}
          priority={composerPriority}
          assignee={composerAssignee}
          project={composerProject}
          cycle={composerCycle}
          labels={composerLabels}
          saving={mutationIssueId !== null}
          onTitle={(title) => setDraft((current) => current ? { ...current, title } : current)}
          onDescription={(description) => setDraft((current) => current ? { ...current, description } : current)}
        />
      ) : null}
      {overlay === "picker" ? <PickerOverlay title={pickerTitle} options={pickerOptions} selectedIndex={overlayIndex} multiple={pickerKind === "labels"} /> : null}
      {overlay === "boardColumns" ? <PickerOverlay title="Board columns" options={boardColumnOptions} selectedIndex={overlayIndex} multiple /> : null}
      {overlay === "settings" ? <SettingsOverlay preferences={preferences} selectedIndex={settingsIndex} /> : null}
      {overlay === "filters" ? <FilterOverlay rows={filterRows} selectedIndex={filterPanelIndex} activeCount={activeIssueFilterCount(issueFilters) + (filterIndex === 0 ? 0 : 1)} /> : null}
      </box>
    </ThemeProvider>
  );
}
