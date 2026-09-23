# Agent instructions

Start with [the development guide](docs/development/README.md) and follow its
architecture, quality, and test conventions.

Use the [documentation index](docs/README.md) to find guides relevant to the
change. Current development guides and executable architecture and contract
checks under `tests/` define the supported conventions. Consult relevant
[ADRs](docs/adr/) for decision context, status, and superseding decisions.

Keep this overview focused on documentation entry points. Maintain the document
inventory in the documentation index instead of listing individual guides or
ADRs here.

Prefer minimal, deterministic changes and keep documentation in sync with code.

Use the straight ASCII apostrophe (`'`, U+0027) in source text, translations,
tests, and documentation. Do not use typographic apostrophes (U+2019).

Unit tests must live beside their source component and use its exact basename
plus `.test.ts` (for example, `policy.ts` and `policy.test.ts`). Split tests of
independent components into matching files. Import the component directly; put
shared fixtures in package `testing/` folders. Reserve root `tests/*.spec.ts`
for repository-wide integration, architecture, and contract checks. The
structure check enforces unit-test location and naming.

Tests must describe general behavior using synthetic fixtures, without naming
live issues or production incidents. Every test case must have explicit
`// Arrange`, `// Act`, and `// Assert` sections in that order. Keep setup,
execution, and assertions separate. Keep the action outside assertions, and use
separate or parameterized tests for independent input variations. See the test
conventions in `docs/development/testing.md` for exceptions and stateful
sequences.

Production behavior must be owned by focused classes throughout
`packages/**/src`. Use constructor injection for stateful or I/O collaborators;
static methods are allowed for stateless operations and composition. Do not add
module-level functions or callbacks. Keep package `src/index.ts` files limited
to imports and reexports. Respect the enforced limits: one class per file, 300
nonblank lines per file, 60 nonblank lines per method/function, and cognitive
complexity 15. Do not suppress these rules or pack statements to evade them. Run
`pnpm lint`, `pnpm build`, the behavioral/architecture/contract tests, and
rebuild/check action bundles after production changes. Responsibility and
dependency review remains necessary even when numeric checks pass.

Every public GitHub Action must follow the Action reporting contract in
[the action reporting guide](docs/development/reporting.md): use
`await ActionRunner.run` with its action title message ID and return
`ActionReportData` on every normal path, including skips. The shared
runner/reporter owns diagnostic outputs, logs, severity-matched annotations,
escaped job summaries, and redacted exception reporting. Include public outcome
facts and actionable guidance; never expose private records or raw exceptions.
Preserve each action's failure policy explicitly through `report.failure`. Add
or update behavior tests and keep `tests/contracts/action-reporting.spec.ts`
enforcing this for every published action. Do not add action-specific logging or
summary implementations.

Generated user-facing text must use its presenter's scoped translator and
owner-local English/French ICU catalogs. The shared
packages/presentation/localization package provides only generic FormatJS
infrastructure and catalog types; never put feature wording or a global
message-key registry there. Keep catalogs, argument types, and catalog tests
beside the presenter. Pass locale across package boundaries; do not import
another presenter's catalogs. Follow
[the localization guide](docs/development/localization.md) and
[ADR 0004](docs/adr/0004-localize-generated-messages.md).

Do not hardcode new report, guidance, comment, or notification prose outside
owner catalogs. Domain/application diagnostics retain canonical English machine
messages; translate at the presentation boundary. Preserve identifiers,
redaction, and escaping. Do not enable formatter logging that could reveal
interpolation values. Every action/workflow must expose the same English-default
locale input and forward it to all owned actions. Keep catalog, behavior,
architecture, and localization contract tests passing.

## Documentation rules

These rules apply whenever documentation is added or changed:

- Keep `README.md` focused on the global project description and end user usage:
  what the project does, who uses it, how to start, and where to find details.
  Put architecture, source inventories, and contributor tooling in dedicated
  docs.
- Put detailed guides under `docs/`, grouped by purpose: `usage/`, `reference/`,
  `integrations/`, and `development/`. Keep architectural decision records
  (ADRs) under `docs/adr/`. Keep `docs/README.md` as the linked index and keep
  its directory tree accurate. Keep action and workflow contract references
  beside their YAML manifests.
- Give each page one purpose and one audience. State the task or behavior first,
  then the prerequisites, steps, expected result, and relevant limitations. Use
  plain, direct language. Remove filler, promotional claims, generic
  boilerplate, repeated explanations, and implementation details that do not
  help the intended reader.
- Usage, reference, integration, and development guides describe current
  implemented and supported behavior. Remove dead-code descriptions, removed
  settings or commands, obsolete APIs, and speculative future features from
  those guides.
- Preserve ADRs as the history of architectural decisions, including their
  context, alternatives, and consequences. Do not delete ADRs or rewrite past
  decisions during documentation cleanup. Record a changed decision in a new ADR
  and link it from the superseded record with an updated status. Keep ADR
  numbering stable and repair links when documentation moves.
- Verify commands, paths, inputs, secrets, permissions, examples, and defaults
  against the code and public YAML contracts. Distinguish automatic work from
  manual tasks. Use synthetic examples and clearly identify required
  placeholders.
- Maintain one authoritative explanation per topic and link to it from other
  pages. Update all incoming links when moving or deleting a page. Keep
  generated reference sections consistent with their manifests.
- After documentation changes, check local links and the documented tree, parse
  YAML examples, and run the relevant public contract checks. Do not change
  production behavior merely to make an inaccurate document true.
