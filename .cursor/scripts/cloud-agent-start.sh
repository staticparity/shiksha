#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

required_vars=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  OPENAI_API_KEY
)

missing=()
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if ((${#missing[@]} > 0)); then
  echo "Missing required environment secrets: ${missing[*]}" >&2
  echo "Add them in the Cloud Agent environment settings before starting the app." >&2
  exit 1
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
EOF

echo "Wrote .env.local from environment secrets."
