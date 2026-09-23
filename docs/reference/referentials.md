# Host and speaker referentials

The consumer repository stores two UTF-8 CSV files. Keep contact details in that
private repository; generated form choices contain public display names.

## Hosts

Path: `referentials/hosting.csv`.

| Column       | Required | Meaning                                                |
| ------------ | -------- | ------------------------------------------------------ |
| `host_id`    | Yes      | Stable ID: `host-` followed by four digits.            |
| `name`       | Yes      | Public host display name.                              |
| `contact_id` | Yes      | Stable contact ID: `contact-` followed by four digits. |
| `contact`    | Yes      | Contact person's name.                                 |
| `mail`       | Yes      | Valid contact email address.                           |
| `phone`      | No       | Contact phone number.                                  |
| `address`    | Yes      | Host address.                                          |

Synthetic example:

```csv
host_id,name,contact_id,contact,mail,phone,address
host-0001,Example Host,contact-0001,Example Contact,host@example.test,,1 Example Street
```

Several rows may use the same `host_id` and host display name for different
contacts. Each contact ID must be unique. The first contact for a host is used
for communication; keep that row first when changing the catalog.

## Speakers

Path: `referentials/speakers.csv`.

| Column       | Required | Meaning                                               |
| ------------ | -------- | ----------------------------------------------------- |
| `speaker_id` | Yes      | Unique stable ID: `speaker-` followed by four digits. |
| `firstname`  | Yes      | Public first name.                                    |
| `lastname`   | Yes      | Public last name.                                     |
| `company`    | Yes      | Company or affiliation.                               |
| `mail`       | Yes      | Valid email address.                                  |
| `phone`      | No       | Phone number.                                         |

Synthetic example:

```csv
speaker_id,firstname,lastname,company,mail,phone
speaker-0001,Alex,Example,Example Company,alex@example.test,
```

Host display names and speaker full names must be unique after normalization.
Duplicate names invalidate the catalog even when the stable IDs differ.

Keep IDs unchanged when names or contact details change. Do not reuse an ID for
a different host, contact, or speaker. Quote CSV values containing commas,
quotes, or newlines.

## Use references in issues

Choose a host from the generated dropdown. Copy speaker names from the form into
the agenda. You can also include the catalog ID explicitly:

```text
- Alex Example [speaker-0001]: Reliable platforms
```

Unknown or ambiguous references produce diagnostics. Correct the catalog or
issue instead of adding contact details to the issue.

## Update the catalogs

1. Edit the CSV files and preserve existing IDs.
2. Open a pull request and wait for
   [data validation](../../.github/workflows/check-meetup-referentials-and-issue-form.md).
   Invalid catalogs and projection errors fail the check; stale choices are
   advisory.
3. Merge valid changes. The synchronization workflow opens a pull request if the
   generated choices need updating. Review and merge that update.

You can also regenerate the form locally and include it with the catalog
changes.

To regenerate locally, check out `meetup-event-automation` at the same release
commit used by your workflows, alongside the consumer checkout. With Node.js 24,
run from the **consumer repository root**:

```sh
INPUT_LOCALE=en INPUT_MODE=fix node ../meetup-event-automation/actions/referential/sync-issue-form/dist/index.js
git diff -- .github/ISSUE_TEMPLATE/meetup.yml
```

Use the same locale as your workflows (`en` or `fr`) and adjust the sibling
checkout path if needed. This runs the committed action bundle against the local
CSV files and updates the local form; it needs no GitHub token and makes no
network requests. Review the diff before committing.

The
[synchronization workflow](../../.github/workflows/update-meetup-issue-form.md)
also opens a pull request when choices on the default branch need updating. It
changes the host dropdown and speaker reference block in the existing form.
Maintain other form fields yourself and keep their IDs and labels intact.

The initial form must include the `hoster` dropdown and a Markdown block with
`<!-- Available speakers -->`. Use the
[form template](../../__tests__/meetup-issue-template.yml) when setting up a new
repository.
