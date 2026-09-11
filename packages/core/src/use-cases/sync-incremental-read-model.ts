import { Effect } from "effect";
import type { Issue } from "../domain";
import { LinearApiError } from "../errors";
import { LinearService, ReadModelRepository } from "../services";

const OVERLAP_MS = 2 * 60 * 1000;
const MAX_PAGES = 100;

export const syncIncrementalReadModel = Effect.gen(function* () {
  const linear = yield* LinearService;
  const repository = yield* ReadModelRepository;
  const cached = yield* repository.loadInitialReadModel;
  if (!cached) {
    const initial = yield* linear.initialReadModel;
    yield* repository.saveInitialReadModel(initial);
    return initial;
  }

  const syncStartedAt = new Date();
  const since = new Date(Math.max(0, cached.syncedAt.getTime() - OVERLAP_MS));
  const changedIssues: Issue[] = [];
  let after: string | undefined;
  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
    const page = yield* linear.updatedIssues(since, after);
    changedIssues.push(...page.items);
    if (!page.hasNextPage || !page.endCursor) {
      yield* repository.mergeIssues(changedIssues, syncStartedAt);
      const updated = yield* repository.loadInitialReadModel;
      if (!updated) {
        return yield* Effect.fail(new LinearApiError({ reason: "invalid-response", message: "Incremental sync did not produce a cached read model." }));
      }
      return updated;
    }
    after = page.endCursor;
  }

  return yield* Effect.fail(new LinearApiError({
    reason: "invalid-response",
    message: "Incremental issue sync exceeded the pagination safety limit.",
  }));
});
