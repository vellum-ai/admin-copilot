#!/usr/bin/env bun
/**
 * page-hash — print the SHA-256 of normalized stdin text.
 *
 * A cheap "did this page change at all" key for the competitor-brief diff:
 * the model fetches a page, pipes its text here, and compares the hash to the
 * one stored in the competitor snapshot. Whitespace is collapsed so trivial
 * reflowing does not churn the hash; materiality is still the model's call.
 *
 * Portable: Node/Bun stdlib only, no dependencies, no Vellum-internal imports.
 *
 *   echo "$PAGE_TEXT" | bun page-hash.ts
 */

import { createHash } from "node:crypto";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const input = await readStdin();
const hash = createHash("sha256").update(normalize(input)).digest("hex");
process.stdout.write(`${hash}\n`);
