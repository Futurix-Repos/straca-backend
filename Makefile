.PHONY: deploy
deploy: 
	git pull
	docker compose up -d --remove-orphans