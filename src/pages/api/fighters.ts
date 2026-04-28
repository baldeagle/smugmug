import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { getClientIP, checkRateLimit, ROBOTS_HEADERS } from "../../lib/rate-limit";
import fightersData from "../../data/fighters.json";

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

let filenameMap: Map<string, string> | null = null;

async function getFilenameMap(): Promise<Map<string, string>> {
  if (filenameMap) return filenameMap;
  const store = getStore("photos");
  try {
    const raw = await store.get("__order__", { type: "text" });
    if (!raw) return new Map();
    const keys: string[] = JSON.parse(raw);
    const map = new Map<string, string>();
    for (const key of keys) {
      const fn = filenameFromKey(key).toLowerCase();
      map.set(fn, key);
    }
    filenameMap = map;
    return map;
  } catch {
    return new Map();
  }
}

export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "fighters", 60, 60000)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } });
  }

  const map = await getFilenameMap();
  const fighterId = url.searchParams.get("id");

  if (fighterId) {
    const fighter = fightersData.fighters.find((f) => String(f.id) === fighterId);
    if (!fighter) {
      return new Response(JSON.stringify({ error: "Fighter not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const sort = url.searchParams.get("sort") || "action";
    const sorted = [...fighter.photos];
    if (sort === "chrono") {
      sorted.sort((a, b) => a.filename.localeCompare(b.filename));
    } else {
      sorted.sort((a, b) => b.action_score - a.action_score);
    }

    const photos = [];
    for (const p of sorted) {
      const key = map.get(p.filename.toLowerCase());
      if (key) {
        photos.push({ key, filename: p.filename });
      }
    }

    return new Response(
      JSON.stringify({ id: fighter.id, totalPhotos: fighter.total_photos, photos }),
      { headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } }
    );
  }

  const fighters = [];
  for (const f of fightersData.fighters) {
    const first = f.photos[0];
    if (!first) continue;
    const key = map.get(first.filename.toLowerCase());
    if (!key) continue;
    fighters.push({
      id: f.id,
      totalPhotos: f.total_photos,
      thumbUrl: thumbUrl(filenameFromKey(key)),
    });
  }

  return new Response(
    JSON.stringify({ fighters }),
    { headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } }
  );
};
