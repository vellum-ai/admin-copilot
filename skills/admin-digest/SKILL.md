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
This is a read-and-summarize pass — it **proposes**, and mutates the inbox only
when the user approves a proposed batch (see §3; the heavy lifting still lives in
`inbox-management`'s confirmed pipeline). For the general briefing tone
and the weather/news/"something interesting" sections, `start-the-day` is
included; this skill adds the admin spine on top.

Read delivery preferences once via `admin_copilot_prefs` `get_prefs`
(`digest.channel`) and deliver there: `in-app` → reply directly; `slack` / `email`
→ hand off to the relevant channel skill.

> **If `admin_copilot_prefs` is not in your available tools,** the plugin's tools
> have not loaded into this session yet (a later run picks them up automatically)
> — `get_prefs` will not become reachable by exploring. Do **not** search the
> filesystem for a prefs file or read it by hand. Default delivery to `in-app`,
> skip the competitor section (§5), add a one-line note ("admin-copilot prefs
> unavailable — using defaults"), and continue. Do not loop.

## Sections (in priority order)

### 1. Today at a glance
One line: number of meetings, first/last commitment, biggest open loop.

### 2. Calendar & prep
From `google-calendar` / `outlook-calendar`. Don't just summarize the day —
propose the concrete, reversible moves a chief of staff would make. Read the day
with `gcal.ts list` + `availability`; for any meeting that needs detail, `gcal.ts
get`. Surface only the moves worth making; skip the rest.

- **At a glance:** today's meetings with times; notable gaps usable for focused
  work.
- **Prep flags:** docs to review, talking points, anything needing a pre-read.
  Offer to assemble the pre-read.
- **Conflicts / double-bookings:** surface overlaps and propose a resolution
  (which to keep, what to move). A reschedule goes out as a *draft* note you hand
  the user — never sent.
- **Focus blocks:** propose holding focus time in the biggest usable gap. At
  flag-only, propose it ("want me to hold 9–11 for deep work?"); once the user has
  graduated focus-block holds, create it directly with
  `gcal.ts create … --skip-confirm`. A hold touches only the user's own calendar
  and is trivially deletable, so it's autonomy-eligible.
- **Agenda-less meetings:** flag multi-attendee meetings with no agenda or
  description; offer to draft one (draft only — you don't send it).
- **Low-value recurring meetings:** if the user routinely skips or declines a
  recurring meeting, propose declining the next instance with
  `gcal.ts rsvp --response declined`. Always propose — a decline is visible to the
  organizer, so it never goes out silently.

### 3. Inbox triage (propose-then-confirm)
The digest *brief* is read-only — it surfaces, it doesn't mutate as a side effect
of being generated:
- Count of new/unread since yesterday; what needs a reply.
- **Urgent** items surfaced individually (customer-at-risk, time-sensitive asks).
- Proposed actions to confirm: name each batch concretely — "12 newsletters ready
  to archive", "3 replies I can draft" — so the user can approve it by name.

**On the user's go-ahead, execute immediately — don't defer to the next scheduled
run.** When the user approves a proposed batch ("archive them", "archive the
newsletters", "yes"), archive that batch *now* via `inbox-management`'s archiver:
`gmail-archive.ts --action archive --query "<the query you proposed>"` (or
`--message-ids "<ids>"` if you already resolved them). Cross-check the safe-list
first (`gmail-prefs.ts --action list`), then report back what was actually
archived. Never auto-send a draft. If the user doesn't respond, leave the
proposals — the scheduled `inbox-management` run picks up triage at its configured
stage. Deferring an *approved* archive to "the next run" is the bug, not the
design: an explicit go-ahead is a confirmation, so honor it.

**Learn from each decision — earn graduation.** Outcomes are how the copilot
earns autonomy, so record them and act on the pattern rather than keeping a tally.
- When the user approves, rejects, or ignores a proposed batch, `remember` it
  concretely — the category and what they decided ("approved archiving
  newsletters"; "rejected archiving cold outreach from a known vendor"). A
  rejection is the highest-value signal — capture it the same turn it lands.
- Before proposing, `recall` how the user has handled this category before. If
  they've consistently approved a known-safe category with no recent rejections,
  proactively offer to graduate it: *"You've approved archiving newsletters every
  time — want me to start doing that silently?"* Acceptance routes through
  `inbox-management`'s trust ladder (its informed-consent framing, then
  `gmail-prefs.ts --action set-management-config --stage <n>`), which keeps the
  explicit gate. Never bump the stage yourself from the digest.
- A recent rejection tightens the next proposal — drop or narrow that batch
  instead of re-proposing the same thing, and don't offer to graduate a category
  the user has pushed back on.

This is judgment over a remembered pattern, not a precision threshold: `recall`,
weigh what you find, and make the call.

### 4. Follow-ups
Threads where the user owes a reply or is awaiting one and it's gone stale
(via `gmail` search). Flag the oldest first.

### 5. Competitor deltas
New `competitor-brief` findings since the last digest. For each tracked
competitor, `admin_copilot_prefs` `get_competitor_snapshot` and surface only
findings with a recent `firstSeenAt` (since yesterday). One line each, sourced.
When a finding clearly warrants a response, append the suggested move as an offer
the user can accept by name (a draft heads-up to a channel, a deeper look) — a
prepared draft, never an action already taken. Skip the section entirely if
nothing is new — do not run a full competitor pass here (that's the weekly
brief's job).

### 6. Top 3 priorities
Synthesize the above into the three things most worth the user's attention today,
with a suggested first move.

## Tone & rules

- Concise, scannable, executive-assistant voice. No filler.
- Two useful sections beat six padded ones.
- Never claim an action was taken unless it was — proposals are proposals.
- Every external claim (a competitor finding, an urgent email) is traceable to its
  source.
- **Autonomy scales with reversibility.** Act directly only on moves that touch
  the user alone and undo cleanly — holding a focus block on their own calendar,
  drafting. Anything others see or that's hard to reverse — declines, reschedule
  or agenda messages, anything leaving the inbox — is proposed, never done
  silently. The copilot prepares autonomously; a human transmits.
