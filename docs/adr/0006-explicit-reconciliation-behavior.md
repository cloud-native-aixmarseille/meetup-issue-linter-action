# ADR 0006: Match action inputs to operational behavior

Status: Accepted

Date: 2026-09-30

Partially supersedes [ADR 0001](0001-centralize-meetup-event-automation.md) and
[ADR 0005](0005-single-communication-reconciliation-path.md) for the remaining
reconciliation inputs.

## Context

Issue updates and daily audits both reconcile assets and feedback in `fix` mode.
Their integration checks use `check` only to exercise missing credentials, which
fail before any remote operation in either mode.

Event reconciliation and issue-form synchronization each use both modes in
operational workflows. The pull-request issue-form check allows projection
drift because synchronization runs after merge. The drift-failure switch has no
other effective production value; it has no effect in `fix` mode.

## Decision

Remove `mode` from the assets and feedback actions and their journey requests.
Every invocation performs reconciliation with the existing credential checks,
prerequisite checks, stale-issue protection, and shared workflow concurrency lock.
Integration checks continue to verify missing credentials before remote work.

Keep `mode` for event reconciliation and issue-form synchronization, but require
callers to select `check` or `fix` explicitly without a default.

Remove `fail-on-drift` from issue-form synchronization. Check mode always reports
projection drift without failing. Error diagnostics and execution errors still
fail in either mode. Fix mode writes the projection and reports changed files.

## Consequences

Direct publication callers remove `mode` and provide the shared event lock.
Publication actions no longer provide a preview mode. Direct event and issue-form
callers must specify `mode`. Issue-form callers remove `fail-on-drift`; drift is
always advisory, matching the pull-request workflow. Operational workflow behavior
is unchanged.
