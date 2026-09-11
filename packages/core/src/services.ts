import { Context, type Effect } from "effect";
import type {
  AppPreferences,
  AuthenticatedIdentity,
  AuthSession,
  Comment,
  CreateIssueInput,
  Cycle,
  InitialReadModel,
  Issue,
  Label,
  Page,
  Project,
  Team,
  UpdateIssueInput,
  User,
  WorkflowState,
  Workspace,
} from "./domain";
import type { AuthError, ConfigError, LinearApiError, StorageError, TuiError } from "./errors";

export interface CacheHealth {
  readonly ready: boolean;
  readonly journalMode: "wal";
  readonly foreignKeys: true;
}

export interface CacheServiceShape {
  readonly healthCheck: Effect.Effect<CacheHealth, StorageError>;
}
export class CacheService extends Context.Tag("@lineater/core/CacheService")<CacheService, CacheServiceShape>() {}

export interface IssueRepositoryShape {
  readonly count: Effect.Effect<number, StorageError>;
  readonly findByIdentifier: (identifier: string) => Effect.Effect<Issue | null, StorageError>;
  readonly list: (limit: number) => Effect.Effect<readonly Issue[], StorageError>;
  readonly save: (issue: Issue) => Effect.Effect<void, StorageError>;
  readonly updateState: (issueId: string, stateId: string) => Effect.Effect<void, StorageError>;
}
export class IssueRepository extends Context.Tag("@lineater/core/IssueRepository")<IssueRepository, IssueRepositoryShape>() {}

export interface CommentRepositoryShape {
  readonly listByIssue: (issueId: string) => Effect.Effect<readonly Comment[], StorageError>;
  readonly save: (comment: Comment) => Effect.Effect<void, StorageError>;
}
export class CommentRepository extends Context.Tag("@lineater/core/CommentRepository")<CommentRepository, CommentRepositoryShape>() {}

export interface ReadModelRepositoryShape {
  readonly saveIdentity: (identity: AuthenticatedIdentity) => Effect.Effect<void, StorageError>;
  readonly saveInitialReadModel: (model: InitialReadModel) => Effect.Effect<void, StorageError>;
  readonly loadInitialReadModel: Effect.Effect<InitialReadModel | null, StorageError>;
}
export class ReadModelRepository extends Context.Tag("@lineater/core/ReadModelRepository")<ReadModelRepository, ReadModelRepositoryShape>() {}

export interface AuthServiceShape {
  readonly login: Effect.Effect<AuthSession, AuthError>;
  readonly logout: Effect.Effect<void, AuthError>;
  readonly session: Effect.Effect<AuthSession | null, AuthError>;
  readonly accessToken: Effect.Effect<string, AuthError>;
}
export class AuthService extends Context.Tag("@lineater/core/AuthService")<AuthService, AuthServiceShape>() {}

export interface BrowserServiceShape {
  readonly open: (url: URL) => Effect.Effect<void, AuthError>;
}
export class BrowserService extends Context.Tag("@lineater/core/BrowserService")<BrowserService, BrowserServiceShape>() {}

export interface SecretStoreShape {
  readonly get: (name: string) => Effect.Effect<string | null, AuthError>;
  readonly set: (name: string, value: string) => Effect.Effect<void, AuthError>;
  readonly remove: (name: string) => Effect.Effect<void, AuthError>;
}
export class SecretStore extends Context.Tag("@lineater/core/SecretStore")<SecretStore, SecretStoreShape>() {}

export interface LinearServiceShape {
  readonly viewer: Effect.Effect<{ readonly workspace: Workspace; readonly viewer: User }, LinearApiError | AuthError>;
  readonly users: (after?: string) => Effect.Effect<Page<User>, LinearApiError | AuthError>;
  readonly teams: (after?: string) => Effect.Effect<Page<Team>, LinearApiError | AuthError>;
  readonly workflowStates: (after?: string) => Effect.Effect<Page<WorkflowState>, LinearApiError | AuthError>;
  readonly issues: (after?: string) => Effect.Effect<Page<Issue>, LinearApiError | AuthError>;
  readonly issue: (identifier: string) => Effect.Effect<Issue | null, LinearApiError | AuthError>;
  readonly projects: (after?: string) => Effect.Effect<Page<Project>, LinearApiError | AuthError>;
  readonly cycles: (after?: string) => Effect.Effect<Page<Cycle>, LinearApiError | AuthError>;
  readonly labels: (after?: string) => Effect.Effect<Page<Label>, LinearApiError | AuthError>;
  readonly comments: (issueId: string, after?: string) => Effect.Effect<Page<Comment>, LinearApiError | AuthError>;
  readonly createComment: (issueId: string, body: string) => Effect.Effect<Comment, LinearApiError | AuthError>;
  readonly createIssue: (input: CreateIssueInput) => Effect.Effect<Issue, LinearApiError | AuthError>;
  readonly updateIssue: (issueId: string, input: UpdateIssueInput) => Effect.Effect<Issue, LinearApiError | AuthError>;
  readonly changeIssueStatus: (issueId: string, stateId: string) => Effect.Effect<Issue, LinearApiError | AuthError>;
  readonly initialReadModel: Effect.Effect<InitialReadModel, LinearApiError | AuthError>;
}
export class LinearService extends Context.Tag("@lineater/core/LinearService")<LinearService, LinearServiceShape>() {}

export interface PreferencesServiceShape {
  readonly load: Effect.Effect<AppPreferences, ConfigError>;
  readonly save: (preferences: AppPreferences) => Effect.Effect<void, ConfigError>;
}
export class PreferencesService extends Context.Tag("@lineater/core/PreferencesService")<PreferencesService, PreferencesServiceShape>() {}

export interface LogServiceShape {
  readonly info: (event: string, fields?: Readonly<Record<string, string | number | boolean>>) => Effect.Effect<void>;
  readonly error: (event: string, fields?: Readonly<Record<string, string | number | boolean>>) => Effect.Effect<void>;
}
export class LogService extends Context.Tag("@lineater/core/LogService")<LogService, LogServiceShape>() {}

export interface StartupStatus {
  readonly cacheReady: boolean;
  readonly cachedIssueCount: number;
}

export interface TuiServiceShape {
  readonly run: (status: StartupStatus) => Effect.Effect<void, TuiError>;
}
export class TuiService extends Context.Tag("@lineater/core/TuiService")<TuiService, TuiServiceShape>() {}
