# OpenFeedback and the shared feedback link

The issue-update and daily-audit workflows create missing OpenFeedback events,
save their public URLs in the issue, and point the shared Kutt link to the event
on its date.

## Configure

Follow [repository setup](../usage/setup.md), then pass these settings to both
`update-meetup-issue.yml` and `check-active-meetup-issues.yml`:

| Consumer setting                 | Reusable workflow parameter   | Requirement                                                            |
| -------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Secret `KUTT_API_KEY`            | Secret `kutt-api-key`         | Required; key belonging to the owner of the existing link on `kutt.it` |
| Variable `KUTT_FEEDBACK_LINK_ID` | Input `kutt-link-id`          | Required; the link's API `id`, not its short address                   |
| Secret `OPENFEEDBACK_API_KEY`    | Secret `openfeedback-api-key` | Required organization key beginning with `oforg_`                      |

All three settings are required, including for issues with an
existing feedback URL. A missing or malformed OpenFeedback key fails feedback
reconciliation. Use an organization key beginning with `oforg_`; an event-specific
`ofproj_` key is not accepted.

Create the Kutt short link before enabling the workflows. Missing Kutt settings
fail feedback reconciliation. The automation does not create or replace a
missing short link.

A valid existing **OpenFeedback Link** is reused. Supported URLs are
`https://openfeedback.io/<event-id>`, optionally followed by `/YYYY-MM-DD` or `/0`.
Query strings and fragments are rejected. The URL field can remain empty until
the automation fills it; the API key is always required.

## Prepare the event

When the field is empty, the workflow creates an event
through the [OpenFeedback events API](https://api.openfeedback.io/#tag/events).
It uses the meetup title, limited to 100 characters, and the GitHub issue URL as
the schedule link.

Open the saved URL and add talks and speakers in OpenFeedback before the meetup.
The automation creates the event only; it does not populate the agenda or check
that talks are ready. Once the URL is saved, subsequent runs leave the
OpenFeedback event unchanged.

Creation requires a valid event date and a title. A complete agenda is not
required. Closed, cancelled, postponed and unrelated issues are skipped.

## Event-day update

The shared Kutt link changes only on the event's calendar day in `Europe/Paris`.
Future and past events cannot take it over. The link keeps its short address;
only its target changes. If the target already matches, no update is made.

Keep the daily audit enabled. If no run occurs on the event day, update Kutt
manually. If several active meetups share the date, the workflow reports
`publication.feedback.ambiguous-date`; choose the target manually.

## Resolve failures

A failed issue update after successful event creation can be retried. The event
ID is stable for the repository and issue. A retry finds the same event and
updates its name and schedule link, preserving its talks, settings and votes.

For a missing Kutt link, verify its API ID and the key's owner. For an
OpenFeedback authorization error, verify that the organization key has access to
the event. If the issue changed during a run, rerun after editing is complete.

The direct
[feedback action](../../actions/publication/reconcile-feedback/README.md)
reconciles feedback on every invocation. Call it under the shared event workflow
lock used by the reusable workflows.
