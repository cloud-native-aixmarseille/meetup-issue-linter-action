<!-- header:start -->

# Meetup Event Automation

![Meetup Event Automation logo](.github/logo.svg)

---

<!-- header:end -->

<!-- badges:start -->

[![Release](https://img.shields.io/github/v/release/cloud-native-aixmarseille/meetup-issue-linter-action)](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/releases)
[![License](https://img.shields.io/github/license/cloud-native-aixmarseille/meetup-issue-linter-action)](http://choosealicense.com/licenses/mit/)
[![Stars](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/blob/main/CONTRIBUTING.md)

<!-- badges:end -->

<!-- overview:start -->

## Overview

This repository owns the tested Meetup Event Automation product for the complete
meetup event journey through dedicated Actions and reusable workflows.

<!-- overview:end -->

## Automation catalog

This repository is the implementation and release unit for Meetup Event
Automation. The `meetups` repository owns event data, credentials, and
trigger-only workflows; it consumes the Actions and reusable workflows
published here at an immutable release revision.

The architecture and migration constraints are recorded in
[ADR-0001](docs/adr/0001-centralize-meetup-event-automation.md).

### Domains

Domain packages contain deterministic business models, policies, ports, and use
cases. They do not depend on GitHub Actions, vendor SDKs, files, YAML/CSV, or the
system clock.

| Domain        | Package                                                             | Responsibility                                                                                         |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Event         | [`@meetup-automation/event`](packages/domain/event)                 | Event documents, validation and normalization, readiness, explicit lifecycle, and event reconciliation |
| Referential   | [`@meetup-automation/referential`](packages/domain/referential)     | Hosts and speakers, stable identifiers, catalog validation, resolution, and public choices             |
| Communication | [`@meetup-automation/communication`](packages/domain/communication) | Communication policy, recipient-safe intent planning, idempotency, and delivery state                  |
| Publication   | [`@meetup-automation/publication`](packages/domain/publication)     | External event URLs and explicit manual publication, asset, and attendance tasks                       |

Cross-domain journey orchestration and the versioned consumer configuration
contract live in [`@meetup-automation/journey`](packages/application/journey).
The contract is intentionally opinionated: paths, labels, Europe/Paris time,
routing, and policy defaults are brain-owned conventions. Consumers do not
provide a meetup-specific runtime config file; they supply credentials, caller
identity and Slack routing inputs, and the fixed Drive folder variables.
Occurrence status is operational too: scheduled is the default, closing an
issue implies occurrence, and explicit labels drive postponed or cancelled
transitions.

### Adapters

Adapter names state both their technology and responsibility. Vendor objects
remain at these boundaries and do not leak into domain APIs.

| Adapter                                                                                                 | Responsibility                                                                 |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`github-event-repository`](packages/adapter/github-event-repository)                                   | Read and minimally patch GitHub Issue-backed event documents                   |
| [`github-event-comment-repository`](packages/adapter/github-event-comment-repository)                   | Reconcile the single managed diagnostic comment                                |
| [`github-issue-form-event-document-codec`](packages/adapter/github-issue-form-event-document-codec)     | Decode, migrate, and render versioned issue-form event documents               |
| [`github-communication-approval-repository`](packages/adapter/github-communication-approval-repository) | Persist maintainer-approved event, revision, and routing snapshots             |
| [`github-delivery-ledger`](packages/adapter/github-delivery-ledger)                                     | Persist communication delivery reservations and outcomes                       |
| [`github-repository-dispatch-mail-gateway`](packages/adapter/github-repository-dispatch-mail-gateway)   | Dispatch idempotent mail intents through a repository event                    |
| [`csv-referential-repository`](packages/adapter/csv-referential-repository)                             | Load host and speaker referentials from checked-out CSV files                  |
| [`yaml-issue-form-projection`](packages/adapter/yaml-issue-form-projection)                             | Project public referential choices into the issue form                         |
| [`yaml-automation-config-repository`](packages/adapter/yaml-automation-config-repository)               | Load and validate the checked-out journey configuration                        |
| [`slack-notification-gateway`](packages/adapter/slack-notification-gateway)                             | Deliver redacted Slack notifications                                           |
| [`system-clock`](packages/adapter/system-clock)                                                         | Supply explicit instants to time-dependent use cases                           |
| [`google-drive-asset-repository`](packages/adapter/google-drive-asset-repository)                       | Reconcile event folders and template copies through the publication asset port |

### Actions

Each Action is a thin input/output boundary over the application use cases. Its
directory contains the public contract, documentation, entrypoint, and
committed bundle.

| Action                                                                                   | Responsibility                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`actions/event/reconcile`](actions/event/reconcile/README.md)                           | Reconcile one event issue and its managed diagnostics                    |
| [`actions/event/list-active`](actions/event/list-active/README.md)                       | List all active event issue numbers with pagination                      |
| [`actions/referential/validate`](actions/referential/validate/README.md)                 | Validate private referentials with redacted results                      |
| [`actions/referential/sync-issue-form`](actions/referential/sync-issue-form/README.md)   | Synchronize public issue-form choices from referentials                  |
| [`actions/communication/reconcile`](actions/communication/reconcile/README.md)           | Plan or dispatch due communications under workflow authorization         |
| [`actions/publication/reconcile-assets`](actions/publication/reconcile-assets/README.md) | Check or reconcile Drive folders, template copies, and issue asset links |

Drive integration is optional in both event workflows. See
[Google Drive event assets](docs/publication-assets.md) for setup instructions,
asset identity, and retry behavior.

### Reusable workflows

Consumer repositories keep GitHub-required triggers and delegate the journey
to these workflows.

| Workflow                                       | Intended trigger                                            | Documentation                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `update-meetup-issue.yml`                      | Relevant issue events                                       | [Update one meetup issue](.github/workflows/update-meetup-issue.md)                                       |
| `check-active-meetup-issues.yml`               | Schedule or manual audit                                    | [Check active meetup issues](.github/workflows/check-active-meetup-issues.md)                             |
| `update-meetup-issue-form.yml`                 | Referential/configuration changes or manual synchronization | [Update the meetup issue form](.github/workflows/update-meetup-issue-form.md)                             |
| `check-meetup-referentials-and-issue-form.yml` | Consumer pull requests                                      | [Check meetup referentials and issue form](.github/workflows/check-meetup-referentials-and-issue-form.md) |

### Release pinning

Actions and reusable workflows share one SemVer release. Consumers must pin a
full 40-character release commit SHA, retaining the version as a review aid:

```yaml
jobs:
  manage:
    uses: cloud-native-aixmarseille/meetup-issue-linter-action/.github/workflows/update-meetup-issue.yml@0123456789abcdef0123456789abcdef01234567 # 1.x.y; replace with the published release SHA
```

Do not pin a mutable branch or major-version tag. Upgrades are explicit changes
to that SHA and can be rolled back by restoring the previous release SHA.

### Development

Developer workflow, repository rules, and quality gates live in
[docs/developer-guide.md](docs/developer-guide.md).

```shell
make setup
make lint
make check-knip
make quality
make check-architecture
make check-contracts
```

## Contributing

Contributions are welcome! Please see the [contributing guidelines](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/blob/main/CONTRIBUTING.md) for more details.

## License

This project is licensed under the MIT License.

SPDX-License-Identifier: MIT

Copyright © 2026 Cloud Native Aix-Marseille

For more details, see the [license](http://choosealicense.com/licenses/mit/).
