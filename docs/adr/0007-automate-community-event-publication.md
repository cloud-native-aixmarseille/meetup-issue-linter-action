# ADR 0007: Automate community-event (OCGroups) publication

Status: Proposed

Date: 2026-10-06

Builds on [ADR 0001](0001-centralize-meetup-event-automation.md),
[ADR 0002](0002-runtime-dependency-injection.md), and
[ADR 0004](0004-localize-generated-messages.md). Follows the reconciliation
behavior established by [ADR 0006](0006-explicit-reconciliation-behavior.md).

## Context

Publishing the CNCF community event is one of the last manual steps in the
meetup journey. Organizers create the event on the CNCF Open Community Groups
(OCG) platform and paste its URL into the **CNCF Link** issue field. The
[organizer guide](../usage/organize-meetup.md) states this explicitly: "Publish
the event on Meetup and the CNCF community platform, then fill in Meetup Link and
CNCF Link. These publishing steps are manual."

The automation already anticipates removing this manual step. ADR 0001 reserved a
`CommunityEventPublisher` port owned by the publication package, with a planned
`ocgroups-community-event-publisher` adapter and "manual projection; no adapter
initially". That port exists today in `packages/domain/publication`, and
`ManualPublicationPolicy` tracks `publish-community-event` as a pending task
"until a corresponding outbound adapter exists". `CommunityEventUrlPolicy`
validates a pasted community URL against the configured CNCF/OCGroups prefix
`https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/` (and the
legacy `community.cncf.io` prefix).

Two existing reconciliations are the model to follow. Drive assets
(`ManageMeetupAssets` and `google-drive-asset-repository`) and OpenFeedback
(`ManageMeetupFeedback` and `openfeedback-event-gateway`) both create or recover
an external resource idempotently, persist its URL into the issue through the
versioned codec, skip inactive or invalid events, and report through the shared
runner. Both run in the issue-update and daily-audit workflows under the shared
event concurrency lock.

### Platform constraint

OCG is open-source software that communities self-host; CNCF runs one instance at
`ocgroups.dev`. Its event-management operations exist as server routes under
`/dashboard/group/events` (create, update, publish, unpublish, cancel, delete),
and an event is identified by a server-generated UUID while its public page uses
a slug at `/{community}/group/{group}/event/{slug}`.

However, as of the upstream `main` branch, these are internal dashboard
endpoints, not a supported integration surface:

- Authentication is interactive, session-cookie based only: email/password,
  GitHub OAuth2, or Linux Foundation OIDC. There is no API key, personal access
  token, or machine-to-machine credential.
- Requests are form-encoded and responses are HTML/HTMX fragments and redirect
  headers, not JSON. Creation returns the new event id only through a redirect
  header.
- There is no OpenAPI description and no documented stability guarantee. A
  read-only JSON API for group details and events is requested in open upstream
  issue [cncf/open-community-groups#449](https://github.com/cncf/open-community-groups/issues/449);
  an earlier read-only JSON pull request was closed unmerged, and no write or
  automation API is yet planned.

A GitHub Action therefore cannot authenticate to OCG non-interactively today
without scripting a browser login and storing an organizer's personal
credentials, which is brittle, unsupported, and a privacy and security risk.

## Decision drivers

1. Remove the manual community-event publishing step without weakening the
   determinism, idempotency, privacy, and reporting guarantees of ADR 0001.
2. Reuse the publication seam ADR 0001 already defined rather than inventing a
   parallel mechanism.
3. Depend only on a supported, stable integration surface authenticated by a
   dedicated machine credential; never store or replay a human login.
4. Keep contact data and private referential records out of the public
   automation repository, logs, summaries, and outputs.
5. Keep the change minimal and reversible, matching the assets and feedback
   reconciliations.

## Decision

Automate community-event publication through the existing
`CommunityEventPublisher` port with a new `ocgroups-community-event-publisher`
adapter, a publication-journey use case, and a `reconcile-community-event`
action, mirroring the Drive and OpenFeedback reconciliations. Gate the adapter
behind a supported OCG integration contract: a stable server-side event API
authenticated by a dedicated machine credential. Until that contract exists,
keep `publish-community-event` an explicit manual task and keep
`CommunityEventUrlPolicy` validating the pasted URL.

### Target design

- **Adapter.** Add `packages/adapter/ocgroups-community-event-publisher`
  implementing `CommunityEventPublisher`. It owns the OCG base URL, community,
  and group identifiers, and the machine credential. It creates the event when
  absent and reconciles it when present, keyed by a stable idempotency key
  derived from the repository and issue number. It returns the public event URL
  built from the configured community-event prefix. The adapter maps vendor
  responses to domain values; OCG request and response shapes never cross the
  port. It classifies retryable and rate-limited responses and never publishes
  provider payloads or exception text.
- **Use case.** Add a publication-journey use case
  (`ManageMeetupCommunityEvent`) alongside `ManageMeetupFeedback` and
  `ManageMeetupAssets`. It loads the issue, evaluates the event in `check` mode,
  skips closed, cancelled, postponed, and unrelated issues, and requires a valid
  date, title, and host before acting. It calls the publisher, then projects the
  returned URL into **CNCF Link** through the versioned codec patch only, leaving
  all other normalization to event reconciliation. Persistence re-checks that the
  issue is current before writing.
- **Lifecycle mapping.** Create the OCG event as a draft, then publish it. Map
  the meetup model to the OCG event input deterministically: event title, event
  description, in-person kind, the fixed `Europe/Paris` timezone, start and end
  derived from the event date, and venue derived from the resolved host's public
  location. Map `event:postponed` and `event:cancelled` to the corresponding OCG
  update, unpublish, and cancel operations. Speaker and host references use
  public display data only; no contact detail or private referential record is
  sent.
- **Action and composition.** Add `actions/publication/reconcile-community-event`
  as a thin entrypoint, composed by a dedicated publication composition root that
  binds the publisher and use case (ADR 0002). Following ADR 0006, the action
  performs reconciliation on every invocation with no `mode` input; credential,
  prerequisite, stale-issue, and shared-concurrency checks decide whether remote
  work proceeds. It reports through `ActionRunner.run` with its title message id
  and returns `ActionReportData` on every path, including skips, per the
  [reporting contract](../development/reporting.md). It exposes the shared
  `locale` input (ADR 0004).
- **Workflow wiring and configuration.** Call the action from the issue-update
  and daily-audit reusable workflows under the shared event lock, beside the
  feedback and asset steps. Add the OCG credential as a required consumer secret
  and the community and group identifiers as workflow inputs, documented in the
  [configuration reference](../reference/configuration.md). Keep the
  `Europe/Paris` timezone and the community-event URL prefix as fixed release
  conventions.
- **Manual-task retirement.** Once the automated path is in place, drop
  `publish-community-event` from `ManualPublicationPolicy` as Drive and
  OpenFeedback precedent did for their tasks, and update the organizer guide so
  the CNCF link is filled automatically while the URL field may stay empty until
  the automation writes it.

### Precondition and upstream dependency

Do not implement the adapter against the internal HTMX dashboard endpoints or a
simulated interactive session. The precondition for implementation is a supported
OCG server API for event create, update, and publish, authenticated by a
machine credential the consumer can store as a secret. To unblock it, engage
upstream: contribute to or track issue #449 and request a write or automation
API and a non-interactive credential. The configured community-event prefix and
the `CommunityEventUrlPolicy` already make the current manual URL forward
compatible with the automated one, so the automated adapter can land as a
minimal change once the API exists.

## Consequences

- The publication seam, port, and manual-task model from ADR 0001 are realized
  rather than replaced; the implementation stays consistent with the assets and
  feedback reconciliations and their contract and behavior tests.
- Organizers stop creating and linking the CNCF event by hand once the adapter
  lands; until then the manual task and URL validation remain and nothing
  regresses.
- The decision is explicitly contingent on an upstream capability that does not
  exist yet, so this ADR records the design and the precondition without
  committing to the internal, unstable endpoints.
- No organizer credentials are stored or replayed, and no contact data or private
  referential record crosses into the public automation repository, logs,
  summaries, or outputs.
- If OCG never exposes a supported write API, the community event stays manual
  and this ADR is superseded by a decision that records that outcome.
