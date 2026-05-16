#!/usr/bin/env bash
set -euo pipefail

source .env
unset NOTION_API_TOKEN

npm run typecheck
npm run deploy

ntn workers env set \
	DOCS_DATABASE_ID="$DOCS_DATABASE_ID" \
	PERSONAS_DATABASE_ID="$PERSONAS_DATABASE_ID" \
	FEATURES_DATABASE_ID="$FEATURES_DATABASE_ID" \
	EXECUTIONS_DATABASE_ID="$EXECUTIONS_DATABASE_ID"
