import { getStore } from '@netlify/blobs';
import { g as getClientIP, c as checkRateLimit, R as ROBOTS_HEADERS } from '../../chunks/rate-limit_CT6SyZ0q.mjs';
export { renderers } from '../../renderers.mjs';

function filenameFromKey(key) {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}
async function buildOrderCache(store) {
  const { blobs } = await store.list();
  const photoBlobs = blobs.filter((b) => !b.key.startsWith("__"));
  const entries = await Promise.all(
    photoBlobs.map(async (blob) => {
      try {
        const meta = await store.getMetadata(blob.key);
        return { key: blob.key, exifDate: meta?.exifDate || "" };
      } catch {
        return { key: blob.key, exifDate: "" };
      }
    })
  );
  entries.sort((a, b) => {
    if (a.exifDate && b.exifDate) return a.exifDate.localeCompare(b.exifDate);
    if (a.exifDate) return -1;
    if (b.exifDate) return 1;
    return a.key.localeCompare(b.key);
  });
  const sortedKeys = entries.map((e) => e.key);
  await store.set("__order__", JSON.stringify(sortedKeys), {
    metadata: { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), count: String(sortedKeys.length) }
  });
  return sortedKeys;
}
const GET = async ({ url, request, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "photos", 60, 6e4)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } });
  }
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const store = getStore("photos");
  let allKeys;
  const cached = await store.get("__order__", { type: "text" });
  if (cached) {
    allKeys = JSON.parse(cached);
  } else {
    allKeys = await buildOrderCache(store);
  }
  const total = allKeys.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageKeys = allKeys.slice(start, start + limit);
  const photos = pageKeys.map((key) => ({
    key,
    filename: filenameFromKey(key)
  }));
  return new Response(
    JSON.stringify({ photos, page, totalPages, total }),
    { headers: { "Content-Type": "application/json", ...ROBOTS_HEADERS } }
  );
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
