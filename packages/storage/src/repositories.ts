import {
  CommentRepository,
  IssueRepository,
  ReadModelRepository,
  StorageError,
  type AuthenticatedIdentity,
  type Comment,
  type InitialReadModel,
  type Issue,
} from "@lineater/core";
import { desc, eq, inArray, ne, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { StorageConnection, type StorageConnectionShape } from "./database";
import {
  comments,
  cycles,
  issueLabels,
  issues,
  labels,
  projects,
  syncState,
  teams,
  users,
  workflowStates,
  workspaces,
} from "./schema";

const storageError = (operation: string, cause: unknown) => new StorageError({
  operation,
  message: cause instanceof Error ? cause.message : "Unknown storage failure",
  cause,
});

const issueFromRow = (row: typeof issues.$inferSelect, labelIds: readonly string[] = []): Issue => ({
  id: row.id,
  teamId: row.teamId,
  identifier: row.identifier,
  number: row.number,
  title: row.title,
  description: row.description,
  priority: row.priority,
  stateId: row.stateId,
  assigneeId: row.assigneeId,
  projectId: row.projectId,
  cycleId: row.cycleId,
  labelIds,
  sortOrder: row.sortOrder,
  completedAt: row.completedAt,
  canceledAt: row.canceledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const issueRow = (issue: Issue): typeof issues.$inferInsert => ({
  id: issue.id,
  teamId: issue.teamId,
  identifier: issue.identifier,
  number: issue.number,
  title: issue.title,
  description: issue.description,
  priority: issue.priority,
  stateId: issue.stateId,
  assigneeId: issue.assigneeId,
  projectId: issue.projectId,
  cycleId: issue.cycleId,
  sortOrder: issue.sortOrder,
  completedAt: issue.completedAt,
  canceledAt: issue.canceledAt,
  createdAt: issue.createdAt,
  updatedAt: issue.updatedAt,
});

const saveIssue = (db: StorageConnectionShape["db"], issue: Issue): void => {
  db.transaction((tx) => {
    tx.insert(issues).values(issueRow(issue)).onConflictDoUpdate({
      target: issues.id,
      set: {
        teamId: issue.teamId, identifier: issue.identifier, number: issue.number, title: issue.title,
        description: issue.description, priority: issue.priority, stateId: issue.stateId, assigneeId: issue.assigneeId,
        projectId: issue.projectId, cycleId: issue.cycleId, sortOrder: issue.sortOrder, completedAt: issue.completedAt,
        canceledAt: issue.canceledAt, updatedAt: issue.updatedAt,
      },
    }).run();
    tx.delete(issueLabels).where(eq(issueLabels.issueId, issue.id)).run();
    if (issue.labelIds.length > 0) {
      const cachedLabelIds = new Set(tx.select({ id: labels.id }).from(labels).where(inArray(labels.id, [...issue.labelIds])).all().map(({ id }) => id));
      const relations = issue.labelIds.filter((labelId) => cachedLabelIds.has(labelId)).map((labelId) => ({ issueId: issue.id, labelId }));
      if (relations.length > 0) tx.insert(issueLabels).values(relations).run();
    }
  });
};

const saveIdentity = (
  db: StorageConnectionShape["db"],
  identity: AuthenticatedIdentity,
): void => {
  db.transaction((tx) => {
    tx.insert(workspaces).values(identity.workspace).onConflictDoUpdate({
      target: workspaces.id,
      set: {
        name: identity.workspace.name,
        urlKey: identity.workspace.urlKey,
        updatedAt: identity.workspace.updatedAt,
      },
    }).run();
    tx.insert(users).values(identity.viewer).onConflictDoUpdate({
      target: users.id,
      set: {
        workspaceId: identity.viewer.workspaceId,
        name: identity.viewer.name,
        displayName: identity.viewer.displayName,
        email: identity.viewer.email,
        avatarUrl: identity.viewer.avatarUrl,
        active: identity.viewer.active,
        updatedAt: identity.viewer.updatedAt,
      },
    }).run();
    tx.delete(syncState).where(ne(syncState.workspaceId, identity.workspace.id)).run();
    tx.insert(syncState).values({ workspaceId: identity.workspace.id, viewerId: identity.viewer.id })
      .onConflictDoUpdate({ target: syncState.workspaceId, set: { viewerId: identity.viewer.id } }).run();
  });
};

const saveInitial = (
  db: StorageConnectionShape["db"],
  model: InitialReadModel,
): void => {
  db.transaction((tx) => {
    tx.insert(workspaces).values(model.workspace).onConflictDoUpdate({
      target: workspaces.id,
      set: { name: model.workspace.name, urlKey: model.workspace.urlKey, updatedAt: model.workspace.updatedAt },
    }).run();

    const allUsers = [...new Map([...model.users, model.viewer].map((user) => [user.id, user])).values()];
    if (allUsers.length > 0) tx.insert(users).values(allUsers).onConflictDoUpdate({
      target: users.id,
      set: {
        workspaceId: sql`excluded.workspace_id`, name: sql`excluded.name`, displayName: sql`excluded.display_name`,
        email: sql`excluded.email`, avatarUrl: sql`excluded.avatar_url`, active: sql`excluded.active`, updatedAt: sql`excluded.updated_at`,
      },
    }).run();
    if (model.teams.length > 0) tx.insert(teams).values([...model.teams]).onConflictDoUpdate({
      target: teams.id,
      set: { workspaceId: sql`excluded.workspace_id`, key: sql`excluded.key`, name: sql`excluded.name`, updatedAt: sql`excluded.updated_at` },
    }).run();
    if (model.workflowStates.length > 0) tx.insert(workflowStates).values([...model.workflowStates]).onConflictDoUpdate({
      target: workflowStates.id,
      set: { teamId: sql`excluded.team_id`, name: sql`excluded.name`, type: sql`excluded.type`, color: sql`excluded.color`, position: sql`excluded.position`, updatedAt: sql`excluded.updated_at` },
    }).run();
    if (model.labels.length > 0) tx.insert(labels).values([...model.labels]).onConflictDoUpdate({
      target: labels.id,
      set: { workspaceId: sql`excluded.workspace_id`, teamId: sql`excluded.team_id`, name: sql`excluded.name`, color: sql`excluded.color`, updatedAt: sql`excluded.updated_at` },
    }).run();
    if (model.projects.length > 0) tx.insert(projects).values([...model.projects]).onConflictDoUpdate({
      target: projects.id,
      set: {
        workspaceId: sql`excluded.workspace_id`, name: sql`excluded.name`, description: sql`excluded.description`, state: sql`excluded.state`,
        startDate: sql`excluded.start_date`, targetDate: sql`excluded.target_date`, updatedAt: sql`excluded.updated_at`,
      },
    }).run();
    if (model.cycles.length > 0) tx.insert(cycles).values([...model.cycles]).onConflictDoUpdate({
      target: cycles.id,
      set: {
        teamId: sql`excluded.team_id`, number: sql`excluded.number`, name: sql`excluded.name`, startsAt: sql`excluded.starts_at`,
        endsAt: sql`excluded.ends_at`, updatedAt: sql`excluded.updated_at`,
      },
    }).run();
    const userIds = new Set(allUsers.map(({ id }) => id));
    const projectIds = new Set(model.projects.map(({ id }) => id));
    const cycleIds = new Set(model.cycles.map(({ id }) => id));
    const safeIssues = model.issues.map((issue) => ({
      ...issue,
      assigneeId: issue.assigneeId && userIds.has(issue.assigneeId) ? issue.assigneeId : null,
      projectId: issue.projectId && projectIds.has(issue.projectId) ? issue.projectId : null,
      cycleId: issue.cycleId && cycleIds.has(issue.cycleId) ? issue.cycleId : null,
    }));
    if (safeIssues.length > 0) tx.insert(issues).values(safeIssues.map(issueRow)).onConflictDoUpdate({
      target: issues.id,
      set: {
        teamId: sql`excluded.team_id`, identifier: sql`excluded.identifier`, number: sql`excluded.number`, title: sql`excluded.title`,
        description: sql`excluded.description`, priority: sql`excluded.priority`, stateId: sql`excluded.state_id`, assigneeId: sql`excluded.assignee_id`,
        projectId: sql`excluded.project_id`, cycleId: sql`excluded.cycle_id`, sortOrder: sql`excluded.sort_order`, completedAt: sql`excluded.completed_at`,
        canceledAt: sql`excluded.canceled_at`, updatedAt: sql`excluded.updated_at`,
      },
    }).run();
    if (safeIssues.length > 0) {
      const safeIssueIds = safeIssues.map(({ id }) => id);
      tx.delete(issueLabels).where(inArray(issueLabels.issueId, safeIssueIds)).run();
      const labelIds = new Set(model.labels.map(({ id }) => id));
      const relations = safeIssues.flatMap((issue) => issue.labelIds
        .filter((labelId) => labelIds.has(labelId))
        .map((labelId) => ({ issueId: issue.id, labelId })));
      if (relations.length > 0) tx.insert(issueLabels).values(relations).run();
    }
    tx.insert(syncState).values({
      workspaceId: model.workspace.id,
      viewerId: model.viewer.id,
      lastSuccessfulSync: model.syncedAt,
      updatedAtThreshold: model.syncedAt,
      cursor: null,
    }).onConflictDoUpdate({
      target: syncState.workspaceId,
      set: { viewerId: model.viewer.id, lastSuccessfulSync: model.syncedAt, updatedAtThreshold: model.syncedAt, cursor: null },
    }).run();
  });
};

const loadInitial = (db: StorageConnectionShape["db"]): InitialReadModel | null => {
  const state = db.select().from(syncState).orderBy(desc(syncState.lastSuccessfulSync)).get();
  if (!state?.viewerId) return null;
  const workspace = db.select().from(workspaces).where(eq(workspaces.id, state.workspaceId)).get();
  const viewer = db.select().from(users).where(eq(users.id, state.viewerId)).get();
  if (!workspace || !viewer) return null;

  const cachedTeams = db.select().from(teams).where(eq(teams.workspaceId, workspace.id)).all();
  const teamIds = cachedTeams.map(({ id }) => id);
  const cachedStates = teamIds.length > 0
    ? db.select().from(workflowStates).where(inArray(workflowStates.teamId, teamIds)).all()
    : [];
  const issueRows = teamIds.length > 0
    ? db.select().from(issues).where(inArray(issues.teamId, teamIds)).orderBy(desc(issues.updatedAt)).all()
    : [];
  const cachedIssueIds = issueRows.map(({ id }) => id);
  const labelRelations = cachedIssueIds.length > 0
    ? db.select().from(issueLabels).where(inArray(issueLabels.issueId, cachedIssueIds)).all()
    : [];
  const labelsByIssue = new Map<string, string[]>();
  for (const relation of labelRelations) {
    const current = labelsByIssue.get(relation.issueId) ?? [];
    current.push(relation.labelId);
    labelsByIssue.set(relation.issueId, current);
  }
  const cachedIssues = issueRows.map((row) => issueFromRow(row, labelsByIssue.get(row.id) ?? []));
  const cachedCycles = teamIds.length > 0
    ? db.select().from(cycles).where(inArray(cycles.teamId, teamIds)).all()
    : [];

  return {
    workspace,
    viewer,
    users: db.select().from(users).where(eq(users.workspaceId, workspace.id)).all(),
    teams: cachedTeams,
    workflowStates: cachedStates,
    issues: cachedIssues,
    labels: db.select().from(labels).where(eq(labels.workspaceId, workspace.id)).all(),
    projects: db.select().from(projects).where(eq(projects.workspaceId, workspace.id)).all(),
    cycles: cachedCycles,
    syncedAt: state.lastSuccessfulSync ?? workspace.updatedAt,
  };
};

export const RepositoryLive = Layer.mergeAll(
  Layer.effect(CommentRepository, Effect.gen(function* () {
    const { db } = yield* StorageConnection;
    return {
      listByIssue: (issueId) => Effect.try({
        try: () => db.select().from(comments).where(eq(comments.issueId, issueId)).orderBy(desc(comments.createdAt)).all() as readonly Comment[],
        catch: (cause) => storageError("list-comments", cause),
      }),
      save: (comment) => Effect.try({
        try: () => {
          const userId = comment.userId && db.select({ id: users.id }).from(users).where(eq(users.id, comment.userId)).get()
            ? comment.userId
            : null;
          db.insert(comments).values({ ...comment, userId }).onConflictDoUpdate({
            target: comments.id,
            set: { issueId: comment.issueId, userId, body: comment.body, updatedAt: comment.updatedAt },
          }).run();
        },
        catch: (cause) => storageError("save-comment", cause),
      }),
    };
  })),
  Layer.effect(IssueRepository, Effect.gen(function* () {
    const { db } = yield* StorageConnection;
    return {
      count: Effect.try({
        try: () => db.select({ value: sql<number>`count(*)` }).from(issues).get()?.value ?? 0,
        catch: (cause) => storageError("count-issues", cause),
      }),
      findByIdentifier: (identifier) => Effect.try({
        try: () => {
          const row = db.select().from(issues).where(eq(issues.identifier, identifier)).get();
          if (!row) return null;
          const relations = db.select().from(issueLabels).where(eq(issueLabels.issueId, row.id)).all();
          return issueFromRow(row, relations.map(({ labelId }) => labelId));
        },
        catch: (cause) => storageError("find-issue", cause),
      }),
      list: (limit) => Effect.try({
        try: () => db.select().from(issues).orderBy(desc(issues.updatedAt)).limit(limit).all().map((row) => {
          const relations = db.select().from(issueLabels).where(eq(issueLabels.issueId, row.id)).all();
          return issueFromRow(row, relations.map(({ labelId }) => labelId));
        }),
        catch: (cause) => storageError("list-issues", cause),
      }),
      save: (issue) => Effect.try({
        try: () => saveIssue(db, issue),
        catch: (cause) => storageError("save-issue", cause),
      }),
      updateState: (issueId, stateId) => Effect.try({
        try: () => { db.update(issues).set({ stateId, updatedAt: new Date() }).where(eq(issues.id, issueId)).run(); },
        catch: (cause) => storageError("update-issue-state", cause),
      }),
    };
  })),
  Layer.effect(ReadModelRepository, Effect.gen(function* () {
    const { db } = yield* StorageConnection;
    return {
      saveIdentity: (identity) => Effect.try({
        try: () => saveIdentity(db, identity),
        catch: (cause) => storageError("save-identity", cause),
      }),
      saveInitialReadModel: (model) => Effect.try({
        try: () => saveInitial(db, model),
        catch: (cause) => storageError("save-initial-read-model", cause),
      }),
      loadInitialReadModel: Effect.try({
        try: () => loadInitial(db),
        catch: (cause) => storageError("load-initial-read-model", cause),
      }),
    };
  })),
);
