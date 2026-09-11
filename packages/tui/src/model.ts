import type { InitialReadModel, Issue, WorkflowState } from "@lineater/core";

export type LayoutMode = "too-small" | "single" | "medium" | "wide";
export type WorkspaceView = "list" | "board";
export type ActivePane = "sidebar" | "issues" | "detail";

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

export const orderedStates = (model: InitialReadModel, teamId: string | null): readonly WorkflowState[] =>
  model.workflowStates
    .filter((state) => teamId === null || state.teamId === teamId)
    .toSorted((left, right) => left.position - right.position || left.name.localeCompare(right.name));

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
