#!/usr/bin/env bash
set -euo pipefail

LAUNCH_DIR="$HOME/Library/LaunchAgents"
USER_DOMAIN="gui/$(id -u)"

SERVER_LABEL="com.sunhuabiao.todoapp.localhttp"
EXPORT_LABEL="com.sunhuabiao.todoapp.reminders_export"
SERVER_PLIST="$LAUNCH_DIR/$SERVER_LABEL.plist"
EXPORT_PLIST="$LAUNCH_DIR/$EXPORT_LABEL.plist"

launchctl bootout "$USER_DOMAIN" "$SERVER_PLIST" >/dev/null 2>&1 || true
launchctl bootout "$USER_DOMAIN" "$EXPORT_PLIST" >/dev/null 2>&1 || true

rm -f "$SERVER_PLIST" "$EXPORT_PLIST"

echo "Removed LaunchAgents:"
echo "  $SERVER_PLIST"
echo "  $EXPORT_PLIST"
