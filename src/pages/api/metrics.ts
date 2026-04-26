import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { sanitizeKey } from "../../lib/auth";
import { isAuthenticated } from "../../lib/auth";
import { getClientIP, checkRateLimit, ROBOTS_HEADERS } from "../../lib/rate-limit";

function filenameFromKey(key: string): string {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

function thumbUrl(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  return `/api/thumb/${encodeURIComponent(base + "_thumb" + ext)}`;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "metrics", 120, 60000)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  let body: { key?: string; duration?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.key || typeof body.duration !== "number") {
    return new Response(JSON.stringify({ error: "Missing key or duration" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let key: string;
  try {
    key = sanitizeKey(body.key);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid key" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const duration = Math.max(0, Math.min(body.duration, 90));
  const store = getStore("metrics");

  let views = 0;
  let totalDuration = 0;
  try {
    const raw = await store.get(key, { type: "text" });
    if (raw) {
      const parsed = JSON.parse(raw);
      views = parsed.v || 0;
      totalDuration = parsed.d || 0;
    }
  } catch {}

  views += 1;
  totalDuration += duration;

  await store.set(key, JSON.stringify({ v: views, d: Math.round(totalDuration * 100) / 100 }));

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};

export const GET: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "admin-stats", 30, 60000)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } });
  }

  if (!(await isAuthenticated(cookies))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const sort = url.searchParams.get("sort") || "score";
  const dir = url.searchParams.get("dir") || "desc";

  const [photosStore, starsStore, metricsStore] = [
    getStore("photos"),
    getStore("stars"),
    getStore("metrics"),
  ];

  const cached = await photosStore.get("__order__", { type: "text" });
  if (!cached) {
    return new Response(JSON.stringify({ error: "Order cache not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  const allKeys: string[] = JSON.parse(cached);

  const [starsBlobs, metricsBlobs] = await Promise.all([
    starsStore.list(),
    metricsStore.list(),
  ]);

  const stars: Record<string, number> = {};
  const metrics: Record<string, { v: number; d: number }> = {};

  await Promise.all([
    ...starsBlobs.blobs.map(async (b) => {
      try {
        const raw = await starsStore.get(b.key, { type: "text" });
        stars[b.key] = raw ? parseInt(raw, 10) : 0;
      } catch {}
    }),
    ...metricsBlobs.blobs.map(async (b) => {
      try {
        const raw = await metricsStore.get(b.key, { type: "text" });
        if (raw) metrics[b.key] = JSON.parse(raw);
      } catch {}
    }),
  ]);

  const rows = allKeys.map((key) => {
    const s = stars[key] || 0;
    const m = metrics[key] || { v: 0, d: 0 };
    const avgDuration = m.v > 0 ? m.d / m.v : 0;
    const score = s * 10 + m.v + avgDuration * 0.5;
    return {
      key,
      filename: filenameFromKey(key),
      thumbUrl: thumbUrl(filenameFromKey(key)),
      views: m.v,
      totalDuration: Math.round(m.d * 10) / 10,
      avgDuration: Math.round(avgDuration * 10) / 10,
      stars: s,
      score: Math.round(score * 10) / 10,
    };
  });

  const sortKey = sort === "name" ? "filename"
    : sort === "views" ? "views"
    : sort === "duration" ? "avgDuration"
    : sort === "stars" ? "stars"
    : "score";

  const dirMul = dir === "asc" ? 1 : -1;
  rows.sort((a: any, b: any) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string") return dirMul * av.localeCompare(bv);
    return dirMul * (av - bv);
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);

  const totalViews = rows.reduce((sum, r) => sum + r.views, 0);
  const totalStars = rows.reduce((sum, r) => sum + r.stars, 0);

  return new Response(
    JSON.stringify({
      photos: pageRows,
      page,
      totalPages,
      total,
      totalViews,
      totalStars,
      avgViews: total > 0 ? Math.round(totalViews / total * 10) / 10 : 0,
    }),
    { headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } }
  );
};
