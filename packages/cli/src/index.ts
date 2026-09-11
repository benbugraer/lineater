import { Args, Command, Options } from "@effect/cli";
import {
  IssueRepository,
  LinearService,
  LogService,
  TuiService,
  authenticate,
  createIssue as createIssueUseCase,
  getAuthSession,
  getStartupStatus,
  logout,
  syncInitialReadModel,
  updateIssue as updateIssueUseCase,
} from "@lineater/core";
import { Console, Effect, Option } from "effect";

const json = Options.boolean("json").pipe(
  Options.withDescription("Print machine-readable JSON to stdout."),
);
const offline = Options.boolean("offline").pipe(
  Options.withDescription("Read only from the local SQLite cache."),
);

const print = (value: unknown, asJson: boolean) => Console.log(
  asJson ? JSON.stringify(value) : String(value),
);

const root = Command.make("lineater", {}, () => Effect.gen(function* () {
  const tui = yield* TuiService;
  const log = yield* LogService;
  const status = yield* getStartupStatus;
  yield* log.info("app.tui.started", { cacheReady: status.cacheReady, cachedIssues: status.cachedIssueCount });
  yield* tui.run(status);
})).pipe(Command.withDescription("A fast, keyboard-first Linear client for the terminal."));

const authLogin = Command.make("login", {}, () => Effect.gen(function* () {
  const log = yield* LogService;
  yield* Console.log("Opening Linear authorization in your browser…");
  const identity = yield* authenticate;
  const model = yield* syncInitialReadModel;
  yield* log.info("auth.login.succeeded", { workspaceId: identity.workspace.id, viewerId: identity.viewer.id });
  yield* Console.log(`Connected to ${identity.workspace.name} as ${identity.viewer.displayName}.`);
  yield* Console.log(`Cached ${model.issues.length} recent issues, ${model.projects.length} projects, and ${model.cycles.length} cycles.`);
})).pipe(Command.withDescription("Authorize Lineater with Linear using OAuth 2.0 + PKCE."));

const authStatus = Command.make("status", { json }, ({ json }) => Effect.gen(function* () {
  const session = yield* getAuthSession;
  if (json) {
    yield* print(session ? { authenticated: true, scopes: session.scopes, expiresAt: session.expiresAt } : { authenticated: false }, true);
    return;
  }
  yield* Console.log(session
    ? `Authenticated · scopes: ${session.scopes.join(", ")} · access token expires: ${session.expiresAt.toISOString()}`
    : "Not authenticated. Run `lineater auth login`.");
})).pipe(Command.withDescription("Show local authentication status without printing credentials."));

const authLogout = Command.make("logout", {}, () => Effect.gen(function* () {
  const log = yield* LogService;
  yield* logout;
  yield* log.info("auth.logout.succeeded");
  yield* Console.log("Linear credentials were revoked and removed from the OS credential store.");
})).pipe(Command.withDescription("Revoke and remove the active Linear credential."));

const auth = Command.make("auth").pipe(
  Command.withDescription("Manage Linear authentication."),
  Command.withSubcommands([authLogin, authStatus, authLogout]),
);

const sync = Command.make("sync", { json }, ({ json }) => Effect.gen(function* () {
  const log = yield* LogService;
  const model = yield* syncInitialReadModel;
  yield* log.info("sync.initial.succeeded", {
    workspaceId: model.workspace.id,
    issues: model.issues.length,
    projects: model.projects.length,
    cycles: model.cycles.length,
  });
  const summary = {
    workspace: model.workspace.name,
    users: model.users.length,
    teams: model.teams.length,
    workflowStates: model.workflowStates.length,
    issues: model.issues.length,
    projects: model.projects.length,
    cycles: model.cycles.length,
    syncedAt: model.syncedAt,
  };
  yield* print(json ? summary : `Synced ${summary.issues} issues for ${summary.workspace}.`, json);
})).pipe(Command.withDescription("Refresh the first local read-model page from Linear."));

const viewer = Command.make("viewer", { json }, ({ json }) => Effect.gen(function* () {
  const linear = yield* LinearService;
  const result = yield* linear.viewer;
  yield* print(json ? result : `${result.viewer.displayName} <${result.viewer.email ?? "no email"}> · ${result.workspace.name}`, json);
})).pipe(Command.withDescription("Show the authenticated Linear user and workspace."));

const makeListCommand = <A>(
  name: string,
  description: string,
  load: (linear: LinearService["Type"]) => Effect.Effect<{ readonly items: readonly A[] }, unknown>,
  format: (item: A) => string,
) => Command.make(name, { json }, ({ json }) => Effect.gen(function* () {
  const linear = yield* LinearService;
  const result = yield* load(linear);
  yield* print(json ? result.items : result.items.map(format).join("\n"), json);
})).pipe(Command.withDescription(description));

const teams = makeListCommand("teams", "List the first page of accessible teams.", (linear) => linear.teams(), (team) => `${team.key}\t${team.name}`);
const issues = Command.make("issues", { json, offline }, ({ json, offline }) => Effect.gen(function* () {
  const items = offline
    ? yield* IssueRepository.pipe(Effect.flatMap((repository) => repository.list(50)))
    : (yield* LinearService.pipe(Effect.flatMap((linear) => linear.issues()))).items;
  yield* print(json ? items : items.map((issue) => `${issue.identifier}\t${issue.title}`).join("\n"), json);
})).pipe(Command.withDescription("List recently updated issues from Linear or the explicit offline cache."));
const projects = makeListCommand("projects", "List recently updated projects.", (linear) => linear.projects(), (project) => `${project.state}\t${project.name}`);
const cycles = makeListCommand("cycles", "List recently updated cycles.", (linear) => linear.cycles(), (cycle) => `${cycle.number}\t${cycle.name ?? `Cycle ${cycle.number}`}`);
const states = makeListCommand("states", "List accessible workflow states.", (linear) => linear.workflowStates(), (state) => `${state.type}\t${state.name}`);

const createTitle = Args.text({ name: "title" }).pipe(Args.withDescription("Issue title."));
const teamOption = Options.text("team").pipe(Options.withDescription("Linear team UUID."));
const descriptionOption = Options.text("description").pipe(Options.optional);
const stateOption = Options.text("state").pipe(Options.optional);
const priorityOption = Options.integer("priority").pipe(Options.optional);
const assigneeOption = Options.text("assignee").pipe(Options.optional);
const labelsOption = Options.text("labels").pipe(Options.optional);
const projectOption = Options.text("project").pipe(Options.optional);
const cycleOption = Options.text("cycle").pipe(Options.optional);

const create = Command.make("create", {
  title: createTitle, team: teamOption, description: descriptionOption, state: stateOption,
  priority: priorityOption, assignee: assigneeOption, labels: labelsOption, project: projectOption,
  cycle: cycleOption, json,
}, (input) => Effect.gen(function* () {
  const created = yield* createIssueUseCase({
    teamId: input.team,
    title: input.title,
    description: Option.getOrUndefined(input.description),
    stateId: Option.getOrUndefined(input.state),
    priority: Option.getOrUndefined(input.priority),
    assigneeId: Option.getOrUndefined(input.assignee),
    labelIds: Option.match(input.labels, { onNone: () => undefined, onSome: (value) => value.split(",").map((id) => id.trim()).filter(Boolean) }),
    projectId: Option.getOrUndefined(input.project),
    cycleId: Option.getOrUndefined(input.cycle),
  });
  yield* print(input.json ? created : `${created.identifier} · ${created.title}`, input.json);
})).pipe(Command.withDescription("Create an issue using the same mutation use case as the TUI."));

const issueIdentifier = Args.text({ name: "identifier" }).pipe(Args.withDescription("Linear issue identifier, for example ENG-123."));
const update = Command.make("update", {
  identifier: issueIdentifier,
  title: Options.text("title").pipe(Options.optional),
  description: descriptionOption,
  state: stateOption,
  priority: priorityOption,
  assignee: assigneeOption,
  labels: labelsOption,
  project: projectOption,
  cycle: cycleOption,
  json,
}, (input) => Effect.gen(function* () {
  const linear = yield* LinearService;
  const original = yield* linear.issue(input.identifier.toUpperCase());
  if (!original) return yield* Effect.fail(new Error(`Issue ${input.identifier} was not found.`));
  const updated = yield* updateIssueUseCase(original, {
    title: Option.getOrUndefined(input.title),
    description: Option.getOrUndefined(input.description),
    stateId: Option.getOrUndefined(input.state),
    priority: Option.getOrUndefined(input.priority),
    assigneeId: Option.match(input.assignee, { onNone: () => undefined, onSome: (value) => value === "none" ? null : value }),
    labelIds: Option.match(input.labels, { onNone: () => undefined, onSome: (value) => value ? value.split(",").map((id) => id.trim()).filter(Boolean) : [] }),
    projectId: Option.match(input.project, { onNone: () => undefined, onSome: (value) => value === "none" ? null : value }),
    cycleId: Option.match(input.cycle, { onNone: () => undefined, onSome: (value) => value === "none" ? null : value }),
  });
  yield* print(input.json ? updated : `${updated.identifier} · ${updated.title}`, input.json);
})).pipe(Command.withDescription("Update issue fields. Use 'none' to clear assignee, project, or cycle."));

const issue = Command.make("issue", { identifier: issueIdentifier, json, offline }, ({ identifier, json, offline }) => Effect.gen(function* () {
  const normalizedIdentifier = identifier.toUpperCase();
  const result = offline
    ? yield* IssueRepository.pipe(Effect.flatMap((repository) => repository.findByIdentifier(normalizedIdentifier)))
    : yield* LinearService.pipe(Effect.flatMap((linear) => linear.issue(normalizedIdentifier)));
  if (!result) {
    yield* Console.error(`Issue ${identifier} was not found.`);
    return;
  }
  yield* print(json ? result : `${result.identifier} · ${result.title}\n${result.description ?? "No description."}`, json);
})).pipe(Command.withDescription("Fetch one issue by identifier."));

export const lineaterCommand = root.pipe(
  Command.withSubcommands([auth, sync, viewer, teams, states, issues, issue, create, update, projects, cycles]),
);
