.PHONY: exec
exec:
	docker exec -it \
		-w /workspaces/zenn-contents \
		zenn-contents-devcontainer \
		/bin/bash

.PHONY: preview
preview:
	npx zenn preview

.PHONY: textlint
textlint:
	npm run textlint
