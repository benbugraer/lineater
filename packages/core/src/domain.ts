export type WorkspaceId = string;
export type TeamId = string;
export type UserId = string;
export type IssueId = string;
export type ProjectId = string;
export type CycleId = string;
export type LabelId = string;
export type WorkflowStateId = string;
export type CommentId = string;

export interface Workspace {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly urlKey: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Team {
  readonly id: TeamId;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface User {
  readonly id: UserId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorkflowState {
  readonly id: WorkflowStateId;
  readonly teamId: TeamId;
  readonly name: string;
  readonly type: string;
  readonly color: string;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Issue {
  readonly id: IssueId;
  readonly teamId: TeamId;
  readonly identifier: string;
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly priority: number;
  readonly stateId: WorkflowStateId;
  readonly assigneeId: UserId | null;
  readonly projectId: ProjectId | null;
  readonly cycleId: CycleId | null;
  readonly labelIds: readonly LabelId[];
  readonly sortOrder: number | null;
  readonly completedAt: Date | null;
  readonly canceledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Project {
  readonly id: ProjectId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string | null;
  readonly state: string;
  readonly startDate: Date | null;
  readonly targetDate: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Cycle {
  readonly id: CycleId;
  readonly teamId: TeamId;
  readonly number: number;
  readonly name: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Label {
  readonly id: LabelId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly name: string;
  readonly color: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Comment {
  readonly id: CommentId;
  readonly issueId: IssueId;
  readonly userId: UserId | null;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateIssueInput {
  readonly teamId: TeamId;
  readonly title: string;
  readonly description?: string;
  readonly stateId?: WorkflowStateId;
  readonly priority?: number;
  readonly assigneeId?: UserId;
  readonly labelIds?: readonly LabelId[];
  readonly projectId?: ProjectId;
  readonly cycleId?: CycleId;
}

export interface UpdateIssueInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly stateId?: WorkflowStateId;
  readonly priority?: number;
  readonly assigneeId?: UserId | null;
  readonly labelIds?: readonly LabelId[];
  readonly projectId?: ProjectId | null;
  readonly cycleId?: CycleId | null;
}

export interface Page<A> {
  readonly items: readonly A[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
}

export interface AppPreferences {
  readonly theme: string;
  readonly defaultView: "list" | "board";
  readonly autoSync: boolean;
}

export interface AuthSession {
  readonly scopes: readonly string[];
  readonly expiresAt: Date;
}

export interface AuthenticatedIdentity extends AuthSession {
  readonly workspace: Workspace;
  readonly viewer: User;
}

export interface InitialReadModel {
  readonly workspace: Workspace;
  readonly viewer: User;
  readonly users: readonly User[];
  readonly teams: readonly Team[];
  readonly workflowStates: readonly WorkflowState[];
  readonly issues: readonly Issue[];
  readonly labels: readonly Label[];
  readonly projects: readonly Project[];
  readonly cycles: readonly Cycle[];
  readonly syncedAt: Date;
}
