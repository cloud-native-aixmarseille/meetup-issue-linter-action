# Google Drive event assets

The issue-update and daily-audit workflows create an event folder, copy its
templates, and save the folder URL in **Drive Link** on the issue.

## Configure

Create two distinct Drive folders: a parent for event folders and a folder
containing the template files. Give the service account read access to the
templates and permission to create folders, copy files and update files in the
parent. Shared drives are supported. Configure sharing for attendees and
speakers yourself; the automation does not change permissions.

Follow [repository setup](../usage/setup.md), then pass these settings to both
`update-meetup-issue.yml` and `check-active-meetup-issues.yml`:

| Consumer setting                                  | Reusable workflow parameter                    |
| ------------------------------------------------- | ---------------------------------------------- |
| Secret `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`       | Secret `google-credentials`                    |
| Variable `GOOGLE_DRIVE_MEETUP_FOLDER_ID`          | Input `google-drive-meetup-folder-id`          |
| Variable `GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID` | Input `google-drive-meetup-template-folder-id` |

The credential is the service-account JSON, including `type`, `client_email` and
`private_key`. The credential and both folder IDs are required. Folder settings
contain IDs, not URLs, and must differ. Missing or invalid settings fail asset
reconciliation.

## Prepare templates

The template folder must contain at least one file and no subfolders. Each file
needs a non-empty, unique `template_kind` in its Drive `appProperties` metadata,
such as `slides` or `attendance`. Set this metadata through the Drive API using
the same application credentials used by the automation.

Use `[EVENT_DATE:YYYY-MM-DD]` in filenames where the event date belongs. For
example, `Slides [EVENT_DATE:YYYY-MM-DD]` becomes `Slides 2026-10-15`.

The automation copies files and substitutes filenames. Edit presentation
content, attendee sheets and other document content yourself.

## Run and retry

An issue needs a valid date and a host resolved from the
[referentials](../reference/referentials.md). Cancelled and unrelated issues are
skipped. Event folders use `YYYY-MM-DD - Month - Host`, with English month
names.

Each issue owns one managed folder. Changing its date or host renames that
folder. Each template file owns one managed copy: changes to template names or
kinds update the copy's name and metadata; changes to template contents do not
replace existing copy contents. New templates produce new copies.

Files are identified by stored metadata, not their names. Manually created files
with matching names are left alone. Repeated successful runs reuse managed
assets. When automation is enabled, it sets **Drive Link** to its managed
folder.

If Drive succeeds but saving the issue fails, rerun to reuse the assets and save
the link. If a Drive write times out or has an uncertain result, inspect Drive
before retrying: an interrupted response can leave a created file or folder.
Duplicate managed folders or copies require manual reconciliation. For access
errors, check service-account permissions and quota; for rate limits, retry
later.

The direct
[assets action](../../actions/publication/reconcile-assets/README.md) reconciles
assets on every invocation. Call it under the shared event workflow lock. Its
`asset-url` output is the folder URL; `drive-files` maps each
`<template_kind>-link` to a copied file URL.
