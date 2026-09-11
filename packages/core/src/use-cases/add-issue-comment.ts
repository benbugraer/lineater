import { Effect } from "effect";
import { IssueInputError } from "../errors";
import { CommentRepository, LinearService } from "../services";

export const addIssueComment = (issueId: string, body: string) => Effect.gen(function* () {
  const trimmed = body.trim();
  if (!trimmed) return yield* Effect.fail(new IssueInputError({ field: "description", message: "Comment cannot be empty." }));
  const linear = yield* LinearService;
  const repository = yield* CommentRepository;
  const comment = yield* linear.createComment(issueId, trimmed);
  yield* repository.save(comment);
  return comment;
});
