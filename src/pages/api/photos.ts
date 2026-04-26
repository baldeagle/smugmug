import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";

function filenameFromKey(key: string): string {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

async function getMetadataBatch(store: ReturnType<typeof getStore>, keys: string[]) {
  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        const meta = await store.getMetadata(key);
        return { key, exifDate: meta?.exifDate || "" };
      } catch {
        return { key, exifDate: "" };
      }
    })
  );
  return results;
}

export const GET: APIRoute = async ({ url }) => {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  const store = getStore("photos");
  const { blobs } = await store.list();

  const allKeys = blobs.map((b) => b.key);
  const metaBatch = await getMetadataBatch(store, allKeys);

  const sorted = metaBatch.sort((a, b) => {
    if (a.exifDate && b.exifDate) return a.exifDate.localeCompare(b.exifDate);
    if (a.exifDate) return -1;
    if (b.exifDate) return 1;
    return a.key.localeCompare(b.key);
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageKeys = sorted.slice(start, start + limit);

  const photos = pageKeys.map((entry) => ({
    key: entry.key,
    filename: filenameFromKey(entry.key),
  }));

  return new Response(
    JSON.stringify({ photos, page, totalPages, total }),
    { headers: { "Content-Type": "application/json" } }
  );
};
