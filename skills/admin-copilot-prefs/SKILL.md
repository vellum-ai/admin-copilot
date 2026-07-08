---
name: admin-copilot-prefs
description: >-
  Shared persistence layer for the Admin Copilot — provides the
  admin_copilot_prefs tool that reads/writes the plugin's preferences and
  tracked-competitor state. Loaded automatically as an include of the
  admin-copilot-setup, admin-digest, and competitor-brief skills; rarely
  loaded directly.
compatibility: "Designed for Vellum personal assistants"
metadata:
  emoji: "🗃️"
  vellum:
    category: "productivity"
    display-name: "Admin Copilot Prefs"
    activation-hints:
      - "An Admin Copilot skill needs to read or write stored preferences or competitor state"
    avoid-when:
      - "Any user-facing admin request (load admin-copilot-setup, admin-digest, or competitor-brief instead — they include this skill)"
---

# Admin Copilot Prefs

The state layer for the Admin Copilot. All preferences and the competitor
list/snapshots are read and written **only** through the `admin_copilot_prefs`
tool this skill provides, invoked via `skill_execute`:

```json
{"tool": "admin_copilot_prefs", "input": {"action": "get_prefs"}, "activity": "Reading admin-copilot preferences"}
```

The tool owns the storage location and seeds defaults on first use. Never
search the filesystem for the state files, read them directly, or write them
by hand — always go through the tool.
