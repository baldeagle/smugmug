import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";

function filenameFromKey(key: string): string {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

export const GET: APIRoute = async ({ url }) => {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  const store = getStore("photos");
  const { blobs } = await store.list();

  const allKeys = blobs.map((b) => b.key).sort();
  const total = allKeys.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageKeys = allKeys.slice(start, start + limit);

  const photos = pageKeys.map((key) => ({
    key,
    filename: filenameFromKey(key),
  }));

  return new Response(
    JSON.stringify({ photos, page, totalPages, total }),
    { headers: { "Content-Type": "application/json" } }
  );
};
