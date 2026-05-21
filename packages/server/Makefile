.PHONY: up down restart logs status

# Runs the Hono server under PM2. Requires `npm i -g pm2` (or use `bun pm2` if installed locally).

up:
	pm2 start ecosystem.config.cjs --update-env
	pm2 save

down:
	-pm2 delete gantt-server

restart:
	pm2 restart gantt-server --update-env

logs:
	pm2 logs gantt-server --lines 200

status:
	pm2 status gantt-server
