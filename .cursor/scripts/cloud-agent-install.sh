#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

corepack enable
pnpm approve-builds sharp unrs-resolver
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
