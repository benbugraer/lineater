import { AuthError, BrowserService, ClipboardService, SecretStore, TuiError } from "@lineater/core";
import { Effect, Layer } from "effect";

export const LINEATER_SECRET_SERVICE = "dev.lineater.cli";

const platformCommand = (url: string): string[] => {
  switch (process.platform) {
    case "darwin": return ["open", url];
    case "win32": return ["explorer.exe", url];
    default: return ["xdg-open", url];
  }
};

export const clipboardCommands = (
  platform: NodeJS.Platform,
  environment: Readonly<Record<string, string | undefined>>,
): readonly (readonly string[])[] => {
  if (platform === "darwin") return [["pbcopy"]];
  if (platform === "win32") return [["clip.exe"]];
  return environment.WAYLAND_DISPLAY
    ? [["wl-copy"], ["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]]
    : [["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"], ["wl-copy"]];
};

export const ClipboardLive = Layer.succeed(ClipboardService, {
  copy: (text) => Effect.tryPromise({
    try: async () => {
      let lastFailure: unknown;
      for (const command of clipboardCommands(process.platform, process.env)) {
        try {
          const processHandle = Bun.spawn([...command], { stdin: "pipe", stdout: "ignore", stderr: "ignore" });
          processHandle.stdin.write(text);
          processHandle.stdin.end();
          const exitCode = await processHandle.exited;
          if (exitCode === 0) return;
          lastFailure = new Error(`${command[0]} exited with code ${exitCode}`);
        } catch (cause) {
          lastFailure = cause;
        }
      }
      throw lastFailure ?? new Error("No clipboard provider is available");
    },
    catch: (cause) => new TuiError({
      message: "Could not copy to the system clipboard. Install wl-clipboard, xclip, or xsel and retry.",
      cause,
    }),
  }),
});

export const BrowserLive = Layer.succeed(BrowserService, {
  open: (url) => Effect.tryPromise({
    try: async () => {
      const processHandle = Bun.spawn(platformCommand(url.toString()), {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      const exitCode = await processHandle.exited;
      if (exitCode !== 0) throw new Error(`Browser opener exited with code ${exitCode}`);
    },
    catch: (cause) => new AuthError({
      reason: "browser",
      message: `Could not open a browser. Open the authorization URL manually is intentionally disabled to avoid leaking OAuth parameters; fix your system browser opener and retry.`,
      cause,
    }),
  }),
});

export const SecretStoreLive = Layer.succeed(SecretStore, {
  get: (name) => Effect.tryPromise({
    try: () => Bun.secrets.get({ service: LINEATER_SECRET_SERVICE, name }),
    catch: (cause) => new AuthError({
      reason: "secret-store",
      message: "The operating-system credential store is unavailable. Unlock or start Keychain/Secret Service and retry.",
      cause,
    }),
  }),
  set: (name, value) => Effect.tryPromise({
    try: () => Bun.secrets.set({ service: LINEATER_SECRET_SERVICE, name, value }),
    catch: (cause) => new AuthError({
      reason: "secret-store",
      message: "Could not save the Linear credential in the operating-system credential store.",
      cause,
    }),
  }),
  remove: (name) => Effect.tryPromise({
    try: () => Bun.secrets.delete({ service: LINEATER_SECRET_SERVICE, name }).then(() => undefined),
    catch: (cause) => new AuthError({
      reason: "secret-store",
      message: "Could not remove the Linear credential from the operating-system credential store.",
      cause,
    }),
  }),
});
