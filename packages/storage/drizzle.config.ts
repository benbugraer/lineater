import { defineConfig } from "drizzle-kit";
import { homedir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/storage/src/schema.ts",
  out: "./packages/storage/drizzle",
  dbCredentials: {
    url: process.env.LINEATER_DATABASE_PATH
      ?? join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "lineater", "lineater.db"),
  },
});
