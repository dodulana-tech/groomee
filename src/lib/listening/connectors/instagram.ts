import type { ListeningTerm } from "@prisma/client";
import type { Connector, RawMention } from "../types";
import { getState, isDue, markRun, setState } from "../state";

// Instagram Graph API via Facebook Login (hashtag search is not available on
// Instagram Login). Needs instagram_basic, instagram_manage_comments,
// pages_read_engagement + "Instagram Public Content Access" (App Review +
// Business Verification). Hashtag search is capped at 30 unique hashtags per
// rolling 7 days, so we cap tracked hashtags at 25 and cache their ids.
const MAX_HASHTAGS = 25;

interface IgMedia {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  comments?: { data: { id: string; text: string; username?: string; timestamp?: string }[] };
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const version = process.env.IG_GRAPH_VERSION ?? "v23.0";
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", process.env.IG_ACCESS_TOKEN!);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await res.json();
  if (!res.ok) throw new Error(`instagram ${path} → ${res.status} ${JSON.stringify(body?.error ?? {})}`);
  return body as T;
}

export const instagramConnector: Connector = {
  name: "instagram",
  async run(terms: ListeningTerm[]) {
    const userId = process.env.IG_USER_ID;
    if (!userId || !process.env.IG_ACCESS_TOKEN) {
      return { source: "INSTAGRAM", mentions: [], skipped: "IG_USER_ID / IG_ACCESS_TOKEN not set" };
    }
    if (!(await isDue("instagram", 1))) return { source: "INSTAGRAM", mentions: [], skipped: "ran <1h ago" };

    const mentions: RawMention[] = [];
    const push = (m: IgMedia, matchedTerm: string, text?: string, handle?: string) => {
      const body = text ?? m.caption ?? "";
      if (!body.trim()) return;
      mentions.push({
        source: "INSTAGRAM",
        externalId: m.id,
        url: m.permalink ?? null,
        authorHandle: handle ?? m.username ?? null,
        text: body.slice(0, 4000),
        postedAt: m.timestamp ? new Date(m.timestamp) : null,
        matchedTerm,
      });
    };

    // 1. Posts where @groomeeapp is photo-tagged.
    const tagged = await graph<{ data: IgMedia[] }>(`${userId}/tags`, {
      fields: "id,caption,permalink,timestamp,username",
      limit: "25",
    });
    tagged.data.forEach((m) => push(m, "tagged @groomeeapp"));

    // 2. Comments on our own recent posts.
    const own = await graph<{ data: IgMedia[] }>(`${userId}/media`, {
      fields: "id,permalink,comments.limit(25){id,text,username,timestamp}",
      limit: "10",
    });
    for (const post of own.data) {
      for (const c of post.comments?.data ?? []) {
        push({ id: c.id, permalink: post.permalink, timestamp: c.timestamp }, "comment on our post", c.text, c.username);
      }
    }

    // 3. Recent media on tracked hashtags (no usernames returned by Meta).
    const hashtags = terms
      .filter((t) => t.active && t.kind === "HASHTAG")
      .slice(0, MAX_HASHTAGS)
      .map((t) => t.term.replace(/^#/, "").toLowerCase());
    for (const tag of hashtags) {
      let hashtagId = await getState(`ig.hashtag.${tag}`);
      if (!hashtagId) {
        const found = await graph<{ data: { id: string }[] }>("ig_hashtag_search", { user_id: userId, q: tag });
        hashtagId = found.data[0]?.id ?? null;
        if (!hashtagId) continue;
        await setState(`ig.hashtag.${tag}`, hashtagId);
      }
      const recent = await graph<{ data: IgMedia[] }>(`${hashtagId}/recent_media`, {
        user_id: userId,
        fields: "id,caption,permalink,timestamp",
        limit: "25",
      });
      recent.data.forEach((m) => push(m, `#${tag}`));
    }

    await markRun("instagram");
    return { source: "INSTAGRAM", mentions };
  },
};
