import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TemporaryDirectory {
  readonly path: string;
  readonly cleanup: () => Promise<void>;
}

export const makeTemporaryDirectory = async (prefix = "lineater-test-"): Promise<TemporaryDirectory> => {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return {
    path,
    cleanup: () => rm(path, { recursive: true, force: true }),
  };
};
