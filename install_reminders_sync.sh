#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="$(command -v python3)"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
USER_DOMAIN="gui/$(id -u)"

SERVER_LABEL="com.sunhuabiao.todoapp.localhttp"
EXPORT_LABEL="com.sunhuabiao.todoapp.reminders_export"
SERVER_PLIST="$LAUNCH_DIR/$SERVER_LABEL.plist"
EXPORT_PLIST="$LAUNCH_DIR/$EXPORT_LABEL.plist"

mkdir -p "$LAUNCH_DIR"

cat >"$SERVER_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$SERVER_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>-m</string>
    <string>http.server</string>
    <string>4173</string>
    <string>--bind</string>
    <string>127.0.0.1</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/$SERVER_LABEL.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/$SERVER_LABEL.err.log</string>
</dict>
</plist>
PLIST

cat >"$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$EXPORT_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$ROOT_DIR/scripts/export_reminders.py</string>
    <string>$ROOT_DIR/reminders-export.json</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>7</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/$EXPORT_LABEL.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/$EXPORT_LABEL.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "$USER_DOMAIN" "$SERVER_PLIST" >/dev/null 2>&1 || true
launchctl bootout "$USER_DOMAIN" "$EXPORT_PLIST" >/dev/null 2>&1 || true

launchctl bootstrap "$USER_DOMAIN" "$SERVER_PLIST"
launchctl bootstrap "$USER_DOMAIN" "$EXPORT_PLIST"
launchctl kickstart -k "$USER_DOMAIN/$SERVER_LABEL"
launchctl kickstart -k "$USER_DOMAIN/$EXPORT_LABEL"

echo "Installed LaunchAgents:"
echo "  $SERVER_PLIST"
echo "  $EXPORT_PLIST"
echo
echo "Local app URL: http://127.0.0.1:4173"
echo "Export file: $ROOT_DIR/reminders-export.json"
