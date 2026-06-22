/**
 * `init` hook for the admin-copilot plugin.
 *
 * Runs once at daemon bootstrap. Pure file I/O — no LLM, no network — so it
 * respects the "No LLM work at daemon startup" rule. All proactive work
 * (digest, inbox triage, competitor brief) is registered later, model-mediated,
 * by the `admin-copilot-setup` skill calling `schedule_create`.
 *
 * Two jobs:
 *   1. Capture `pluginStorageDir` into shared module state so the
 *      `admin_copilot_prefs` tool can reach it (the tool's `ToolContext` does
 *      not carry the storage dir).
 *   2. Seed `prefs.json` + the `competitor-runs/` directory with defaults if
 *      they do not already exist (idempotent).
 */

import type { PluginInitContext } from "@vellumai/plugin-api";

import { seedPrefsIfAbsent, setStorageDir } from "../src/state.js";

export default async function init(ctx: PluginInitContext): Promise<void> {
  setStorageDir(ctx.pluginStorageDir);
  await seedPrefsIfAbsent();
  ctx.logger.info(
    { plugin: "admin-copilot", storageDir: ctx.pluginStorageDir },
    "admin-copilot initialized",
  );
}
