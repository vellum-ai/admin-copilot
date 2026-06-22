---
name: admin-digest
description: >-
  The Admin Copilot's morning briefing — a chief-of-staff digest unifying today's
  calendar and meeting prep, an inbox triage summary with propose-then-confirm
  actions, new competitor deltas, and stale follow-ups. Use when producing the
  daily/morning admin digest or chief-of-staff briefing, or when the morning
  digest schedule fires.
compatibility: "Designed for Vellum personal assistants"
metadata:
  emoji: "📋"
  vellum:
    category: "productivity"
    display-name: "Admin Digest"
    includes: ["start-the-day"]
    activation-hints:
      - "The morning admin digest schedule fires"
      - "User asks for their chief-of-staff briefing or admin digest"
      - "User wants a unified morning view of calendar, inbox, follow-ups, and competitors"
    avoid-when:
      - "User wants the general lifestyle briefing with weather/news (use start-the-day)"
      - "User wants to run the full inbox triage pipeline (use inbox-management)"
---

# Admin Digest

A sharp, scannable morning brief from a chief of staff. Build only the sections
you have something useful to say about; cut the rest. Bullets, not paragraphs.
This is a read-and-summarize pass — it **proposes**, it does not mutate the inbox
(that's `inbox-management`'s confirmed pipeline). For the general briefing tone
and the weather/news/"something interesting" sections, `start-the-day` is
included; this skill adds the admin spine on top.

Read delivery preferences once via `admin_copilot_prefs` `get_prefs`
(`digest.channel`) and deliver there: `in-app` → reply directly; `slack` / `email`
→ hand off to the relevant channel skill.

## Sections (in priority order)

### 1. Today at a glance
One line: number of meetings, first/last commitment, biggest open loop.

### 2. Calendar & prep
From `google-calendar` / `outlook-calendar`:
- Today's meetings with times.
- Prep flags: docs to review, talking points, anything needing a pre-read.
- Notable gaps usable for focused work.

### 3. Inbox triage (propose-then-confirm)
A **read-only** summary — do not archive or send here:
- Count of new/unread since yesterday; what needs a reply.
- **Urgent** items surfaced individually (customer-at-risk, time-sensitive asks).
- Proposed actions to confirm: "X newsletters ready to archive", "3 replies I can
  draft" — offer; act only on the user's go-ahead. The scheduled
  `inbox-management` run is what actually executes approved triage.

### 4. Follow-ups
Threads where the user owes a reply or is awaiting one and it's gone stale
(via `gmail` search). Flag the oldest first.

### 5. Competitor deltas
New `competitor-brief` findings since the last digest. For each tracked
competitor, `admin_copilot_prefs` `get_competitor_snapshot` and surface only
findings with a recent `firstSeenAt` (since yesterday). One line each, sourced.
Skip the section entirely if nothing is new — do not run a full competitor pass
here (that's the weekly brief's job).

### 6. Top 3 priorities
Synthesize the above into the three things most worth the user's attention today,
with a suggested first move.

## Tone & rules

- Concise, scannable, executive-assistant voice. No filler.
- Two useful sections beat six padded ones.
- Never claim an action was taken unless it was — proposals are proposals.
- Every external claim (a competitor finding, an urgent email) is traceable to its
  source.
