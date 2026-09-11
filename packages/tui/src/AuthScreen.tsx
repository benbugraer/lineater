/** @jsxImportSource @opentui/react */
import { useTheme } from "./theme";

interface AuthScreenProps {
  readonly phase: "booting" | "unauthenticated" | "authorizing" | "syncing";
  readonly error: string | null;
}

export function AuthScreen({ phase, error }: AuthScreenProps) {
  const theme = useTheme();
  const loading = phase === "booting";
  const authorizing = phase === "authorizing";
  const syncing = phase === "syncing";

  return (
    <box width="100%" height="100%" backgroundColor={theme.palette.background} flexDirection="column">
      <box height={3} paddingLeft={2} paddingRight={2} flexDirection="row" justifyContent="space-between" alignItems="center" border={["bottom"]} borderColor={theme.palette.border}>
        <text fg={theme.palette.text}><span fg={theme.palette.accent}>◆</span> <strong>LINEATER</strong></text>
        <text fg={theme.palette.subtle}>LOCAL-FIRST · LINEAR</text>
      </box>

      <box flexGrow={1} alignItems="center" justifyContent="center" paddingLeft={2} paddingRight={2}>
        <box width={64} border borderColor={error ? theme.palette.error : theme.palette.border} backgroundColor={theme.palette.elevated} flexDirection="column">
          <box height={7} paddingLeft={3} paddingRight={3} flexDirection="column" justifyContent="center" border={["bottom"]} borderColor={theme.palette.border}>
            <text fg={theme.palette.accent}>LINEAR, WITHOUT LEAVING YOUR TERMINAL</text>
            <text fg={theme.palette.text}><strong>Connect your workspace</strong></text>
            <text fg={theme.palette.muted}>Fast, keyboard-first issue management backed by your local cache.</text>
          </box>

          <box paddingLeft={3} paddingRight={3} paddingTop={2} paddingBottom={2} flexDirection="column">
            <text fg={theme.palette.textSecondary}><span fg={theme.palette.success}>●</span> OAuth 2.0 + PKCE</text>
            <text fg={theme.palette.textSecondary}><span fg={theme.palette.success}>●</span> Tokens stay in your OS credential store</text>
            <text fg={theme.palette.textSecondary}><span fg={theme.palette.success}>●</span> Only read and write scopes requested</text>
            <box height={2} />
            {error ? (
              <box border={["left"]} borderColor={theme.palette.error} paddingLeft={2} marginBottom={1}>
                <text fg={theme.palette.error} wrapMode="word">{error}</text>
              </box>
            ) : null}
            <box height={3} backgroundColor={authorizing || syncing || loading ? theme.palette.selectionMuted : theme.palette.accent} alignItems="center" justifyContent="center">
              <text fg={authorizing || syncing || loading ? theme.palette.textSecondary : theme.palette.background}>
                <strong>{loading ? "Checking local session…" : syncing ? "Loading your Linear workspace…" : authorizing ? "Waiting for browser authorization…" : "[ Enter ]  Authorize with Linear"}</strong>
              </text>
            </box>
            {authorizing ? <text fg={theme.palette.muted}>Complete authorization in your browser, then return here.</text> : null}
            {syncing ? <text fg={theme.palette.muted}>No cache yet. Fetching your first issue page securely.</text> : null}
          </box>
        </box>
      </box>

      <box height={3} paddingLeft={2} paddingRight={2} flexDirection="row" justifyContent="space-between" alignItems="center" border={["top"]} borderColor={theme.palette.border}>
        <text fg={theme.palette.muted}><span fg={theme.palette.textSecondary}>enter</span> authorize   <span fg={theme.palette.textSecondary}>?</span> help   <span fg={theme.palette.textSecondary}>q</span> quit</text>
        <text fg={theme.palette.accent}>SECURE CONNECTION</text>
      </box>
    </box>
  );
}
