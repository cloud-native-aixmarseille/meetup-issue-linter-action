# Developer guide

This repository treats documentation, executable rules, and developer tooling as
part of the product.

## Source of truth

- `README.md` explains the repository shape and public delivery surface.
- `docs/adr/0001-centralize-meetup-event-automation.md` defines the intended
  architecture and dependency direction.
- `tests/architecture.spec.ts` and `tests/contracts.spec.ts` encode the
  structural rules that must stay deterministic.
- `.github/copilot-instructions.md` inherits from this guide for agent behavior.

## Daily workflow

Use the repository entrypoints instead of ad hoc shell commands:

- `make setup`
- `make lint`
- `make check-knip`
- `make quality`
- `make check-architecture`
- `make check-contracts`
- `make package`
- `make test`
- `make check-dist`

## Quality rules

- Prefer small, inward-facing changes that preserve dependency direction.
- Keep business rules in domain and application packages.
- Keep adapters and runtime entrypoints thin and explicit.
- Update documentation and tests together when behavior or contracts change.
- Prefer deterministic checks and named tasks over one-off commands.
- Treat generated action and workflow documentation as source-controlled output
  that must stay in sync.

## Agent guidance

Agents should read this guide before editing code. When code and documentation
conflict, update the relevant documentation or call out the mismatch rather than
silently ignoring it.
