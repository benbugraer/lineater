import { describe, expect, test } from "bun:test";
import { makeTemporaryDirectory } from "@lineater/testkit";
import { join } from "node:path";

const runCli = async (arguments_: readonly string[]) => {
  const temporary = await makeTemporaryDirectory("lineater-cli-");
  const processHandle = Bun.spawn(["bun", "apps/lineater/src/main.ts", ...arguments_], {
    cwd: join(import.meta.dir, "../../.."),
    env: {
      ...process.env,
      HOME: temporary.path,
      LINEATER_CONFIG_DIR: join(temporary.path, "config"),
      LINEATER_DATA_DIR: join(temporary.path, "data"),
      LINEATER_STATE_DIR: join(temporary.path, "state"),
      LINEATER_DATABASE_PATH: join(temporary.path, "data", "lineater.db"),
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);
  await temporary.cleanup();
  return { exitCode, stdout, stderr };
};

describe("CLI output contract", () => {
  test("prints only valid JSON to stdout for offline issue queries", async () => {
    const result = await runCli(["issues", "--offline", "--priority", "2", "--json"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([]);
  }, 20_000);

  test("documents filtering and comment commands in help output", async () => {
    const issues = await runCli(["issues", "--help"]);
    expect(issues.exitCode).toBe(0);
    expect(issues.stdout).toContain("--assignee");
    expect(issues.stdout).toContain("--label");
    const root = await runCli(["--help"]);
    expect(root.stdout).toContain("comment");
  }, 20_000);
});
