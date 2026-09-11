import { describe, expect, test } from "bun:test";
import { defaultTheme, themeById, themes } from "./theme";

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
};

const contrast = (left: string, right: string): number => {
  const first = luminance(left);
  const second = luminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

describe("TUI themes", () => {
  test("keeps Linear Dark as the default and resolves unknown preferences safely", () => {
    expect(defaultTheme.id).toBe("linear");
    expect(themeById("missing").id).toBe("linear");
  });

  test("ships unique light and dark themes including every Catppuccin flavor", () => {
    const ids = themes.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(themes.some(({ appearance }) => appearance === "light")).toBe(true);
    expect(themes.some(({ appearance }) => appearance === "dark")).toBe(true);
    expect(ids).toContain("catppuccin-latte");
    expect(ids).toContain("catppuccin-frappe");
    expect(ids).toContain("catppuccin-macchiato");
    expect(ids).toContain("catppuccin-mocha");
  });

  test("defines valid RGB or RGBA colors for every semantic palette slot", () => {
    for (const theme of themes) {
      for (const color of Object.values(theme.palette)) {
        expect(color).toMatch(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i);
      }
    }
  });

  test("keeps light-theme editors, panels, shortcuts, and text visually distinct", () => {
    for (const theme of themes.filter(({ appearance }) => appearance === "light")) {
      const { palette } = theme;
      expect(new Set([
        palette.background,
        palette.surface,
        palette.panel,
        palette.elevated,
        palette.input,
        palette.selection,
      ]).size).toBeGreaterThanOrEqual(5);
      expect(contrast(palette.text, palette.input)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.textSecondary, palette.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.accentText, palette.panel)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
