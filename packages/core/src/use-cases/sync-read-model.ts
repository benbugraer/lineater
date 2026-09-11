import { Effect } from "effect";
import { LinearService, ReadModelRepository } from "../services";

export const syncInitialReadModel = Effect.gen(function* () {
  const linear = yield* LinearService;
  const repository = yield* ReadModelRepository;
  const model = yield* linear.initialReadModel;
  yield* repository.saveInitialReadModel(model);
  return model;
});
