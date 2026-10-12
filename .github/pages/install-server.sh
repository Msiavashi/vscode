#!/usr/bin/env bash
# Installs (if missing) and starts the VS Code web server matching this web app build.
# Everything lives under ~/.vscode-web-remote; ~/.vscode-server and other users are not touched.
# The server listens on loopback only and requires the token; reach it through an SSH port forward.
#   install-server.sh [start]   install if needed, start if needed, print connection details
#   install-server.sh stop
set -euo pipefail

COMMIT=@COMMIT@
URL=${VSW_URL:-https://github.com/@REPO@/releases/download/server-${COMMIT:0:12}/reh-web-linux-x64.tar.gz}
ROOT=${VSW_HOME:-$HOME/.vscode-web-remote}
PORT=${VSW_PORT:-18765}
DIR=$ROOT/server/$COMMIT
TOKEN_FILE=$ROOT/token
PID_FILE=$ROOT/server.pid
LOG=$ROOT/server.log

mkdir -p "$ROOT"
chmod 700 "$ROOT"

running() { [ -f "$PID_FILE" ] && kill -0 "$(cut -d' ' -f1 "$PID_FILE")" 2>/dev/null; }
stop() {
	if running; then
		kill "$(cut -d' ' -f1 "$PID_FILE")" 2>/dev/null || true
		echo "stopped server"
	fi
	rm -f "$PID_FILE"
}

if [ "${1:-start}" = stop ]; then stop; exit 0; fi

if [ ! -x "$DIR/bin/code-server-oss" ]; then
	echo "Installing server $COMMIT ..."
	TMP=$(mktemp -d "$ROOT/tmp.XXXXXX")
	trap 'rm -rf "$TMP"' EXIT
	curl -fL --progress-bar "$URL" | tar xz -C "$TMP"
	mkdir -p "$ROOT/server"
	mv "$TMP"/* "$DIR"
fi

if [ ! -s "$TOKEN_FILE" ]; then
	umask 077
	head -c 24 /dev/urandom | base64 | tr -d '/+=\n' > "$TOKEN_FILE"
fi
chmod 600 "$TOKEN_FILE"

# A server of another version cannot talk to this web app; replace it.
if running && [ "$(cut -d' ' -f2 "$PID_FILE")" != "$COMMIT" ]; then stop; fi

if ! running; then
	if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
		echo "Port $PORT is already in use by another process; set VSW_PORT to a free port." >&2
		exit 1
	fi
	setsid nohup "$DIR/bin/code-server-oss" \
		--host 127.0.0.1 --port "$PORT" \
		--connection-token-file "$TOKEN_FILE" \
		--server-data-dir "$ROOT/data" --user-data-dir "$ROOT/data/User" --extensions-dir "$ROOT/data/extensions" \
		--accept-server-license-terms --telemetry-level off \
		> "$LOG" 2>&1 < /dev/null &
	echo "$! $COMMIT $PORT" > "$PID_FILE"
	for _ in $(seq 1 50); do
		if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then break; fi
		sleep 0.2
	done
fi

PORT=$(cut -d' ' -f3 "$PID_FILE")
cat <<MSG

Server running (loopback only). On your device forward the port, e.g.
  ssh -L $PORT:127.0.0.1:$PORT $(whoami)@$(hostname)
Then open the web app and connect with
  host:  localhost:$PORT
  token: $(cat "$TOKEN_FILE")
MSG
