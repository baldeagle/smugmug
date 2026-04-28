import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { isAuthenticated, sanitizeKey } from "../../lib/auth";
import { getClientIP, checkRateLimit, ROBOTS_HEADERS } from "../../lib/rate-limit";

interface Bookmark {
  id: string;
  name: string;
  key: string;
}

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

function enrich(bm: Bookmark) {
  const filename = filenameFromKey(bm.key);
  return { ...bm, filename, thumbUrl: thumbUrl(filename) };
}

async function readBookmarks(): Promise<Bookmark[]> {
  const store = getStore("photos");
  try {
    const raw = await store.get("__bookmarks__", { type: "text" });
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function writeBookmarks(bookmarks: Bookmark[]) {
  const store = getStore("photos");
  await store.set("__bookmarks__", JSON.stringify(bookmarks));
}

export const GET: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "bookmarks", 60, 60000)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } });
  }

  const bookmarks = await readBookmarks();
  return new Response(
    JSON.stringify({ bookmarks: bookmarks.map(enrich) }),
    { headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } }
  );
};

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "bookmarks-admin", 30, 60000)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  if (!(await isAuthenticated(cookies))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let body: { name?: string; key?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.name || !body.key) {
    return new Response(JSON.stringify({ error: "Missing name or key" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let key: string;
  try {
    key = sanitizeKey(body.key);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid key" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const name = body.name.trim().slice(0, 100);
  if (!name) {
    return new Response(JSON.stringify({ error: "Invalid name" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const bookmarks = await readBookmarks();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  bookmarks.push({ id, name, key });
  await writeBookmarks(bookmarks);

  return new Response(
    JSON.stringify({ bookmarks: bookmarks.map(enrich) }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const DELETE: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "bookmarks-admin", 30, 60000)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  if (!(await isAuthenticated(cookies))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let bookmarks = await readBookmarks();
  bookmarks = bookmarks.filter((bm) => bm.id !== id);
  await writeBookmarks(bookmarks);

  return new Response(
    JSON.stringify({ bookmarks: bookmarks.map(enrich) }),
    { headers: { "Content-Type": "application/json" } }
  );
};
