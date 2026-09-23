# ADR-0003: Keep production behavior in focused classes

- Status: Accepted
- Date: 2026-09-18
- Builds on: [ADR-0002](0002-runtime-dependency-injection.md)

## Context

The issue-form codec grew to more than a thousand lines, combining Markdown
scanning, legacy migration, operational checklists, reference metadata, participant
links, and patch generation. Similar growth appeared in event rules, referential
validation, approval handling, delivery reconciliation, and runtime composition.
Several package entrypoints contained implementation. Architecture tests enforced
package dependencies but did not prevent these local responsibility and size
problems.

Standalone functions are not intrinsically invalid TypeScript. This repository
chooses class ownership for all production behavior so implementation has a
consistent home. Wrapping a large module in one class would leave the underlying
responsibility problem unresolved.

## Decision

Production TypeScript under package `src` directories uses one focused class per
file. Methods own implementation; callbacks may be local to classes. Interfaces,
function types, constants, and other data declarations may remain at module scope.
Package `src/index.ts` files expose existing declarations rather than implement
behavior. Test code and repository tooling are excluded from this convention.

Keep constructor injection and owned ports for stateful and I/O collaborators.
Allow static methods for stateless rules, parsing, value operations, and runtime
composition. Keep dependencies explicit and inside their existing architectural
layer. Prefer private methods for implementation used only by the owning class;
export collaborators from their module only when another module uses them.

Use Biome errors to enforce one class per file, 300 nonblank lines per file,
60 nonblank lines per function or method, and cognitive complexity at most 15.
Disable its static-only-class prohibition for production code to accommodate this
policy. An AST-based repository check enforces class ownership and package
entrypoints. Tooling unit tests exercise rejected and accepted syntax. Contract tests verify
the actual Biome limits and audit the entire production tree on every test run. Existing
architecture and Knip checks continue to enforce boundaries, cycles, and usage.

The codec becomes a small facade over readers, writers, sections, checklists,
metadata, and participant-link collaborators. Other oversized modules are split
along validation, policy, planning, dispatch, result projection, and composition
responsibilities. Public GitHub Action inputs, outputs, issue schema, and workflow
contracts remain stable. Private workspace TypeScript APIs change from standalone
functions to class methods; their callers and tests move together.

## Consequences

More small modules make ownership and dependencies explicit. Static classes add
syntax compared with pure functions; this is a deliberate repository convention.
Numeric limits are guardrails, not a proof of good design: reviewers still check
cohesion, side-effect ownership, duplication, and useful abstractions. Do not evade
limits with suppression comments or formatting tricks. Preserve synthetic AAA
behavior tests, reference-link round trips, privacy, concurrency guards, and
idempotent delivery while moving code.

The [developer guide](../development/README.md) and `AGENTS.md` document the rules
that require human judgment. Enforce mechanically checkable rules in tooling first.
