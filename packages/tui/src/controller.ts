import type { AppPreferences, AuthSession, Comment, CreateIssueInput, InitialReadModel, Issue, UpdateIssueInput } from "@lineater/core";

export interface TuiBootstrap {
  readonly session: AuthSession | null;
  readonly cachedModel: InitialReadModel | null;
}

export interface TuiController {
  readonly bootstrap: () => Promise<TuiBootstrap>;
  readonly loadPreferences: () => Promise<AppPreferences>;
  readonly savePreferences: (preferences: AppPreferences) => Promise<void>;
  readonly authorize: () => Promise<InitialReadModel>;
  readonly sync: () => Promise<InitialReadModel>;
  readonly syncIncremental: () => Promise<InitialReadModel>;
  readonly createIssue: (input: CreateIssueInput) => Promise<Issue>;
  readonly updateIssue: (issue: Issue, input: UpdateIssueInput) => Promise<Issue>;
  readonly loadComments: (issueId: string) => Promise<readonly Comment[]>;
  readonly addComment: (issueId: string, body: string) => Promise<Comment>;
  readonly editText: (initial: string, name: string) => Promise<string | null>;
  readonly copyIssueIdentifier: (issue: Issue) => Promise<void>;
  readonly openIssueInBrowser: (issue: Issue) => Promise<void>;
  readonly changeIssueStatus: (issue: Issue, stateId: string) => Promise<Issue>;
  readonly dispose: () => void;
}
