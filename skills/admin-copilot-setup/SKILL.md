---
name: admin-copilot-setup
description: >-
  One-time guided setup for the Admin Copilot — a proactive chief-of-staff that
  runs a morning digest, keeps the inbox triaged (propose-then-confirm), preps
  the calendar, and delivers a weekly competitor brief. Use when the user wants
  to set up, enable, configure, or turn on their admin assistant / chief of
  staff, or change what it does proactively.
compatibility: "Designed for Vellum personal assistants"
metadata:
  emoji: "🗂️"
  vellum:
    category: "productivity"
    display-name: "Admin Copilot Setup"
    user-invocable: true
    includes: ["inbox-management", "start-the-day"]
    activation-hints:
      - "User wants to set up or enable a chief of staff / admin assistant"
      - "User wants the assistant to proactively handle email, calendar, and a daily digest"
      - "User wants to configure the morning digest, inbox triage, or competitor tracking"
      - "User wants to change or turn off what the admin copilot does proactively"
    avoid-when:
      - "User wants a one-off inbox cleanup (use inbox-cleanup) or a single email action (use gmail)"
      - "User wants a one-time briefing right now (use start-the-day)"
---

# Admin Copilot Setup

Stand up a proactive admin assistant in one guided pass, then get out of the
way. Four pillars, each independently optional:

1. **Morning digest** — calendar + inbox triage + competitor deltas + follow-ups.
2. **Inbox triage** — ongoing, **propose-then-confirm** (delegated to
   `inbox-management`; never auto-sends, archives only what the user approves).
3. **Calendar prep** — surfaced inside the digest (meeting prep, gaps, conflicts).
4. **Weekly competitor brief** — only what materially changed (`competitor-brief`).

All preferences persist via the **`admin_copilot_prefs`** tool, which owns the
storage location — never write the prefs file by hand. Proactive jobs are real
schedules created with **`schedule_create`** — nothing fires at startup;
everything is created here, with the user present.

> **Posture:** lead with the safe default. The assistant pre-sorts noise and
> *proposes* actions; the user stays in control. Say this out loud during setup
> so expectations are set before anything runs.

## Step 0 — Frame and scope

State the four pillars in one breath, note the propose-then-confirm posture, and
ask which the user wants. Don't assume all four. Let them start with one.

## Step 1 — Connect accounts

The copilot reuses the user's existing connections; it does **not** own
credentials. For any pillar that needs it:

- Email / calendar not connected yet → run the relevant connector
  (`vellum-oauth-integrations`, `gmail`, `google-calendar` / `outlook-calendar`).
- If already connected, skip — don't re-auth.

## Step 2 — Capture preferences

Confirm the user's timezone first (see `time-based-actions` → timezone
confidence check) so cron fires in their local time.

Persist choices with the `admin_copilot_prefs` tool, action `set_prefs`, passing
a `prefs_patch`. This tool is the **only** supported way to write preferences.
The `prefs_patch` shape:

```json
{
  "digest":          { "enabled": true, "cron": "0 7 * * 1-5", "timezone": "America/New_York", "channel": "in-app" },
  "inbox":           { "delegateToInboxManagement": true, "stage": "flag-only" },
  "competitorBrief": { "enabled": true, "cron": "0 8 * * 1", "channel": "in-app" }
}
```

- **Digest time:** ask; default 7:00am weekdays (`0 7 * * 1-5`).
- **Delivery channel** per pillar: `in-app`, `slack`, or `email`. Default `in-app`.
- **Inbox stage:** always start `flag-only` (propose-then-confirm). The user
  earns autonomy later through `inbox-management`'s trust ladder — never jump to
  `autonomous` at setup.

For competitor tracking, add each competitor with `admin_copilot_prefs`
`add_competitor` (`name`, plus `domain`, `watch_urls`, `keywords` when known).

> **Do not hunt for the prefs file.** It lives at an internal path the tool
> manages — not model-discoverable by design. Searching the filesystem for it,
> reading it, or writing it by hand will not work. Always go through
> `admin_copilot_prefs`.
>
> **If `admin_copilot_prefs` is not in your available tools,** the plugin's
> tools have not loaded in this assistant session — `set_prefs` will not become
> reachable by exploring. Do **not** improvise a file write or search for a
> storage directory. Instead, tell the user verbatim: *"The admin-copilot tools
> aren't loaded yet — restart the assistant, then ask me to set up your admin
> copilot again."* Then create whatever schedules the user enabled (Step 3) with
> default preferences so the digest still fires, and stop. Do not loop.

## Step 3 — Wire the proactive jobs

Create a schedule **only for the pillars the user enabled**, with `schedule_create`.

**Morning digest** (if `digest.enabled`):
- `expression`: the chosen `digest.cron`; `syntax: "cron"`; `timezone`: theirs.
- `mode: "execute"`
- `message: "Load the admin-digest skill and produce today's chief-of-staff briefing, then deliver it on the configured channel."`
- `reuse_conversation: true`
- `inference_profile`: a capable profile (digest quality matters) — omit to use the default if unsure.
- `routing_intent`: match the chosen channel (e.g. `single_channel`).

**Weekly competitor brief** (if `competitorBrief.enabled`):
- `expression`: the chosen `competitorBrief.cron` (default `0 8 * * 1`, Mon 8am); `syntax: "cron"`; `timezone`: theirs.
- `mode: "execute"`
- `message: "Load the competitor-brief skill and produce this week's competitor brief, then deliver it on the configured channel."`
- `reuse_conversation: true`

**Inbox triage** (if the user wants it): **do not create the schedule yourself.**
Run `inbox-management` setup, which creates its own recurring schedule
(`0 */3 * * 1-5`, execute, reuse) and owns the trust ladder. Confirm stage
`flag-only`. If the user wants urgent items caught sooner, tighten that triage
cadence (e.g. hourly on weekdays).

> `schedule_create` runs as a guardian action. Setup is a guardian flow, so this
> is expected; if a non-guardian context somehow reaches here, scheduling will be
> refused — tell the user setup must run from their own (guardian) session.

## Step 4 — Confirm

Summarize what's now live: which jobs, when they fire, where output lands, and
that inbox triage is propose-then-confirm. Tell them how to change it: "ask me to
update your admin copilot" (re-runs this skill → `set_prefs`). Done — the copilot
now works in the background.
