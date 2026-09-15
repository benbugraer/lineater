import type { InitialReadModel, Issue, WorkflowState } from "@lineater/core";

export type LayoutMode = "too-small" | "single" | "medium" | "wide";
export type WorkspaceView = "list" | "board";
export type ActivePane = "sidebar" | "issues" | "detail";

export const isAuthenticationFailure = (cause: unknown): boolean => {
  if (typeof cause !== "object" || cause === null || !("_tag" in cause) || !("reason" in cause)) return false;
  const tagged = Object.fromEntries(Object.entries(cause));
  return (tagged._tag === "AuthError" && ["expired", "not-authenticated"].includes(String(tagged.reason)))
    || (tagged._tag === "LinearApiError" && tagged.reason === "authentication");
};

export interface IssueFilters {
  readonly stateId: string | null;
  readonly projectId: string | null;
  readonly cycleId: string | null;
  readonly assigneeId: string | null;
  readonly priority: number | null;
  readonly labelId: string | null;
}

export const emptyIssueFilters: IssueFilters = {
  stateId: null,
  projectId: null,
  cycleId: null,
  assigneeId: null,
  priority: null,
  labelId: null,
};

export const activeIssueFilterCount = (filters: IssueFilters): number =>
  Object.values(filters).filter((value) => value !== null).length;

export const layoutMode = (width: number, height: number): LayoutMode => {
  if (width < 58 || height < 18) return "too-small";
  if (width < 86) return "single";
  if (width < 124) return "medium";
  return "wide";
};

const workflowStateTypeRank = (type: string): number => {
  switch (type) {
    case "triage": return 0;
    case "backlog": return 1;
    case "unstarted": return 2;
    case "started": return 3;
    case "completed": return 4;
    case "canceled": return 5;
    case "duplicate": return 6;
    default: return 7;
  }
};

/** Orders team states by Linear's fixed workflow categories, then each state's category position. */
export const orderedStates = (model: InitialReadModel, teamId: string | null): readonly WorkflowState[] =>
  model.workflowStates
    .filter((state) => teamId === null || state.teamId === teamId)
    .toSorted((left, right) => workflowStateTypeRank(left.type) - workflowStateTypeRank(right.type)
      || left.position - right.position
      || left.name.localeCompare(right.name));

/** Returns workflow columns in team order after applying local board visibility choices. */
export const visibleBoardStates = (
  model: InitialReadModel,
  teamId: string | null,
  hiddenStateIds: ReadonlySet<string>,
): readonly WorkflowState[] => orderedStates(model, teamId).filter(({ id }) => !hiddenStateIds.has(id));

/** Orders board cards by Linear's workspace-wide manual `sortOrder`. */
export const orderedBoardIssues = (issues: readonly Issue[]): readonly Issue[] =>
  issues.toSorted((left, right) => {
    if (left.sortOrder === null && right.sortOrder === null) return left.number - right.number;
    if (left.sortOrder === null) return 1;
    if (right.sortOrder === null) return -1;
    return left.sortOrder - right.sortOrder || left.number - right.number;
  });

export const visibleIssues = (
  model: InitialReadModel,
  teamId: string | null,
  query: string,
  filters: IssueFilters = emptyIssueFilters,
): readonly Issue[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return model.issues.filter((issue) => {
    if (teamId !== null && issue.teamId !== teamId) return false;
    if (filters.stateId !== null && issue.stateId !== filters.stateId) return false;
    if (filters.projectId !== null && issue.projectId !== filters.projectId) return false;
    if (filters.cycleId !== null && issue.cycleId !== filters.cycleId) return false;
    if (filters.assigneeId !== null && issue.assigneeId !== filters.assigneeId) return false;
    if (filters.priority !== null && issue.priority !== filters.priority) return false;
    if (filters.labelId !== null && !issue.labelIds.includes(filters.labelId)) return false;
    if (!normalizedQuery) return true;
    return issue.identifier.toLocaleLowerCase().includes(normalizedQuery)
      || issue.title.toLocaleLowerCase().includes(normalizedQuery);
  });
};

export const moveIndex = (current: number, delta: number, length: number): number => {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, current + delta));
};

export const adjacentStatus = (
  model: InitialReadModel,
  issue: Issue,
  delta: -1 | 1,
): WorkflowState | null => {
  const states = orderedStates(model, issue.teamId);
  const index = states.findIndex(({ id }) => id === issue.stateId);
  if (index < 0) return null;
  return states[index + delta] ?? null;
};

export const replaceIssue = (model: InitialReadModel, updated: Issue): InitialReadModel => ({
  ...model,
  issues: model.issues.map((issue) => issue.id === updated.id ? updated : issue),
});

export const priorityLabel = (priority: number): string => {
  switch (priority) {
    case 1: return "Urgent";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "No priority";
  }
};

export const relativeDate = (date: Date, now = new Date()): string => {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.floor(days / 7)}w ago`;
  return date.toISOString().slice(0, 10);
};
