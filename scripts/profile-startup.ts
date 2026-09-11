import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "dist/lineater");
if (!(await Bun.file(binary).exists())) {
  throw new Error(`Missing ${binary}. Run bun run build first.`);
}

const root = await mkdtemp(join(tmpdir(), "lineater-profile-"));
const configDirectory = join(root, "config");
const dataDirectory = join(root, "data");
const stateDirectory = join(root, "state");
await Promise.all([
  mkdir(configDirectory, { recursive: true, mode: 0o700 }),
  mkdir(dataDirectory, { recursive: true, mode: 0o700 }),
  mkdir(stateDirectory, { recursive: true, mode: 0o700 }),
]);
await writeFile(join(configDirectory, "config.json"), "{}\n", { mode: 0o600 });

const environment = {
  ...process.env,
  HOME: root,
  LINEATER_CONFIG_DIR: configDirectory,
  LINEATER_DATA_DIR: dataDirectory,
  LINEATER_STATE_DIR: stateDirectory,
  LINEATER_DATABASE_PATH: join(dataDirectory, "lineater.db"),
};

const run = async (): Promise<number> => {
  const startedAt = performance.now();
  const child = Bun.spawn([binary, "issues", "--offline", "--json"], {
    env: environment,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0 || stderr || !Array.isArray(JSON.parse(stdout))) {
    throw new Error(`Profile command failed: ${stderr || stdout}`);
  }
  return performance.now() - startedAt;
};

try {
  await run();
  const samples: number[] = [];
  for (let index = 0; index < 10; index += 1) samples.push(await run());
  samples.sort((left, right) => left - right);
  const percentile = (fraction: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))] ?? 0;
  process.stdout.write(`Lineater cached CLI startup (${samples.length} runs)\np50 ${percentile(0.5).toFixed(1)} ms\np95 ${percentile(0.95).toFixed(1)} ms\n`);
} finally {
  await rm(root, { recursive: true, force: true });
}
