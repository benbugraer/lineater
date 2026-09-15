import { describe, expect, test } from "bun:test";
import { PreferencesService } from "@lineater/core";
import { Effect, Layer } from "effect";
import { chmod, mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises";
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

  test("uses packaged public OAuth configuration while preserving runtime overrides", () => {
    expect(makeOAuthConfig({}, {}, "packaged-client")?.clientId).toBe("packaged-client");
    expect(makeOAuthConfig({}, { linearClientId: "file-client" }, "packaged-client")?.clientId).toBe("file-client");
    expect(makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "environment-client" }, { linearClientId: "file-client" }, "packaged-client")?.clientId).toBe("environment-client");
    expect(() => makeOAuthConfig({}, {}, "invalid client id")).toThrow("invalid format");
    expect(() => makeOAuthConfig({}, { linearClientId: "GERCEK_LINEAR_CLIENT_ID" }, undefined)).toThrow("placeholder");
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "your-public-client-id" }, {}, undefined)).toThrow("placeholder");
  });

  test("requires an exact loopback redirect with a fixed port", () => {
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client-id", LINEATER_LINEAR_REDIRECT_URI: "https://example.com/callback" }, {}, undefined)).toThrow("loopback");
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client-id", LINEATER_LINEAR_REDIRECT_URI: "http://127.0.0.1/oauth/callback" }, {}, undefined)).toThrow("fixed port");
  });

  test("rejects admin and unknown OAuth scopes", () => {
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client-id", LINEATER_LINEAR_SCOPES: "read,admin" }, {})).toThrow("over-privileged");
    expect(() => makeOAuthConfig({ LINEATER_LINEAR_CLIENT_ID: "client-id", LINEATER_LINEAR_SCOPES: "read,unknown" }, {})).toThrow("over-privileged");
  });

  test("rejects plaintext credentials in the non-sensitive config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "lineater-config-secret-"));
    const paths = makeAppPaths({ HOME: root, LINEATER_CONFIG_DIR: root });
    await writeFile(paths.configPath, `${JSON.stringify({ accessToken: "must-not-live-here" })}\n`, { mode: 0o600 });
    const initial = { theme: "linear", defaultView: "list" as const, autoSync: true, keybindings: {} };
    const ConfigTest = Layer.succeed(ConfigService, { paths, oauth: null, preferences: initial });
    try {
      await expect(Effect.runPromise(
        PreferencesService.pipe(
          Effect.flatMap(({ save }) => save(initial)),
          Effect.provide(PreferencesLive),
          Effect.provide(ConfigTest),
        ),
      )).rejects.toThrow("Secrets and tokens are not allowed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects symbolic-link config targets before persisting preferences", async () => {
    const root = await mkdtemp(join(tmpdir(), "lineater-config-link-"));
    const paths = makeAppPaths({ HOME: root, LINEATER_CONFIG_DIR: root });
    const target = join(root, "target.json");
    await writeFile(target, "{}\n");
    await symlink(target, paths.configPath);
    const initial = { theme: "linear", defaultView: "list" as const, autoSync: true, keybindings: {} };
    const ConfigTest = Layer.succeed(ConfigService, { paths, oauth: null, preferences: initial });
    try {
      await expect(Effect.runPromise(
        PreferencesService.pipe(
          Effect.flatMap(({ save }) => save(initial)),
          Effect.provide(PreferencesLive),
          Effect.provide(ConfigTest),
        ),
      )).rejects.toThrow("symbolic link");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("atomically persists non-sensitive TUI preferences with restrictive permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "lineater-config-"));
    const paths = makeAppPaths({ HOME: root, LINEATER_CONFIG_DIR: root });
    await writeFile(paths.configPath, `${JSON.stringify({ linearClientId: "keep-me-safe" })}\n`);
    await chmod(paths.configPath, 0o600);
    const initial = { theme: "linear", defaultView: "list" as const, autoSync: true, keybindings: {} };
    const ConfigTest = Layer.succeed(ConfigService, { paths, oauth: null, preferences: initial });
    try {
      await Effect.runPromise(
        PreferencesService.pipe(
          Effect.flatMap(({ save }) => save({ theme: "catppuccin-mocha", defaultView: "board", autoSync: false, keybindings: { "app.settings": "ctrl+," } })),
          Effect.provide(PreferencesLive),
          Effect.provide(ConfigTest),
        ),
      );
      const saved = await Bun.file(paths.configPath).json();
      expect(saved).toEqual({
        linearClientId: "keep-me-safe",
        theme: "catppuccin-mocha",
        defaultView: "board",
        autoSync: false,
        keybindings: { "app.settings": "ctrl+," },
      });
      expect((await stat(paths.configPath)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
