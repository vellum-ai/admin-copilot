/**
 * Shared persistence layer for the admin-copilot plugin.
 *
 * `pluginStorageDir` is handed to the plugin only on the `init` hook's
 * context (`PluginInitContext.pluginStorageDir`) — the tool `ToolContext`
 * does NOT carry it. The `init` hook captures the path here via
 * {@link setStorageDir}; the prefs tool reads it back via {@link getStorageDir}.
 * Both modules import this file, so they share one module instance (Node
 * caches by resolved URL) and therefore one captured path.
 *
 * All reads/writes are plain JSON files under that directory:
 *   <pluginStorageDir>/prefs.json
 *   <pluginStorageDir>/competitor-runs/<slug>.json
 */

import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type AdminCopilotPrefs,
  type CompetitorSnapshot,
  defaultPrefs,
} from "./prefs.js";

const PREFS_FILE = "prefs.json";
const COMPETITOR_RUNS_DIR = "competitor-runs";

let storageDir: string | null = null;

/** Capture the plugin's writable data directory (called once from `init`). */
export function setStorageDir(dir: string): void {
  storageDir = dir;
}

/** The captured storage dir, or throw if `init` has not run yet. */
export function getStorageDir(): string {
  if (storageDir === null) {
    throw new Error(
      "admin-copilot: plugin storage dir is not initialized — the init hook must run before the prefs tool is invoked",
    );
  }
  return storageDir;
}

/** kebab-case a competitor name into a filesystem-safe slug. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "competitor"
  );
}

function prefsPath(): string {
  return join(getStorageDir(), PREFS_FILE);
}

function competitorRunsDir(): string {
  return join(getStorageDir(), COMPETITOR_RUNS_DIR);
}

/** Create the storage dir + competitor-runs subdir if absent. Idempotent. */
export function ensureDirs(): void {
  mkdirSync(getStorageDir(), { recursive: true });
  mkdirSync(competitorRunsDir(), { recursive: true });
}

/** Seed `prefs.json` with defaults if it does not yet exist. Idempotent. */
export async function seedPrefsIfAbsent(): Promise<void> {
  ensureDirs();
  if (existsSync(prefsPath())) return;
  await writeFile(prefsPath(), JSON.stringify(defaultPrefs(), null, 2), "utf8");
}

export async function readPrefs(): Promise<AdminCopilotPrefs> {
  try {
    const raw = await readFile(prefsPath(), "utf8");
    return { ...defaultPrefs(), ...(JSON.parse(raw) as AdminCopilotPrefs) };
  } catch {
    return defaultPrefs();
  }
}

export async function writePrefs(prefs: AdminCopilotPrefs): Promise<void> {
  ensureDirs();
  await writeFile(prefsPath(), JSON.stringify(prefs, null, 2), "utf8");
}

/**
 * Shallow-deep merge a partial patch onto the current prefs and persist.
 * Top-level objects (`digest`, `inbox`, `competitorBrief`) merge per-key;
 * `competitors` is replaced wholesale when present in the patch.
 */
export async function mergePrefs(
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

export async function readCompetitorSnapshot(
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

export async function writeCompetitorSnapshot(
  snapshot: CompetitorSnapshot,
): Promise<void> {
  ensureDirs();
  await writeFile(
    join(competitorRunsDir(), `${slugify(snapshot.competitor)}.json`),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );
}
