PNPM ?= corepack pnpm

.PHONY: help setup typecheck test package lint lint-fix ci

help: ## Display help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

setup: ## Setup project
	$(PNPM) install --frozen-lockfile

typecheck: ## Type-check every workspace project through Nx
	$(PNPM) workspace:build

test: ## Test every workspace project through Nx
	$(PNPM) test

build: ## Build every workspace project through Nx
	$(PNPM) workspace:build

package: ## Build all committed GitHub Action bundles
	$(PNPM) package

lint: ## Execute linting
	$(PNPM) lint
	$(call run_linter)

lint-fix: ## Execute linting and fix
	$(PNPM) format
	$(PNPM) lint:fix
	$(call run_linter, \
		-e FIX_MARKDOWN=true \
		-e FIX_NATURAL_LANGUAGE=true \
		-e FIX_SHELL_SHFMT=true \
		-e FIX_BIOME_LINT=true \
		-e FIX_BIOME_FORMAT=true \
		-e FIX_YAML_PRETTIER=true \
		-e FIX_MARKDOWN_PRETTIER=true \
	)

check-dist: ## Check that the dist folder is up to date
	$(PNPM) check:dist

ci: setup ## Execute all CI quality gates
	$(MAKE) lint-fix
	$(MAKE) typecheck
	$(MAKE) build
	$(MAKE) package
	$(MAKE) test
	$(MAKE) check-dist

define run_linter
	DEFAULT_WORKSPACE="$(CURDIR)"; \
	LINTER_IMAGE="linter:latest"; \
	VOLUME="$$DEFAULT_WORKSPACE:$$DEFAULT_WORKSPACE"; \
	docker build --platform=linux/amd64 --build-arg UID=$(shell id -u) --build-arg GID=$(shell id -g) --tag $$LINTER_IMAGE .; \
	docker run \
		--platform=linux/amd64 \
		-v $$VOLUME \
		--rm \
		-e DEFAULT_WORKSPACE="$$DEFAULT_WORKSPACE" \
		-e FILTER_REGEX_INCLUDE="$(filter-out $@,$(MAKECMDGOALS))" \
		$(1) \
		$$LINTER_IMAGE
endef

#############################
# Argument fix workaround
#############################
%:
	@:
