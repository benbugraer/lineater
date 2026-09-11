import { Data } from "effect";

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly operation: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class AuthError extends Data.TaggedError("AuthError")<{
  readonly reason: "configuration" | "browser" | "callback" | "denied" | "exchange" | "secret-store" | "not-authenticated" | "expired";
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class LinearApiError extends Data.TaggedError("LinearApiError")<{
  readonly reason: "network" | "graphql" | "authentication" | "permission" | "rate-limit" | "invalid-response";
  readonly message: string;
  readonly retryAt?: Date;
  readonly cause?: unknown;
}> {}

export class IssueInputError extends Data.TaggedError("IssueInputError")<{
  readonly field: "teamId" | "title" | "description" | "priority" | "stateId" | "assigneeId" | "labelIds";
  readonly message: string;
}> {}

export class TuiError extends Data.TaggedError("TuiError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
