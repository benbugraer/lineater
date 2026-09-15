# Lineater website

Astro + React marketing and documentation surface for Lineater.

The interactive `LineaterPreview` mirrors the shipped TUI's responsive list, dynamic board, create composer, settings, semantic colors, metadata, and keyboard footer. Keep mock labels and shortcuts synchronized with `packages/tui`; do not replace it with a generic terminal screenshot.

## Commands

Run from `apps/web`:

```bash
bun install
bunx astro dev --background
bunx astro dev status
bun run build
bunx astro dev stop
```

Official Lineater release binaries embed only the public OAuth client identifier. Source builds use a real `LINEATER_LINEAR_CLIENT_ID`; documentation placeholders and client secrets are rejected.

The site is static and deployable to Cloudflare Workers Static Assets.
