// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const isGitHubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  site: isGitHubPages ? "https://benbugraer.github.io" : "https://lineater.pages.dev",
  base: isGitHubPages ? "/lineater" : "/",
  integrations: [mdx(), react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: { allow: [workspaceRoot] },
    },
  },
});