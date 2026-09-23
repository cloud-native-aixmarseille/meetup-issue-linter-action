# Configuration

Configure the consumer repository through GitHub repository variables, secrets,
and reusable workflow inputs. There is no consumer runtime configuration file.
The names below match the [setup examples](../usage/setup.md); the workflow
parameter names are the public contract.

## Required settings

| Consumer setting                                  | Workflow parameter                             | Used by                                   |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Variable `CI_BOT_APP_CLIENT_ID`                   | Input `github-app-client-id`                   | Event workflows and form synchronization. |
| Secret `CI_BOT_APP_PRIVATE_KEY`                   | Secret `github-app-private-key`                | Event workflows and form synchronization. |
| Variable `KUTT_FEEDBACK_LINK_ID`                  | Input `kutt-link-id`                           | Both event workflows.                     |
| Secret `OPENFEEDBACK_API_KEY`                     | Secret `openfeedback-api-key`                  | Both event workflows.                     |
| Secret `KUTT_API_KEY`                             | Secret `kutt-api-key`                          | Both event workflows.                     |
| Secret `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`       | Secret `google-credentials`                    | Both event workflows.                     |
| Variable `GOOGLE_DRIVE_MEETUP_FOLDER_ID`          | Input `google-drive-meetup-folder-id`          | Both event workflows.                     |
| Variable `GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID` | Input `google-drive-meetup-template-folder-id` | Both event workflows.                     |
| Secret `SLACK_BOT_TOKEN`                          | Secret `slack-token`                           | Both event workflows.                     |
| Variable `SLACK_CHANNEL_ID`                       | Input `slack-channel-id`                       | Both event workflows.                     |

Use the GitHub App's client ID. Install the App on the consumer repository and
`mailings` under the same owner. Both event workflows generate a separate,
short-lived token for email dispatch to that owner's `mailings` repository. See
[communications](../integrations/communications.md) for permissions.

The OpenFeedback key must be an organization key beginning with `oforg_`.
It is required even when an issue already contains a feedback URL.
The Kutt link ID is the API identifier of an existing link, not its short URL.
Drive settings contain folder IDs. See [Drive](../integrations/assets.md) and
[feedback](../integrations/feedback.md) for setup requirements. The
referential/form validation workflow requires no credentials.

Pass inputs and secrets explicitly in each caller. Defining a repository secret
does not forward it to a reusable workflow.

## Language

The optional `locale` workflow input defaults to English (`en`) and also supports
French (`fr`). Use the same `locale` in all callers. Regional French variants such as `fr-FR`
resolve to French; unsupported values fall back to English. Changing locale
requires issue-form synchronization and renewed communication approval. See
[localization](../development/localization.md) for covered messages and stable
identifiers.

## Fixed conventions

These values are part of the automation release, not caller options:

| Setting                     | Value                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| Event timezone              | `Europe/Paris`                                                      |
| Issue form                  | `.github/ISSUE_TEMPLATE/meetup.yml`                                 |
| Host catalog                | `referentials/hosting.csv`                                          |
| Speaker catalog             | `referentials/speakers.csv`                                         |
| Near-event readiness window | 7 days                                                              |
| Email dispatch repository   | `<consumer-repository-owner>/mailings`                              |
| Meetup event URL prefix     | `https://www.meetup.com/cloud-native-aix-marseille/events/`         |
| CNCF event URL prefix       | `https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/` |

The CNCF URL policy also accepts
`https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-…`.
Use Drive folder URLs for assets and OpenFeedback event URLs for feedback.

## Labels

Create these labels in the consumer repository:

| Label                    | Meaning                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `meetup`                 | Marks an issue as a meetup.                                  |
| `hoster:needed`          | Host participation is not confirmed.                         |
| `hoster:confirmed`       | Organizer confirms the host.                                 |
| `speakers:needed`        | Speaker participation is not confirmed.                      |
| `speakers:confirmed`     | Organizer confirms the speakers.                             |
| `event:postponed`        | Meetup is postponed.                                         |
| `event:held`             | Meetup took place.                                           |
| `event:cancelled`        | Meetup is cancelled.                                         |
| `communication:approved` | Requests communication approval for the current event facts. |

The automation maintains the `needed` labels from the confirmation state. Use at
most one `event:*` status label. An open issue without a status label is
scheduled; closing it marks it held unless an explicit status says otherwise.
The date passing alone does not mark an event held.

Communication approval requires a label event from a user with triage, write,
maintain, or admin access. See
[approval and delivery](../integrations/communications.md) before enabling
messages.
