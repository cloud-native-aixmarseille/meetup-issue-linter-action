# Organize a meetup

This guide assumes the [repository setup](setup.md) is complete.

## Create the event

Open a new issue with the **Meetup** form. Fill in:

- **Event Title** and **Event Date** (`YYYY-MM-DD`).
- **Hoster**, using the generated choices.
- **Event Description**, with the public event summary.
- **Agenda**, with a speaker reference and description for every talk.

Copy speaker names from the form. For example:

```text
- Alex Example: Reliable platforms
- Sam Example, Jo Example: Operating Kubernetes
```

Select the aperitif and restaurant/bar options and use the checklists to track
preparation. Keep email addresses, phone numbers, and other contact details in
the private [referentials](../reference/referentials.md).

## Resolve diagnostics and confirm participation

The issue workflow normalizes supported fields and updates a diagnostic comment.
Read that comment and fix missing or invalid values. If the workflow fails, open
its Actions run to identify the failing integration or configuration.

After confirming participation, add `hoster:confirmed` and `speakers:confirmed`.
The automation maintains the corresponding `needed` labels. A ready event has
valid required fields, resolved host and speaker references, both confirmations,
Meetup/CNCF/Drive links, and no blocking diagnostics. The **OpenFeedback Link**
field may stay empty until the automation creates the feedback event.

Publish the event on Meetup and the CNCF community platform, then fill in
**Meetup Link** and **CNCF Link**. These publishing steps are manual.

## Prepare assets and feedback

The workflow creates the [Drive event folder](../integrations/assets.md), copies
the configured templates, and fills **Drive Link**. Check the Actions report if
asset preparation fails.

Leave **OpenFeedback Link** empty to have the event created automatically using
the required [organization API key](../integrations/feedback.md). A valid existing
feedback URL is reused. Add talks and speakers in OpenFeedback before the meetup;
event creation does not populate them.

The shared Kutt link switches on the event's calendar day in `Europe/Paris`.
Check the daily audit ran and the target contains the expected talks.

## Approve communications

After reviewing the event, a repository user with triage, write, maintain, or
admin access applies `communication:approved`.

If the workflow reports stale approval, review the changed facts, remove the
label, and apply it again. Changes to the event date, participants, readiness,
publication links, routing, language, or the checked-out repository revision can
require new approval. See [communications](../integrations/communications.md)
for message timing and retry behavior. A checkbox does not authorize a message.

## Postpone or cancel

Add `event:postponed` or `event:cancelled` and remove any other `event:*` status
label. If a postponed event is scheduled again, set the new date, remove
`event:postponed`, and review its links and approval.

For a cancelled event, apply `event:cancelled` before closing the issue. Closing
an issue without an explicit status marks it held.

## Complete follow-up

After the meetup, apply `event:held` or close the issue. Passage of time alone
does not confirm that the meetup happened.

Review communication approval for the held event so due thank-you messages can
be sent. Publish slides, import attendance to the CNCF platform, and complete
the remaining post-event tasks. Check the communication result before marking
thank-you tasks complete. Update the follow-up checkboxes yourself after work is
done.

The audit continues to include held events with unfinished follow-up, including
closed issues. Cancelled events and events with complete follow-up are excluded.
