.PHONY: migrate migrate-file migrate-down help

# Load variables from .env file (if exists)
-include .env
export

# Run all migrations from migrations folder
migrate:
	@echo "Running all migrations..."
	@for file in migrations/*.sql; do \
		echo "Applying $$file..."; \
		PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -f $$file; \
	done
	@echo "All migrations applied."

# Run a specific migration file: make migrate-file FILE=migrations/001_xxx.sql
migrate-file:
	@echo "Applying $(FILE)..."
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -f $(FILE)

# Run migrations via docker-compose
migrate-docker:
	@echo "Running all migrations via docker..."
	@for file in migrations/*.sql; do \
		echo "Applying $$file..."; \
		docker-compose exec -T postgres psql -U $(DB_USER) -d $(DB_NAME) -f /dev/stdin < $$file; \
	done
	@echo "All migrations applied."

# Run a specific migration via docker: make migrate-docker-file FILE=migrations/001_xxx.sql
migrate-docker-file:
	@echo "Applying $(FILE) via docker..."
	docker-compose exec -T postgres psql -U $(DB_USER) -d $(DB_NAME) -f /dev/stdin < $(FILE)

help:
	@echo "Available commands:"
	@echo "  make migrate              - Run all migrations (local psql)"
	@echo "  make migrate-file FILE=x  - Run specific migration (local psql)"
	@echo "  make migrate-docker       - Run all migrations (docker)"
	@echo "  make migrate-docker-file FILE=x - Run specific migration (docker)"
