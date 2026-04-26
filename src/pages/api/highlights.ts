import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { getClientIP, checkRateLimit, ROBOTS_HEADERS } from "../../lib/rate-limit";

function filenameFromKey(key: string): string {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "highlights", 60, 60000)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } });
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  const starStore = getStore("stars");
  const { blobs } = await starStore.list();

  const entries: { key: string; count: number }[] = [];
  for (const b of blobs) {
    try {
      const raw = await starStore.get(b.key, { type: "text" });
      const count = raw ? parseInt(raw, 10) : 0;
      if (count > 0) entries.push({ key: b.key, count });
    } catch {}
  }

  entries.sort((a, b) => b.count - a.count);

  const top = entries.slice(0, 200);
  const total = top.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageEntries = top.slice(start, start + limit);

  const photos = pageEntries.map((entry) => ({
    key: entry.key,
    filename: filenameFromKey(entry.key),
    stars: entry.count,
  }));

  return new Response(
    JSON.stringify({ photos, page, totalPages, total }),
    { headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } }
  );
};
