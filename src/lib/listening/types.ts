import type { ListeningSource, ListeningTerm } from "@prisma/client";

/** A post as fetched from a connector, before dedupe / classification. */
export interface RawMention {
  source: ListeningSource;
  externalId: string;
  url?: string | null;
  authorHandle?: string | null;
  text: string;
  postedAt?: Date | null;
  matchedTerm?: string | null;
  competitor?: string | null;
}

export interface ConnectorResult {
  source: ListeningSource;
  mentions: RawMention[];
  /** Why the connector didn't run (missing creds, throttled) — not an error. */
  skipped?: string;
}

export interface Connector {
  name: string;
  run(terms: ListeningTerm[]): Promise<ConnectorResult>;
}

/** Terms whose text should be matched against free-text sources. */
export function textTerms(terms: ListeningTerm[]): ListeningTerm[] {
  return terms.filter((t) => t.active && t.kind !== "HASHTAG");
}

/** First term found in `text` (case-insensitive), so the row records why it matched. */
export function findTerm(text: string, terms: ListeningTerm[]): ListeningTerm | null {
  const lower = text.toLowerCase();
  return terms.find((t) => lower.includes(t.term.toLowerCase().replace(/^@/, ""))) ?? null;
}
