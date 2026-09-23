# Development

This is a TypeScript pnpm workspace. The public deliverables are the GitHub
Actions in `actions/` and reusable workflows in `.github/workflows/`.

Read the [architecture rules](architecture.md) before changing package
responsibilities and the [test conventions](testing.md) before adding tests. Use
[action reporting](reporting.md) and [localization](localization.md) for
generated messages. [AGENTS.md](../../AGENTS.md) also applies to agent-assisted
work.

## Setup

Use Node.js 24 and the pnpm version in [`package.json`](../../package.json).
Action bundles target Node.js 24; the package's minimum supported development
runtime is Node.js 22.12.0.

```sh
pnpm install --frozen-lockfile
```

`make setup` runs the same install. Dependencies, including Biome, come from
`pnpm-lock.yaml`; do not substitute globally installed lint tools or force
incompatible transitive versions to silence dependency warnings.

## Commands

Run commands from the repository root.

| Command                   | Purpose                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm lint`               | Check formatting, Biome rules, class/test structure, and unused code/dependencies        |
| `pnpm build`              | Type-check the root TypeScript project without emitting files                            |
| `pnpm workspace:build`    | Type-check workspace projects through Nx                                                 |
| `pnpm test`               | Run all unit, integration, architecture, and contract tests                              |
| `pnpm test:watch`         | Run Vitest in watch mode                                                                 |
| `pnpm test:cov`           | Run tests with coverage thresholds                                                       |
| `pnpm check:architecture` | Check package boundaries, imports, and cycles                                            |
| `pnpm check:contracts`    | Check action, workflow, CI, and code-structure contracts                                 |
| `pnpm check:structure`    | Check class ownership, entrypoints, and unit-test placement                              |
| `pnpm check:knip`         | Find unused code and dependencies                                                        |
| `pnpm package`            | Rebuild committed action bundles                                                         |
| `pnpm check:dist`         | Rebuild bundles and fail if their bytes were stale or missing                            |
| `pnpm quality`            | Run lint, type-checking, architecture/contracts, packaging, all tests, and bundle checks |

Use `pnpm format` to apply formatting and `pnpm lint:fix` for Biome lint fixes.
Both can edit files; review the resulting diff.

The [Makefile](../../Makefile) provides wrappers for these checks. `make lint`
and `make lint-fix` additionally build and run the repository's Super-linter
Docker image. They require Docker. Super-linter's Biome checks are disabled;
`pnpm` runs the lockfile version.

## Choose checks for the change

- **Production code:** run `pnpm quality` and include changed action bundles.
  Run focused tests while developing; the full command covers behavior,
  architecture, public contracts, and packaging before review.
- **Action metadata or workflow YAML:** run `pnpm check:contracts` and
  `make lint`. Update the adjacent action or workflow reference and the relevant
  usage page.
- **Documentation only:** verify commands and behavior against current source,
  check relative links, and run the applicable Markdown checks through
  `make lint`. Do not add implementation-mirroring tests or rebuild bundles for
  prose changes.

[`scripts/build-actions.mjs`](../../scripts/build-actions.mjs) owns the bundle
entrypoints and build settings. Edit source, then run `pnpm package`; never edit
`actions/**/dist/index.js` directly. `check:dist` compares files before and
after its own rebuild, including missing files, independently of Git staging.

## CI and public documentation

Main and pull-request CI use
[`__shared-ci.yml`](../../.github/workflows/__shared-ci.yml). It runs the shared
linter, Node.js checks, bundle verification, and action integration tests
against a synthetic issue. `lint:ci` emits SARIF; `test:ci` emits JUnit and
coverage reports. These reporting entrypoints must remain compatible with the
shared CI workflows.

Keep action inputs and outputs in `action.yml`, and workflow inputs, outputs,
and secrets in the corresponding YAML. Keep their adjacent Markdown contracts in
sync. The release job in
[`__main-ci.yml`](../../.github/workflows/__main-ci.yml) delegates documentation
updates to the pinned reusable release workflow. There is no local documentation
generation script in this repository.

Usage and reference documentation must describe current, working behavior.
Preserve architectural decision history in
[ADRs](../README.md#architecture-decisions). Put user tasks under `docs/usage/`,
supported settings under `docs/reference/`, integration setup and operations
under `docs/integrations/`, and contributor rules here. Follow the
[documentation rules in AGENTS.md](../../AGENTS.md) when adding or moving pages.
