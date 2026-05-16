#!/usr/bin/env bash
set -euo pipefail

npm run exec -- syncFeatures -d '{"data_source_id":null,"limit":10,"dry_run":false}'
