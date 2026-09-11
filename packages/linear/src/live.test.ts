import { describe, expect, test } from "bun:test";
import { ForbiddenLinearError, LinearError, NetworkLinearError, RatelimitedLinearError } from "@linear/sdk";
import { Effect } from "effect";
import { LinearApiError } from "@lineater/core";
import { makeIssueFilter, mapLinearError, retryLinearRead } from "./live";

const sdkError = <A extends Error>(prototype: object, fields: Readonly<Record<string, unknown>> = {}): A =>
  Object.assign(Object.create(prototype), fields) as A;

describe("Linear transport policy", () => {
  test("maps domain filters to verified Linear relation comparators", () => {
    expect(makeIssueFilter({
      teamId: "team", stateId: "state", projectId: "project", cycleId: "cycle",
      assigneeId: "user", priority: 2, labelId: "label",
    })).toEqual({
      team: { id: { eq: "team" } },
      state: { id: { eq: "state" } },
      project: { id: { eq: "project" } },
      cycle: { id: { eq: "cycle" } },
      assignee: { id: { eq: "user" } },
      priority: { eq: 2 },
      labels: { some: { id: { eq: "label" } } },
    });
  });

  test("classifies rate-limit, permission, and network failures", () => {
    const reset = Date.now() + 60_000;
    expect(mapLinearError(sdkError<RatelimitedLinearError>(RatelimitedLinearError.prototype, { requestsResetAt: reset })).reason).toBe("rate-limit");
    expect(mapLinearError(sdkError<ForbiddenLinearError>(ForbiddenLinearError.prototype)).reason).toBe("permission");
    expect(mapLinearError(sdkError<NetworkLinearError>(NetworkLinearError.prototype)).reason).toBe("network");
    expect(mapLinearError(sdkError<LinearError>(LinearError.prototype, { data: { viewer: null }, errors: [{ message: "partial failure" }] })).reason).toBe("graphql");
  });

  test("retries controlled network reads but never permission or rate-limit failures", async () => {
    let attempts = 0;
    const eventually = Effect.suspend(() => {
      attempts += 1;
      return attempts < 3
        ? Effect.fail(new LinearApiError({ reason: "network", message: "offline" }))
        : Effect.succeed("ok");
    });
    expect(await Effect.runPromise(retryLinearRead(eventually))).toBe("ok");
    expect(attempts).toBe(3);

    for (const reason of ["permission", "rate-limit"] as const) {
      attempts = 0;
      const failure = Effect.suspend(() => {
        attempts += 1;
        return Effect.fail(new LinearApiError({ reason, message: reason }));
      });
      await expect(Effect.runPromise(retryLinearRead(failure))).rejects.toThrow(reason);
      expect(attempts).toBe(1);
    }
  });

  test("does not expose unknown infrastructure exception messages", () => {
    const error = mapLinearError(new Error("secret-bearing implementation detail"));
    expect(error.message).toBe("Linear returned an invalid response.");
    expect(error.message).not.toContain("secret-bearing");
  });
});
