import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editWithExternalEditor } from "./editor";

const directories: string[] = [];
const originalEditor = process.env.LINEATER_EDITOR;
afterEach(async () => {
  if (originalEditor === undefined) delete process.env.LINEATER_EDITOR;
  else process.env.LINEATER_EDITOR = originalEditor;
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("external editor", () => {
  test("passes a secure temporary file as an argv value and returns changed Markdown", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lineater-editor-test-"));
    directories.push(directory);
    const editor = join(directory, "editor-without-shell");
    await writeFile(editor, `#!/usr/bin/env bun\nimport { readFileSync, writeFileSync } from "node:fs";\nconst path = process.argv[2];\nif (!path) process.exit(2);\nwriteFileSync(path, readFileSync(path, "utf8") + "\\nEdited");\n`, { mode: 0o700 });
    await chmod(editor, 0o700);
    process.env.LINEATER_EDITOR = editor;
    await expect(editWithExternalEditor("Initial", "ENG-1.md")).resolves.toBe("Initial\nEdited");
  });
});
