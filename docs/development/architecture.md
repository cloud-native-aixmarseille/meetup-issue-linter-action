# Architecture

This guide describes the current implementation. The
[architecture decision records](../README.md#architecture-decisions) preserve
the context and reasoning behind its decisions.

`meetup-event-automation` owns meetup rules, orchestration, adapters, actions,
and reusable workflows. The consuming repository owns event issues, private
host/speaker CSV data, the issue form, workflow triggers, variables, secrets,
and permission grants. Consumer workflows delegate behavior to a pinned
automation revision.

Defaults are defined by
[`AutomationConfigFactory`](../../packages/application/journey/src/config/automation-config.ts).
The runtime receives integration credentials and fixed-name repository variables
at the GitHub Actions boundary. See the
[configuration reference](../reference/configuration.md) for the supported
consumer settings.

## Package ownership

| Package area                         | Responsibility                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `packages/domain/event`              | Event model, field rules, readiness, lifecycle, reconciliation, event/document/comment ports, clock       |
| `packages/domain/referential`        | Catalog validation, stable participant IDs, reference resolution, issue-form choices, catalog port        |
| `packages/domain/communication`      | Due-message planning, approval facts, idempotency, delivery state, approval/ledger/gateway/clock ports    |
| `packages/domain/publication`        | Publication URL rules, manual checklist evaluation, asset reconciliation, asset and feedback ports        |
| `packages/application/journey`       | Cross-domain orchestration, configuration defaults, public result envelope, issue-form projection port    |
| `packages/adapter/*`                 | Concrete implementations of owned ports: GitHub, CSV, YAML, Drive, OpenFeedback, Kutt, Slack, system time |
| `packages/presentation/localization` | Generic locale normalization, ICU formatting, and catalog contracts                                       |
| `packages/runtime/github-actions`    | Input parsing, credentials, dependency composition, action execution, output serialization                |

A domain package owns its model, use cases, and ports. Journey code coordinates
those APIs without redefining their rules. Each port has one owner. Adapters
explicitly implement the owned interface and translate vendor payloads into
application/domain values.

Adapter names use `<technology>-<responsibility>`, with matching `technology:`
and `responsibility:` tags in `project.json`. Keep unrelated responsibilities in
separate adapters. Do not introduce generic `utils`, `helpers`, or `shared`
packages; keep behavior in the context that owns it.

## Dependency direction

The workspace dependency rules are enforced by
[`tests/architecture.spec.ts`](../../tests/architecture.spec.ts).

| Layer        | Allowed workspace dependencies             |
| ------------ | ------------------------------------------ |
| Domain       | None                                       |
| Application  | Domain                                     |
| Presentation | None                                       |
| Adapter      | Domain, application, presentation          |
| Runtime      | Domain, application, adapter, presentation |

Import other packages through their entrypoints. Deep imports and source or
package dependency cycles are prohibited. Keep internal collaborators out of
package entrypoints unless another package needs them.

Domain code must remain independent of SDKs, filesystems, GitHub Actions,
serialization libraries, DI containers, and the system clock. Application code
receives capabilities through ports, not SDK clients or credentials. Neither
layer depends on presentation infrastructure. Presenters own their catalogs and
use [the localization package](localization.md) for formatting. Reusable
workflows coordinate actions, permissions, and concurrency; business rules
belong in TypeScript.

## Runtime composition

The runtime composition roots create a fresh Inversify container per invocation.
Bindings resolve lazily as singletons within that invocation; credentials and
cached catalogs do not carry into another invocation. Bind replacements before
resolving dependent use cases.

Inversify imports, container identifiers, and lookups stay in runtime
composition roots. Use explicit constructor dependencies elsewhere; do not add
decorators or automatic constructor discovery. Static methods are allowed for
stateless operations and composition.

The common composition root supplies event and referential dependencies.
Communication, publication, and feedback roots add their required capabilities.
Communication planning and participant resolution share the same catalog
snapshot. The runtime converts available credentials into capabilities before
calling the journey. Its delivery factory receives the final dispatch
authorization, and the ledger independently checks that authorization before
writing.

## Production code structure

All behavior in `packages/**/src/**/*.ts` belongs to a focused class. Use
constructor injection for stateful or I/O collaborators. Module-level functions,
function-valued variables, callbacks, and object method implementations are
prohibited. Callbacks and helpers inside classes are allowed. Data, constants,
interfaces, type aliases, and port function types may remain at module scope.
Tests and repository tooling are outside this class-only convention.

Package `src/index.ts` files contain imports and reexports only. Put
implementation and side-effect imports in named modules. Action entrypoints
invoke the runtime runner class.

Biome and the structure checks enforce:

| Limit                                       | Maximum |
| ------------------------------------------- | ------- |
| Classes per production file                 | 1       |
| Nonblank lines per production file          | 300     |
| Nonblank lines per method or function       | 60      |
| Cognitive complexity per method or function | 15      |

Do not suppress these rules, compress statements, or gather unrelated behavior
in a class to bypass them. Review responsibility and dependency direction even
when numeric checks pass. Split parsing, validation, presentation, persistence,
and orchestration when they have different reasons to change.

## Action reports and generated messages

All actions use the shared runner to produce logs, annotations, diagnostic
outputs, and escaped job summaries. Actions return public facts and explicit
failure policy; they do not implement their own logging or summaries. Follow
[the reporting contract](reporting.md).

Each presenter owns its English/French ICU catalogs, argument types, and tests.
The runtime resolves locale once and passes it through composition. Domain
diagnostics and protocol identifiers remain stable. See
[localization](localization.md) and
[ADR 0004](../adr/0004-localize-generated-messages.md).

## State, retries, and concurrent writes

GitHub issue text is a projection of the event model. The codec owns Markdown
parsing, versioned metadata, compatible representations, and minimal patches.
Stable catalog IDs identify participants; display names and CSV line links are
presentation data. Preserve codec round trips and supported schema parsing when
changing representations. Check callers and fixtures before removing
compatibility code.

Time-dependent rules receive an explicit clock and time zone. A past date does
not prove an event happened. Occurrence comes from issue state and explicit
status labels; lifecycle is derived from those facts.

Official side-effecting event jobs share a repository/issue concurrency group
and use `cancel-in-progress: false`. Reconciliation reloads and compares issue
snapshots before writing or dispatching. GitHub issue writes have no
transactional compare-and-set guarantee, so a final race with a human edit
remains possible.

Communication approval binds a trusted maintainer action to an immutable issue
snapshot and message-affecting facts. Delivery reserves an intent as `pending`
before calling a gateway and marks it `accepted` after acknowledgement. Pending
and uncertain intents are not automatically resent. A definitively deferred
attempt releases its reservation for a safe retry. The GitHub ledger depends on
the shared workflow lock; do not dispatch outside the official workflows or
claim exactly-once delivery.

OpenFeedback creation uses a stable source key to recover events on retries.
Preserve idempotency and failure behavior for all external effects. Operational
recovery is documented under [integrations](../README.md#integrations).

## Privacy and trust boundaries

- Store real catalogs and contact records only in the consuming repository. Use
  synthetic fixtures in this repository.
- Public event data may include intended display names and published event
  details. Keep email addresses, phone numbers, private addresses, contact-only
  names, raw CSV rows, credentials, and provider payloads out of public issues,
  logs, summaries, outputs, caches, and artifacts.
- Restricted contact data may pass through the ephemeral runner and approved
  delivery processors only. Downstream mail processors must deduplicate the
  idempotency key, suppress payload logging, and document retention before
  dispatch is enabled.
- Use safe diagnostic templates and codes at output boundaries. Do not publish
  raw exception messages or arbitrary diagnostic field paths. Public
  communication identifiers and ledger keys use SHA-256 digests.
- Trust managed diagnostic, approval, and ledger comments only when authored by
  the configured GitHub App bot. A marker alone does not establish trust.
- Read catalogs from the checked-out revision. Parse action inputs at the
  boundary and pass issue text through typed APIs or data files/environment
  values, never executable shell interpolation.
- Pin external actions and consumer workflow references to full commit SHAs. Use
  `persist-credentials: false`. Grant minimum workflow permissions and
  independently restrict each job's GitHub App token to its repositories and
  required scopes; workflow permissions do not restrict an App token.
- Pass delivery secrets explicitly. Use the GitHub App to create separate
  consumer and mailings repository tokens with the permissions each needs.
  Event workflows require the OpenFeedback organization key as well as Kutt,
  Drive, and Slack credentials.

The [test guide](testing.md) identifies the executable checks for these rules.
