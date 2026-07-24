.DEFAULT_GOAL := help
.PHONY: help setup dev dev-web build test lint typecheck fmt api-client docker-build docker-up docker-down

help: ## List available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: ## Install all workspace dependencies
	pnpm install

dev: ## Run the app in dev mode via turbo
	pnpm turbo run dev

dev-web: ## Run just the web app
	pnpm --filter @slideops/web dev

build: ## Build the app and packages
	pnpm turbo run build

test: ## Run unit and component tests
	pnpm turbo run test

lint: ## Lint all packages
	pnpm turbo run lint

typecheck: ## Typecheck all packages
	pnpm turbo run typecheck

fmt: ## Format the whole repository
	pnpm exec prettier --write "**/*.{ts,tsx,css,json,md}"

api-client: ## Regenerate the typed API client from the backend openapi contract
	pnpm --filter @slideops/api-client generate

docker-build: ## Build the production image for the app
	docker compose build

docker-up: ## Run the local frontend stack
	docker compose up

docker-down: ## Stop the local frontend stack
	docker compose down
