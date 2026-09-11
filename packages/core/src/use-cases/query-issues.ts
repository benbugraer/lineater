import { Effect } from "effect";
import type { IssueQuery } from "../domain";
import { IssueRepository, LinearService } from "../services";

const matches = (
  issue: {
    readonly teamId: string;
    readonly stateId: string;
    readonly projectId: string | null;
    readonly cycleId: string | null;
    readonly assigneeId: string | null;
    readonly priority: number;
    readonly labelIds: readonly string[];
  },
  query: IssueQuery,
): boolean =>
  (query.teamId === undefined || issue.teamId === query.teamId)
  && (query.stateId === undefined || issue.stateId === query.stateId)
  && (query.projectId === undefined || issue.projectId === query.projectId)
  && (query.cycleId === undefined || issue.cycleId === query.cycleId)
  && (query.assigneeId === undefined || issue.assigneeId === query.assigneeId)
  && (query.priority === undefined || issue.priority === query.priority)
  && (query.labelId === undefined || issue.labelIds.includes(query.labelId));

export const listIssues = (
  query: IssueQuery,
  options: { readonly offline: boolean; readonly limit?: number },
) => Effect.gen(function* () {
  if (options.offline) {
    const repository = yield* IssueRepository;
    const issues = yield* repository.list(options.limit ?? 500);
    return issues.filter((issue) => matches(issue, query));
  }
  const linear = yield* LinearService;
  return (yield* linear.issues(undefined, query)).items;
});

export const getIssue = (identifier: string, offline: boolean) => Effect.gen(function* () {
  const normalized = identifier.trim().toUpperCase();
  if (offline) {
    const repository = yield* IssueRepository;
    return yield* repository.findByIdentifier(normalized);
  }
  const linear = yield* LinearService;
  return yield* linear.issue(normalized);
});
