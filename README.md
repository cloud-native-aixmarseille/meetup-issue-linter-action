<!-- header:start -->

# Meetup Event Automation

<!-- header:end -->

GitHub Actions workflows for organizing Cloud Native Aix-Marseille meetups. Each
meetup is tracked in a GitHub issue: its date, host, speakers, agenda,
publication links, and follow-up tasks.

The automation validates and updates those issues, keeps host and speaker
choices in sync, prepares Google Drive assets and OpenFeedback events, updates
the shared feedback link, and sends approved email and Slack messages.

This repository contains the automation. The consuming meetup repository stores
the issues, private host and speaker CSV files, credentials, and workflow
triggers. The community paths, labels, timezone, and publication destinations
are fixed by this project's [configuration](docs/reference/configuration.md).

## Set up a repository

Follow the [setup guide](docs/usage/setup.md) to add the issue form,
referentials, GitHub App credentials, Drive, Slack, OpenFeedback, Kutt, and
reusable workflow callers. Pin every caller to the same published release commit.

- [Google Drive](docs/integrations/assets.md): create event folders and copy
  templates.
- [OpenFeedback](docs/integrations/feedback.md): create feedback events automatically.
- [Email and Slack](docs/integrations/communications.md): send approved
  communications.

Set the optional `locale` workflow input to `fr` for French generated messages;
English is the default. Use the same locale in all four callers.

## Organize a meetup

1. Open a **Meetup** issue and fill in the date, title, host, description, and
   agenda.
2. Read the automation's diagnostic comment and complete the missing
   information.
3. Add `hoster:confirmed` and `speakers:confirmed` after confirming
   participation.
4. Publish the Meetup and CNCF event pages, then add their links to the issue.
5. Review the event and apply `communication:approved` to authorize
   communications.
6. Complete the event and its follow-up checklist.

The [organizer guide](docs/usage/organize-meetup.md) covers agenda syntax,
postponements, feedback preparation, approvals, and follow-up.

## Documentation

Use the [documentation index](docs/README.md) for setup, configuration,
integration guides, and action and workflow references.

For code changes, see [Contributing](CONTRIBUTING.md) and the
[development guide](docs/development/README.md).

## License

[MIT](LICENSE)
