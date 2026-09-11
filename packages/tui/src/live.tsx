/** @jsxImportSource @opentui/react */
import {
  addIssueComment,
  type AuthService,
  type BrowserService,
  type ClipboardService,
  type CommentRepository,
  copyIssueIdentifier,
  type IssueRepository,
  type LinearService,
  loadPreferences,
  type PreferencesService,
  type ReadModelRepository,
  TuiError,
  TuiService,
  authenticate,
  changeIssueStatus,
  createIssue,
  loadIssueComments,
  loadTuiBootstrap,
  openIssueInBrowser,
  savePreferences,
  syncIncrementalReadModel,
  syncInitialReadModel,
  updateIssue,
  type StartupStatus,
} from "@lineater/core";
import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { registerDefaultKeys, registerEscapeClearsPendingSequence, registerNeovimDisambiguation } from "@opentui/keymap/addons";
import { createOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/react";
import { createRoot, type Root } from "@opentui/react";
import { Effect, Fiber, Layer, Runtime } from "effect";
import type { TuiController } from "./controller";
import { editWithExternalEditor } from "./editor";
import { LineaterApp } from "./LineaterApp";

type TuiEnvironment = AuthService | BrowserService | ClipboardService | CommentRepository | IssueRepository | LinearService | PreferencesService | ReadModelRepository;

export const runTuiRenderer = (controller: TuiController): Effect.Effect<void, TuiError> =>
  Effect.async<void, TuiError>((resume) => {
    let renderer: CliRenderer | undefined;
    let root: Root | undefined;
    let cleanups: readonly (() => void)[] = [];
    let finished = false;

    const destroy = () => {
      if (finished) return;
      finished = true;
      root?.unmount();
      controller.dispose();
      for (const cleanup of cleanups) cleanup();
      renderer?.destroy();
    };

    const exit = () => {
      destroy();
      resume(Effect.void);
    };

    createCliRenderer({ exitOnCtrlC: false })
      .then((createdRenderer) => {
        if (finished) {
          createdRenderer.destroy();
          return;
        }

        renderer = createdRenderer;
        const keymap = createOpenTuiKeymap(createdRenderer);
        cleanups = [
          registerDefaultKeys(keymap),
          registerNeovimDisambiguation(keymap, { timeoutMs: 350 }),
          registerEscapeClearsPendingSequence(keymap),
        ];
        root = createRoot(createdRenderer);
        const interactiveController: TuiController = {
          ...controller,
          editText: async (initial, name) => {
            createdRenderer.suspend();
            try {
              return await controller.editText(initial, name);
            } finally {
              createdRenderer.resume();
            }
          },
        };
        root.render(
          <KeymapProvider keymap={keymap}>
            <LineaterApp controller={interactiveController} onExit={exit} />
          </KeymapProvider>,
        );
      })
      .catch((cause: unknown) => {
        destroy();
        resume(Effect.fail(new TuiError({
          message: cause instanceof Error ? cause.message : "Unable to start terminal renderer",
          cause,
        })));
      });

    return Effect.sync(destroy);
  });

export const TuiLive = Layer.effect(TuiService, Effect.gen(function* () {
  const runtime = yield* Effect.runtime<TuiEnvironment>();
  const fibers = new Set<Fiber.RuntimeFiber<unknown, unknown>>();
  const run = <A, E>(effect: Effect.Effect<A, E, TuiEnvironment>): Promise<A> => {
    const fiber = Runtime.runFork(runtime)(effect);
    fibers.add(fiber);
    return Runtime.runPromise(runtime)(Fiber.join(fiber)).finally(() => { fibers.delete(fiber); });
  };
  const controller: TuiController = {
    bootstrap: () => run(loadTuiBootstrap),
    loadPreferences: () => run(loadPreferences),
    savePreferences: (preferences) => run(savePreferences(preferences)),
    authorize: () => run(authenticate.pipe(Effect.andThen(syncInitialReadModel))),
    sync: () => run(syncInitialReadModel),
    syncIncremental: () => run(syncIncrementalReadModel),
    createIssue: (input) => run(createIssue(input)),
    updateIssue: (issue, input) => run(updateIssue(issue, input)),
    loadComments: (issueId) => run(loadIssueComments(issueId)),
    addComment: (issueId, body) => run(addIssueComment(issueId, body)),
    editText: editWithExternalEditor,
    copyIssueIdentifier: (issue) => run(copyIssueIdentifier(issue)),
    openIssueInBrowser: (issue) => run(openIssueInBrowser(issue)),
    changeIssueStatus: (issue, stateId) => run(changeIssueStatus(issue, stateId)),
    dispose: () => {
      const running = [...fibers];
      fibers.clear();
      Runtime.runFork(runtime)(Effect.forEach(running, Fiber.interrupt, { discard: true }));
    },
  };

  return {
    run: (_status: StartupStatus) => runTuiRenderer(controller),
  };
}));
