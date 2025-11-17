# Google Drive event assets

The publication domain owns event folder names and template reconciliation.
`ManageMeetupAssets` coordinates event parsing, host resolution, publication,
and issue projection. `google-drive-asset-repository` implements the
publication-owned `AssetRepository` port using the focused `@googleapis/drive`
SDK. The action entrypoint lives in `packages/runtime/github-actions` and is
published at `actions/publication/reconcile-assets`.

## Enable the integration

In the consumer repository, set these variables:

- `CI_GOOGLE_DRIVE_MEETUP_FOLDER_ID`: parent of the event folders.
- `CI_GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID`: folder containing file templates.

Pass the service-account JSON explicitly as the optional `google-credentials`
secret to `update-meetup-issue.yml` and `check-active-meetup-issues.yml`:

```yaml
secrets:
  github-app-private-key: ${{ secrets.CI_BOT_APP_PRIVATE_KEY }}
  google-credentials: ${{ secrets.CI_GOOGLE_SERVICE_ACCOUNT_CREDENTIALS }}
```

The service account needs read access to templates and permission to create,
copy, and update files in the parent folder. Shared drives are supported; this
action does not change sharing permissions. Missing credentials leave assets
as manual work and produce `publication.assets.unavailable`. Supplied but
invalid credentials or folder IDs fail the action without printing secret
values or provider response bodies.

For direct action use, set `GOOGLE_DRIVE_MEETUP_FOLDER_ID` and
`GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID` in its environment. Direct use supports
`check`; `fix` is an internal workflow operation requiring
`mutation-authorized: "true"` while holding the shared non-cancelling per-event
lock. The two public event workflows provide that lock and assertion.

## Reconciliation behavior

- A resolved host and valid civil event date are required. Unrelated issues and
  cancelled events are skipped.
- Folders are named `YYYY-MM-DD - Month - Host`, with English month names
  calculated from the civil date independently of the runner timezone.
- Each template file must have a unique `template_kind` app property. Its
  filename can contain `[EVENT_DATE:YYYY-MM-DD]` placeholders.
- Copies retain `template_file_id` and `template_kind` app properties. Changed
  event dates, host names, template filenames, and kinds are reconciled without
  creating duplicate copies.
- `drive-files` is a JSON object mapping `<template_kind>-link` to file URLs.
  `asset-url` contains the folder URL. The versioned `result` envelope includes
  these links and diagnostics, without private referential records.
- `check` reads metadata and reports drift without modifying Drive or GitHub.
  `fix` also projects the managed folder URL through the event document codec.
  Event normalization and managed comments remain owned by event reconciliation.

## Migration and retries

An existing issue folder link can be adopted when it points to a non-trashed
folder inside the configured parent. A conflicting `issue_number` or
repository-scoped event key is rejected. Adoption stores a SHA-256 key derived
from the repository, issue identity, and asset policy version, retaining the
legacy `issue_number` property. Existing untagged template copies are adopted
only by an unambiguous exact expected filename. Conflicting folder or file
matches require manual reconciliation.

All Drive listings are paginated, including empty intermediate pages. An
incomplete search or repeated pagination token fails reconciliation. A repeated
successful run finds existing folder and template metadata and performs no
duplicate creation. The workflows serialize automation for each event, and the
journey checks for concurrent human edits before Drive work and before
persisting the issue projection.

There is no transaction spanning Drive and GitHub. A failed issue update can
leave successfully created assets for the next reconciliation to reuse. Drive
writes are not automatically retried after an ambiguous response. A rate limit
is reported for a later retry; denied access reports credential, folder-access,
or quota checks. For an uncertain write, inspect provider state before retrying.
Exactly-once creation is not guaranteed across lost responses or Drive search
indexing delays.

The former root action, `src/linter` classes, npm lockfile, and standalone
`fix-meetup-drive.mjs` script are superseded by the workspace use cases and
dedicated action. No real Drive folders or consumer event issues are modified
by the local test suite.
