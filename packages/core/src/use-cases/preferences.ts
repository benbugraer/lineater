import { Effect } from "effect";
import type { AppPreferences } from "../domain";
import { PreferencesService } from "../services";

export const loadPreferences = PreferencesService.pipe(
  Effect.flatMap(({ load }) => load),
);

export const savePreferences = (preferences: AppPreferences) => PreferencesService.pipe(
  Effect.flatMap(({ save }) => save(preferences)),
);
