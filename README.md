# admin-copilot

A proactive **chief-of-staff** plugin for Vellum personal assistants. It frees up
a user's routine administrative load by running in the background and surfacing
only what matters:

- **Morning digest** — calendar + meeting prep, inbox triage summary, competitor
  deltas, and stale follow-ups, in one scannable brief.
- **Inbox triage (propose-then-confirm)** — ongoing email management that pre-sorts
  noise and _proposes_ actions; it never auto-sends and archives only what the user
  approves. Delegates to the first-party `inbox-management` trust ladder.
- **Calendar prep** — meeting prep, gaps, and conflicts, surfaced in the digest.
- **Weekly competitor brief** — tracks a saved competitor list and reports only
  what materially changed (pricing, launches, funding, hiring, positioning).

It is an **orchestration layer**: it composes the assistant's existing email,
calendar, digest, scheduling, and notification capabilities rather than
re-implementing them, and adds the one missing pillar — recurring competitor
research with week-over-week diffing.

## Install

From the Vellum plugin marketplace:

```bash
assistant plugins install admin-copilot
```

Then ask your assistant to "set up my admin copilot" to walk onboarding and turn
on the proactive schedules.

## Surfaces

| Surface | Path                           | What it does                                                                                                                |
| ------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Hook    | `hooks/init.ts`                | Seeds `prefs.json` + `competitor-runs/` and captures the storage dir for the prefs tool. Pure file I/O — no boot-time work. |
| Tool    | `tools/admin_copilot_prefs.ts` | Low-risk read/write of preferences and the competitor list/snapshots in the plugin's own data dir.                          |
| Skill   | `skills/admin-copilot-setup/`  | One-time guided onboarding: capture preferences, connect accounts, and register the proactive schedules.                   |
| Skill   | `skills/admin-digest/`         | The unified morning briefing (calendar, inbox triage summary, competitor deltas, follow-ups).                              |
| Skill   | `skills/competitor-brief/`     | Recurring competitor monitoring with a content-hash pre-filter + model-judged materiality + week-over-week diff.           |

Proactivity is delivered entirely by **schedules** created at setup time,
model-mediated — never at daemon startup. There are no per-turn hooks, so ordinary
chat carries zero added prompt cost.

## Configuration

All preferences live in `<pluginStorageDir>/prefs.json`, seeded by the `init` hook
and edited through the `admin_copilot_prefs` tool / the setup skill. See
`src/prefs.ts` for the shape and defaults. No credentials are owned by the plugin —
Gmail/Calendar auth stays with the assistant's existing connectors. Installing the
plugin is itself the enablement gate; there is no separate feature flag.

## Local development

```bash
# Copy into the workspace the assistant scans. A running assistant picks the
# plugin up automatically on its next turn — no restart needed.
cp -R admin-copilot "$(assistant daemon workspace)/plugins/admin-copilot"
assistant plugins list      # → admin-copilot, status: ok
```

## License

MIT
