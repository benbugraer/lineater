import { describe, expect, test } from "bun:test";
import { clipboardCommands } from "./platform";

describe("terminal platform commands", () => {
  test("uses direct argv commands without a shell for each supported platform", () => {
    expect(clipboardCommands("darwin", {})).toEqual([["pbcopy"]]);
    expect(clipboardCommands("win32", {})).toEqual([["clip.exe"]]);
    expect(clipboardCommands("linux", { WAYLAND_DISPLAY: "wayland-0" })[0]).toEqual(["wl-copy"]);
    expect(clipboardCommands("linux", { DISPLAY: ":0" })[0]).toEqual(["xclip", "-selection", "clipboard"]);
    for (const command of clipboardCommands("linux", {})) {
      expect(command.join(" ")).not.toContain("sh -c");
    }
  });
});
