import { AuthService, LinearService, ReadModelRepository } from "../services";
import { Effect } from "effect";

export const authenticate = Effect.gen(function* () {
  const auth = yield* AuthService;
  const linear = yield* LinearService;
  const repository = yield* ReadModelRepository;
  const session = yield* auth.login;
  const identityData = yield* linear.viewer.pipe(
    Effect.tapError(() => auth.logout.pipe(Effect.ignore)),
  );
  const identity = { ...identityData, ...session };
  yield* repository.saveIdentity(identity);
  return identity;
});

export const logout = AuthService.pipe(Effect.flatMap((auth) => auth.logout));
export const getAuthSession = AuthService.pipe(Effect.flatMap((auth) => auth.session));
