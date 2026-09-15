import { describe, expect, test } from "bun:test";
import { AuthError, AuthService, BrowserService, SecretStore } from "@lineater/core";
import { ConfigService } from "@lineater/config";
import { Effect, Fiber, Layer } from "effect";
import { AuthLive, buildAuthorizationUrl, createPkce, waitForCallback } from "./oauth";

const config = {
  clientId: "lineater-test-client",
  redirectUri: new URL("http://127.0.0.1:45991/oauth/callback"),
  scopes: ["read", "write"],
  callbackTimeoutMs: 2_000,
} as const;

describe("Linear OAuth PKCE", () => {
  test("creates a high-entropy S256 verifier and challenge", async () => {
    const first = await createPkce();
    const second = await createPkce();
    expect(first.verifier.length).toBeGreaterThanOrEqual(43);
    expect(first.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toEqual(second);

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(first.verifier));
    const expected = new Uint8Array(digest).toBase64({ alphabet: "base64url", omitPadding: true });
    expect(first.challenge).toBe(expected);
  });

  test("builds a least-privilege authorization URL without a client secret", () => {
    const url = buildAuthorizationUrl(config, "secure-state", "secure-challenge");
    expect(url.origin + url.pathname).toBe("https://linear.app/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("secure-state");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("read,write");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });

  test("accepts one matching loopback callback", async () => {
    const callback = Effect.runPromise(waitForCallback(config.redirectUri, "expected-state", 2_000));
    await Bun.sleep(30);
    const response = await fetch("http://127.0.0.1:45991/oauth/callback?code=authorization-code&state=expected-state");
    expect(response.status).toBe(200);
    await expect(callback).resolves.toEqual({ code: "authorization-code" });
  });

  test("checks secure credential storage before opening browser consent", async () => {
    let browserOpened = false;
    const ConfigTest = Layer.succeed(ConfigService, {
      paths: { configDirectory: "/tmp", dataDirectory: "/tmp", stateDirectory: "/tmp", configPath: "/tmp/config.json", databasePath: "/tmp/test.db", logPath: "/tmp/test.log" },
      oauth: config,
      preferences: { theme: "linear", defaultView: "list", autoSync: true, keybindings: {} },
    });
    const BrowserTest = Layer.succeed(BrowserService, {
      open: () => Effect.sync(() => { browserOpened = true; }),
    });
    const unavailable = new AuthError({ reason: "secret-store", message: "Credential store unavailable" });
    const SecretTest = Layer.succeed(SecretStore, {
      get: () => Effect.fail(unavailable),
      set: () => Effect.fail(unavailable),
      remove: () => Effect.fail(unavailable),
    });
    const layer = AuthLive.pipe(Layer.provide(Layer.mergeAll(ConfigTest, BrowserTest, SecretTest)));

    await expect(Effect.runPromise(AuthService.pipe(
      Effect.flatMap(({ login }) => login),
      Effect.provide(layer),
    ))).rejects.toThrow("Credential store unavailable");
    expect(browserOpened).toBe(false);
  });

  test("completes login and stores the rotating token bundle through SecretStore", async () => {
    const redirectUri = new URL("http://127.0.0.1:45993/oauth/callback");
    const secrets = new Map<string, string>();
    const originalFetch = globalThis.fetch;
    const tokenRequestBodies: string[] = [];
    const mockedFetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.linear.app/oauth/token") {
        const requestBody = String(init?.body ?? "");
        tokenRequestBodies.push(requestBody);
        const refreshing = requestBody.includes("grant_type=refresh_token");
        return new Response(JSON.stringify({
          access_token: refreshing ? "refreshed-access-token-long-enough" : "access-token-value-long-enough",
          refresh_token: refreshing ? "rotated-refresh-token-long-enough" : "refresh-token-value-long-enough",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "read write",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return originalFetch(input, init);
    }, { preconnect: originalFetch.preconnect });
    globalThis.fetch = mockedFetch;

    const ConfigTest = Layer.succeed(ConfigService, {
      paths: { configDirectory: "/tmp", dataDirectory: "/tmp", stateDirectory: "/tmp", configPath: "/tmp/config.json", databasePath: "/tmp/test.db", logPath: "/tmp/test.log" },
      oauth: { clientId: "test-client", redirectUri, scopes: ["read", "write"], callbackTimeoutMs: 2_000 },
      preferences: { theme: "linear", defaultView: "list", autoSync: true, keybindings: {} },
    });
    const BrowserTest = Layer.succeed(BrowserService, {
      open: (url) => Effect.promise(async () => {
          expect(url.searchParams.get("code_challenge_method")).toBe("S256");
          expect(url.searchParams.has("client_secret")).toBe(false);
          await Bun.sleep(30);
          const callback = new URL(redirectUri);
          callback.searchParams.set("code", "one-time-code");
          callback.searchParams.set("state", url.searchParams.get("state") ?? "");
          const response = await originalFetch(callback);
          expect(response.status).toBe(200);
      }),
    });
    const SecretTest = Layer.succeed(SecretStore, {
      get: (name) => Effect.succeed(secrets.get(name) ?? null),
      set: (name, value) => Effect.sync(() => { secrets.set(name, value); }),
      remove: (name) => Effect.sync(() => { secrets.delete(name); }),
    });
    const layer = AuthLive.pipe(Layer.provide(Layer.mergeAll(ConfigTest, BrowserTest, SecretTest)));

    try {
      const result = await Effect.runPromise(Effect.gen(function* () {
        const auth = yield* AuthService;
        const session = yield* auth.login;
        yield* Effect.sync(() => {
          const stored = secrets.get("oauth-session") ?? "";
          secrets.set("oauth-session", stored.replace(/"expiresAt":\d+/, '"expiresAt":1'));
        });
        const refreshedAccessToken = yield* auth.accessToken;
        return { session, refreshedAccessToken };
      }).pipe(Effect.provide(layer)));
      expect(result.session.scopes).toEqual(["read", "write"]);
      expect(result.refreshedAccessToken).toBe("refreshed-access-token-long-enough");
      expect(tokenRequestBodies[0]).toContain("grant_type=authorization_code");
      expect(tokenRequestBodies[0]).toContain("code_verifier=");
      expect(tokenRequestBodies[0]).not.toContain("client_secret");
      expect(tokenRequestBodies[1]).toContain("grant_type=refresh_token");
      expect(tokenRequestBodies[1]).not.toContain("client_secret");
      expect(secrets.get("oauth-session")).toContain("rotated-refresh-token-long-enough");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("closes the loopback listener when authorization is interrupted", async () => {
    const redirectUri = new URL("http://127.0.0.1:45994/oauth/callback");
    const fiber = Effect.runFork(waitForCallback(redirectUri, "expected-state", 10_000));
    await Bun.sleep(30);
    await Effect.runPromise(Fiber.interrupt(fiber));
    await expect(fetch(redirectUri)).rejects.toThrow();
  });

  test("rejects mismatched state without letting an unauthenticated request cancel the real callback", async () => {
    const redirectUri = new URL("http://127.0.0.1:45992/oauth/callback");
    const callback = Effect.runPromise(waitForCallback(redirectUri, "expected-state", 2_000));
    await Bun.sleep(30);
    const rejected = await fetch("http://127.0.0.1:45992/oauth/callback?code=attacker-code&state=attacker-state");
    expect(rejected.status).toBe(400);
    const accepted = await fetch("http://127.0.0.1:45992/oauth/callback?code=authorization-code&state=expected-state");
    expect(accepted.status).toBe(200);
    expect(await callback).toEqual({ code: "authorization-code" });
  });
});
