/**
 * Preference + state shapes for the admin-copilot plugin, plus their
 * defaults.
 *
 * Files under `src/` are internal helpers — the external-plugin loader does
 * not walk this directory, so it contributes no surface of its own. The
 * `init` hook and the `admin_copilot_prefs` tool both import from here.
 *
 * The external-plugin loader reads only `name` / `version` /
 * `peerDependencies` from `package.json`, so this plugin's configuration is
 * NOT a manifest field — it lives entirely in `<pluginStorageDir>/prefs.json`,
 * seeded by the `init` hook and edited at runtime through the prefs tool and
 * the setup skill.
 */

export const PREFS_SCHEMA_VERSION = 1;

/** Where a proactive job's output is delivered. */
export type DeliveryChannel = "in-app" | "slack" | "email";

/**
 * Inbox autonomy stage, mirroring the `inbox-management` skill's trust
 * ladder. Default is `flag-only` (propose-then-confirm): nothing is mutated
 * silently; the assistant surfaces what it *would* do for confirmation.
 */
export type InboxStage = "flag-only" | "standard" | "autonomous";

export interface DigestPrefs {
  enabled: boolean;
  /** Cron expression for the morning digest (user timezone). */
  cron: string;
  /** Olson timezone, or null to use the workspace/user default. */
  timezone: string | null;
  channel: DeliveryChannel;
}

export interface InboxPrefs {
  /** When true, inbox triage is owned by the `inbox-management` skill. */
  delegateToInboxManagement: boolean;
  stage: InboxStage;
}

export interface CompetitorPrefs {
  enabled: boolean;
  /** Cron expression for the weekly competitor brief (user timezone). */
  cron: string;
  channel: DeliveryChannel;
}

export interface Competitor {
  name: string;
  /** Primary domain, e.g. `example.com`. */
  domain: string | null;
  /** Specific pages worth checking (pricing, changelog, blog, careers). */
  watchUrls: string[];
  /** Topics to weight when judging materiality (pricing, funding, launches). */
  keywords: string[];
}

export interface AdminCopilotPrefs {
  schemaVersion: number;
  digest: DigestPrefs;
  inbox: InboxPrefs;
  competitorBrief: CompetitorPrefs;
  competitors: Competitor[];
}

export function defaultPrefs(): AdminCopilotPrefs {
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
export interface CompetitorSnapshotSource {
  url: string;
  /** SHA-256 of the fetched text — a cheap "did this page change at all" key. */
  contentHash: string;
  fetchedAt: string;
  summary: string;
}

export interface CompetitorFinding {
  title: string;
  detail: string;
  /** e.g. pricing | launch | funding | hiring | positioning | other. */
  category: string;
  sourceUrl: string;
  firstSeenAt: string;
}

export interface CompetitorSnapshot {
  competitor: string;
  lastRunAt: string;
  sources: CompetitorSnapshotSource[];
  findings: CompetitorFinding[];
}
