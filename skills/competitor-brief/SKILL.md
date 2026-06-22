---
name: competitor-brief
description: >-
  Recurring competitor and market monitoring. Tracks a saved list of competitors,
  checks their sites and recent news each run, diffs against the last run, and
  reports only what materially changed — pricing, launches, funding, hiring,
  positioning. Use for "track competitors", "competitive intel", "what changed
  with <competitor>", managing the tracked list, or the weekly competitor brief.
compatibility: "Designed for Vellum personal assistants"
metadata:
  emoji: "🔭"
  vellum:
    category: "productivity"
    display-name: "Competitor Brief"
    activation-hints:
      - "User wants ongoing competitor or market monitoring"
      - "User asks what changed with a competitor recently"
      - "The weekly competitor brief schedule fires"
      - "User wants to add, remove, or list tracked competitors"
    avoid-when:
      - "User wants a one-off deep research report unrelated to tracked competitors (use deep-research)"
      - "User wants a general web search with no competitor-tracking intent"
---

# Competitor Brief

Keep a small, durable picture of each tracked competitor and surface **only what
changed** since last time. The value is signal, not a re-scrape: a good brief is
short, dated, and sourced.

State lives in the `admin-copilot` plugin's storage and is read/written through
the **`admin_copilot_prefs`** tool — never edit files by hand:

- The tracked list: `list_competitors`, `add_competitor`, `remove_competitor`.
- Per-competitor last-run snapshots: `get_competitor_snapshot`,
  `save_competitor_snapshot`.

## When the user is curating the list

- **Add:** `admin_copilot_prefs` `add_competitor` with `name` and, when known,
  `domain`, `watch_urls` (pricing / changelog / blog / careers pages worth
  checking), and `keywords` (topics to weight — e.g. "pricing", "enterprise",
  "funding").
- **Remove / list:** `remove_competitor` / `list_competitors`.
- Confirm the resulting list back to the user.

## Producing a brief (per run)

1. **Load state.** `list_competitors`, and for each one `get_competitor_snapshot`
   to recall what you saw last time (sources + findings + `lastRunAt`).
2. **Gather current signal** for each competitor:
   - Fetch each `watch_url` with `web_fetch`; run a `web_search` for the
     competitor name plus its `keywords` and recent dates.
   - For a deeper periodic pass (e.g. monthly, or when the user asks for depth),
     escalate to the **deep-research** harness instead of light fetches. Keep the
     weekly run light and cheap.
3. **Cheap change pre-filter.** For each fetched page, hash the text and compare
   to the stored source hash to skip pages that did not change at all:

   ```bash
   # prints the sha256 of normalized stdin text
   echo "$PAGE_TEXT" | bun "$SKILL_DIR/scripts/page-hash.ts"
   ```

   A matching hash means the page is byte-stable — skip deep analysis of it.
   A new or changed hash means read it closely. The hash is only a pre-filter;
   **you decide what is material.**
4. **Judge materiality.** Compare new signal against the prior findings. Surface
   only genuine changes: new/changed pricing, product launches or major
   changelog entries, funding or M&A, notable hiring (esp. leadership), and
   positioning/messaging shifts. Ignore cosmetic edits and re-phrasings.
5. **Write the new snapshot.** `save_competitor_snapshot` with the full object so
   next run can diff against it:

   ```json
   {
     "competitor": "Example Co",
     "lastRunAt": "<ISO timestamp>",
     "sources": [
       { "url": "https://example.com/pricing", "contentHash": "<sha256>", "fetchedAt": "<ISO>", "summary": "1-line state" }
     ],
     "findings": [
       { "title": "Launched X tier", "detail": "...", "category": "launch", "sourceUrl": "https://...", "firstSeenAt": "<ISO>" }
     ]
   }
   ```

   Use the system clock for timestamps (`date -u +%Y-%m-%dT%H:%M:%SZ`).
6. **Deliver the brief.** Group by competitor; lead with the most material item;
   one line each, every claim linked to its source. Respect the configured
   delivery channel (`admin_copilot_prefs` `get_prefs` → `competitorBrief.channel`):
   in-app means reply directly; for slack/email, hand off to the relevant channel
   (the `notifications` or messaging skill).

## Empty weeks

If nothing material changed, **still report** — one line: "No material competitor
changes this week (checked N competitors)." Silence reads as a broken job and
erodes trust. Always save the refreshed snapshot even when findings are empty so
hashes stay current.

## Rules

- Only changes worth a busy person's attention. When in doubt, leave it out.
- Every finding cites a source URL. No source, no finding.
- This skill never sends email or messages on its own — delivery to slack/email
  goes through the dedicated channel skills, which carry their own confirmation.
- Keep weekly runs cheap; reserve deep-research for explicit deep passes.
