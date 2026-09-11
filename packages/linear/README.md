# @lineater/linear

Linear SDK and optimized GraphQL adapters. External models are mapped into `@lineater/core` domain models at this boundary.

Reads use bounded cursor pagination, typed metadata filters, incremental `updatedAt` thresholds, timeouts, and controlled network retries. GraphQL, permission, authentication, and rate-limit failures remain distinct typed errors; unknown infrastructure details are not exposed in user-facing messages. `createIssue`, `updateIssue`, status changes, and comment creation use the SDK's typed mutations without automatic retry, preventing duplicate side effects. Issue URLs, label IDs, and workspace/team label scope are mapped into the stable local read model.
