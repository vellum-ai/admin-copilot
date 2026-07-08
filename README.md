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

| Surface | Path                            | What it does                                                                                                      |
| ------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Skill   | `skills/admin-copilot-setup/`   | One-time guided onboarding: capture preferences, connect accounts, and register the proactive schedules.           |
| Skill   | `skills/admin-digest/`          | The unified morning briefing (calendar, inbox triage summary, competitor deltas, follow-ups).                       |
| Skill   | `skills/competitor-brief/`      | Recurring competitor monitoring with a content-hash pre-filter + model-judged materiality + week-over-week diff.    |
| Skill   | `skills/admin-copilot-prefs/`   | The shared state layer: ships the `admin_copilot_prefs` tool (via `TOOLS.json`), included by the three skills above. |

The plugin is **skills-only** — no hooks and no always-on tools. The
`admin_copilot_prefs` tool is declared in the `admin-copilot-prefs` skill's
`TOOLS.json`, so it registers only while an admin-copilot skill is active in a
conversation (invoked through `skill_execute`, executed in the skill sandbox)
and adds zero prompt cost to ordinary chat. Proactivity is delivered entirely
by **schedules** created at setup time, model-mediated — never at daemon
startup.

## Configuration

All preferences live in `prefs.json` in the plugin's data directory, seeded on
first use of the `admin_copilot_prefs` tool and edited only through it / the
setup skill. See `skills/admin-copilot-prefs/tools/prefs.ts` for the shape and
defaults. No credentials are owned by the plugin — Gmail/Calendar auth stays
with the assistant's existing connectors. Installing the plugin is itself the
enablement gate; there is no separate feature flag.

## Local development

```bash
# Copy into the workspace the assistant scans. A running assistant picks the
# plugin up automatically on its next turn — no restart needed.
cp -R admin-copilot "$(assistant daemon workspace)/plugins/admin-copilot"
assistant plugins list      # → admin-copilot, status: ok
```

## License

MIT
