# @lineater/linear

Linear SDK and optimized GraphQL adapters. External models are mapped into `@lineater/core` domain models at this boundary.

Reads use bounded pagination and controlled network retries. `createIssue`, `updateIssue`, status changes, and comment creation use the SDK's typed mutations without automatic retry, preventing duplicate side effects. Issue label IDs and workspace/team label scope are mapped into the local read model.
