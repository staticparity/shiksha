#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

ensure_dockerd() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  if ! pgrep -x dockerd >/dev/null 2>&1; then
    sudo dockerd >/tmp/dockerd.log 2>&1 &
    sleep 3
  fi
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  docker info >/dev/null 2>&1
}

start_local_supabase() {
  ensure_dockerd

  if ! docker network inspect local-network >/dev/null 2>&1; then
    docker network create -o 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1' local-network
  fi

  if curl -sf http://127.0.0.1:54321/auth/v1/health >/dev/null 2>&1; then
    echo "Local Supabase already running."
  else
    local attempt=1
    local max_attempts=3
    while (( attempt <= max_attempts )); do
      echo "Starting local Supabase (attempt ${attempt}/${max_attempts})..."
      if ./node_modules/.bin/supabase start --network-id local-network; then
        break
      fi
      echo "supabase start failed; stopping and retrying..." >&2
      ./node_modules/.bin/supabase stop --no-backup >/dev/null 2>&1 || true
      sleep $((attempt * 5))
      ((attempt++)) || true
    done
    if (( attempt > max_attempts )); then
      echo "Failed to start local Supabase after ${max_attempts} attempts." >&2
      exit 1
    fi
  fi

  # Wait until Auth is ready (covers race after start returns).
  local i=0
  until curl -sf http://127.0.0.1:54321/auth/v1/health >/dev/null 2>&1; do
    ((i++)) || true
    if (( i > 60 )); then
      echo "Timed out waiting for local Supabase Auth health." >&2
      exit 1
    fi
    sleep 2
  done

  # Standard local demo keys from `supabase start`
  local url="http://127.0.0.1:54321"
  local anon="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

  cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
OPENAI_API_KEY=${OPENAI_API_KEY:-sk-placeholder-for-local-dev}
EOF
  echo "Wrote .env.local for local Supabase."
}

# Prefer injected Cloud Agent secrets when present (hosted Supabase).
if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" && -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
EOF
  echo "Wrote .env.local from environment secrets."
else
  echo "No Supabase secrets found; starting local Supabase stack."
  start_local_supabase
fi

if [[ -z "${OPENAI_API_KEY:-}" || "${OPENAI_API_KEY}" == sk-placeholder* ]]; then
  echo "WARNING: OPENAI_API_KEY is missing or placeholder. Chat/mastery APIs will fail until it is set." >&2
fi
