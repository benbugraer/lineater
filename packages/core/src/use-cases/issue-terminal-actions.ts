import { Effect } from "effect";
import type { Issue } from "../domain";
import { TuiError } from "../errors";
import { BrowserService, ClipboardService } from "../services";

export const copyIssueIdentifier = (issue: Issue) => ClipboardService.pipe(
  Effect.flatMap(({ copy }) => copy(issue.identifier)),
);

export const openIssueInBrowser = (issue: Issue) => Effect.gen(function* () {
  const browser = yield* BrowserService;
  const url = yield* Effect.try({
    try: () => new URL(issue.url),
    catch: (cause) => new TuiError({ message: "Linear returned an invalid issue URL.", cause }),
  });
  if (url.protocol !== "https:" || url.hostname !== "linear.app") {
    return yield* Effect.fail(new TuiError({ message: "Refusing to open an untrusted issue URL." }));
  }
  yield* browser.open(url);
});
