import {
  type AppPreferences,
  ConfigError,
  LogService,
  PreferencesService,
} from "@lineater/core";
import { Context, Effect, Layer } from "effect";
import {
  appendFile,
  chmod,
  lstat,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

export interface AppPaths {
  readonly configDirectory: string;
  readonly dataDirectory: string;
  readonly stateDirectory: string;
  readonly configPath: string;
  readonly databasePath: string;
  readonly logPath: string;
}

export interface OAuthConfig {
  readonly clientId: string;
  readonly redirectUri: URL;
  readonly scopes: readonly string[];
  readonly callbackTimeoutMs: number;
}

export interface AppConfig {
  readonly paths: AppPaths;
  readonly oauth: OAuthConfig | null;
  readonly preferences: AppPreferences;
}

export interface ConfigServiceShape extends AppConfig {}
export class ConfigService extends Context.Tag(
  "@lineater/config/ConfigService",
)<ConfigService, ConfigServiceShape>() {}

interface ConfigFile {
  readonly linearClientId?: string;
  readonly linearRedirectUri?: string;
  readonly linearScopes?: readonly string[];
  readonly theme?: string;
  readonly defaultView?: "list" | "board";
  readonly autoSync?: boolean;
  readonly keybindings?: Readonly<Record<string, string>>;
}

declare const LINEATER_PACKAGED_LINEAR_CLIENT_ID: string | undefined;

const packagedLinearClientId = typeof LINEATER_PACKAGED_LINEAR_CLIENT_ID === "string"
  ? LINEATER_PACKAGED_LINEAR_CLIENT_ID.trim()
  : undefined;

const reservedOAuthClientIds = new Set([
  "your-client-id",
  "your-public-client-id",
  "public-oauth-client-id",
  "gercek_linear_client_id",
  "example-client-id",
]);

const isReservedOAuthClientId = (clientId: string): boolean => {
  const normalized = clientId.trim().toLowerCase();
  return reservedOAuthClientIds.has(normalized)
    || /^(your|gercek|example|placeholder|sample|changeme)[-_]/i.test(clientId)
    || /placeholder|example[-_]?client|your[-_]?public/i.test(clientId);
};

const allowedScopes = new Set([
  "read",
  "write",
  "issues:create",
  "comments:create",
]);
const resolveHome = (
  environment: Readonly<Record<string, string | undefined>>,
): string => environment.HOME ?? environment.USERPROFILE ?? ".";

export const makeAppPaths = (
  environment: Readonly<Record<string, string | undefined>>,
): AppPaths => {
  const home = resolveHome(environment);
  const configDirectory =
    environment.LINEATER_CONFIG_DIR ??
    join(environment.XDG_CONFIG_HOME ?? join(home, ".config"), "lineater");
  const dataDirectory =
    environment.LINEATER_DATA_DIR ??
    join(
      environment.XDG_DATA_HOME ?? join(home, ".local", "share"),
      "lineater",
    );
  const stateDirectory =
    environment.LINEATER_STATE_DIR ??
    join(
      environment.XDG_STATE_HOME ?? join(home, ".local", "state"),
      "lineater",
    );

  return {
    configDirectory,
    dataDirectory,
    stateDirectory,
    configPath:
      environment.LINEATER_CONFIG_PATH ?? join(configDirectory, "config.json"),
    databasePath:
      environment.LINEATER_DATABASE_PATH ?? join(dataDirectory, "lineater.db"),
    logPath:
      environment.LINEATER_LOG_PATH ?? join(stateDirectory, "lineater.log"),
  };
};

const readConfigFile = async (path: string): Promise<ConfigFile> => {
  const file = Bun.file(path);
  if (!(await file.exists())) return {};
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("Config path must be a regular file, not a symbolic link");
  if (file.size > 1_048_576)
    throw new Error("Config file exceeds the 1 MiB size limit");
  const value: unknown = await file.json();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Config file must contain a JSON object");
  }
  const record = Object.fromEntries(Object.entries(value));
  const forbiddenKeys = Object.keys(record).filter((key) => /(?:^|[_-])(access|refresh)?token|secret|api[_-]?key/i.test(key));
  if (forbiddenKeys.length > 0) throw new Error("Secrets and tokens are not allowed in the Lineater config file");
  const linearClientId = record.linearClientId;
  const linearRedirectUri = record.linearRedirectUri;
  const linearScopes = record.linearScopes;
  const theme = record.theme;
  const defaultView = record.defaultView;
  const autoSync = record.autoSync;
  const keybindings = record.keybindings;
  if (linearClientId !== undefined && typeof linearClientId !== "string")
    throw new Error("linearClientId must be a string");
  if (linearRedirectUri !== undefined && typeof linearRedirectUri !== "string")
    throw new Error("linearRedirectUri must be a string");
  if (
    linearScopes !== undefined &&
    (!Array.isArray(linearScopes) ||
      !linearScopes.every((scope) => typeof scope === "string"))
  ) {
    throw new Error("linearScopes must be an array of strings");
  }
  if (theme !== undefined && typeof theme !== "string")
    throw new Error("theme must be a string");
  if (
    defaultView !== undefined &&
    defaultView !== "list" &&
    defaultView !== "board"
  )
    throw new Error("defaultView must be list or board");
  if (autoSync !== undefined && typeof autoSync !== "boolean")
    throw new Error("autoSync must be a boolean");
  if (
    keybindings !== undefined &&
    (typeof keybindings !== "object" ||
      keybindings === null ||
      Array.isArray(keybindings) ||
      Object.entries(keybindings).length > 64 ||
      Object.entries(keybindings).some(
        ([command, key]) =>
          !command ||
          command.length > 80 ||
          typeof key !== "string" ||
          !key.trim() ||
          key.length > 32,
      ))
  )
    throw new Error(
      "keybindings must be an object of command names to key expressions",
    );
  return {
    linearClientId,
    linearRedirectUri,
    linearScopes,
    theme,
    defaultView,
    autoSync,
    keybindings: keybindings as Readonly<Record<string, string>> | undefined,
  };
};

export const makeOAuthConfig = (
  environment: Readonly<Record<string, string | undefined>>,
  file: ConfigFile,
  packagedClientId: string | undefined = packagedLinearClientId,
): OAuthConfig | null => {
  const clientId = (environment.LINEATER_LINEAR_CLIENT_ID ?? file.linearClientId ?? packagedClientId)?.trim();
  if (!clientId) return null;
  if (clientId.length < 8 || clientId.length > 256 || !/^[A-Za-z0-9._~-]+$/.test(clientId)) {
    throw new Error("Linear OAuth client ID has an invalid format");
  }
  if (isReservedOAuthClientId(clientId)) {
    throw new Error("Linear OAuth client ID looks like a documentation placeholder. Use the public client ID from Linear API settings.");
  }

  const redirectUri = new URL(
    environment.LINEATER_LINEAR_REDIRECT_URI ??
      file.linearRedirectUri ??
      "http://127.0.0.1:45432/oauth/callback",
  );
  const isLoopback =
    redirectUri.hostname === "127.0.0.1" ||
    redirectUri.hostname === "localhost" ||
    redirectUri.hostname === "[::1]";
  if (
    redirectUri.protocol !== "http:" ||
    !isLoopback ||
    redirectUri.username ||
    redirectUri.password ||
    redirectUri.search ||
    redirectUri.hash
  ) {
    throw new Error(
      "OAuth redirect URI must be a plain HTTP loopback URL without credentials, query parameters, or fragments",
    );
  }
  if (!redirectUri.port)
    throw new Error(
      "OAuth redirect URI must include a fixed port registered in Linear",
    );

  const scopes = (
    environment.LINEATER_LINEAR_SCOPES?.split(",") ??
    file.linearScopes ?? ["read", "write"]
  )
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (!scopes.includes("read")) scopes.unshift("read");
  const unsupported = scopes.filter((scope) => !allowedScopes.has(scope));
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported or over-privileged OAuth scope: ${unsupported.join(", ")}`,
    );
  }

  return {
    clientId,
    redirectUri,
    scopes: [...new Set(scopes)],
    callbackTimeoutMs: 5 * 60 * 1000,
  };
};

export const defaultPreferences: AppPreferences = {
  theme: "linear",
  defaultView: "list",
  autoSync: true,
  keybindings: {},
};

const preferencesFromFile = (file: ConfigFile): AppPreferences => ({
  theme: file.theme?.trim() || defaultPreferences.theme,
  defaultView: file.defaultView ?? defaultPreferences.defaultView,
  autoSync: file.autoSync ?? defaultPreferences.autoSync,
  keybindings: file.keybindings ?? defaultPreferences.keybindings,
});

export const ConfigLive = Layer.effect(
  ConfigService,
  Effect.tryPromise({
    try: async () => {
      const paths = makeAppPaths(Bun.env);
      const file = await readConfigFile(paths.configPath);
      return {
        paths,
        oauth: makeOAuthConfig(Bun.env, file),
        preferences: preferencesFromFile(file),
      };
    },
    catch: (cause) =>
      new ConfigError({
        message:
          cause instanceof Error
            ? cause.message
            : "Unable to load Lineater configuration",
        cause,
      }),
  }),
);

export const PreferencesLive = Layer.effect(
  PreferencesService,
  ConfigService.pipe(
    Effect.map(({ paths, preferences }) => ({
      load: Effect.succeed(preferences),
      save: (next: AppPreferences) =>
        Effect.tryPromise({
          try: async () => {
            const current = await readConfigFile(paths.configPath);
            const payload: ConfigFile = {
              ...(current.linearClientId ? { linearClientId: current.linearClientId } : {}),
              ...(current.linearRedirectUri ? { linearRedirectUri: current.linearRedirectUri } : {}),
              ...(current.linearScopes ? { linearScopes: current.linearScopes } : {}),
              theme: next.theme,
              defaultView: next.defaultView,
              autoSync: next.autoSync,
              keybindings: next.keybindings,
            };
            await mkdir(dirname(paths.configPath), {
              recursive: true,
              mode: 0o700,
            });
            const temporaryPath = `${paths.configPath}.${crypto.randomUUID()}.tmp`;
            try {
              await writeFile(
                temporaryPath,
                `${JSON.stringify(payload, null, 2)}\n`,
                { mode: 0o600, flag: "wx" },
              );
              await chmod(temporaryPath, 0o600);
              await rename(temporaryPath, paths.configPath);
              await chmod(paths.configPath, 0o600);
            } finally {
              await rm(temporaryPath, { force: true });
            }
          },
          catch: (cause) =>
            new ConfigError({
              message:
                cause instanceof Error
                  ? cause.message
                  : "Unable to save Lineater preferences",
              cause,
            }),
        }),
    })),
  ),
);

export const makeFileLogLayer = (logPath: string) =>
  Layer.succeed(LogService, {
    info: (event, fields = {}) => writeLog(logPath, "info", event, fields),
    error: (event, fields = {}) => writeLog(logPath, "error", event, fields),
  });

const writeLog = (
  path: string,
  level: "info" | "error",
  event: string,
  fields: Readonly<Record<string, string | number | boolean>>,
): Effect.Effect<void> =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await appendFile(
        path,
        `${JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields })}\n`,
        { mode: 0o600 },
      );
      await chmod(path, 0o600);
    },
    catch: () => undefined,
  }).pipe(Effect.ignore);
