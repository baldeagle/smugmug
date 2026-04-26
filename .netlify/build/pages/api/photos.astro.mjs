import { getStore } from '@netlify/blobs';
export { renderers } from '../../renderers.mjs';

function filenameFromKey(key) {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}
async function getMetadataBatch(store, keys) {
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
const GET = async ({ url }) => {
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
    filename: filenameFromKey(entry.key)
  }));
  return new Response(
    JSON.stringify({ photos, page, totalPages, total }),
    { headers: { "Content-Type": "application/json" } }
  );
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
