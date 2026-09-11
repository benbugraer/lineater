import {
  AuthService,
  LinearApiError,
  LinearService,
  type IssueQuery,
  type Page,
} from "@lineater/core";
import {
  AuthenticationLinearError,
  ForbiddenLinearError,
  LinearClient,
  LinearError,
  NetworkLinearError,
  PaginationOrderBy,
  RatelimitedLinearError,
  type Connection,
} from "@linear/sdk";
import { Effect, Layer } from "effect";
import {
  mapComment,
  mapCycle,
  mapIssue,
  mapLabel,
  mapProject,
  mapTeam,
  mapUser,
  mapWorkflowState,
  mapWorkspace,
} from "./mappers";

const PAGE_SIZE = 50;

export const mapLinearError = (cause: unknown): LinearApiError => {
  if (cause instanceof RatelimitedLinearError) {
    const retryAt = cause.requestsResetAt ? new Date(cause.requestsResetAt) : undefined;
    return new LinearApiError({ reason: "rate-limit", message: "Linear rate limit reached. Try again after the reset time.", retryAt, cause });
  }
  if (cause instanceof AuthenticationLinearError) {
    return new LinearApiError({ reason: "authentication", message: "Linear rejected the session. Run `lineater auth login` again.", cause });
  }
  if (cause instanceof ForbiddenLinearError) {
    return new LinearApiError({ reason: "permission", message: "The connected Linear account does not have permission for this data.", cause });
  }
  if (cause instanceof NetworkLinearError) {
    return new LinearApiError({ reason: "network", message: "Could not connect to Linear. Cached data remains available.", cause });
  }
  if (cause instanceof LinearError) {
    return new LinearApiError({ reason: "graphql", message: cause.message || "Linear returned a GraphQL error.", cause });
  }
  return new LinearApiError({
    reason: "invalid-response",
    message: "Linear returned an invalid response.",
    cause,
  });
};

export const retryLinearRead = <A>(effect: Effect.Effect<A, LinearApiError>, attempt = 0): Effect.Effect<A, LinearApiError> =>
  effect.pipe(Effect.catchAll((error) => {
    if (error.reason !== "network" || attempt >= 2) return Effect.fail(error);
    const delayMs = 250 * (2 ** attempt) + Math.floor(Math.random() * 150);
    return Effect.sleep(`${delayMs} millis`).pipe(Effect.andThen(retryLinearRead(effect, attempt + 1)));
  }));

export const makeIssueFilter = (query: IssueQuery | undefined) => query ? ({
  ...(query.teamId ? { team: { id: { eq: query.teamId } } } : {}),
  ...(query.stateId ? { state: { id: { eq: query.stateId } } } : {}),
  ...(query.projectId ? { project: { id: { eq: query.projectId } } } : {}),
  ...(query.cycleId ? { cycle: { id: { eq: query.cycleId } } } : {}),
  ...(query.assigneeId ? { assignee: { id: { eq: query.assigneeId } } } : {}),
  ...(query.priority !== undefined ? { priority: { eq: query.priority } } : {}),
  ...(query.labelId ? { labels: { some: { id: { eq: query.labelId } } } } : {}),
}) : undefined;

const page = <Source, Target>(connection: Connection<Source>, map: (source: Source) => Target): Page<Target> => ({
  items: connection.nodes.map(map),
  endCursor: connection.pageInfo.endCursor ?? null,
  hasNextPage: connection.pageInfo.hasNextPage,
});

export const LinearLive = Layer.effect(
  LinearService,
  Effect.gen(function* () {
    const auth = yield* AuthService;

    const requestWithToken = <A>(accessToken: string, run: (client: LinearClient) => Promise<A>) => Effect.tryPromise({
      try: () => run(new LinearClient({ accessToken, signal: AbortSignal.timeout(20_000) })),
      catch: mapLinearError,
    });
    const requestWithClient = <A>(run: (client: LinearClient) => Promise<A>) => auth.accessToken.pipe(
      Effect.flatMap((accessToken) => requestWithToken(accessToken, run)),
    );
    const withClient = <A>(run: (client: LinearClient) => Promise<A>) => auth.accessToken.pipe(
      Effect.flatMap((accessToken) => retryLinearRead(requestWithToken(accessToken, run))),
    );

    const viewer = withClient(async (client) => {
      const sdkViewer = await client.viewer;
      const organization = await sdkViewer.organization;
      const workspace = mapWorkspace(organization);
      return { workspace, viewer: mapUser(sdkViewer, workspace.id) };
    });

    const users = (after?: string) => withClient(async (client) => {
      const organization = await client.organization;
      const connection = await client.users({ first: PAGE_SIZE, after: after ?? null });
      return page(connection, (user) => mapUser(user, organization.id));
    });

    const teams = (after?: string) => withClient(async (client) => {
      const organization = await client.organization;
      const connection = await client.teams({ first: PAGE_SIZE, after: after ?? null });
      return page(connection, (team) => mapTeam(team, organization.id));
    });

    const workflowStates = (after?: string) => withClient(async (client) =>
      page(await client.workflowStates({ first: PAGE_SIZE, after: after ?? null }), mapWorkflowState));

    const issues = (after?: string, query?: IssueQuery) => withClient(async (client) =>
      page(await client.issues({ first: PAGE_SIZE, after: after ?? null, orderBy: PaginationOrderBy.UpdatedAt, filter: makeIssueFilter(query) }), mapIssue));

    const updatedIssues = (since: Date, after?: string) => withClient(async (client) =>
      page(await client.issues({
        first: PAGE_SIZE,
        after: after ?? null,
        includeArchived: true,
        orderBy: PaginationOrderBy.UpdatedAt,
        filter: { updatedAt: { gte: since.toISOString() } },
      }), mapIssue));

    const projects = (after?: string) => withClient(async (client) => {
      const organization = await client.organization;
      const connection = await client.projects({ first: PAGE_SIZE, after: after ?? null, orderBy: PaginationOrderBy.UpdatedAt });
      return page(connection, (project) => mapProject(project, organization.id));
    });

    const cycles = (after?: string) => withClient(async (client) =>
      page(await client.cycles({ first: PAGE_SIZE, after: after ?? null, orderBy: PaginationOrderBy.UpdatedAt }), mapCycle));

    const labels = (after?: string) => withClient(async (client) => {
      const organization = await client.organization;
      return page(await client.issueLabels({ first: PAGE_SIZE, after: after ?? null }), (label) => mapLabel(label, organization.id));
    });

    const comments = (issueId: string, after?: string) => withClient(async (client) => {
      const issue = await client.issue(issueId);
      return page(await issue.comments({ first: PAGE_SIZE, after: after ?? null, orderBy: PaginationOrderBy.CreatedAt }), mapComment);
    });

    const allPages = <A>(load: (after?: string) => Effect.Effect<Page<A>, import("@lineater/core").LinearApiError | import("@lineater/core").AuthError>) =>
      Effect.gen(function* () {
        const items: A[] = [];
        let after: string | undefined;
        for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
          const result = yield* load(after);
          items.push(...result.items);
          if (!result.hasNextPage || !result.endCursor) return items as readonly A[];
          after = result.endCursor;
        }
        return yield* Effect.fail(new LinearApiError({ reason: "invalid-response", message: "Linear pagination exceeded the safety limit." }));
      });

    return {
      viewer,
      users,
      teams,
      workflowStates,
      issues,
      updatedIssues,
      issue: (identifier) => withClient(async (client) => {
        try {
          return mapIssue(await client.issue(identifier));
        } catch (cause) {
          if (cause instanceof LinearError && cause.status === 404) return null;
          throw cause;
        }
      }),
      projects,
      cycles,
      labels,
      comments,
      createComment: (issueId, body) => requestWithClient(async (client) => {
        const payload = await client.createComment({ issueId, body });
        const created = payload.comment ? await payload.comment : undefined;
        if (!payload.success || !created) throw new Error("Linear did not return the created comment");
        return mapComment(created);
      }),
      createIssue: (input) => requestWithClient(async (client) => {
        const payload = await client.createIssue({ ...input, labelIds: input.labelIds ? [...input.labelIds] : undefined });
        const created = payload.issue ? await payload.issue : undefined;
        if (!payload.success || !created) throw new Error("Linear did not return the created issue");
        return mapIssue(created);
      }),
      updateIssue: (issueId, input) => requestWithClient(async (client) => {
        const payload = await client.updateIssue(issueId, { ...input, labelIds: input.labelIds ? [...input.labelIds] : undefined });
        const updated = payload.issue ? await payload.issue : undefined;
        if (!payload.success || !updated) throw new Error("Linear did not return the updated issue");
        return mapIssue(updated);
      }),
      changeIssueStatus: (issueId, stateId) => requestWithClient(async (client) => {
        const payload = await client.updateIssue(issueId, { stateId });
        const updated = payload.issue ? await payload.issue : undefined;
        if (!payload.success || !updated) throw new Error("Linear did not return the updated issue");
        return mapIssue(updated);
      }),
      initialReadModel: Effect.gen(function* () {
        const identity = yield* viewer;
        const [allUsers, allTeams, allStates, issuePage, allLabels, projectPage, cyclePage] = yield* Effect.all([
          allPages(users),
          allPages(teams),
          allPages(workflowStates),
          issues(),
          allPages(labels),
          projects(),
          cycles(),
        ], { concurrency: 3 });

        return {
          ...identity,
          users: allUsers,
          teams: allTeams,
          workflowStates: allStates,
          issues: issuePage.items,
          labels: allLabels,
          projects: projectPage.items,
          cycles: cyclePage.items,
          syncedAt: new Date(),
        };
      }),
    };
  }),
);
