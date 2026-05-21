.PHONY: up down restart logs build status

# Runs the server as a foregrounded Bun process in a docker compose stack.
# Requires Dockerfile + docker-compose.yml in this directory.
up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=200

status:
	docker compose ps
