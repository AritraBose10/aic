import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

/**
 * Thin client wrapper for the server-side core/ai Cloud Function. All prompt
 * construction, consent/confidential filtering, rate/cost limiting, and usage
 * logging happen on the server (functions/src/ai.ts) — the client only passes
 * the brief + selected contact ids and receives the draft back. Blaze-gated.
 */

export interface OutreachBrief {
  segment: string;
  valueProp: string;
  goal: string;
  tone?: string;
  language?: string;
}

export interface GenerateOutreachInput {
  startupId: string;
  channel: string;
  brief: OutreachBrief;
  contactIds: string[];
  contextDocIds?: string[];
}

export interface GenerateOutreachResult {
  draft: string;
  model: string;
  /** Contacts that were consent-cleared and reached the prompt. */
  includedContactIds: string[];
  /** Contacts filtered out server-side (no consent / not owned). */
  excludedContactIds: string[];
  droppedDocIds: string[];
}

export async function generateOutreachDraft(
  input: GenerateOutreachInput,
): Promise<GenerateOutreachResult> {
  const fn = httpsCallable<GenerateOutreachInput, GenerateOutreachResult>(
    functions,
    "generateOutreachDraft",
  );
  const res = await fn(input);
  return res.data;
}
