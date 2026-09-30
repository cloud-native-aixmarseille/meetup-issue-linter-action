# Testing

Run `pnpm test` for the full suite. Run a matching component while developing:

```sh
pnpm exec vitest run packages/domain/event/src/domain/lifecycle.test.ts
```

Domain and application tests use deterministic inputs, fixed clocks, and
injected collaborators. They do not require live services. Adapter tests use
synthetic data and controlled provider responses. Cover observable behavior,
including invalid input, retries, ambiguous failures, concurrency checks,
privacy, and idempotency when relevant to the change.

## File placement

| Test                                                   | Location                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Component unit test                                    | Beside its source, with the exact basename plus `.test.ts`         |
| Tooling unit test                                      | Beside the script: `scripts/check.mjs` and `scripts/check.test.ts` |
| Shared package fixtures/builders                       | The package's `testing/` directory                                 |
| Repository integration, architecture, or contract test | `tests/**/*.spec.ts`                                               |

Import the component directly. Split independently tested components into
matching files. Do not put unit tests under root `tests/` or name them
`.spec.ts`. `pnpm check:structure`, lint, and contract tests enforce placement
and sibling source names. Production TypeScript configurations exclude unit
tests; spec configurations include them.

## Arrange, Act, Assert

These rules apply to every `*.test.ts` and `*.spec.ts` test case.

1. Name the general behavior using synthetic examples and stable identifiers. Do
   not name tests after live issues, customers, production runs, or incidents.
   Contract tests may assert documented product defaults.
2. Include `// Arrange`, `// Act`, and `// Assert` comments in that order, with
   an empty line between sections.
3. Arrange inputs, expected values, dependencies, and mocks before execution.
   Shared fixtures or hooks may supply setup; explain that in Arrange when no
   extra local setup is needed.
4. Act by calling the behavior and capturing the result. Keep execution outside
   assertions. For synchronous exceptions, define a named callback in Act and
   pass it to `expect` in Assert. For a rejected promise, capture the promise in
   Act and immediately await the rejection assertion in Assert.
5. Assert outcomes and observable side effects. Do not change fixtures or start
   another scenario in Assert. Split independent variations into separate tests
   or use `it.each`. For a stateful sequence, run the sequence in Act and
   capture intermediate observations for assertions afterward.

Helpers, mock implementations, and setup/cleanup hooks do not need artificial
AAA sections. The comments separate phases within each test case.

```typescript
it("rejects a non-positive issue identifier", () => {
  // Arrange
  const input = "0";

  // Act
  const parse = () => RuntimeInput.positiveIntegerInput("issue-number", input);

  // Assert
  expect(parse).toThrow("issue-number must be a positive integer");
});
```

## Repository checks

| Check                                                                      | What it verifies                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Architecture](../../tests/architecture.spec.ts)                           | Dependency layers, package entrypoints, cycles, adapter names, DI boundaries |
| [Code structure](../../tests/contracts/code-structure.spec.ts)             | Actual Biome limits, class ownership, unit-test layout                       |
| [Public actions](../../tests/contracts/public-actions.spec.ts)             | Action inputs, outputs, runtime, dispatch authorization                      |
| [Action reporting](../../tests/contracts/action-reporting.spec.ts)         | Shared runner, public reports, failure policy, and safe rendering            |
| [Localization](../../tests/contracts/localization.spec.ts)                 | Catalog ownership, locale wiring, and diagnostic coverage                    |
| [Public workflows](../../tests/contracts/public-workflows.spec.ts)         | Reusable workflow interfaces, permissions, secrets, pinned dependencies      |
| [Event safeguards](../../tests/contracts/event-side-effects.spec.ts)       | Shared concurrency lock, audit gating, issue-form validation                 |
| [Feedback safeguards](../../tests/contracts/feedback-side-effects.spec.ts) | Feedback action credentials and workflow gating                              |
| [Internal CI](../../tests/contracts/internal-ci.spec.ts)                   | Shared CI, action checks, release documentation wiring                       |
| [Journey integration](../../tests/journey-referential-integration.spec.ts) | Event, catalog, codec, and issue-form behavior together                      |

[`__check-actions.yml`](../../.github/workflows/__check-actions.yml) exercises
bundled actions in CI using a synthetic issue and catalog fixtures. Its cleanup
job closes the test issue. Do not replace these fixtures with live meetup
issues. Communication integration checks use an unapproved synthetic issue
and assert that no messages are dispatched through the standard action path.

`pnpm test:cov` enforces the aggregate thresholds in
[`vitest.config.ts`](../../vitest.config.ts): 90% lines/statements and 85%
branches/functions. Tests, shared fixtures, and runtime bootstrap entrypoints
are excluded from coverage. Coverage percentages do not replace assertions about
failure paths or data privacy.

Use [the development checklist](README.md#choose-checks-for-the-change) to
select checks and rebuild bundles after production changes.
