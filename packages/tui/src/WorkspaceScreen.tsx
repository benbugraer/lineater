/** @jsxImportSource @opentui/react */
import type { Comment, InitialReadModel, Issue, WorkflowState } from "@lineater/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";
import type { ActivePane, LayoutMode, WorkspaceView } from "./model";
import { orderedStates, priorityLabel, relativeDate } from "./model";
import { useTheme } from "./theme";

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly color?: string;
}

interface WorkspaceScreenProps {
  readonly model: InitialReadModel;
  readonly layout: LayoutMode;
  readonly view: WorkspaceView;
  readonly activePane: ActivePane;
  readonly navigation: readonly NavigationItem[];
  readonly selectedNavigationIndex: number;
  readonly issues: readonly Issue[];
  readonly selectedIssue: Issue | null;
  readonly selectedIssueIndex: number;
  readonly selectedColumnIndex: number;
  readonly detailOpen: boolean;
  readonly query: string;
  readonly activeFilterCount: number;
  readonly syncing: boolean;
  readonly cachedOnly: boolean;
  readonly mutationIssueId: string | null;
  readonly notice: { readonly tone: "info" | "error"; readonly message: string } | null;
  readonly comments: readonly Comment[];
  readonly commentsLoading: boolean;
}

const statusFor = (model: InitialReadModel, issue: Issue): WorkflowState | undefined =>
  model.workflowStates.find(({ id }) => id === issue.stateId);

const priorityGlyph = (priority: number): string => {
  switch (priority) {
    case 1: return "!!!";
    case 2: return "!!";
    case 3: return "=";
    case 4: return "-";
    default: return "·";
  }
};

function Sidebar({ model, navigation, selectedIndex, active }: {
  readonly model: InitialReadModel;
  readonly navigation: readonly NavigationItem[];
  readonly selectedIndex: number;
  readonly active: boolean;
}) {
  const theme = useTheme();
  const row = (item: NavigationItem, index: number) => (
    <box key={item.id} height={1} paddingLeft={2} paddingRight={2} backgroundColor={index === selectedIndex ? theme.palette.selection : theme.palette.elevated} alignItems="center" flexDirection="row">
      <text fg={theme.palette.text}><span fg={item.color ?? (index === selectedIndex ? theme.palette.accentBright : theme.palette.subtle)}>{item.id.startsWith("team:") ? "●" : item.hint}</span><span fg={index === selectedIndex ? theme.palette.text : theme.palette.textSecondary}>  {item.label}</span></text>
      <box flexGrow={1} />
      {index === selectedIndex && active ? <text fg={theme.palette.accent}>›</text> : null}
    </box>
  );
  return (
    <box width={27} height="100%" backgroundColor={theme.palette.elevated} border={["right"]} borderColor={active ? theme.palette.borderActive : theme.palette.border} flexDirection="column">
      <box height={5} paddingLeft={2} paddingRight={2} flexDirection="column" justifyContent="center" border={["bottom"]} borderColor={theme.palette.border}>
        <text fg={theme.palette.text}><span fg={theme.palette.accent}>◆</span> <strong>{model.workspace.name}</strong></text>
        <text fg={theme.palette.subtle}>{model.viewer.displayName}</text>
      </box>
      <box flexGrow={1} paddingTop={1} flexDirection="column">
        <box height={2} paddingLeft={2} alignItems="center"><text fg={theme.palette.subtle}>WORKSPACE</text></box>
        {navigation.slice(0, 2).map(row)}
        <box height={2} paddingLeft={2} alignItems="center"><text fg={theme.palette.subtle}>TEAMS</text></box>
        {navigation.slice(2).map((item, index) => row(item, index + 2))}
      </box>
      <box height={3} paddingLeft={2} flexDirection="column" justifyContent="center" border={["top"]} borderColor={theme.palette.border}>
        <text fg={theme.palette.subtle}>{model.issues.length} cached issues</text>
      </box>
    </box>
  );
}

function IssueList({ model, issues, selectedIndex, active, width }: {
  readonly model: InitialReadModel;
  readonly issues: readonly Issue[];
  readonly selectedIndex: number;
  readonly active: boolean;
  readonly width: number | "100%";
}) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const selectedId = issues[selectedIndex]?.id;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.verticalScrollBar.visible = false;
    if (selectedId) scrollRef.current?.scrollChildIntoView(`issue-row-${selectedId}`);
  }, [selectedId]);
  return (
    <box width={width} height="100%" backgroundColor={theme.palette.surface} border={["right"]} borderColor={active ? theme.palette.borderActive : theme.palette.border} flexDirection="column">
      <box height={4} paddingLeft={2} paddingRight={2} flexDirection="column" justifyContent="center" border={["bottom"]} borderColor={theme.palette.border}>
        <text fg={theme.palette.text}><strong>Issues</strong> <span fg={theme.palette.subtle}>{issues.length}</span></text>
        <text fg={theme.palette.subtle}>Updated recently</text>
      </box>
      <scrollbox ref={scrollRef} flexGrow={1} focused={active} verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.palette.surface, foregroundColor: theme.palette.scrollbar } }}>
        {issues.length === 0 ? (
          <box height={8} paddingLeft={2} paddingTop={2} flexDirection="column">
            <text fg={theme.palette.muted}><strong>No issues here</strong></text>
            <text fg={theme.palette.subtle}>Change the team filter or refresh from Linear.</text>
          </box>
        ) : issues.map((issue, index) => {
          const selected = index === selectedIndex;
          const status = statusFor(model, issue);
          return (
            <box key={issue.id} id={`issue-row-${issue.id}`} height={4} paddingLeft={2} paddingRight={2} backgroundColor={selected ? theme.palette.selectionMuted : theme.palette.surface} border={["bottom"]} borderColor={theme.palette.border} flexDirection="column" justifyContent="center">
              <box flexDirection="row">
                <text fg={selected ? theme.palette.accentBright : theme.palette.muted}>{issue.identifier}</text>
                <box flexGrow={1} />
                <text fg={theme.palette.subtle}>{relativeDate(issue.updatedAt)}</text>
              </box>
              <box flexDirection="row">
                <text fg={selected ? theme.palette.text : theme.palette.textSecondary}>{issue.title}</text>
                <box flexGrow={1} />
                <text fg={theme.palette.muted}>{priorityGlyph(issue.priority)} </text>
                <text fg={status?.color ?? theme.palette.muted}>●</text>
              </box>
            </box>
          );
        })}
      </scrollbox>
    </box>
  );
}

function MetadataRow({ label, value, color }: {
  readonly label: string;
  readonly value: string;
  readonly color?: string;
}) {
  const theme = useTheme();
  return (
    <box height={1} flexDirection="row" alignItems="center">
      <box width={13} height={1}><text fg={theme.palette.subtle}>{label}</text></box>
      <text fg={color ?? theme.palette.textSecondary}>{value}</text>
    </box>
  );
}

function IssueDetail({ model, issue, active, compact, comments, commentsLoading }: {
  readonly model: InitialReadModel;
  readonly issue: Issue | null;
  readonly active: boolean;
  readonly compact: boolean;
  readonly comments: readonly Comment[];
  readonly commentsLoading: boolean;
}) {
  const theme = useTheme();
  if (!issue) {
    return (
      <box flexGrow={1} height="100%" backgroundColor={theme.palette.panel} justifyContent="center" alignItems="center">
        <text fg={theme.palette.subtle}>Select an issue to inspect its details.</text>
      </box>
    );
  }
  const status = statusFor(model, issue);
  const team = model.teams.find(({ id }) => id === issue.teamId);
  const assignee = model.users.find(({ id }) => id === issue.assigneeId);
  const project = model.projects.find(({ id }) => id === issue.projectId);
  const cycle = model.cycles.find(({ id }) => id === issue.cycleId);
  const issueLabelNames = issue.labelIds
    .map((id) => model.labels.find((label) => label.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <box flexGrow={1} height="100%" backgroundColor={theme.palette.panel} border={active ? ["left"] : []} borderColor={theme.palette.borderActive} flexDirection="column">
      <box height={4} paddingLeft={3} paddingRight={3} flexDirection="row" alignItems="center" border={["bottom"]} borderColor={theme.palette.border}>
        <text fg={theme.palette.muted}>{issue.identifier}</text>
        <box flexGrow={1} />
        <text fg={status?.color ?? theme.palette.muted}>● </text><text fg={theme.palette.textSecondary}>{status?.name ?? "Unknown state"}</text>
      </box>
      <scrollbox flexGrow={1} paddingLeft={3} paddingRight={3} paddingTop={2}>
        <text fg={theme.palette.text} wrapMode="word"><strong>{issue.title}</strong></text>
        <box height={2} />
        <MetadataRow label="Status" value={status?.name ?? "Unknown"} color={status?.color} />
        <MetadataRow label="Priority" value={priorityLabel(issue.priority)} />
        <MetadataRow label="Assignee" value={assignee?.displayName ?? "Unassigned"} />
        <MetadataRow label="Team" value={team?.name ?? "Unknown"} />
        <MetadataRow label="Project" value={project?.name ?? "No project"} />
        <MetadataRow label="Cycle" value={cycle?.name ?? (cycle ? `Cycle ${cycle.number}` : "No cycle")} />
        <MetadataRow label="Labels" value={issueLabelNames.join(", ") || "No labels"} />
        <MetadataRow label="Updated" value={issue.updatedAt.toISOString().slice(0, 10)} />
        <box height={2} />
        <text fg={theme.palette.subtle}>DESCRIPTION</text>
        <box height={1} />
        <text fg={issue.description ? theme.palette.textSecondary : theme.palette.subtle} wrapMode="word">{issue.description || "No description provided."}</text>
        <box height={2} />
        <text fg={theme.palette.subtle}>COMMENTS {comments.length > 0 ? `· ${comments.length}` : ""}</text>
        <box height={1} />
        {commentsLoading ? <text fg={theme.palette.warning}>Loading comments…</text> : comments.length === 0 ? (
          <text fg={theme.palette.subtle}>No comments loaded. Press enter to open this issue.</text>
        ) : comments.map((comment) => {
          const author = model.users.find(({ id }) => id === comment.userId);
          return (
            <box key={comment.id} marginBottom={1} paddingLeft={1} border={["left"]} borderColor={theme.palette.border} flexDirection="column">
              <text fg={theme.palette.muted}>{author?.displayName ?? "Unknown user"} · {relativeDate(comment.createdAt)}</text>
              <text fg={theme.palette.textSecondary} wrapMode="word">{comment.body}</text>
            </box>
          );
        })}
      </scrollbox>
      <box height={3} paddingLeft={3} alignItems="center" border={["top"]} borderColor={theme.palette.border}>
        <text fg={theme.palette.subtle}>{compact ? "esc back · " : ""}<span fg={theme.palette.textSecondary}>e</span> edit  <span fg={theme.palette.textSecondary}>c</span> comment  <span fg={theme.palette.textSecondary}>s</span> status  <span fg={theme.palette.textSecondary}>a/p/t</span> metadata  <span fg={theme.palette.textSecondary}>y/o</span> copy/open</text>
      </box>
    </box>
  );
}

function BoardColumn({ state, issues, selectedIssue, selected, active, last, width }: {
  readonly state: WorkflowState;
  readonly issues: readonly Issue[];
  readonly selectedIssue: Issue | null;
  readonly selected: boolean;
  readonly active: boolean;
  readonly last: boolean;
  readonly width: `${number}%`;
}) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const selectedId = selected ? selectedIssue?.id : undefined;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.verticalScrollBar.visible = false;
    if (selectedId) scrollRef.current?.scrollChildIntoView(`board-issue-${selectedId}`);
  }, [selectedId]);

  return (
    <box width={width} marginRight={last ? 0 : 1} border borderColor={selected && active ? theme.palette.accent : theme.palette.border} backgroundColor={theme.palette.panel} flexDirection="column">
      <box height={3} paddingLeft={1} paddingRight={1} alignItems="center" flexDirection="row" border={["bottom"]} borderColor={theme.palette.border}>
        <text fg={state.color}>●</text><text fg={theme.palette.text}> <strong>{state.name}</strong></text>
        <box flexGrow={1} /><text fg={theme.palette.subtle}>{issues.length}</text>
      </box>
      <scrollbox ref={scrollRef} flexGrow={1} verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.palette.panel, foregroundColor: theme.palette.scrollbar } }}>
        {issues.length === 0 ? (
          <box height={4} padding={1}><text fg={theme.palette.subtle}>No issues</text></box>
        ) : issues.map((issue) => {
          const issueSelected = selected && selectedIssue?.id === issue.id;
          return (
            <box key={issue.id} id={`board-issue-${issue.id}`} minHeight={5} padding={1} marginBottom={1} backgroundColor={issueSelected ? theme.palette.selection : theme.palette.elevated} border={["left"]} borderColor={issueSelected ? theme.palette.accent : theme.palette.border} flexDirection="column">
              <text fg={theme.palette.muted}>{issue.identifier}</text>
              <text fg={issueSelected ? theme.palette.text : theme.palette.textSecondary} wrapMode="word">{issue.title}</text>
              <text fg={theme.palette.subtle}>{priorityGlyph(issue.priority)} {priorityLabel(issue.priority)}</text>
            </box>
          );
        })}
      </scrollbox>
    </box>
  );
}

function Board({ model, issues, selectedIssue, selectedColumnIndex, layout, active }: {
  readonly model: InitialReadModel;
  readonly issues: readonly Issue[];
  readonly selectedIssue: Issue | null;
  readonly selectedColumnIndex: number;
  readonly layout: LayoutMode;
  readonly active: boolean;
}) {
  const theme = useTheme();
  const teamId = selectedIssue?.teamId ?? issues[0]?.teamId ?? null;
  const states = orderedStates(model, teamId);
  const visibleColumns = layout === "wide" ? 3 : layout === "medium" ? 2 : 1;
  const start = Math.max(0, Math.min(states.length - visibleColumns, selectedColumnIndex - Math.floor(visibleColumns / 2)));
  const columns = states.slice(start, start + visibleColumns);

  if (states.length === 0) {
    return <box flexGrow={1} alignItems="center" justifyContent="center"><text fg={theme.palette.subtle}>No workflow states are cached for this team.</text></box>;
  }

  return (
    <box flexGrow={1} height="100%" backgroundColor={theme.palette.background} padding={1} flexDirection="row">
      {columns.map((state, index) => {
        const stateIndex = states.findIndex(({ id }) => id === state.id);
        return (
          <BoardColumn
            key={state.id}
            state={state}
            issues={issues.filter(({ stateId }) => stateId === state.id)}
            selectedIssue={selectedIssue}
            selected={stateIndex === selectedColumnIndex}
            active={active}
            last={index === columns.length - 1}
            width={`${100 / columns.length}%`}
          />
        );
      })}
    </box>
  );
}

export function WorkspaceScreen(props: WorkspaceScreenProps) {
  const theme = useTheme();
  const {
    model, layout, view, activePane, navigation, selectedNavigationIndex, issues,
    selectedIssue, selectedIssueIndex, selectedColumnIndex, detailOpen, query, activeFilterCount,
    syncing, cachedOnly, mutationIssueId, notice, comments, commentsLoading,
  } = props;
  const showSidebar = layout === "wide";
  const singleDetail = layout === "single" && detailOpen;
  const noticeLimit = layout === "wide" ? 100 : layout === "medium" ? 68 : 34;
  const noticeText = notice && notice.message.length > noticeLimit
    ? `${notice.message.slice(0, noticeLimit - 1)}…`
    : notice?.message;

  return (
    <box width="100%" height="100%" backgroundColor={theme.palette.background} flexDirection="column">
      <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} border={["bottom"]} borderColor={theme.palette.border} flexDirection="row" alignItems="center">
        <text fg={theme.palette.text}><span fg={theme.palette.accent}>◆</span> <strong>LINEATER</strong></text>
        <box width={3} />
        <text fg={theme.palette.subtle}>{view === "board" ? "Board" : "Issues"}</text>
        {query ? <text fg={theme.palette.accentBright}>  / {query}</text> : null}
        {activeFilterCount > 0 ? <text fg={theme.palette.accentText}>  ◆ {activeFilterCount} filters</text> : null}
        <box flexGrow={1} />
        {mutationIssueId ? <text fg={theme.palette.warning}>UPDATING  </text> : null}
        <text fg={syncing || cachedOnly || notice?.tone === "error" ? theme.palette.warning : theme.palette.success}>{syncing ? "SYNCING…" : cachedOnly || notice?.tone === "error" ? "● CACHE" : "● SYNCED"}</text>
      </box>

      <box flexGrow={1} flexDirection="row">
        {showSidebar ? <Sidebar model={model} navigation={navigation} selectedIndex={selectedNavigationIndex} active={activePane === "sidebar"} /> : null}
        {view === "board" ? (
          <Board model={model} issues={issues} selectedIssue={selectedIssue} selectedColumnIndex={selectedColumnIndex} layout={layout} active={activePane === "issues"} />
        ) : singleDetail ? (
          <IssueDetail model={model} issue={selectedIssue} active compact comments={comments} commentsLoading={commentsLoading} />
        ) : (
          <>
            <IssueList model={model} issues={issues} selectedIndex={selectedIssueIndex} active={activePane === "issues"} width={layout === "wide" ? 48 : layout === "medium" ? 43 : "100%"} />
            {layout !== "single" ? <IssueDetail model={model} issue={selectedIssue} active={activePane === "detail"} compact={false} comments={comments} commentsLoading={commentsLoading} /> : null}
          </>
        )}
      </box>

      <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} border={["top"]} borderColor={theme.palette.border} flexDirection="row" alignItems="center">
        {notice ? <text fg={notice.tone === "error" ? theme.palette.error : theme.palette.accentBright}>{noticeText}</text> : layout === "single" ? (
          <text fg={theme.palette.muted}><span fg={theme.palette.textSecondary}>j/k</span> move  <span fg={theme.palette.textSecondary}>n</span> new  <span fg={theme.palette.textSecondary}>b</span> board  <span fg={theme.palette.textSecondary}>f</span> filter  <span fg={theme.palette.textSecondary}>S/,</span> settings  <span fg={theme.palette.textSecondary}>?</span> help</text>
        ) : (
          <text fg={theme.palette.muted}><span fg={theme.palette.textSecondary}>j/k</span> navigate   <span fg={theme.palette.textSecondary}>n</span> new   <span fg={theme.palette.textSecondary}>e</span> edit   <span fg={theme.palette.textSecondary}>b</span> {view === "board" ? "list" : "board"}   <span fg={theme.palette.textSecondary}>f</span> filter   <span fg={theme.palette.textSecondary}>S/,</span> settings   <span fg={theme.palette.textSecondary}>?</span> help</text>
        )}
        <box flexGrow={1} />
        {layout === "single" ? null : <text fg={theme.palette.subtle}>{model.workspace.name} · {model.viewer.displayName}</text>}
      </box>
    </box>
  );
}
