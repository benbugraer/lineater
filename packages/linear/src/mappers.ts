import type {
  Comment as DomainComment,
  Cycle as DomainCycle,
  Issue as DomainIssue,
  Label as DomainLabel,
  Project as DomainProject,
  Team as DomainTeam,
  User as DomainUser,
  WorkflowState as DomainWorkflowState,
  Workspace,
} from "@lineater/core";
import type { Comment, Cycle, Issue, IssueLabel, Organization, Project, Team, User, WorkflowState } from "@linear/sdk";

export type CommentSource = Pick<Comment, "id" | "issueId" | "userId" | "body" | "createdAt" | "updatedAt">;
export type WorkspaceSource = Pick<Organization, "id" | "name" | "urlKey" | "createdAt" | "updatedAt">;
export type UserSource = Pick<User, "id" | "name" | "displayName" | "email" | "avatarUrl" | "active" | "createdAt" | "updatedAt">;
export type TeamSource = Pick<Team, "id" | "key" | "name" | "createdAt" | "updatedAt">;
export type WorkflowStateSource = Pick<WorkflowState, "id" | "teamId" | "name" | "type" | "color" | "position" | "createdAt" | "updatedAt">;
export type IssueSource = Pick<Issue, "id" | "teamId" | "identifier" | "url" | "number" | "title" | "description" | "priority" | "stateId" | "assigneeId" | "projectId" | "cycleId" | "labelIds" | "sortOrder" | "completedAt" | "canceledAt" | "createdAt" | "updatedAt">;
export type LabelSource = Pick<IssueLabel, "id" | "teamId" | "name" | "color" | "createdAt" | "updatedAt">;
export type ProjectSource = Pick<Project, "id" | "name" | "description" | "state" | "startDate" | "targetDate" | "createdAt" | "updatedAt">;
export type CycleSource = Pick<Cycle, "id" | "teamId" | "number" | "name" | "startsAt" | "endsAt" | "createdAt" | "updatedAt">;

const timelessDate = (value: string | null | undefined): Date | null =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

const requiredRelationId = (entity: string, relation: string, value: string | undefined): string => {
  if (!value) throw new Error(`${entity} is missing required ${relation} relation id`);
  return value;
};

export const mapComment = (comment: CommentSource): DomainComment => ({
  id: comment.id,
  issueId: requiredRelationId(`Comment ${comment.id}`, "issue", comment.issueId ?? undefined),
  userId: comment.userId ?? null,
  body: comment.body,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
});

export const mapWorkspace = (organization: WorkspaceSource): Workspace => ({
  id: organization.id,
  name: organization.name,
  urlKey: organization.urlKey,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt,
});

export const mapUser = (user: UserSource, workspaceId: string): DomainUser => ({
  id: user.id,
  workspaceId,
  name: user.name,
  displayName: user.displayName,
  email: user.email || null,
  avatarUrl: user.avatarUrl ?? null,
  active: user.active,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const mapTeam = (team: TeamSource, workspaceId: string): DomainTeam => ({
  id: team.id,
  workspaceId,
  key: team.key,
  name: team.name,
  createdAt: team.createdAt,
  updatedAt: team.updatedAt,
});

export const mapWorkflowState = (state: WorkflowStateSource): DomainWorkflowState => ({
  id: state.id,
  teamId: requiredRelationId(`Workflow state ${state.id}`, "team", state.teamId),
  name: state.name,
  type: state.type,
  color: state.color,
  position: state.position,
  createdAt: state.createdAt,
  updatedAt: state.updatedAt,
});

export const mapIssue = (issue: IssueSource): DomainIssue => ({
  id: issue.id,
  teamId: requiredRelationId(`Issue ${issue.identifier}`, "team", issue.teamId),
  identifier: issue.identifier,
  url: issue.url,
  number: issue.number,
  title: issue.title,
  description: issue.description ?? null,
  priority: issue.priority,
  stateId: requiredRelationId(`Issue ${issue.identifier}`, "state", issue.stateId),
  assigneeId: issue.assigneeId ?? null,
  projectId: issue.projectId ?? null,
  cycleId: issue.cycleId ?? null,
  labelIds: issue.labelIds,
  sortOrder: Number.isFinite(issue.sortOrder) ? issue.sortOrder : null,
  completedAt: issue.completedAt ?? null,
  canceledAt: issue.canceledAt ?? null,
  createdAt: issue.createdAt,
  updatedAt: issue.updatedAt,
});

export const mapLabel = (label: LabelSource, workspaceId: string): DomainLabel => ({
  id: label.id,
  workspaceId,
  teamId: label.teamId ?? null,
  name: label.name,
  color: label.color,
  createdAt: label.createdAt,
  updatedAt: label.updatedAt,
});

export const mapProject = (project: ProjectSource, workspaceId: string): DomainProject => ({
  id: project.id,
  workspaceId,
  name: project.name,
  description: project.description || null,
  state: project.state,
  startDate: timelessDate(project.startDate),
  targetDate: timelessDate(project.targetDate),
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

export const mapCycle = (cycle: CycleSource): DomainCycle => ({
  id: cycle.id,
  teamId: requiredRelationId(`Cycle ${cycle.id}`, "team", cycle.teamId),
  number: cycle.number,
  name: cycle.name ?? null,
  startsAt: cycle.startsAt,
  endsAt: cycle.endsAt,
  createdAt: cycle.createdAt,
  updatedAt: cycle.updatedAt,
});
