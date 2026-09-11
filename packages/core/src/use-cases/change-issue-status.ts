import type { Issue } from "../domain";
import { IssueRepository, LinearService } from "../services";
import { Effect } from "effect";

export const changeIssueStatus = (issue: Issue, stateId: string) => Effect.gen(function* () {
  if (issue.stateId === stateId) return issue;

  const repository = yield* IssueRepository;
  const linear = yield* LinearService;
  yield* repository.updateState(issue.id, stateId);

  return yield* linear.changeIssueStatus(issue.id, stateId).pipe(
    Effect.tap((updated) => repository.updateState(issue.id, updated.stateId)),
    Effect.tapError(() => repository.updateState(issue.id, issue.stateId).pipe(Effect.ignore)),
  );
});
