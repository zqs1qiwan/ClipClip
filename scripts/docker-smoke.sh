#!/bin/sh
# ClipClip release smoke test.
#
# Builds the image (which verifies the pinned base-image digest), starts a throwaway
# container on an isolated host port, waits for /api/health, asserts local-mode defaults,
# key API endpoints and static assets, then removes the container. It never touches the
# production `clipclip` container or the production port 5678.
#
# Requirements: docker, curl (preferred) or wget, node (JSON assertions) and the usual
# POSIX tools (grep, tail, sleep). Nothing else is installed.
#
# Usage:
#   sh scripts/docker-smoke.sh                  # build + smoke on 127.0.0.1:15678
#   sh scripts/docker-smoke.sh --no-build       # reuse an existing image
#   sh scripts/docker-smoke.sh --image clipclip:ci --port 15679
#   sh scripts/docker-smoke.sh --keep           # keep the container for debugging
#   sh scripts/docker-smoke.sh --help
#
# Environment overrides:
#   CLIPCLIP_SMOKE_IMAGE      image reference          (default: clipclip:0.1.0)
#   CLIPCLIP_SMOKE_PORT       host port                (default: 15678; 5678 is refused)
#   CLIPCLIP_SMOKE_TIMEOUT    seconds to wait for up   (default: 30)
#   CLIPCLIP_SMOKE_CONTAINER  container name           (default: clipclip-smoke-<pid>)
#
# Exit codes: 0 = all checks passed, 1 = smoke failure, 2 = bad usage/environment.
set -eu

IMAGE=${CLIPCLIP_SMOKE_IMAGE:-clipclip:0.1.0}
PORT=${CLIPCLIP_SMOKE_PORT:-15678}
TIMEOUT=${CLIPCLIP_SMOKE_TIMEOUT:-30}
CONTAINER=${CLIPCLIP_SMOKE_CONTAINER:-clipclip-smoke-$$}
BUILD=1
KEEP=0

usage() {
  cat <<'EOF'
Usage: sh scripts/docker-smoke.sh [options]

  --image <ref>   image reference to smoke test (default: clipclip:0.1.0)
  --port <port>   host port to publish (default: 15678; 5678 is refused)
  --no-build      skip `docker build` and use an existing image
  --keep          keep the container after the run for debugging
  -h, --help      show this help

Environment: CLIPCLIP_SMOKE_IMAGE, CLIPCLIP_SMOKE_PORT, CLIPCLIP_SMOKE_TIMEOUT,
             CLIPCLIP_SMOKE_CONTAINER.
EOF
}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --image)
      [ "$#" -ge 2 ] || fail "--image needs a value"
      IMAGE=$2
      shift 2
      ;;
    --port)
      [ "$#" -ge 2 ] || fail "--port needs a value"
      PORT=$2
      shift 2
      ;;
    --no-build)
      BUILD=0
      shift
      ;;
    --keep)
      KEEP=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "unknown argument: $1"
      ;;
  esac
done

case "$PORT" in
  *[!0-9]*) fail "port must be numeric: $PORT" ;;
esac
if [ "$PORT" -le 0 ] || [ "$PORT" -ge 65536 ]; then
  fail "port out of range: $PORT"
fi
if [ "$PORT" -eq 5678 ]; then
  fail "refusing to use the production port 5678; pass --port with an isolated port"
fi

command -v docker >/dev/null 2>&1 || fail "docker is required but was not found"
command -v node >/dev/null 2>&1 || fail "node is required for JSON assertions but was not found"

if command -v curl >/dev/null 2>&1; then
  FETCH=curl
elif command -v wget >/dev/null 2>&1; then
  FETCH=wget
else
  fail "curl or wget is required"
fi

# Build context and Dockerfile are relative to the repository root.
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR/.." || fail "cannot enter the repository root"
[ -f Dockerfile ] || fail "Dockerfile not found in $(pwd)"

fetch_path() {
  # GET a path on the smoke container and print the body; non-zero on HTTP error.
  case "$FETCH" in
    curl) curl -fsS --max-time 5 "http://127.0.0.1:$PORT$1" ;;
    wget) wget -q -O - --timeout=5 "http://127.0.0.1:$PORT$1" ;;
  esac
}

cleanup() {
  if [ "$KEEP" -eq 1 ]; then
    echo "Keeping container: $CONTAINER (remove with: docker rm -f $CONTAINER)"
    return 0
  fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap 'cleanup' EXIT
trap 'exit 130' INT TERM

# Never run when the chosen port already serves an app (e.g. production clipclip).
if fetch_path /api/health >/dev/null 2>&1; then
  fail "127.0.0.1:$PORT already answers /api/health; choose another port with --port"
fi

if [ "$BUILD" -eq 1 ]; then
  BASE_IMAGE=$(grep -m 1 '^FROM ' Dockerfile | cut -d ' ' -f 2)
  echo "Building $IMAGE (base image: $BASE_IMAGE)"
  docker build -t "$IMAGE" . || fail "docker build failed"
else
  docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "image $IMAGE not found; run without --no-build"
fi

# Remove a stale container from an interrupted previous run (unique per PID).
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "Starting $CONTAINER on 127.0.0.1:$PORT (production container is not touched)"
docker run -d --name "$CONTAINER" \
  --init \
  --read-only \
  --tmpfs /tmp:size=16m,uid=1000,gid=1000 \
  --tmpfs /data:size=32m,uid=1000,gid=1000 \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  --log-driver json-file --log-opt max-size=1m --log-opt max-file=1 \
  --memory 512m --cpus 1 --pids-limit 256 \
  -p "127.0.0.1:$PORT:5678" \
  "$IMAGE" >/dev/null || fail "docker run failed"

waited=0
until fetch_path /api/health >/dev/null 2>&1; do
  if [ "$waited" -ge "$TIMEOUT" ]; then
    echo "--- container logs ---" >&2
    docker logs "$CONTAINER" >&2 || true
    fail "/api/health not ready after ${TIMEOUT}s"
  fi
  sleep 1
  waited=$((waited + 1))
done
echo "PASS /api/health reachable after ${waited}s"

health=$(fetch_path /api/health) || fail "GET /api/health failed"
printf '%s' "$health" | node -e '
let body = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { body += chunk; });
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    console.error("invalid JSON: " + error.message);
    process.exit(1);
  }
  if (payload.status !== "ok") {
    console.error("expected status=ok, got " + JSON.stringify(payload.status));
    process.exit(1);
  }
  if (payload.publicMode !== false) {
    console.error("expected publicMode=false, got " + JSON.stringify(payload.publicMode));
    process.exit(1);
  }
});
' || fail "health payload assertion failed (expected status=ok and publicMode=false)"
echo "PASS /api/health status=ok, publicMode=false"

check_body() {
  # $1 = path, $2 = optional marker that must appear in the response body
  body=$(fetch_path "$1") || fail "GET $1 failed"
  [ -n "$body" ] || fail "GET $1 returned an empty body"
  if [ -n "${2:-}" ]; then
    printf '%s' "$body" | grep -q "$2" || fail "GET $1 body does not contain: $2"
  fi
  echo "PASS GET $1"
}

check_body /api/live
check_body /api/files/recent
check_body / "ClipClip"
check_body /styles.css "body"
check_body /app.js "import"
check_body /manifest.json "ClipClip"

if [ "$FETCH" = curl ]; then
  sse_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 \
    "http://127.0.0.1:$PORT/api/events" 2>/dev/null || true)
  case "$sse_code" in
    200) echo "PASS GET /api/events (SSE stream opened)" ;;
    *) fail "GET /api/events returned HTTP ${sse_code:-none}" ;;
  esac
fi

echo "SMOKE PASS (image=$IMAGE, port=$PORT, container=$CONTAINER)"