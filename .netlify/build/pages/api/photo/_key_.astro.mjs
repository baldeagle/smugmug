import { getStore } from '@netlify/blobs';
import { s as sanitizeKey, b as sanitizeFilename } from '../../../chunks/auth_VDEDaLTA.mjs';
import { a as checkReferer, R as ROBOTS_HEADERS } from '../../../chunks/rate-limit_CT6SyZ0q.mjs';
export { renderers } from '../../../renderers.mjs';

const GET = async ({ params, url, request }) => {
  if (!checkReferer(request)) {
    return new Response("Forbidden", { status: 403, headers: ROBOTS_HEADERS });
  }
  let key;
  try {
    key = sanitizeKey(params.key ?? "");
  } catch {
    return new Response("Invalid key", { status: 400 });
  }
  if (!key) {
    return new Response("Not found", { status: 404 });
  }
  const store = getStore("photos");
  const blob = await store.get(key, { type: "arrayBuffer" });
  if (!blob) {
    return new Response("Not found", { status: 404, headers: ROBOTS_HEADERS });
  }
  const meta = await store.getMetadata(key);
  const contentType = meta?.contentType || "image/jpeg";
  const filename = sanitizeFilename(meta?.filename || key);
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ...ROBOTS_HEADERS
  };
  if (url.searchParams.has("download")) {
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  }
  return new Response(blob, { headers });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
