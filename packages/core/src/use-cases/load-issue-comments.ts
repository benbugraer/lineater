import { Effect } from "effect";
import { CommentRepository, LinearService } from "../services";

export const loadIssueComments = (issueId: string) => Effect.gen(function* () {
  const repository = yield* CommentRepository;
  const cached = yield* repository.listByIssue(issueId);
  const linear = yield* LinearService;
  return yield* linear.comments(issueId).pipe(
    Effect.flatMap((page) => Effect.forEach(page.items, (comment) => repository.save(comment), { discard: true }).pipe(
      Effect.as(page.items),
    )),
    Effect.catchAll((error) => cached.length > 0 ? Effect.succeed(cached) : Effect.fail(error)),
  );
});
