import { AuthService, ReadModelRepository } from "../services";
import { Effect } from "effect";

export const loadTuiBootstrap = Effect.gen(function* () {
  const auth = yield* AuthService;
  const readModel = yield* ReadModelRepository;
  const [session, cachedModel] = yield* Effect.all([
    auth.session,
    readModel.loadInitialReadModel,
  ]);
  return { session, cachedModel } as const;
});
