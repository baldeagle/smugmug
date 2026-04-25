import { getStore } from '@netlify/blobs';
export { renderers } from '../../../renderers.mjs';

const GET = async ({ params, url }) => {
  const key = params.key;
  if (!key) {
    return new Response("Not found", { status: 404 });
  }
  const store = getStore("photos");
  const blob = await store.get(key, { type: "arrayBuffer" });
  if (!blob) {
    return new Response("Not found", { status: 404 });
  }
  const meta = await store.getMetadata(key);
  const contentType = meta?.contentType || "image/jpeg";
  const filename = meta?.filename || key;
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable"
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
