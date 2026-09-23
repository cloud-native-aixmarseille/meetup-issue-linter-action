# Localization

All public actions and reusable workflows accept an optional `locale` input:

```yaml
with:
  locale: fr
```

English (`en`) is the default; French (`fr`) is supported. Regional forms such
as `fr-FR`, `fr-CA`, and `fr_CA` use French. Unsupported or malformed locales
fall back to English.

The selected language applies to logs, diagnostic annotations, job summaries,
workflow failure guidance, managed issue comments, generated speaker guidance,
and organizer notifications. Use the same locale for every workflow in a
consumer repository, especially referential checks and issue-form updates.
Changing locale makes the generated form stale until it is synchronized again.

Diagnostic JSON retains canonical English messages and stable codes, fields, and
severities. Existing labels, issue headings, IDs, comment markers, and
approval/ledger formats also stay stable. Unknown diagnostic codes retain their
redacted English explanation. Static workflow metadata and externally rendered
email bodies are outside these catalogs.

Changing notification language requires renewed communication approval (remove
and re-add the approval label). It does not resend deliveries already recorded
in the ledger.

## Ownership

The shared `packages/presentation/localization` package wraps
[`@formatjs/intl`](https://formatjs.github.io/docs/intl/) and provides
formatting, locale normalization, and typed catalog contracts. It contains no
feature wording.

| Responsibility                                           | Catalogs and scoped translator                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Action reports, errors, and diagnostic annotations       | `packages/runtime/github-actions/src/i18n` — `ActionMessages`                         |
| Managed issue comments                                   | `packages/adapter/github-event-comment-repository/src/i18n` — `EventCommentMessages`  |
| Issue-form speaker guidance                              | `packages/adapter/yaml-issue-form-projection/src/i18n` — `IssueFormMessages`          |
| Organizer notification content and its approval revision | `packages/runtime/github-actions/src/notifications` — `OrganizerNotificationMessages` |

Keep wording, keys, parameter types, and catalog tests with the presenter that
owns them. Pass the resolved locale across package boundaries; each owner
creates its own translator. Do not import another presenter's catalogs or
introduce a global message-key union. Domain and application rules continue to
emit stable diagnostic codes without translation dependencies.

## Adding or changing messages

1. Add a semantic key to the owning presenter's English catalog, then add its
   French translation. Keep complete sentences together.
2. Use ICU placeholders, `plural`, and `select` for variable text. Add typed
   arguments to that owner's `MessageParameters` and samples to its
   `catalog.test.ts`. Keep identifiers unformatted; use `{count, number}` for
   quantities. Owner-local tests validate syntax, key parity, and arguments.
3. Render with the owner's scoped translator. Action operations receive
   `ActionMessages` from `ActionRunner`; pass its `locale` through composition.
   Do not read ambient environment locale or maintain global language state.
4. Preserve redaction and destination escaping. Never pass raw exceptions,
   provider responses, or private catalog data into a template. FormatJS's
   default logging stays disabled to protect interpolation values.
5. Add relevant behavior tests. Update
   `OrganizerNotificationMessages.policyRevision` when changing outbound
   notification wording, without changing delivery idempotency keys.
6. Run `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm package`, and
   `pnpm check:dist`. Commit regenerated bundles and public reference docs.

To add a language, extend the shared locale contract and normalization, add the
matching catalog in every owner, and extend catalog and notification revision
tests. Update public input descriptions and this guide. Missing or invalid
translations fall back to English using English formatting rules at runtime, but
incomplete catalogs still fail the development checks.

See [ADR 0004](../adr/0004-localize-generated-messages.md) for the architecture
and compatibility decisions.

French catalogs (`*.fr.ts`) are excluded from the English-only Codespell check.
Keep English catalogs checked, and use a line-scoped `codespell:ignore`
directive only for valid French words in mixed-language tests. Review French
spelling when changing translations.
