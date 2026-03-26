#!/usr/bin/env python3
"""Export macOS Reminders data to a JSON file for the local todo app."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "reminders-export.json"
RECORD_SEP = chr(30)
FIELD_SEP = chr(31)

def to_priority(value: str) -> str:
    try:
        numeric = int(value)
    except ValueError:
        return "medium"
    if 1 <= numeric <= 4:
        return "high"
    if numeric >= 7:
        return "low"
    return "medium"


def to_completed(value: str) -> bool:
    return value.strip().lower() == "true"


def applescript_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def run_applescript(script: str) -> str:
    result = subprocess.run(
        ["osascript", "-l", "AppleScript", "-e", script],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def read_applescript_list(script: str) -> list[str]:
    raw_output = run_applescript(script)
    if not raw_output:
        return []
    return [item for item in raw_output.split(RECORD_SEP) if item]


def get_list_names() -> list[str]:
    return read_applescript_list(
        """
        tell application id "com.apple.reminders"
            set AppleScript's text item delimiters to character id 30
            set output_text to (name of every list) as text
            set AppleScript's text item delimiters to ""
            return output_text
        end tell
        """
    )


def get_list_values(list_name: str, field_name: str) -> list[str]:
    escaped_name = applescript_string(list_name)
    return read_applescript_list(
        f'''
        tell application id "com.apple.reminders"
            tell list "{escaped_name}"
                set AppleScript's text item delimiters to character id 30
                set output_text to ({field_name} of every reminder) as text
                set AppleScript's text item delimiters to ""
                return output_text
            end tell
        end tell
        '''
    )


def read_reminders() -> list[dict[str, object]]:
    timestamp_ms = int(time.time() * 1000)
    tasks: list[dict[str, object]] = []
    next_index = 0

    for list_name in get_list_names():
        ids = get_list_values(list_name, "id")
        names = get_list_values(list_name, "name")
        completed_values = get_list_values(list_name, "completed")
        priorities = get_list_values(list_name, "priority")

        reminder_count = min(len(ids), len(names), len(completed_values), len(priorities))
        for index in range(reminder_count):
            external_id = ids[index].strip()
            text = names[index].strip()
            if not external_id or not text:
                continue
            tasks.append(
                {
                    "source": "reminders",
                    "externalId": external_id,
                    "text": text,
                    "completed": to_completed(completed_values[index]),
                    "priority": to_priority(priorities[index]),
                    "sourceList": list_name,
                    "note": "",
                    "dueDate": "",
                    "createdAt": timestamp_ms + next_index,
                    "updatedAt": timestamp_ms + next_index,
                }
            )
            next_index += 1
    return tasks


def main() -> int:
    output_path = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tasks = read_reminders()
    payload = {
        "kind": "reminders-export",
        "source": "reminders",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "taskCount": len(tasks),
        "tasks": tasks,
    }

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Exported {payload.get('taskCount', 0)} reminders to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
