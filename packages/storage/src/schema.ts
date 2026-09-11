import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
};

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  urlKey: text("url_key").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("workspaces_url_key_unique").on(table.urlKey)]);

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  name: text("name").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("teams_workspace_key_unique").on(table.workspaceId, table.key),
  index("teams_workspace_idx").on(table.workspaceId),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [index("users_workspace_idx").on(table.workspaceId)]);

export const workflowStates = sqliteTable("workflow_states", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  color: text("color").notNull(),
  position: integer("position").notNull(),
  ...timestamps,
}, (table) => [
  index("workflow_states_team_idx").on(table.teamId),
  index("workflow_states_team_position_idx").on(table.teamId, table.position),
]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  state: text("state").notNull(),
  startDate: integer("start_date", { mode: "timestamp_ms" }),
  targetDate: integer("target_date", { mode: "timestamp_ms" }),
  ...timestamps,
}, (table) => [index("projects_workspace_idx").on(table.workspaceId)]);

export const cycles = sqliteTable("cycles", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  name: text("name"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("cycles_team_number_unique").on(table.teamId, table.number),
  index("cycles_team_idx").on(table.teamId),
]);

export const issues = sqliteTable("issues", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  identifier: text("identifier").notNull(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: integer("priority").notNull().default(0),
  stateId: text("state_id").notNull().references(() => workflowStates.id),
  assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  cycleId: text("cycle_id").references(() => cycles.id, { onDelete: "set null" }),
  sortOrder: real("sort_order"),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
  ...timestamps,
}, (table) => [
  uniqueIndex("issues_identifier_unique").on(table.identifier),
  index("issues_team_updated_idx").on(table.teamId, table.updatedAt),
  index("issues_state_idx").on(table.stateId),
  index("issues_assignee_idx").on(table.assigneeId),
  index("issues_project_idx").on(table.projectId),
  index("issues_cycle_idx").on(table.cycleId),
]);

export const labels = sqliteTable("labels", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  ...timestamps,
}, (table) => [
  index("labels_workspace_idx").on(table.workspaceId),
  index("labels_team_idx").on(table.teamId),
]);

export const issueLabels = sqliteTable("issue_labels", {
  issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  labelId: text("label_id").notNull().references(() => labels.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.issueId, table.labelId] }),
  index("issue_labels_label_idx").on(table.labelId),
]);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  ...timestamps,
}, (table) => [
  index("comments_issue_created_idx").on(table.issueId, table.createdAt),
]);

export const syncState = sqliteTable("sync_state", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  viewerId: text("viewer_id").references(() => users.id, { onDelete: "set null" }),
  lastSuccessfulSync: integer("last_successful_sync", { mode: "timestamp_ms" }),
  updatedAtThreshold: integer("updated_at_threshold", { mode: "timestamp_ms" }),
  cursor: text("cursor"),
});

export const schema = {
  workspaces,
  teams,
  users,
  workflowStates,
  projects,
  cycles,
  issues,
  labels,
  issueLabels,
  comments,
  syncState,
};
