# ADR 0005: Use one communication reconciliation path

Status: Accepted; other action modes partially superseded by [ADR 0006](0006-explicit-reconciliation-behavior.md)

Date: 2026-09-30

Partially supersedes [ADR 0001](0001-centralize-meetup-event-automation.md) for
the communication action's mode and caller-authorization inputs.

## Context

Both operational workflows request communication dispatch. The explicit `check`
mode is used only by integration CI. Maintaining a separate caller-selected
mode adds a switch to an action whose production behavior is fixed.

## Decision

Remove the communication action's `mode` and `dispatch-authorized` inputs and
their internal request parameters. Every invocation reconciles due communications.
Configuration, approval, current issue state, and delivery-ledger checks determine
whether delivery can proceed. The reusable workflows hold the shared event lock;
direct callers must provide the same concurrency group. The action no longer
requires the caller's boolean assertion that the lock is held.

The effective result mode remains `check` when a gate blocks delivery and
`dispatch` when delivery is enabled. Other actions retain their mode inputs.

Integration CI uses an unapproved synthetic issue and the shared event lock. It
asserts a planned result with zero dispatched messages. Unit tests cover approved
delivery and blocked paths with controlled gateways.

Issue updates and audits retain distinct error policies. Keep
`report-errors-to-issue` as a required input without a default: issue updates
explicitly fail on diagnostic errors, and audits explicitly report errors in the
issue and succeed once the report is persisted.

## Consequences

Callers remove the communication action's `mode` and `dispatch-authorized` inputs
and explicitly select `report-errors-to-issue`. Production workflows keep
their dispatch behavior and concurrency lock. The action no longer offers an
independent planning-only selector.
