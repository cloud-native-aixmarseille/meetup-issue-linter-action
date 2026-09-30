# Action reporting

Every public action must use the shared GitHub Actions reporting boundary:

- Register its bootstrap as
  `await ActionRunner.run("action.<group>.<action>", operation)`. The English
  title must match the action manifest name. The runner passes one resolved
  ActionMessages into the operation. Entrypoints follow
  `src/entrypoints/<group>-<action>.ts` and are included in
  `scripts/build-actions.mjs`.
- Return `ActionReportData` on every normal path, including skipped actions.
  Select public facts explicitly: outcome, mode, counts, persistence status,
  affected files, and useful next steps. Explain skipped or blocked work.
- Return redacted `PublicDiagnostic` values with the original severity, code,
  message, optional field, and optional `fixApplied` flag. The runner owns the
  `diagnostics` output; the action still owns its other documented outputs.
- `ActionReport` renders the same facts and diagnostics in logs,
  severity-matched annotations, and an HTML-escaped job summary. Successful runs
  with no diagnostics still receive a report. Do not duplicate this rendering in
  actions or hide essential explanations exclusively in machine-readable
  outputs.
- Exceptions pass through `RuntimeInput.publicErrorMessage` and receive a
  failure annotation, redacted diagnostic output, and summary. Never log raw
  exceptions, provider responses, contact records, credentials, or whole
  use-case results. A summary-write error must preserve the action outcome and
  existing log diagnostics; emit a safe warning without exposing the write
  error.
- Keep exit status separate from diagnostic severity. Set `report.failure` only
  when the action's documented policy requires failure. For example, referential
  validation fails on invalid catalogs. Issue-form synchronization fails on
  error diagnostics in either mode. Projection drift is advisory in check mode:
  it is reported without failing because synchronization runs after merge.
  Successful updates in fix mode do not fail. Communication reconciliation requires
  an explicit reporting policy: `report-errors-to-issue: false` fails on error
  diagnostics, as used by issue updates. With `report-errors-to-issue: true`, it
  succeeds after persisting its redacted report in a managed meetup issue
  comment. An unchanged trusted comment also counts as persisted. Execution
  failures and failed comment reads or writes still fail the action. Actions own
  these policies through the shared runner;
  calling workflows do not need separate enforcement steps. Reporting changes
  must not silently change these policies.

`tests/contracts/action-reporting.spec.ts` discovers every action manifest and
enforces the shared runner and reporting ownership. The runner's typed operation
requires report data on every returned path. Add behavioral tests beside the
changed action for public facts, diagnostics, redaction, and relevant
skip/failure paths; shared renderer and runner tests cover transport and
exception behavior. Update action descriptions and generated readmes, then
rebuild all affected bundles and run
[the development checks](README.md#choose-checks-for-the-change).
