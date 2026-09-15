import { useState } from "react";

type Screen = "issues" | "board" | "composer" | "settings";

const issues = [
  ["SK-104", "Linear filters and incremental sync", "In Progress", "High"],
  ["SK-101", "Harden OAuth callback lifecycle", "In Review", "Urgent"],
  ["SK-99", "Publish standalone release artifacts", "Todo", "Medium"],
  ["SK-97", "Document terminal-native workflows", "Todo", "Low"],
  ["SK-93", "Cloudflare Workers deploy and DNS", "Done", "High"],
] as const;

const screens: readonly { id: Screen; label: string; key: string }[] = [
  { id: "issues", label: "Issues", key: "1" },
  { id: "board", label: "Board", key: "b" },
  { id: "composer", label: "Create issue", key: "n" },
  { id: "settings", label: "Settings", key: "S" },
];

function Sidebar() {
  return <aside className="tui-sidebar">
    <div className="tui-workspace"><b>◆ Sosyal Köprü</b><span>benbugraer</span></div>
    <div className="tui-rule" />
    <small>WORKSPACE</small>
    <div className="tui-nav active"><span>◫</span> All issues</div>
    <div className="tui-nav"><span>◉</span> My issues</div>
    <small>TEAMS</small>
    <div className="tui-nav"><span className="purple">●</span> Sosyal Köprü</div>
    <div className="tui-cache">50 cached issues</div>
  </aside>;
}

function IssueList() {
  return <section className="tui-list">
    <header><b>Issues <i>50</i></b><span>Updated recently</span></header>
    {issues.map(([id, title, state, priority], index) => <div className={`tui-issue ${index === 0 ? "selected" : ""}`} key={id}>
      <div><span>{id}</span><time>{index < 2 ? "today" : `${index}d ago`}</time></div>
      <strong>{title}</strong>
      <small><i className={`state-dot state-${state.toLowerCase().replace(" ", "-")}`}>●</i> {state}<em>{priority}</em></small>
    </div>)}
  </section>;
}

function Detail() {
  return <section className="tui-detail">
    <header><b>SK-104</b><span className="state-dot state-in-progress">●</span> In Progress</header>
    <h3>Linear filters and incremental sync</h3>
    <p>Complete metadata filtering and keep the cached read model current without blocking terminal startup.</p>
    <div className="tui-meta"><span>Status</span><b>In Progress</b><span>Priority</span><b>High</b><span>Assignee</span><b>benbugraer</b><span>Project</span><b>Lineater</b></div>
    <h4>DESCRIPTION</h4>
    <p>## Acceptance criteria</p>
    <p>– Cached data renders immediately<br />– Updated issues sync with a safe overlap<br />– Network errors preserve local work</p>
    <div className="tui-detail-help">e edit&nbsp;&nbsp; c comment&nbsp;&nbsp; y/o copy/open</div>
  </section>;
}

function Board() {
  const columns = [
    ["Todo", issues.slice(2, 5)],
    ["In Progress", issues.slice(0, 1)],
    ["In Review", issues.slice(1, 2)],
  ] as const;
  return <section className="tui-board">{columns.map(([name, cards], column) => <div className="tui-column" key={name}>
    <header><span><i className={`state-dot state-${name.toLowerCase().replace(" ", "-")}`}>●</i> {name}</span><b>{cards.length}</b></header>
    {cards.map(([id, title, , priority], row) => <article className={column === 1 && row === 0 ? "selected" : ""} key={id}>
      <span>{id}</span><strong>{title}</strong><small>{priority}</small>
    </article>)}
  </div>)}</section>;
}

function Composer() {
  return <div className="tui-overlay"><section className="tui-modal tui-composer">
    <header><b><span>◆</span> Create issue</b><em>esc cancel</em></header>
    <label>TITLE</label><div className="tui-input">Ship the next Lineater release<span>▌</span></div>
    <label>DESCRIPTION · MARKDOWN</label><div className="tui-editor">## Goal<br /><br />Publish a secure terminal-native release with complete filtering, themes and offline-first sync.<br /><br />- [ ] Verify release checksums<br />- [ ] Run installer smoke tests</div>
    <footer className="composer-footer">
      <div className="composer-metadata">
        <section><b>ISSUE DETAILS</b><p><i>Team</i><span>Sosyal Köprü</span></p><p><i>Status</i><span>Todo</span></p><p><i>Priority</i><span>High</span></p><p><i>Assignee</i><span>benbugraer</span></p></section>
        <section><b>PLANNING</b><p><i>Project</i><span>Lineater</span></p><p><i>Cycle</i><span>Current</span></p><p><i>Labels</i><span>Feature, Release</span></p></section>
      </div>
      <div className="composer-actions">
        <section><b>EDIT</b><p><kbd>TAB</kbd><span>Next field</span></p><p><kbd>^E</kbd><span>External editor</span></p></section>
        <section><b>ISSUE</b><p><kbd>^T</kbd><span>Team</span></p><p><kbd>^O</kbd><span>Status</span></p></section>
        <section><b>PLANNING</b><p><kbd>^G</kbd><span>Project</span></p><p><kbd>^Y</kbd><span>Cycle</span></p></section>
        <section><b>FINISH</b><p><kbd>^S</kbd><span>Create issue</span></p><p><kbd>ESC</kbd><span>Cancel</span></p></section>
      </div>
    </footer>
  </section></div>;
}

function Settings() {
  return <div className="tui-overlay"><section className="tui-modal tui-settings">
    <header><b><span>◆</span> Settings</b><em>esc close</em></header>
    <div className="setting selected"><span>› Theme</span><b>Catppuccin Mocha</b><small>dark · 9 themes</small></div>
    <div className="setting"><span>&nbsp;&nbsp;Startup view</span><b>Issues</b><small>Initial workspace layout</small></div>
    <div className="setting"><span>&nbsp;&nbsp;Auto sync</span><b>On</b><small>Refresh after cached startup</small></div>
    <footer><kbd>j/k</kbd> select · <kbd>h/l</kbd> change · <kbd>enter</kbd> next · <kbd>esc</kbd> close</footer>
  </section></div>;
}

export default function LineaterPreview() {
  const [screen, setScreen] = useState<Screen>("issues");
  return <div className="lineater-preview">
    <div className="preview-tabs" role="tablist" aria-label="Lineater interface previews">
      {screens.map((item) => <button type="button" role="tab" aria-selected={screen === item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)} key={item.id}><kbd>{item.key}</kbd>{item.label}</button>)}
    </div>
    <div className="tui-window">
      <div className="tui-top"><b><span>◆</span> LINEATER</b><strong>{screen === "board" ? "Board" : "Issues"}</strong><em><i /> SYNCED</em></div>
      <div className="tui-main"><Sidebar />{screen === "board" ? <Board /> : <><IssueList /><Detail /></>}{screen === "composer" ? <Composer /> : null}{screen === "settings" ? <Settings /> : null}</div>
      <div className="tui-footer"><span><kbd>j/k</kbd> navigate&nbsp;&nbsp; <kbd>n</kbd> new&nbsp;&nbsp; <kbd>e</kbd> edit&nbsp;&nbsp; <kbd>f</kbd> filter&nbsp;&nbsp; <kbd>b</kbd> board&nbsp;&nbsp; <kbd>S/,</kbd> settings&nbsp;&nbsp; <kbd>?</kbd> help</span><em>Sosyal Köprü · benbugraer</em></div>
    </div>
    <p className="preview-caption">Interactive product mock · switch views to inspect Lineater’s real keyboard-first list, dynamic board, issue composer and settings workflows.</p>
  </div>;
}
