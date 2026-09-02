SHELL := /bin/sh
.DEFAULT_GOAL := up

COMPOSE ?= docker compose
NPM ?= npm
ENV_FILE ?= .env

.PHONY: help check-tools env up down restart ps logs credentials install dev test build verify db-schema db-seed db-setup db-shell destroy

help: ## Show available commands
	@awk 'BEGIN { FS = ":.*##"; printf "Proof & Perk commands:\n\n" } /^[a-zA-Z0-9_-]+:.*##/ { printf "  %-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

check-tools: ## Verify Docker, Docker Compose, and OpenSSL are available
	@command -v docker >/dev/null 2>&1 || { echo "Docker is required."; exit 1; }
	@docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required."; exit 1; }
	@command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required to generate local secrets."; exit 1; }

env: $(ENV_FILE) ## Create .env with generated local secrets when missing

$(ENV_FILE): .env.example
	@jwt_secret=$$(openssl rand -hex 32); \
		db_password=$$(openssl rand -hex 24); \
		admin_password="Local-$$(openssl rand -hex 12)"; \
		temporary_env=$$(mktemp .env.XXXXXX); \
		awk -F= -v OFS="=" \
			-v jwt_secret="$$jwt_secret" \
			-v db_password="$$db_password" \
			-v admin_password="$$admin_password" \
			'$$1 == "JWT_SECRET" { $$2 = jwt_secret } \
			 $$1 == "POSTGRES_PASSWORD" { $$2 = db_password } \
			 $$1 == "ADMIN_PASSWORD" { $$2 = admin_password } \
			 { print }' .env.example > "$$temporary_env"; \
		mv "$$temporary_env" "$(ENV_FILE)"
	@echo "Created $(ENV_FILE) with generated local secrets. Run 'make credentials' for the local administrator login."

up: check-tools $(ENV_FILE) ## Build and start the complete local Docker stack (default)
	@$(COMPOSE) up --build -d --wait
	@app_port=$$(awk -F= '$$1 == "APP_PORT" { print $$2 }' "$(ENV_FILE)"); \
		echo "Proof & Perk is ready at http://localhost:$${app_port:-3000}"; \
		echo "Run 'make credentials' for the local administrator login."

down: check-tools $(ENV_FILE) ## Stop containers while preserving database and receipt volumes
	@$(COMPOSE) down --remove-orphans

restart: check-tools $(ENV_FILE) ## Restart the application stack
	@$(COMPOSE) restart

ps: check-tools $(ENV_FILE) ## Show container and health status
	@$(COMPOSE) ps

logs: check-tools $(ENV_FILE) ## Follow application and database logs
	@$(COMPOSE) logs -f app db

credentials: $(ENV_FILE) ## Print the generated local administrator login
	@awk -F= '$$1 == "ADMIN_EMAIL" { print "Admin email: " $$2 } $$1 == "ADMIN_PASSWORD" { print "Admin password: " $$2 }' "$(ENV_FILE)"

install: ## Install exact Node.js dependencies
	@command -v $(NPM) >/dev/null 2>&1 || { echo "npm is required."; exit 1; }
	@$(NPM) ci

dev: install $(ENV_FILE) ## Start frontend and API development servers (requires local PostgreSQL)
	@$(NPM) run dev

test: install ## Run the automated test suite
	@$(NPM) test

build: install ## Build the production frontend
	@$(NPM) run build

verify: check-tools $(ENV_FILE) install ## Run tests, build, and validate Docker Compose
	@$(NPM) test
	@$(NPM) run build
	@$(COMPOSE) --env-file "$(ENV_FILE)" config --quiet

db-schema: check-tools $(ENV_FILE) ## Apply the PostgreSQL schema through Docker
	@$(COMPOSE) run --rm app-init node server/src/scripts/apply-schema.js

db-seed: check-tools $(ENV_FILE) ## Create or update the administrator through Docker
	@$(COMPOSE) run --rm app-init node server/src/scripts/seed-admin.js

db-setup: check-tools $(ENV_FILE) ## Apply the schema and seed the administrator through Docker
	@$(COMPOSE) run --rm app-init

db-shell: check-tools $(ENV_FILE) ## Open psql in the running database container
	@$(COMPOSE) exec db sh -lc 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

destroy: check-tools $(ENV_FILE) ## Delete containers and all local database/receipt volumes (CONFIRM=yes)
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "This permanently deletes local database and receipt volumes."; \
		echo "Run: make destroy CONFIRM=yes"; \
		exit 1; \
	fi
	@$(COMPOSE) down --volumes --remove-orphans
