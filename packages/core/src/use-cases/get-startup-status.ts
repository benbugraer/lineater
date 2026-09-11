import { Effect } from "effect";
import { CacheService, IssueRepository, type StartupStatus } from "../services";

export const getStartupStatus: Effect.Effect<
  StartupStatus,
  import("../errors").StorageError,
  CacheService | IssueRepository
> = Effect.gen(function* () {
  const cache = yield* CacheService;
  const issues = yield* IssueRepository;
  const [health, cachedIssueCount] = yield* Effect.all([
    cache.healthCheck,
    issues.count,
  ]);

  return {
    cacheReady: health.ready,
    cachedIssueCount,
  } satisfies StartupStatus;
});
