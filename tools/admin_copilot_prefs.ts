/**
 * `admin_copilot_prefs` tool — the shared persistence surface for the
 * admin-copilot plugin's skills (setup, digest, competitor-brief).
 *
 * Read/write the plugin's preferences and competitor list/snapshots in
 * `<pluginStorageDir>/`. The storage dir is captured by the `init` hook into
 * shared module state (`src/state.ts`) because the tool's `ToolContext` does
 * not carry `pluginStorageDir`.
 *
 * Low risk: it only touches the plugin's own data directory — no credentials,
 * no external calls, no inbox/calendar mutations. The mutating admin actions
 * (sending email, archiving) live in the existing first-party skills behind
 * their own confirmation gates.
 */

import {
  RiskLevel,
  type ToolContext,
  type ToolDefinition,
  type ToolExecutionResult,
} from "@vellumai/plugin-api";

import type { Competitor, CompetitorSnapshot } from "../src/prefs.js";
import {
  mergePrefs,
  readCompetitorSnapshot,
  readPrefs,
  writeCompetitorSnapshot,
  writePrefs,
} from "../src/state.js";

type Action =
  | "get_prefs"
  | "set_prefs"
  | "list_competitors"
  | "add_competitor"
  | "remove_competitor"
  | "get_competitor_snapshot"
  | "save_competitor_snapshot";

interface PrefsToolInput {
  action: Action;
  /** set_prefs: partial prefs object to deep-merge. */
  prefs_patch?: Record<string, unknown>;
  /** competitor name for add/remove/get/save actions. */
  name?: string;
  /** add_competitor: primary domain. */
  domain?: string;
  /** add_competitor: specific pages worth checking. */
  watch_urls?: string[];
  /** add_competitor: topics to weight when judging materiality. */
  keywords?: string[];
  /** save_competitor_snapshot: the full snapshot object. */
  snapshot?: CompetitorSnapshot;
}

function ok(data: unknown): ToolExecutionResult {
  return { content: JSON.stringify(data), isError: false };
}

function err(message: string): ToolExecutionResult {
  return { content: JSON.stringify({ error: message }), isError: true };
}

async function run(input: PrefsToolInput): Promise<ToolExecutionResult> {
  switch (input.action) {
    case "get_prefs":
      return ok(await readPrefs());

    case "set_prefs": {
      if (!input.prefs_patch || typeof input.prefs_patch !== "object") {
        return err("set_prefs requires a prefs_patch object");
      }
      return ok(await mergePrefs(input.prefs_patch));
    }

    case "list_competitors": {
      const prefs = await readPrefs();
      return ok(prefs.competitors);
    }

    case "add_competitor": {
      if (!input.name) return err("add_competitor requires name");
      const prefs = await readPrefs();
      const competitor: Competitor = {
        name: input.name,
        domain: input.domain ?? null,
        watchUrls: input.watch_urls ?? [],
        keywords: input.keywords ?? [],
      };
      const rest = prefs.competitors.filter(
        (c) => c.name.toLowerCase() !== input.name!.toLowerCase(),
      );
      prefs.competitors = [...rest, competitor];
      await writePrefs(prefs);
      return ok(prefs.competitors);
    }

    case "remove_competitor": {
      if (!input.name) return err("remove_competitor requires name");
      const prefs = await readPrefs();
      prefs.competitors = prefs.competitors.filter(
        (c) => c.name.toLowerCase() !== input.name!.toLowerCase(),
      );
      await writePrefs(prefs);
      return ok(prefs.competitors);
    }

    case "get_competitor_snapshot": {
      if (!input.name) return err("get_competitor_snapshot requires name");
      return ok(await readCompetitorSnapshot(input.name));
    }

    case "save_competitor_snapshot": {
      if (!input.snapshot || typeof input.snapshot !== "object") {
        return err("save_competitor_snapshot requires a snapshot object");
      }
      await writeCompetitorSnapshot(input.snapshot);
      return ok({ saved: input.snapshot.competitor });
    }

    default:
      return err(`unknown action: ${String(input.action)}`);
  }
}

const adminCopilotPrefs: ToolDefinition = {
  description:
    "Read and write the admin-copilot plugin's stored preferences and competitor list/snapshots (in the plugin's own data dir). Actions: get_prefs, set_prefs (prefs_patch), list_competitors, add_competitor (name, domain?, watch_urls?, keywords?), remove_competitor (name), get_competitor_snapshot (name), save_competitor_snapshot (snapshot). Used by the admin-copilot setup, digest, and competitor-brief skills. Does not send email, touch the inbox, or call external services.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "get_prefs",
          "set_prefs",
          "list_competitors",
          "add_competitor",
          "remove_competitor",
          "get_competitor_snapshot",
          "save_competitor_snapshot",
        ],
        description: "Which operation to perform.",
      },
      prefs_patch: {
        type: "object",
        description:
          "set_prefs: partial preferences to deep-merge (digest, inbox, competitorBrief, competitors).",
      },
      name: {
        type: "string",
        description: "Competitor name for add/remove/get/save actions.",
      },
      domain: {
        type: "string",
        description: "add_competitor: primary domain.",
      },
      watch_urls: {
        type: "array",
        items: { type: "string" },
        description: "add_competitor: specific pages worth checking.",
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description:
          "add_competitor: topics to weight when judging materiality.",
      },
      snapshot: {
        type: "object",
        description:
          "save_competitor_snapshot: the full snapshot { competitor, lastRunAt, sources[], findings[] }.",
      },
    },
    required: ["action"],
  },
  defaultRiskLevel: RiskLevel.Low,
  execute: (input: Record<string, unknown>, _ctx: ToolContext) =>
    run(input as unknown as PrefsToolInput),
};

export default adminCopilotPrefs;
