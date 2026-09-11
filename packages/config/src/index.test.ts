import { describe, expect, test } from "bun:test";
import { PreferencesService } from "@lineater/core";
import { Effect, Layer } from "effect";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigService, makeAppPaths, makeOAuthConfig, PreferencesLive } from "./index";

describe("Lineater configuration", () => {
  test("uses XDG paths without storing credentials in config", () => {
    const paths = makeAppPaths({ HOME: "/home/test", XDG_CONFIG_HOME: "/config", XDG_DATA_HOME: "/data", XDG_STATE_HOME: "/state" });
    expect(paths.configPath).toBe("/config/lineater/config.json");
    expect(paths.databasePath).toBe("/data/lineater/lineater.db");
    expect(paths.logPath).toBe("/state/lineater/lineater.log");
  });

  test("requires an exact loopback redirect with a fixed port", () => {
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client", LINEATER_LINEAR_REDIRECT_URI: "https://example.com/callback" }, {})).toThrow("loopback");
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client", LINEATER_LINEAR_REDIRECT_URI: "http://127.0.0.1/oauth/callback" }, {})).toThrow("fixed port");
  });

  test("rejects admin and unknown OAuth scopes", () => {
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client", LINEATER_LINEAR_SCOPES: "read,admin" }, {})).toThrow("over-privileged");
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client", LINEATER_LINEAR_SCOPES: "read,unknown" }, {})).toThrow("over-privileged");
  });

  test("atomically persists non-sensitive TUI preferences with restrictive permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "lineater-config-"));
    const paths = makeAppPaths({ HOME: root, LINEATER_CONFIG_DIR: root });
    await writeFile(paths.configPath, `${JSON.stringify({ linearClientId: "keep-me" })}\n`);
    await chmod(paths.configPath, 0o600);
    const initial = { theme: "linear", defaultView: "list" as const, autoSync: true };
    const ConfigTest = Layer.succeed(ConfigService, { paths, oauth: null, preferences: initial });
    try {
      await Effect.runPromise(
        PreferencesService.pipe(
          Effect.flatMap(({ save }) => save({ theme: "catppuccin-mocha", defaultView: "board", autoSync: false })),
          Effect.provide(PreferencesLive),
          Effect.provide(ConfigTest),
        ),
      );
      const saved = await Bun.file(paths.configPath).json();
      expect(saved).toEqual({
        linearClientId: "keep-me",
        theme: "catppuccin-mocha",
        defaultView: "board",
        autoSync: false,
      });
      expect((await stat(paths.configPath)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
