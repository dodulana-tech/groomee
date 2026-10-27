import type { ListeningTerm } from "@prisma/client";
import { findTerm, textTerms, type Connector, type RawMention } from "../types";
import { getState, isDue, markRun, setState } from "../state";

// X API v2 recent search — pay-per-use (~$0.005 per post read). Runs every
// 6h with X_MAX_RESULTS posts per run (default 25 ≈ $15/month worst case);
// also set a spend cap in the X developer console.

interface XSearch {
  data?: { id: string; text: string; author_id?: string; created_at?: string }[];
  includes?: { users?: { id: string; username: string }[] };
  meta?: { newest_id?: string };
}

function buildQuery(terms: ListeningTerm[]): string {
  const parts: string[] = [];
  for (const t of terms) {
    const clause = t.term.startsWith("@") ? t.term : `"${t.term}"`;
    // X caps queries at 512 chars on the base tier.
    if ([...parts, clause].join(" OR ").length > 440) break;
    parts.push(clause);
  }
  return `(${parts.join(" OR ")}) -is:retweet`;
}

export const xConnector: Connector = {
  name: "x",
  async run(terms: ListeningTerm[]) {
    const token = process.env.X_BEARER_TOKEN;
    if (!token) return { source: "X", mentions: [], skipped: "X_BEARER_TOKEN not set" };
    if (!(await isDue("x", 6))) return { source: "X", mentions: [], skipped: "ran <6h ago" };

    const candidates = textTerms(terms);
    if (candidates.length === 0) return { source: "X", mentions: [], skipped: "no terms" };

    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", buildQuery(candidates));
    url.searchParams.set("max_results", String(Math.min(100, Math.max(10, Number(process.env.X_MAX_RESULTS ?? 25)))));
    url.searchParams.set("tweet.fields", "created_at,author_id");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "username");
    const sinceId = await getState("x.sinceId");
    if (sinceId) url.searchParams.set("since_id", sinceId);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`x search ${res.status} ${await res.text()}`);
    const body = (await res.json()) as XSearch;

    const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u.username]));
    const mentions: RawMention[] = (body.data ?? []).map((tw) => {
      const handle = tw.author_id ? users.get(tw.author_id) : undefined;
      const term = findTerm(tw.text, candidates);
      return {
        source: "X",
        externalId: tw.id,
        url: handle ? `https://x.com/${handle}/status/${tw.id}` : `https://x.com/i/web/status/${tw.id}`,
        authorHandle: handle ? `@${handle}` : null,
        text: tw.text,
        postedAt: tw.created_at ? new Date(tw.created_at) : null,
        matchedTerm: term?.term ?? null,
        competitor: term?.kind === "COMPETITOR" ? term.competitor ?? term.term : null,
      };
    });

    if (body.meta?.newest_id) await setState("x.sinceId", body.meta.newest_id);
    await markRun("x");
    return { source: "X", mentions };
  },
};
