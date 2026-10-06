# Documentation

## Usage

- [Set up a repository](usage/setup.md): prerequisites, files, credentials, and
  workflow callers.
- [Organize a meetup](usage/organize-meetup.md): create an event, resolve
  diagnostics, approve messages, and complete follow-up.

## Reference

- [Configuration](reference/configuration.md): settings, fixed conventions, and
  labels.
- [Host and speaker referentials](reference/referentials.md): CSV columns,
  stable IDs, and issue-form updates.

## Integrations

- [Google Drive assets](integrations/assets.md)
- [OpenFeedback and Kutt](integrations/feedback.md)
- [Email and Slack](integrations/communications.md)

## Workflow contracts

| Workflow                                                                                              | Purpose                                                    |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Update meetup issue](../.github/workflows/update-meetup-issue.md)                                    | Process issue changes.                                     |
| [Check active meetup issues](../.github/workflows/check-active-meetup-issues.md)                      | Run the scheduled or manual audit.                         |
| [Update meetup issue form](../.github/workflows/update-meetup-issue-form.md)                          | Open a pull request with updated host and speaker choices. |
| [Check referentials and issue form](../.github/workflows/check-meetup-referentials-and-issue-form.md) | Validate consumer pull requests.                           |

## Action contracts

| Action                                                                     | Purpose                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Reconcile event](../actions/event/reconcile/README.md)                    | Validate and normalize one meetup issue.                     |
| [List active events](../actions/event/list-active/README.md)               | Select issues for an audit.                                  |
| [Validate referentials](../actions/referential/validate/README.md)         | Check host and speaker catalogs.                             |
| [Synchronize issue form](../actions/referential/sync-issue-form/README.md) | Update the checked-out form choices.                         |
| [Reconcile assets](../actions/publication/reconcile-assets/README.md)      | Prepare Google Drive folders and template copies.            |
| [Reconcile feedback](../actions/publication/reconcile-feedback/README.md)  | Create OpenFeedback events and update the shared short link. |
| [Reconcile communications](../actions/communication/reconcile/README.md)   | Plan or dispatch authorized email and Slack messages.        |

## Development

- [Development workflow](development/README.md)
- [Architecture](development/architecture.md)
- [Testing](development/testing.md)
- [Action reporting](development/reporting.md)
- [Localization](development/localization.md)
- [Agent instructions](../AGENTS.md)

## Architecture decisions

ADRs preserve the context and reasoning behind architectural decisions. Use the
[architecture guide](development/architecture.md) for the current
implementation.

- [ADR-0001: Centralize meetup event automation](adr/0001-centralize-meetup-event-automation.md)
- [ADR-0002: Runtime dependency injection](adr/0002-runtime-dependency-injection.md)
- [ADR-0003: Production code structure](adr/0003-production-code-structure.md)
- [ADR-0004: Localize generated messages](adr/0004-localize-generated-messages.md)
- [ADR-0005: Use one communication reconciliation path](adr/0005-single-communication-reconciliation-path.md)
- [ADR-0006: Match action inputs to operational behavior](adr/0006-explicit-reconciliation-behavior.md)
- [ADR-0007: Automate community-event (OCGroups) publication](adr/0007-automate-community-event-publication.md)

## Directory layout

```text
docs/
├── README.md
├── usage/
│   ├── setup.md
│   └── organize-meetup.md
├── reference/
│   ├── configuration.md
│   └── referentials.md
├── integrations/
│   ├── assets.md
│   ├── feedback.md
│   └── communications.md
├── development/
│   ├── README.md
│   ├── architecture.md
│   ├── testing.md
│   ├── reporting.md
│   └── localization.md
└── adr/
    ├── 0001-centralize-meetup-event-automation.md
    ├── 0002-runtime-dependency-injection.md
    ├── 0003-production-code-structure.md
    ├── 0004-localize-generated-messages.md
    ├── 0005-single-communication-reconciliation-path.md
    ├── 0006-explicit-reconciliation-behavior.md
    └── 0007-automate-community-event-publication.md
```

Action references stay beside `action.yml`; workflow references stay beside
their workflow YAML. Each detailed topic has one guide linked from this index.
