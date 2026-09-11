import { Effect } from "effect";
import type { CreateIssueInput } from "../domain";
import { IssueInputError } from "../errors";
import { IssueRepository, LinearService } from "../services";

const validatePriority = (priority: number | undefined) => priority === undefined || (Number.isInteger(priority) && priority >= 0 && priority <= 4);

export const createIssue = (input: CreateIssueInput) => Effect.gen(function* () {
  const teamId = input.teamId.trim();
  const title = input.title.trim();
  if (!teamId) return yield* Effect.fail(new IssueInputError({ field: "teamId", message: "Choose a team before creating the issue." }));
  if (!title) return yield* Effect.fail(new IssueInputError({ field: "title", message: "Issue title cannot be empty." }));
  if (!validatePriority(input.priority)) return yield* Effect.fail(new IssueInputError({ field: "priority", message: "Priority must be an integer from 0 to 4." }));

  const linear = yield* LinearService;
  const repository = yield* IssueRepository;
  const created = yield* linear.createIssue({ ...input, teamId, title });
  yield* repository.save(created);
  return created;
});
