import { Effect } from "effect";
import type { Issue, UpdateIssueInput } from "../domain";
import { IssueInputError } from "../errors";
import { IssueRepository, LinearService } from "../services";

const applyUpdate = (issue: Issue, input: UpdateIssueInput): Issue => ({
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

export const updateIssue = (issue: Issue, input: UpdateIssueInput) => Effect.gen(function* () {
  if (input.title !== undefined && !input.title.trim()) {
    return yield* Effect.fail(new IssueInputError({ field: "title", message: "Issue title cannot be empty." }));
  }
  if (input.priority !== undefined && (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 4)) {
    return yield* Effect.fail(new IssueInputError({ field: "priority", message: "Priority must be an integer from 0 to 4." }));
  }
  if (Object.keys(input).length === 0) return issue;

  const repository = yield* IssueRepository;
  const linear = yield* LinearService;
  const optimistic = applyUpdate(issue, input);
  yield* repository.save(optimistic);

  return yield* linear.updateIssue(issue.id, input).pipe(
    Effect.tap((updated) => repository.save(updated)),
    Effect.tapError(() => repository.save(issue).pipe(Effect.ignore)),
  );
});
