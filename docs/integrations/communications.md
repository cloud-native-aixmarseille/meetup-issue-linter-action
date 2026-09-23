# Email and Slack communications

Communications require an explicit approval on the meetup issue. The
issue-update and daily-audit workflows send due messages using the current
event, its resolved contacts and the stored approval.

## Configure delivery

Complete [repository setup](../usage/setup.md), including the issue workflow's
`labeled` trigger. Both event workflows require these settings:

| Consumer setting                | Reusable workflow parameter     | Purpose                       |
| ------------------------------- | ------------------------------- | ----------------------------- |
| Variable `CI_BOT_APP_CLIENT_ID` | Input `github-app-client-id`    | Identify the GitHub App.      |
| Secret `CI_BOT_APP_PRIVATE_KEY` | Secret `github-app-private-key` | Create installation tokens.   |
| Secret `SLACK_BOT_TOKEN`        | Secret `slack-token`            | Send organizer notifications. |
| Variable `SLACK_CHANNEL_ID`     | Input `slack-channel-id`        | Select the organizer channel. |

Install the GitHub App on `mailings` under the consumer repository's owner with
**Contents: write** permission. Each event workflow generates a separate
installation token scoped to that repository, uses it for email dispatch, and
revokes it at job completion. Configure the mailings repository to handle the
templates listed below.

The Slack bot must be able to post to the selected channel. Missing App or Slack
settings fail the workflow; complete setup before approving communications.

Email recipients come from the [referentials](../reference/referentials.md): the
host's first contact and each resolved speaker. Fix invalid records or
unresolved participants before approving communications.

## Approve an issue

1. Review the issue's date, status, host, speakers, confirmations and links. Let
   pending issue updates finish.
2. Add `communication:approved` with a GitHub account that has `triage`,
   `write`, `maintain` or `admin` permission on the meetup repository.
3. Check the issue-update run. It captures the approval and dispatches any due
   messages.

Approval is captured from the label-add event. A scheduled run cannot create a
missing approval. If the label was already present before setup, remove and
re-add it. Keep the label on the issue for later deliveries.

The approval covers the event date and status, readiness, confirmation labels,
host and speaker IDs, Meetup/CNCF/Drive URLs, delivery routing and consumer
repository revision and notification language. Changes to these values make it
stale. Review the changes, then remove and re-add `communication:approved`. Do
the same if the issue changed between adding the label and capturing the
approval.

Changing the event to `held` requires a new approval before thank-you messages
can be sent. Removing the label stops future dispatches; it does not undo
messages already accepted by a provider.

## When messages are due

Dates use `Europe/Paris`. Every row below also requires a current approval.

| Event condition                                                          | Message                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Scheduled, ready, and today or in the future                             | Introduction email to the host contact and speakers           |
| Scheduled, not ready, and within seven days of its date, including today | Organizer Slack reminder                                      |
| Explicitly marked `held`                                                 | Thank-you email to the host contact and speakers              |
| Cancelled, postponed, or status unknown                                  | No messages                                                   |
| Scheduled with a past date                                               | No messages; a past date does not confirm the meetup happened |

Each message kind is sent at most once per issue and recipient under the current
policy. The Slack reminder is not a daily repeat. Reapproval does not resend
previously recorded messages.

The `<consumer-repository-owner>/mailings` repository receives a
`send-transactional-email` dispatch with a template, recipient, placeholders and
an idempotency key. It must support:

| Recipient    | Introduction template   | Thank-you template       |
| ------------ | ----------------------- | ------------------------ |
| Host contact | `meetup-intro-hosting`  | `meetup-thanks-hosting`  |
| Speaker      | `meetup-intro-speakers` | `meetup-thanks-speakers` |

A successful dispatch means GitHub accepted the request. Check the mailings
repository's run for the actual email result.

## Diagnose and recover

Inspect `communication-diagnostics` on issue-update runs and the daily audit's
summary. `planned-count` counts planned messages; `dispatched-count` counts
provider calls, including rejected or uncertain attempts.

The bot keeps a delivery ledger in an issue comment. Existing records prevent
repeated delivery:

| Delivery result           | Next action                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `accepted`                | Check the provider if delivery is missing; the workflow does not resend                              |
| Rate limited (`deferred`) | Retry later; the reservation is released if the ledger update succeeds                               |
| `rejected`                | Fix the reported credential, destination or request issue; recorded attempts require manual recovery |
| `pending` or `uncertain`  | Check the provider before any manual recovery; the request may already have been accepted            |

There is no automatic reset for recorded deliveries. Do not delete the ledger to
retry one message: that would remove duplicate protection for other messages. A
failed ledger read or reservation prevents dispatch. Use the reusable workflows
so issue updates and audits share the same per-issue concurrency lock.

The direct
[communication action](../../actions/communication/reconcile/README.md) provides
`check` mode to report the plan without sending messages or capturing approval.
Direct action callers supply a token for the mailings repository through the
action's `mailings-token` input.
