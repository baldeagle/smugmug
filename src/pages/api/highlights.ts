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

  try {
    var starStore = getStore("stars");
    var { blobs: starBlobs } = await starStore.list();
  } catch {
    return new Response(JSON.stringify({ photos: [], page: 1, totalPages: 1, total: 0 }), {
      headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS },
    });
  }

  const stars: Record<string, number> = {};
  for (const b of starBlobs) {
    try {
      const raw = await starStore.get(b.key, { type: "text" });
      const count = raw ? parseInt(raw, 10) : 0;
      if (count > 0) stars[b.key] = count;
    } catch {}
  }

  const viewData: Record<string, { v: number; d: number }> = {};
  try {
    const metricsStore = getStore("metrics");
    const raw = await metricsStore.get("__aggregate__", { type: "text" });
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        viewData[k] = v as { v: number; d: number };
      }
    }
  } catch {}

  const allKeys = new Set([...Object.keys(stars), ...Object.keys(viewData)]);

  const entries: { key: string; stars: number; views: number; avgDuration: number; score: number }[] = [];
  for (const key of allKeys) {
    const s = stars[key] || 0;
    const m = viewData[key] || { v: 0, d: 0 };
    const avg = m.v > 0 ? m.d / m.v : 0;
    const score = s * 10 + m.v + avg * 0.5;
    if (score > 0) {
      entries.push({ key, stars: s, views: m.v, avgDuration: avg, score });
    }
  }

  entries.sort((a, b) => b.score - a.score);

  const top = entries.slice(0, 200);
  const total = top.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageEntries = top.slice(start, start + limit);

  const photos = pageEntries.map((entry) => ({
    key: entry.key,
    filename: filenameFromKey(entry.key),
    stars: entry.stars,
  }));

  return new Response(
    JSON.stringify({ photos, page, totalPages, total }),
    { headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } }
  );
};
