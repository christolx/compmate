.PHONY: dev api db stack down test lint build check

dev:
	npm run dev

api:
	cd apps/api && go run ./cmd/api

db:
	docker compose up -d --wait db

stack:
	docker compose up -d --build --wait

down:
	docker compose down

test:
	npm test
	cd apps/api && go test -race ./...

lint:
	npm run lint
	cd apps/api && go vet ./...

build:
	npm run build
	cd apps/api && go build -o bin/api ./cmd/api

check: lint test build
