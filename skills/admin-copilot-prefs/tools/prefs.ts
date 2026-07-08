/**
 * Executor for the `admin_copilot_prefs` skill tool — the shared persistence
 * surface for the admin-copilot skills (setup, digest, competitor-brief).
 *
 * Declared in this skill's TOOLS.json and invoked through `skill_execute`
 * while the skill is active, so nothing here sits on the always-on tool
 * catalog. Runs in the skill sandbox (a subprocess), so it is fully
 * self-contained: node stdlib only, no plugin module state.
 *
 * The storage directory is the plugin's data dir, derived from
 * `VELLUM_WORKSPACE_DIR` (always present in the sandbox environment) with the
 * same layout the host uses for user-plugin storage:
 *   $VELLUM_WORKSPACE_DIR/plugins-data/admin-copilot/prefs.json
 *   $VELLUM_WORKSPACE_DIR/plugins-data/admin-copilot/competitor-runs/<slug>.json
 * Defaults are seeded on first use (idempotent).
 *
 * Low risk: it only touches the plugin's own data directory — no credentials,
 * no external calls, no inbox/calendar mutations. The mutating admin actions
 * (sending email, archiving) live in the existing first-party skills behind
 * their own confirmation gates.
 */

import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PREFS_SCHEMA_VERSION = 1;

/** Where a proactive job's output is delivered. */
type DeliveryChannel = "in-app" | "slack" | "email";

/**
 * Inbox autonomy stage, mirroring the `inbox-management` skill's trust
 * ladder. Default is `flag-only` (propose-then-confirm): nothing is mutated
 * silently; the assistant surfaces what it *would* do for confirmation.
 */
type InboxStage = "flag-only" | "standard" | "autonomous";

interface DigestPrefs {
  enabled: boolean;
  /** Cron expression for the morning digest (user timezone). */
  cron: string;
  /** Olson timezone, or null to use the workspace/user default. */
  timezone: string | null;
  channel: DeliveryChannel;
}

interface InboxPrefs {
  /** When true, inbox triage is owned by the `inbox-management` skill. */
  delegateToInboxManagement: boolean;
  stage: InboxStage;
}

interface CompetitorPrefs {
  enabled: boolean;
  /** Cron expression for the weekly competitor brief (user timezone). */
  cron: string;
  channel: DeliveryChannel;
}

interface Competitor {
  name: string;
  /** Primary domain, e.g. `example.com`. */
  domain: string | null;
  /** Specific pages worth checking (pricing, changelog, blog, careers). */
  watchUrls: string[];
  /** Topics to weight when judging materiality (pricing, funding, launches). */
  keywords: string[];
}

interface AdminCopilotPrefs {
  schemaVersion: number;
  digest: DigestPrefs;
  inbox: InboxPrefs;
  competitorBrief: CompetitorPrefs;
  competitors: Competitor[];
}

function defaultPrefs(): AdminCopilotPrefs {
  return {
    schemaVersion: PREFS_SCHEMA_VERSION,
    digest: {
      enabled: false,
      cron: "0 7 * * 1-5",
      timezone: null,
      channel: "in-app",
    },
    inbox: {
      delegateToInboxManagement: true,
      stage: "flag-only",
    },
    competitorBrief: {
      enabled: false,
      cron: "0 8 * * 1",
      channel: "in-app",
    },
    competitors: [],
  };
}

/** Last-run snapshot for one competitor, used to diff week-over-week. */
interface CompetitorSnapshotSource {
  url: string;
  /** SHA-256 of the fetched text — a cheap "did this page change at all" key. */
  contentHash: string;
  fetchedAt: string;
  summary: string;
}

interface CompetitorFinding {
  title: string;
  detail: string;
  /** e.g. pricing | launch | funding | hiring | positioning | other. */
  category: string;
  sourceUrl: string;
  firstSeenAt: string;
}

interface CompetitorSnapshot {
  competitor: string;
  lastRunAt: string;
  sources: CompetitorSnapshotSource[];
  findings: CompetitorFinding[];
}

const PLUGIN_NAME = "admin-copilot";
const PREFS_FILE = "prefs.json";
const COMPETITOR_RUNS_DIR = "competitor-runs";

/**
 * The plugin's writable data directory. Mirrors the host's user-plugin
 * storage layout (`<workspaceDir>/plugins-data/<pluginName>`) — the same
 * path the host hands plugins via `InitContext.pluginStorageDir`.
 */
function storageDir(): string {
  const workspaceDir = process.env.VELLUM_WORKSPACE_DIR;
  if (!workspaceDir) {
    throw new Error(
      "admin-copilot: VELLUM_WORKSPACE_DIR is not set in the sandbox environment — cannot locate the plugin's data directory",
    );
  }
  return join(workspaceDir, "plugins-data", PLUGIN_NAME);
}

/** kebab-case a competitor name into a filesystem-safe slug. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "competitor"
  );
}

function prefsPath(): string {
  return join(storageDir(), PREFS_FILE);
}

function competitorRunsDir(): string {
  return join(storageDir(), COMPETITOR_RUNS_DIR);
}

/** Create the storage dir + competitor-runs subdir if absent. Idempotent. */
function ensureDirs(): void {
  mkdirSync(storageDir(), { recursive: true });
  mkdirSync(competitorRunsDir(), { recursive: true });
}

/** Seed `prefs.json` with defaults if it does not yet exist. Idempotent. */
async function seedPrefsIfAbsent(): Promise<void> {
  ensureDirs();
  if (existsSync(prefsPath())) return;
  await writeFile(prefsPath(), JSON.stringify(defaultPrefs(), null, 2), "utf8");
}

async function readPrefs(): Promise<AdminCopilotPrefs> {
  try {
    const raw = await readFile(prefsPath(), "utf8");
    return { ...defaultPrefs(), ...(JSON.parse(raw) as AdminCopilotPrefs) };
  } catch {
    return defaultPrefs();
  }
}

async function writePrefs(prefs: AdminCopilotPrefs): Promise<void> {
  ensureDirs();
  await writeFile(prefsPath(), JSON.stringify(prefs, null, 2), "utf8");
}

/**
 * Shallow-deep merge a partial patch onto the current prefs and persist.
 * Top-level objects (`digest`, `inbox`, `competitorBrief`) merge per-key;
 * `competitors` is replaced wholesale when present in the patch.
 */
async function mergePrefs(
  patch: Record<string, unknown>,
): Promise<AdminCopilotPrefs> {
  const current = await readPrefs();
  const merged: AdminCopilotPrefs = {
    ...current,
    ...(patch as Partial<AdminCopilotPrefs>),
    digest: { ...current.digest, ...((patch.digest as object) ?? {}) },
    inbox: { ...current.inbox, ...((patch.inbox as object) ?? {}) },
    competitorBrief: {
      ...current.competitorBrief,
      ...((patch.competitorBrief as object) ?? {}),
    },
  };
  merged.schemaVersion = current.schemaVersion;
  await writePrefs(merged);
  return merged;
}

async function readCompetitorSnapshot(
  name: string,
): Promise<CompetitorSnapshot | null> {
  try {
    const raw = await readFile(
      join(competitorRunsDir(), `${slugify(name)}.json`),
      "utf8",
    );
    return JSON.parse(raw) as CompetitorSnapshot;
  } catch {
    return null;
  }
}

async function writeCompetitorSnapshot(
  snapshot: CompetitorSnapshot,
): Promise<void> {
  ensureDirs();
  await writeFile(
    join(competitorRunsDir(), `${slugify(snapshot.competitor)}.json`),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );
}

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

interface ToolExecutionResult {
  content: string;
  isError: boolean;
}

function ok(data: unknown): ToolExecutionResult {
  return { content: JSON.stringify(data), isError: false };
}

function err(message: string): ToolExecutionResult {
  return { content: JSON.stringify({ error: message }), isError: true };
}

async function dispatch(input: PrefsToolInput): Promise<ToolExecutionResult> {
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

/** Skill tool entry point, invoked by the sandbox runner. */
export async function run(
  input: Record<string, unknown>,
  _context: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  try {
    await seedPrefsIfAbsent();
    return await dispatch(input as unknown as PrefsToolInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(message);
  }
}
