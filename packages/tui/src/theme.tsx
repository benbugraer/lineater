/** @jsxImportSource @opentui/react */
import { createContext, type ReactNode, useContext } from "react";

export interface ThemePalette {
  readonly background: string;
  readonly surface: string;
  readonly panel: string;
  readonly elevated: string;
  readonly input: string;
  readonly selection: string;
  readonly selectionMuted: string;
  readonly border: string;
  readonly borderActive: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly muted: string;
  readonly subtle: string;
  readonly accent: string;
  readonly accentBright: string;
  readonly accentText: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly overlay: string;
  readonly overlaySoft: string;
  readonly scrollbar: string;
}

export interface TuiTheme {
  readonly id: string;
  readonly name: string;
  readonly appearance: "dark" | "light";
  readonly palette: ThemePalette;
}

const makeTheme = (
  id: string,
  name: string,
  appearance: TuiTheme["appearance"],
  palette: ThemePalette,
): TuiTheme => ({ id, name, appearance, palette });

export const themes: readonly TuiTheme[] = [
  makeTheme("linear", "Linear Dark", "dark", {
    background: "#101012", surface: "#111113", panel: "#141416", elevated: "#19191c", input: "#111113",
    selection: "#29283b", selectionMuted: "#23232a", border: "#29292e", borderActive: "#4b478f",
    text: "#f2f2f3", textSecondary: "#c5c5ca", muted: "#777780", subtle: "#68686f",
    accent: "#7c75f2", accentBright: "#9e99ff", accentText: "#c9c7ff", success: "#6eeb83",
    warning: "#e5c07b", error: "#ff8f8f", overlay: "#101012dd", overlaySoft: "#101012bb", scrollbar: "#3b3b42",
  }),
  makeTheme("linear-light", "Linear Light", "light", {
    background: "#f3f3f6", surface: "#fafafa", panel: "#e8e8ed", elevated: "#ffffff", input: "#ececf1",
    selection: "#dad7fb", selectionMuted: "#e2e2e9", border: "#c8c8d2", borderActive: "#655bd7",
    text: "#202124", textSecondary: "#3f4047", muted: "#5f6069", subtle: "#74757e",
    accent: "#5e6ad2", accentBright: "#5148c8", accentText: "#4038a8", success: "#16803a",
    warning: "#8a5a00", error: "#b4232d", overlay: "#d7d7dfdd", overlaySoft: "#d7d7dfbb", scrollbar: "#a8a9b3",
  }),
  makeTheme("catppuccin-latte", "Catppuccin Latte", "light", {
    background: "#eff1f5", surface: "#e6e9ef", panel: "#dce0e8", elevated: "#ffffff", input: "#e6e9ef",
    selection: "#d9ddf8", selectionMuted: "#dce0e8", border: "#acb0be", borderActive: "#7287fd",
    text: "#4c4f69", textSecondary: "#5c5f77", muted: "#7c7f93", subtle: "#8c8fa1",
    accent: "#8839ef", accentBright: "#5166cb", accentText: "#762ac2", success: "#357f25",
    warning: "#b86e00", error: "#d20f39", overlay: "#ccd0dadd", overlaySoft: "#ccd0dabb", scrollbar: "#9ca0b0",
  }),
  makeTheme("catppuccin-frappe", "Catppuccin Frappé", "dark", {
    background: "#303446", surface: "#292c3c", panel: "#292c3c", elevated: "#414559", input: "#232634",
    selection: "#51576d", selectionMuted: "#414559", border: "#51576d", borderActive: "#babbf1",
    text: "#c6d0f5", textSecondary: "#b5bfe2", muted: "#949cbb", subtle: "#838ba7",
    accent: "#ca9ee6", accentBright: "#babbf1", accentText: "#c6a0f6", success: "#a6d189",
    warning: "#e5c890", error: "#e78284", overlay: "#232634dd", overlaySoft: "#232634bb", scrollbar: "#626880",
  }),
  makeTheme("catppuccin-macchiato", "Catppuccin Macchiato", "dark", {
    background: "#24273a", surface: "#1e2030", panel: "#1e2030", elevated: "#363a4f", input: "#181926",
    selection: "#494d64", selectionMuted: "#363a4f", border: "#494d64", borderActive: "#b7bdf8",
    text: "#cad3f5", textSecondary: "#b8c0e0", muted: "#939ab7", subtle: "#8087a2",
    accent: "#c6a0f6", accentBright: "#b7bdf8", accentText: "#c6a0f6", success: "#a6da95",
    warning: "#eed49f", error: "#ed8796", overlay: "#181926dd", overlaySoft: "#181926bb", scrollbar: "#5b6078",
  }),
  makeTheme("catppuccin-mocha", "Catppuccin Mocha", "dark", {
    background: "#1e1e2e", surface: "#181825", panel: "#181825", elevated: "#313244", input: "#11111b",
    selection: "#45475a", selectionMuted: "#313244", border: "#45475a", borderActive: "#b4befe",
    text: "#cdd6f4", textSecondary: "#bac2de", muted: "#9399b2", subtle: "#7f849c",
    accent: "#cba6f7", accentBright: "#b4befe", accentText: "#cba6f7", success: "#a6e3a1",
    warning: "#f9e2af", error: "#f38ba8", overlay: "#11111bdd", overlaySoft: "#11111bbb", scrollbar: "#585b70",
  }),
  makeTheme("tokyo-night", "Tokyo Night", "dark", {
    background: "#1a1b26", surface: "#16161e", panel: "#1f2335", elevated: "#24283b", input: "#16161e",
    selection: "#283457", selectionMuted: "#24283b", border: "#3b4261", borderActive: "#7aa2f7",
    text: "#c0caf5", textSecondary: "#a9b1d6", muted: "#787c99", subtle: "#565f89",
    accent: "#bb9af7", accentBright: "#7aa2f7", accentText: "#bb9af7", success: "#9ece6a",
    warning: "#e0af68", error: "#f7768e", overlay: "#16161edd", overlaySoft: "#16161ebb", scrollbar: "#414868",
  }),
  makeTheme("nord", "Nord", "dark", {
    background: "#2e3440", surface: "#272c36", panel: "#3b4252", elevated: "#434c5e", input: "#242933",
    selection: "#4c566a", selectionMuted: "#3b4252", border: "#4c566a", borderActive: "#88c0d0",
    text: "#eceff4", textSecondary: "#d8dee9", muted: "#a3abbc", subtle: "#7b8496",
    accent: "#81a1c1", accentBright: "#88c0d0", accentText: "#8fbcbb", success: "#a3be8c",
    warning: "#ebcb8b", error: "#bf616a", overlay: "#242933dd", overlaySoft: "#242933bb", scrollbar: "#4c566a",
  }),
  makeTheme("solarized-light", "Solarized Light", "light", {
    background: "#fdf6e3", surface: "#f4eedc", panel: "#e8e1cc", elevated: "#fffaf0", input: "#eee8d5",
    selection: "#ded7c1", selectionMuted: "#e8e1cc", border: "#c8c0aa", borderActive: "#268bd2",
    text: "#465b61", textSecondary: "#4b6067", muted: "#52676d", subtle: "#657b83",
    accent: "#5258a4", accentBright: "#17658f", accentText: "#00685f", success: "#667900",
    warning: "#9b7300", error: "#c52f2c", overlay: "#ddd6c4dd", overlaySoft: "#ddd6c4bb", scrollbar: "#aaa28e",
  }),
];

export const defaultTheme = themes[0] as TuiTheme;
export const themeById = (id: string): TuiTheme => themes.find((theme) => theme.id === id) ?? defaultTheme;

const ThemeContext = createContext<TuiTheme>(defaultTheme);

export function ThemeProvider({ themeId, children }: { readonly themeId: string; readonly children: ReactNode }) {
  return <ThemeContext.Provider value={themeById(themeId)}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): TuiTheme => useContext(ThemeContext);
