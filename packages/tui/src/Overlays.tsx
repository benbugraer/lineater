/** @jsxImportSource @opentui/react */
import type { AppPreferences } from "@lineater/core";
import type { InputRenderable, TextareaRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef } from "react";
import { themes, useTheme } from "./theme";

export type Overlay = "none" | "help" | "search" | "palette" | "status" | "composer" | "comment" | "picker" | "settings";

export interface IssueDraft {
  readonly mode: "create" | "edit";
  readonly title: string;
  readonly description: string;
  readonly teamId: string;
  readonly stateId: string;
  readonly priority: number;
  readonly assigneeId: string | null;
  readonly projectId: string | null;
  readonly cycleId: string | null;
  readonly labelIds: readonly string[];
}

export type PickerKind = "team" | "status" | "priority" | "assignee" | "labels" | "project" | "cycle";

export interface PickerOption {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
  readonly selected?: boolean;
}

const Shortcut = ({ keys, label }: { readonly keys: string; readonly label: string }) => {
  const theme = useTheme();
  return <box height={1} flexDirection="row">
    <box width={12}><text fg={theme.palette.accentText}>{keys}</text></box>
    <text fg={theme.palette.textSecondary}>{label}</text>
  </box>;
};

export function HelpOverlay() {
  const theme = useTheme();
  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center" backgroundColor={theme.palette.overlay}>
      <box width={72} height={25} border borderColor={theme.palette.borderActive} backgroundColor={theme.palette.surface} flexDirection="column">
        <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} alignItems="center" justifyContent="space-between" flexDirection="row" border={["bottom"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.text}><span fg={theme.palette.accent}>?</span> <strong>Keyboard shortcuts</strong></text>
          <text fg={theme.palette.muted}>esc to close</text>
        </box>
        <box flexGrow={1} padding={2} flexDirection="row">
          <box width="50%" flexDirection="column">
            <text fg={theme.palette.muted}>NAVIGATION</text>
            <Shortcut keys="j / k" label="Move down / up" />
            <Shortcut keys="h / l" label="Move left / right" />
            <Shortcut keys="gg / G" label="First / last" />
            <Shortcut keys="enter" label="Open / select" />
            <Shortcut keys="esc" label="Back" />
            <box height={1} />
            <text fg={theme.palette.muted}>DISCOVER</text>
            <Shortcut keys="/" label="Search issues" />
            <Shortcut keys="f" label="Cycle team filter" />
            <Shortcut keys=":" label="Command palette" />
          </box>
          <box width="50%" flexDirection="column">
            <text fg={theme.palette.muted}>ISSUES & VIEWS</text>
            <Shortcut keys="n / e" label="New / edit issue" />
            <Shortcut keys="s" label="Choose status" />
            <Shortcut keys="a / p" label="Assignee / priority" />
            <Shortcut keys="t" label="Choose labels" />
            <Shortcut keys="P / C" label="Project / cycle" />
            <Shortcut keys="b" label="List / board" />
            <Shortcut keys="H / L" label="Move issue status" />
            <Shortcut keys="r" label="Refresh from Linear" />
            <box height={1} />
            <text fg={theme.palette.muted}>APPLICATION</text>
            <Shortcut keys="S / ," label="Open settings" />
            <Shortcut keys="?" label="Toggle this help" />
            <Shortcut keys="q" label="Quit Lineater" />
            <Shortcut keys="ctrl+c" label="Quit safely" />
          </box>
        </box>
      </box>
    </box>
  );
}

interface InputOverlayProps {
  readonly kind: "search" | "palette";
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly suggestions?: readonly string[];
  readonly selectedIndex?: number;
}

export function InputOverlay({ kind, value, onInput, suggestions = [], selectedIndex = 0 }: InputOverlayProps) {
  const theme = useTheme();
  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" paddingTop={4} backgroundColor={theme.palette.overlaySoft}>
      <box width={Math.min(76, 76)} border borderColor={theme.palette.borderActive} backgroundColor={theme.palette.surface} flexDirection="column">
        <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} flexDirection="row" alignItems="center">
          <text fg={theme.palette.accent}>{kind === "search" ? "/" : ":"}</text>
          <input
            focused
            value={value}
            onInput={onInput}
            placeholder={kind === "search" ? "Search by identifier or title…" : "Type a command…"}
            textColor={theme.palette.text}
            focusedTextColor={theme.palette.text}
            placeholderColor={theme.palette.subtle}
            backgroundColor={theme.palette.input}
            focusedBackgroundColor={theme.palette.input}
            flexGrow={1}
          />
          <text fg={theme.palette.subtle}>esc</text>
        </box>
        {suggestions.length > 0 ? (
          <box border={["top"]} borderColor={theme.palette.border} backgroundColor={theme.palette.surface} paddingTop={1} paddingBottom={1} flexDirection="column">
            {suggestions.slice(0, 7).map((suggestion, index) => (
              <box key={suggestion} height={2} paddingLeft={2} paddingRight={2} backgroundColor={index === selectedIndex ? theme.palette.selection : theme.palette.surface} alignItems="center">
                <text fg={index === selectedIndex ? theme.palette.text : theme.palette.textSecondary}>{suggestion}</text>
              </box>
            ))}
          </box>
        ) : null}
      </box>
    </box>
  );
}

interface StatusOverlayProps {
  readonly states: readonly { readonly id: string; readonly name: string; readonly color: string }[];
  readonly selectedIndex: number;
}

export function IssueComposerOverlay({ draft, field, team, status, priority, assignee, project, cycle, labels, saving, onTitle, onDescription }: {
  readonly draft: IssueDraft;
  readonly field: "title" | "description";
  readonly team: string;
  readonly status: string;
  readonly priority: string;
  readonly assignee: string;
  readonly project: string;
  readonly cycle: string;
  readonly labels: string;
  readonly saving: boolean;
  readonly onTitle: (value: string) => void;
  readonly onDescription: (value: string) => void;
}) {
  const theme = useTheme();
  const titleRef = useRef<InputRenderable>(null);
  const descriptionRef = useRef<TextareaRenderable>(null);
  useEffect(() => {
    if (draft.mode !== "edit") return;
    if (titleRef.current) titleRef.current.cursorOffset = 0;
    if (descriptionRef.current) descriptionRef.current.cursorOffset = 0;
  }, [draft.mode]);
  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center" backgroundColor={theme.palette.overlay}>
      <box width="88%" height="82%" border borderColor={theme.palette.borderActive} backgroundColor={theme.palette.elevated} flexDirection="column">
        <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} alignItems="center" flexDirection="row" border={["bottom"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.text}><span fg={theme.palette.accent}>◆</span> <strong>{draft.mode === "create" ? "Create issue" : "Edit issue"}</strong></text>
          <box flexGrow={1} /><text fg={saving ? theme.palette.warning : theme.palette.subtle}>{saving ? "SAVING…" : "esc cancel"}</text>
        </box>
        <box height={5} paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor={theme.palette.elevated} flexDirection="column">
          <text fg={field === "title" ? theme.palette.accentBright : theme.palette.subtle}>TITLE</text>
          <box height={2} backgroundColor={theme.palette.input} border={["left"]} borderColor={field === "title" ? theme.palette.accent : theme.palette.border} paddingLeft={1}>
            <input ref={titleRef} focused={field === "title"} value={draft.title} onInput={onTitle} placeholder="Issue title…" backgroundColor={theme.palette.input} focusedBackgroundColor={theme.palette.input} textColor={theme.palette.text} focusedTextColor={theme.palette.text} placeholderColor={theme.palette.subtle} flexGrow={1} />
          </box>
        </box>
        <box flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor={theme.palette.elevated} flexDirection="column">
          <text fg={field === "description" ? theme.palette.accentBright : theme.palette.subtle}>DESCRIPTION · MARKDOWN</text>
          <box flexGrow={1} backgroundColor={theme.palette.input} border={["left"]} borderColor={field === "description" ? theme.palette.accent : theme.palette.border} paddingLeft={1}>
            <textarea
              ref={descriptionRef}
              focused={field === "description"}
              initialValue={draft.description}
              placeholder="Add context, acceptance criteria, links…"
              backgroundColor={theme.palette.input}
              focusedBackgroundColor={theme.palette.input}
              textColor={theme.palette.text}
              focusedTextColor={theme.palette.text}
              placeholderColor={theme.palette.subtle}
              wrapMode="word"
              flexGrow={1}
              onContentChange={() => onDescription(descriptionRef.current?.plainText ?? "")}
            />
          </box>
        </box>
        <box height={7} paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor={theme.palette.panel} border={["top"]} borderColor={theme.palette.border} flexDirection="column">
          <text fg={theme.palette.textSecondary}><span fg={theme.palette.muted}>Team </span>{team}  <span fg={theme.palette.muted}>Status </span>{status}  <span fg={theme.palette.muted}>Priority </span>{priority}</text>
          <text fg={theme.palette.textSecondary}><span fg={theme.palette.muted}>Assignee </span>{assignee}  <span fg={theme.palette.muted}>Project </span>{project}  <span fg={theme.palette.muted}>Cycle </span>{cycle}</text>
          <text fg={theme.palette.textSecondary}><span fg={theme.palette.muted}>Labels </span>{labels}</text>
          <text fg={theme.palette.textSecondary}><span fg={theme.palette.accentText}>tab</span> field · <span fg={theme.palette.accentText}>^t</span> team · <span fg={theme.palette.accentText}>^o</span> status · <span fg={theme.palette.accentText}>^p</span> priority · <span fg={theme.palette.accentText}>^a</span> assignee · <span fg={theme.palette.accentText}>^l</span> labels</text>
          <text fg={theme.palette.textSecondary}><span fg={theme.palette.accentText}>^g</span> project · <span fg={theme.palette.accentText}>^y</span> cycle · <span fg={theme.palette.accentText}>^e</span> external editor · <span fg={theme.palette.accentText}>^s</span> {draft.mode === "create" ? "create issue" : "save changes"}</text>
        </box>
      </box>
    </box>
  );
}

export function CommentComposerOverlay({ value, saving, onInput }: {
  readonly value: string;
  readonly saving: boolean;
  readonly onInput: (value: string) => void;
}) {
  const theme = useTheme();
  const editorRef = useRef<TextareaRenderable>(null);
  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center" backgroundColor={theme.palette.overlay}>
      <box width="76%" height="58%" border borderColor={theme.palette.borderActive} backgroundColor={theme.palette.elevated} flexDirection="column">
        <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} alignItems="center" flexDirection="row" border={["bottom"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.text}><strong>Add comment</strong></text><box flexGrow={1} /><text fg={saving ? theme.palette.warning : theme.palette.subtle}>{saving ? "POSTING…" : "esc cancel"}</text>
        </box>
        <box flexGrow={1} margin={1} backgroundColor={theme.palette.input} border={["left"]} borderColor={theme.palette.accent}>
          <textarea
            ref={editorRef}
            focused
            initialValue={value}
            placeholder="Write a Markdown comment…"
            backgroundColor={theme.palette.input}
            focusedBackgroundColor={theme.palette.input}
            textColor={theme.palette.text}
            focusedTextColor={theme.palette.text}
            placeholderColor={theme.palette.subtle}
            wrapMode="word"
            flexGrow={1}
            padding={1}
            onContentChange={() => onInput(editorRef.current?.plainText ?? "")}
          />
        </box>
        <box height={3} paddingLeft={2} backgroundColor={theme.palette.panel} alignItems="center" border={["top"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.textSecondary}><span fg={theme.palette.accentText}>ctrl+e</span> external editor · <span fg={theme.palette.accentText}>ctrl+s</span> post comment · <span fg={theme.palette.accentText}>esc</span> cancel</text>
        </box>
      </box>
    </box>
  );
}

export function PickerOverlay({ title, options, selectedIndex, multiple = false }: {
  readonly title: string;
  readonly options: readonly PickerOption[];
  readonly selectedIndex: number;
  readonly multiple?: boolean;
}) {
  const theme = useTheme();
  const start = Math.max(0, Math.min(Math.max(0, options.length - 12), selectedIndex - 5));
  const visible = options.slice(start, start + 12);
  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center" backgroundColor={theme.palette.overlay}>
      <box width={56} border borderColor={theme.palette.borderActive} backgroundColor={theme.palette.surface} flexDirection="column">
        <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} alignItems="center" flexDirection="row" border={["bottom"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.text}><strong>{title}</strong></text><box flexGrow={1} /><text fg={theme.palette.subtle}>esc cancel</text>
        </box>
        <box paddingTop={1} paddingBottom={1} backgroundColor={theme.palette.surface} flexDirection="column">
          {visible.length === 0 ? <box height={2} paddingLeft={2}><text fg={theme.palette.subtle}>No options available</text></box> : visible.map((option, offset) => {
            const index = start + offset;
            return (
              <box key={option.id} height={2} paddingLeft={2} paddingRight={2} backgroundColor={index === selectedIndex ? theme.palette.selection : theme.palette.surface} alignItems="center" flexDirection="row">
                {option.color ? <text fg={option.color}>● </text> : null}
                <text fg={index === selectedIndex ? theme.palette.accentText : theme.palette.textSecondary}>{multiple ? option.selected ? "✓" : "·" : index === selectedIndex ? "›" : " "}  {option.label}</text>
              </box>
            );
          })}
        </box>
        <box height={2} paddingLeft={2} backgroundColor={theme.palette.panel} border={["top"]} borderColor={theme.palette.border}>
          {multiple ? (
            <text fg={theme.palette.textSecondary}><span fg={theme.palette.accentText}>j/k</span> select · <span fg={theme.palette.accentText}>space</span> toggle · <span fg={theme.palette.accentText}>enter</span> done</text>
          ) : (
            <text fg={theme.palette.textSecondary}><span fg={theme.palette.accentText}>j/k</span> select · <span fg={theme.palette.accentText}>enter</span> apply</text>
          )}
        </box>
      </box>
    </box>
  );
}

export function SettingsOverlay({ preferences, selectedIndex }: {
  readonly preferences: AppPreferences;
  readonly selectedIndex: number;
}) {
  const theme = useTheme();
  const { width, height } = useTerminalDimensions();
  const compact = height < 22;
  const selectedTheme = themes.find(({ id }) => id === preferences.theme) ?? themes[0];
  const rows = [
    { label: "Theme", value: selectedTheme?.name ?? "Linear Dark", hint: `${selectedTheme?.appearance ?? "dark"} · ${themes.length} themes` },
    { label: "Startup view", value: preferences.defaultView === "board" ? "Board" : "Issues", hint: "Initial workspace layout" },
    { label: "Auto sync", value: preferences.autoSync ? "On" : "Off", hint: preferences.autoSync ? "Refresh after cached startup" : "Stay offline until r" },
  ] as const;

  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center" backgroundColor={theme.palette.overlay}>
      <box width={Math.min(68, width - 4)} height={compact ? Math.min(17, height) : 22} border borderColor={theme.palette.borderActive} backgroundColor={theme.palette.surface} flexDirection="column">
        <box height={3} paddingLeft={2} paddingRight={2} backgroundColor={theme.palette.panel} alignItems="center" flexDirection="row" border={["bottom"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.text}><span fg={theme.palette.accent}>◆</span> <strong>Settings</strong></text>
          <box flexGrow={1} /><text fg={theme.palette.subtle}>esc close</text>
        </box>
        <box flexGrow={1} paddingTop={1} flexDirection="column">
          {rows.map((row, index) => (
            <box key={row.label} height={compact ? 3 : 4} paddingLeft={2} paddingRight={2} backgroundColor={index === selectedIndex ? theme.palette.selection : theme.palette.surface} flexDirection="column" justifyContent="center">
              <box flexDirection="row">
                <text fg={index === selectedIndex ? theme.palette.text : theme.palette.textSecondary}>{index === selectedIndex ? "› " : "  "}{row.label}</text>
                <box flexGrow={1} />
                <text fg={index === selectedIndex ? theme.palette.accentText : theme.palette.muted}>{row.value}</text>
              </box>
              {compact ? null : <text fg={theme.palette.subtle}>  {row.hint}</text>}
            </box>
          ))}
        </box>
        <box height={2} paddingLeft={2} backgroundColor={theme.palette.panel} alignItems="center" border={["top"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.textSecondary}><span fg={theme.palette.accentText}>j/k</span> select · <span fg={theme.palette.accentText}>h/l</span> change · <span fg={theme.palette.accentText}>enter</span> next · <span fg={theme.palette.accentText}>esc</span> close</text>
        </box>
      </box>
    </box>
  );
}

export function StatusOverlay({ states, selectedIndex }: StatusOverlayProps) {
  const theme = useTheme();
  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center" backgroundColor={theme.palette.overlaySoft}>
      <box width={48} border borderColor={theme.palette.borderActive} backgroundColor={theme.palette.surface} flexDirection="column">
        <box height={3} paddingLeft={2} backgroundColor={theme.palette.panel} alignItems="center" border={["bottom"]} borderColor={theme.palette.border}>
          <text fg={theme.palette.text}><strong>Set issue status</strong></text>
        </box>
        <box paddingTop={1} paddingBottom={1} backgroundColor={theme.palette.surface} flexDirection="column">
          {states.map((state, index) => (
            <box key={state.id} height={2} paddingLeft={2} paddingRight={2} backgroundColor={index === selectedIndex ? theme.palette.selection : theme.palette.surface} alignItems="center">
              <text fg={theme.palette.text}><span fg={state.color}>●</span> <span fg={index === selectedIndex ? theme.palette.text : theme.palette.textSecondary}>{state.name}</span></text>
            </box>
          ))}
        </box>
        <box height={2} paddingLeft={2} backgroundColor={theme.palette.panel} border={["top"]} borderColor={theme.palette.border}><text fg={theme.palette.textSecondary}><span fg={theme.palette.accentText}>j/k</span> select · <span fg={theme.palette.accentText}>enter</span> apply · <span fg={theme.palette.accentText}>esc</span> cancel</text></box>
      </box>
    </box>
  );
}
