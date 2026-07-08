import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

/**
 * Thin client wrapper for the server-side core/search Cloud Function. The
 * server does ALL retrieval, permission filtering (AIS-04), answer generation,
 * and usage logging — the client only sends the query and renders the answer +
 * citations + confidence. Blaze-gated.
 */

export interface SearchCitation {
  sourceType: string;
  sourceId: string;
  title: string;
}

export interface SearchResult {
  answer: string;
  citations: SearchCitation[];
  confidence: "high" | "medium" | "low";
  limitations: string;
  resultCount: number;
  filteredOutCount: number;
}

export async function searchQuery(query: string): Promise<SearchResult> {
  const fn = httpsCallable<{ query: string }, SearchResult>(functions, "searchQuery");
  const res = await fn({ query });
  return res.data;
}
