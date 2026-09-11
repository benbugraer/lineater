#!/usr/bin/env bun
import { Command } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { AuthLive, BrowserLive, ClipboardLive, SecretStoreLive } from "@lineater/auth";
import { lineaterCommand } from "@lineater/cli";
import { ConfigLive, ConfigService, makeFileLogLayer, PreferencesLive } from "@lineater/config";
import { LinearLive } from "@lineater/linear";
import { makeStorageLayer } from "@lineater/storage";
import { TuiLive } from "@lineater/tui";
import { Console, Effect, Layer } from "effect";
import packageMetadata from "../package.json" with { type: "json" };

const StorageLive = Layer.unwrapEffect(
  ConfigService.pipe(
    Effect.map(({ paths }) => makeStorageLayer({ databasePath: paths.databasePath })),
  ),
).pipe(Layer.provide(ConfigLive));

const LogLive = Layer.unwrapEffect(
  ConfigService.pipe(Effect.map(({ paths }) => makeFileLogLayer(paths.logPath))),
).pipe(Layer.provide(ConfigLive));

const AuthPlatformLive = Layer.merge(BrowserLive, SecretStoreLive);
const ConfiguredAuthLive = AuthLive.pipe(
  Layer.provide(AuthPlatformLive),
  Layer.provide(ConfigLive),
);
const ConfiguredLinearLive = LinearLive.pipe(Layer.provide(ConfiguredAuthLive));
const ConfiguredPreferencesLive = PreferencesLive.pipe(Layer.provide(ConfigLive));

const TuiDependencies = Layer.mergeAll(
  StorageLive,
  ConfiguredAuthLive,
  ConfiguredLinearLive,
  ConfiguredPreferencesLive,
  BrowserLive,
  ClipboardLive,
);
const ConfiguredTuiLive = TuiLive.pipe(Layer.provide(TuiDependencies));

const AppLive = Layer.mergeAll(
  TuiDependencies,
  LogLive,
  ConfiguredTuiLive,
);

const cli = Command.run(lineaterCommand, {
  name: "Lineater",
  version: packageMetadata.version,
});

const versionArgument = process.argv[2];
const isVersionRequest = process.argv.length === 3 && (versionArgument === "--version" || versionArgument === "-v");

if (isVersionRequest) {
  process.stdout.write(`${packageMetadata.version}\n`);
} else {
  cli(process.argv).pipe(
    Effect.provide(AppLive),
    Effect.provide(BunContext.layer),
    Effect.catchAll((error) => {
      const rawDetail = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "The command could not be completed.";
      const detail = Array.from(rawDetail, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint < 32 || codePoint === 127 ? "" : character;
      }).join("").slice(0, 500);

      return Console.error(`Lineater could not start.\n${detail}`).pipe(
        Effect.tap(() => Effect.sync(() => {
          process.exitCode = 1;
        })),
      );
    }),
    BunRuntime.runMain,
  );
}
