import { TuiError } from "@lineater/core";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const editorExecutable = (): string => process.env.LINEATER_EDITOR || process.env.EDITOR || process.env.VISUAL || "vi";

export const editWithExternalEditor = async (initial: string, name: string): Promise<string | null> => {
  const directory = await mkdtemp(join(tmpdir(), "lineater-editor-"));
  const path = join(directory, name.replaceAll(/[^a-zA-Z0-9_.-]/g, "-") || "issue.md");
  try {
    await writeFile(path, initial, { encoding: "utf8", mode: 0o600 });
    await chmod(path, 0o600);
    const executable = editorExecutable();
    const processHandle = Bun.spawn([executable, path], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    const exitCode = await processHandle.exited;
    if (exitCode !== 0) throw new TuiError({ message: `Editor exited with status ${exitCode}. No changes were saved.` });
    const edited = await readFile(path, "utf8");
    return edited === initial ? null : edited;
  } catch (cause) {
    if (cause instanceof TuiError) throw cause;
    throw new TuiError({ message: `Could not launch ${editorExecutable()}. Set LINEATER_EDITOR, EDITOR, or VISUAL to an executable path.`, cause });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
