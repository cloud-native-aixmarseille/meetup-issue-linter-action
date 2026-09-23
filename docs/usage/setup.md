# Set up a meetup repository

This guide configures a consumer repository to run the published automation. You
need repository administration access, a GitHub App installation, Google Drive
service-account access, a Slack bot, an OpenFeedback organization API key, and an
existing Kutt short link. See
[configuration](../reference/configuration.md) for all settings and fixed
community conventions.

## 1. Add the event data files

Create these files in the consumer repository:

```text
.github/ISSUE_TEMPLATE/meetup.yml
referentials/hosting.csv
referentials/speakers.csv
```

Use the [meetup form](../../__tests__/meetup-issue-template.yml) from your
chosen release as the initial form. Populate the CSV files using the
[referential schemas](../reference/referentials.md). Store real contact data
only in the private consumer repository.

Create the labels listed in
[configuration](../reference/configuration.md#labels). Keep the form's field IDs
and labels: the automation uses them to read issues. The synchronization
workflow updates host and speaker choices in the existing form; it does not
create the form.

## 2. Configure credentials

Install a GitHub App on the consumer repository with these repository
permissions:

| Permission           | Used for                                          |
| -------------------- | ------------------------------------------------- |
| Issues: write        | Update event issues and managed comments.         |
| Contents: write      | Create the issue-form update branch.              |
| Pull requests: write | Open the issue-form synchronization pull request. |

Install the same App on `mailings` under the consumer repository's owner with
**Contents: write** permission for email dispatch. Each workflow creates the
repository-scoped tokens it needs and revokes them when the job ends.

Add the following repository settings:

| Type     | Name                     | Value                                                      |
| -------- | ------------------------ | ---------------------------------------------------------- |
| Variable | `CI_BOT_APP_CLIENT_ID`   | GitHub App client ID.                                      |
| Secret   | `CI_BOT_APP_PRIVATE_KEY` | App private key in PEM format.                             |
| Variable | `KUTT_FEEDBACK_LINK_ID`  | API ID of the existing Kutt short link.                    |
| Secret   | `OPENFEEDBACK_API_KEY`   | OpenFeedback organization API key beginning with `oforg_`. |
| Secret   | `KUTT_API_KEY`           | API key of that link's owner.                              |

Both event workflows require the OpenFeedback key and both Kutt settings,
including when events already have feedback URLs. Also configure the required
Drive and Slack settings:

| Type     | Name                                     | Value                                                  |
| -------- | ---------------------------------------- | ------------------------------------------------------ |
| Secret   | `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`     | Service-account JSON with access to the Drive folders. |
| Variable | `GOOGLE_DRIVE_MEETUP_FOLDER_ID`          | Parent folder ID for event assets.                     |
| Variable | `GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID` | Distinct folder ID containing templates.               |
| Secret   | `SLACK_BOT_TOKEN`                        | Bot token allowed to post to the organizer channel.    |
| Variable | `SLACK_CHANNEL_ID`                       | Organizer channel ID.                                  |

Prepare [Drive templates](../integrations/assets.md),
[OpenFeedback and Kutt](../integrations/feedback.md), and
[email and Slack delivery](../integrations/communications.md) before running
event workflows.

## 3. Add workflow callers

Create the four files below in the consumer repository. Replace every
`RELEASE_SHA` with the same full 40-character commit SHA from a
[published release](https://github.com/cloud-native-aixmarseille/meetup-event-automation/releases)
that includes the features you configure. GitHub requires a literal revision in
`uses`.

### Process issue changes

`.github/workflows/meetup-issue-update.yml`:

```yaml
name: Update meetup issue
on:
  issues:
    types:
      [
        opened,
        edited,
        reopened,
        assigned,
        unassigned,
        labeled,
        unlabeled,
        closed,
      ]
permissions: {}
jobs:
  manage:
    uses: cloud-native-aixmarseille/meetup-event-automation/.github/workflows/update-meetup-issue.yml@RELEASE_SHA
    permissions:
      contents: read
    with:
      locale: en
      github-app-client-id: ${{ vars.CI_BOT_APP_CLIENT_ID }}
      kutt-link-id: ${{ vars.KUTT_FEEDBACK_LINK_ID }}
      slack-channel-id: ${{ vars.SLACK_CHANNEL_ID }}
      google-drive-meetup-folder-id: ${{ vars.GOOGLE_DRIVE_MEETUP_FOLDER_ID }}
      google-drive-meetup-template-folder-id: ${{ vars.GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID }}
    secrets:
      github-app-private-key: ${{ secrets.CI_BOT_APP_PRIVATE_KEY }}
      openfeedback-api-key: ${{ secrets.OPENFEEDBACK_API_KEY }}
      kutt-api-key: ${{ secrets.KUTT_API_KEY }}
      google-credentials: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS }}
      slack-token: ${{ secrets.SLACK_BOT_TOKEN }}
```

### Run the daily audit

`.github/workflows/meetup-issues-checks.yml`:

```yaml
name: Check active meetup issues
on:
  workflow_dispatch:
  schedule:
    - cron: "0 9 * * *"
permissions: {}
jobs:
  audit:
    uses: cloud-native-aixmarseille/meetup-event-automation/.github/workflows/check-active-meetup-issues.yml@RELEASE_SHA
    permissions:
      contents: read
      issues: read
    with:
      locale: en
      github-app-client-id: ${{ vars.CI_BOT_APP_CLIENT_ID }}
      kutt-link-id: ${{ vars.KUTT_FEEDBACK_LINK_ID }}
      slack-channel-id: ${{ vars.SLACK_CHANNEL_ID }}
      google-drive-meetup-folder-id: ${{ vars.GOOGLE_DRIVE_MEETUP_FOLDER_ID }}
      google-drive-meetup-template-folder-id: ${{ vars.GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID }}
    secrets:
      github-app-private-key: ${{ secrets.CI_BOT_APP_PRIVATE_KEY }}
      openfeedback-api-key: ${{ secrets.OPENFEEDBACK_API_KEY }}
      kutt-api-key: ${{ secrets.KUTT_API_KEY }}
      google-credentials: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS }}
      slack-token: ${{ secrets.SLACK_BOT_TOKEN }}
```

This example runs at 09:00 UTC. Event-day decisions use `Europe/Paris`. The
audit is needed for timed communications and the event-day feedback link update,
even when nobody edits an issue.

### Synchronize the issue form

`.github/workflows/synchronize-meetup-issue-form.yml`:

```yaml
name: Update meetup issue form
on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - referentials/**
      - .github/ISSUE_TEMPLATE/meetup.yml
permissions: {}
jobs:
  synchronize:
    uses: cloud-native-aixmarseille/meetup-event-automation/.github/workflows/update-meetup-issue-form.yml@RELEASE_SHA
    permissions:
      contents: read
    with:
      locale: en
      github-app-client-id: ${{ vars.CI_BOT_APP_CLIENT_ID }}
    secrets:
      github-app-private-key: ${{ secrets.CI_BOT_APP_PRIVATE_KEY }}
```

Run this workflow after the initial files are on the default branch. Review and
merge its pull request before using the form. Replace `main` if your default
branch has another name.

### Validate changes to referentials and the form

`.github/workflows/check-meetup-data.yml`:

```yaml
name: Check meetup data
on:
  pull_request:
    paths:
      - referentials/**
      - .github/ISSUE_TEMPLATE/meetup.yml
permissions: {}
jobs:
  validate:
    uses: cloud-native-aixmarseille/meetup-event-automation/.github/workflows/check-meetup-referentials-and-issue-form.yml@RELEASE_SHA
    permissions:
      contents: read
    with:
      locale: en
```

This check fails for invalid CSV data or projection errors. Stale generated
choices are advisory; the synchronization workflow updates them after merge. See
[updating referentials](../reference/referentials.md#update-the-catalogs).

Use the same `locale` in all four callers. Set it to `fr` for French generated
messages; `en` is the default.

Keep settings and release SHA identical in the two event callers. The reusable
workflows provide the per-event concurrency lock.

## 4. Verify setup

Open a Meetup issue. Check the Actions run and the diagnostic comment on the
issue. Correct any missing fields or credential errors, then follow the
[organizer guide](organize-meetup.md).

To upgrade, change all four pins to the selected release commit and review its
input and secret contracts. Run the data check and an event audit after the
upgrade. Restore the prior pins to roll back the workflow version.
