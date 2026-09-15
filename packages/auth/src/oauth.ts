import { AuthError, AuthService, BrowserService, SecretStore, type AuthSession } from "@lineater/core";
import { ConfigService, type OAuthConfig } from "@lineater/config";
import { Effect, Fiber, Layer } from "effect";
import { timingSafeEqual } from "node:crypto";

const AUTHORIZE_ENDPOINT = "https://linear.app/oauth/authorize";
const TOKEN_ENDPOINT = "https://api.linear.app/oauth/token";
const REVOKE_ENDPOINT = "https://api.linear.app/oauth/revoke";
const SECRET_NAME = "oauth-session";
const EXPIRY_SKEW_MS = 60_000;

interface TokenBundle {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: "Bearer";
  readonly scopes: readonly string[];
  readonly expiresAt: number;
}

const authError = (reason: AuthError["reason"], message: string, cause?: unknown) =>
  new AuthError({ reason, message, cause });

const base64Url = (bytes: Uint8Array): string =>
  bytes.toBase64({ alphabet: "base64url", omitPadding: true });

export const createPkce = async (): Promise<{ readonly verifier: string; readonly challenge: string }> => {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
};

const secureRandom = (): string => base64Url(crypto.getRandomValues(new Uint8Array(32)));

const stateMatches = (expected: string, actual: string): boolean => {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
};

export const buildAuthorizationUrl = (
  config: OAuthConfig,
  state: string,
  challenge: string,
): URL => {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri.toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("actor", "user");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
};

interface CallbackResult {
  readonly code: string;
}

const callbackPage = (status: "success" | "error", message: string): Response => new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Lineater OAuth</title>
<style>html{color-scheme:dark}body{margin:0;background:#0d0d0f;color:#ecece8;font:14px ui-monospace,monospace;display:grid;min-height:100vh;place-items:center}.box{border:1px solid #343438;padding:32px;max-width:520px}b{color:${status === "success" ? "#6ee7a8" : "#fca5a5"}}p{color:#a1a1aa;line-height:1.7}</style></head>
<body><main class="box"><b>${status === "success" ? "Authorization received" : "Authorization failed"}</b><p>${message}</p></main></body></html>`, {
  status: status === "success" ? 200 : 400,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  },
});

export const waitForCallback = (
  redirectUri: URL,
  expectedState: string,
  timeoutMs: number,
): Effect.Effect<CallbackResult, AuthError> => Effect.async<CallbackResult, AuthError>((resume) => {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopServer: (() => void) | undefined;

  const finish = (result: Effect.Effect<CallbackResult, AuthError>, flushResponse = false) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    flushResponse ? setTimeout(() => stopServer?.(), 100) : stopServer?.();
    resume(result);
  };

  try {
    const server = Bun.serve({
      hostname: redirectUri.hostname === "[::1]" ? "::1" : redirectUri.hostname,
      port: Number(redirectUri.port),
      reusePort: false,
      fetch(request) {
        const url = new URL(request.url);
        if (request.method !== "GET" || url.origin !== redirectUri.origin || url.pathname !== redirectUri.pathname) {
          return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
        }

        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");
        if (!state || state.length > 512 || !stateMatches(expectedState, state)) {
          // Do not settle the listener: browser prefetches or an unauthenticated local
          // request must not be able to cancel the user's real OAuth callback.
          return callbackPage("error", "The request could not be verified. Return to the terminal and try again.");
        }
        if (oauthError) {
          finish(Effect.fail(authError("denied", `Linear authorization was denied: ${oauthError}`)), true);
          return callbackPage("error", "Linear authorization was not granted. You can close this tab.");
        }

        const code = url.searchParams.get("code");
        if (!code || code.length > 2_048) {
          finish(Effect.fail(authError("callback", "Linear callback did not include a valid authorization code")), true);
          return callbackPage("error", "No valid authorization code was returned. You can close this tab.");
        }

        finish(Effect.succeed({ code }), true);
        return callbackPage("success", "Return to Lineater in your terminal. You can close this tab.");
      },
    });
    stopServer = () => server.stop(true);
    timer = setTimeout(() => finish(Effect.fail(authError("callback", "Timed out waiting for Linear authorization"))), timeoutMs);
  } catch (cause) {
    finish(Effect.fail(authError("callback", "Could not start the secure loopback callback listener", cause)));
  }

  return Effect.sync(() => {
    if (timer) clearTimeout(timer);
    stopServer?.();
  });
});

const parseScopes = (scope: unknown): readonly string[] => {
  const scopes = typeof scope === "string"
    ? scope.split(/[ ,]+/).filter(Boolean)
    : Array.isArray(scope) && scope.every((item) => typeof item === "string") ? scope : null;
  if (!scopes || scopes.length > 32 || scopes.some((item) => item.length > 128)) {
    throw new Error("Token response has an invalid scope value");
  }
  return scopes;
};

const parseTokenResponse = (value: unknown): TokenBundle => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid token response");
  const record = Object.fromEntries(Object.entries(value));
  if (typeof record.access_token !== "string" || record.access_token.length < 16 || record.access_token.length > 16_384) throw new Error("Token response is missing access_token");
  if (typeof record.refresh_token !== "string" || record.refresh_token.length < 16 || record.refresh_token.length > 16_384) throw new Error("Token response is missing refresh_token");
  if (record.token_type !== "Bearer") throw new Error("Token response has an unsupported token_type");
  if (typeof record.expires_in !== "number" || !Number.isFinite(record.expires_in) || record.expires_in <= 0 || record.expires_in > 31_536_000) throw new Error("Token response has an invalid expires_in");

  return {
    accessToken: record.access_token,
    refreshToken: record.refresh_token,
    tokenType: "Bearer",
    scopes: parseScopes(record.scope),
    expiresAt: Date.now() + record.expires_in * 1000,
  };
};

const requestToken = async (parameters: URLSearchParams): Promise<TokenBundle> => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "accept": "application/json" },
    body: parameters,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 65_536) throw new Error("Linear token response exceeded the size limit");
  const responseText = await response.text();
  if (responseText.length > 65_536) throw new Error("Linear token response exceeded the size limit");
  let body: unknown = null;
  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error(`Linear token endpoint returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const description = typeof body === "object" && body !== null && "error_description" in body && typeof body.error_description === "string"
      ? body.error_description
      : `Linear token endpoint returned HTTP ${response.status}`;
    throw new Error(description.slice(0, 500));
  }
  return parseTokenResponse(body);
};

const validateGrantedScopes = (token: TokenBundle, requested: readonly string[]): TokenBundle => {
  if (!token.scopes.includes("read") || token.scopes.some((scope) => !requested.includes(scope))) {
    throw new Error("Linear returned an unexpected OAuth scope set");
  }
  return token;
};

const serializeToken = (token: TokenBundle): string => JSON.stringify(token);
const parseStoredToken = (value: string): TokenBundle => {
  if (value.length > 65_536) throw new Error("Stored credential exceeds the size limit");
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Stored credential is invalid");
  const record = Object.fromEntries(Object.entries(parsed));
  if (
    typeof record.accessToken !== "string" || record.accessToken.length < 16 || record.accessToken.length > 16_384
    || typeof record.refreshToken !== "string" || record.refreshToken.length < 16 || record.refreshToken.length > 16_384
    || record.tokenType !== "Bearer"
    || typeof record.expiresAt !== "number" || !Number.isFinite(record.expiresAt) || record.expiresAt <= 0
  ) {
    throw new Error("Stored credential is incomplete");
  }
  return {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    tokenType: "Bearer",
    scopes: parseScopes(record.scopes),
    expiresAt: record.expiresAt,
  };
};

const sessionOf = (token: TokenBundle): AuthSession => ({
  scopes: token.scopes,
  expiresAt: new Date(token.expiresAt),
});

export const AuthLive = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const browser = yield* BrowserService;
    const secrets = yield* SecretStore;
    let refreshInFlight: Promise<TokenBundle> | null = null;

    const oauth = Effect.fromNullable(config.oauth).pipe(
      Effect.mapError(() => authError("configuration", "Linear OAuth is not configured. Set LINEATER_LINEAR_CLIENT_ID or add linearClientId to ~/.config/lineater/config.json.")),
    );

    const loadToken = Effect.suspend(() => secrets.get(SECRET_NAME)).pipe(
      Effect.flatMap((stored) => stored === null
        ? Effect.fail(authError("not-authenticated", "Not authenticated. Run `lineater auth login`."))
        : Effect.try({
          try: () => parseStoredToken(stored),
          catch: (cause) => authError("secret-store", "Stored Linear credential is invalid. Run `lineater auth login` again.", cause),
        })),
    );

    const refresh = (token: TokenBundle, oauthConfig: OAuthConfig) => Effect.tryPromise({
      try: async () => {
        if (!refreshInFlight) {
          refreshInFlight = requestToken(new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
            client_id: oauthConfig.clientId,
          })).then((next) => validateGrantedScopes(next, token.scopes)).finally(() => { refreshInFlight = null; });
        }
        return await refreshInFlight;
      },
      catch: (cause) => authError("expired", "Linear session could not be refreshed. Run `lineater auth login` if the problem continues.", cause),
    }).pipe(Effect.tap((next) => secrets.set(SECRET_NAME, serializeToken(next))));

    return {
      login: Effect.gen(function* () {
        const oauthConfig = yield* oauth;
        // Fail before browser consent when the installed system cannot securely
        // persist the resulting credential.
        yield* secrets.get(SECRET_NAME).pipe(Effect.asVoid);
        const state = secureRandom();
        const pkce = yield* Effect.promise(createPkce);
        const authorizationUrl = buildAuthorizationUrl(oauthConfig, state, pkce.challenge);
        const callbackFiber = yield* Effect.fork(waitForCallback(oauthConfig.redirectUri, state, oauthConfig.callbackTimeoutMs));
        // Give the listener a scheduling turn and surface bind failures before opening Linear.
        yield* Effect.raceFirst(
          Effect.sleep("25 millis"),
          Fiber.join(callbackFiber).pipe(Effect.asVoid),
        );
        yield* browser.open(authorizationUrl).pipe(
          Effect.tapError(() => Fiber.interrupt(callbackFiber)),
        );
        const { code } = yield* Fiber.join(callbackFiber);
        const token = yield* Effect.tryPromise({
          try: () => requestToken(new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: oauthConfig.redirectUri.toString(),
            client_id: oauthConfig.clientId,
            code_verifier: pkce.verifier,
          })).then((received) => validateGrantedScopes(received, oauthConfig.scopes)),
          catch: (cause) => authError("exchange", "Linear authorization code exchange failed.", cause),
        });
        yield* secrets.set(SECRET_NAME, serializeToken(token));
        return sessionOf(token);
      }),
      logout: Effect.gen(function* () {
        const stored = yield* secrets.get(SECRET_NAME);
        if (stored !== null) {
          const token = yield* Effect.try({
            try: () => parseStoredToken(stored),
            catch: (cause) => authError("secret-store", "Stored credential is invalid", cause),
          });
          yield* Effect.tryPromise({
            try: async () => {
              const response = await fetch(REVOKE_ENDPOINT, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ token: token.refreshToken, token_type_hint: "refresh_token" }),
                redirect: "error",
                signal: AbortSignal.timeout(10_000),
              });
              if (![200, 400, 401].includes(response.status)) {
                throw new Error(`Linear revoke endpoint returned HTTP ${response.status}`);
              }
            },
            catch: (cause) => authError("exchange", "Could not revoke the Linear credential; it was kept locally so logout can be retried.", cause),
          });
        }
        yield* secrets.remove(SECRET_NAME);
      }),
      session: Effect.suspend(() => secrets.get(SECRET_NAME)).pipe(
        Effect.flatMap((stored) => stored === null
          ? Effect.succeed(null)
          : Effect.try({
            try: () => sessionOf(parseStoredToken(stored)),
            catch: (cause) => authError("secret-store", "Stored credential is invalid", cause),
          })),
      ),
      accessToken: Effect.gen(function* () {
        const oauthConfig = yield* oauth;
        const token = yield* loadToken;
        if (token.expiresAt > Date.now() + EXPIRY_SKEW_MS) return token.accessToken;
        const next = yield* refresh(token, oauthConfig);
        return next.accessToken;
      }),
    };
  }),
);
