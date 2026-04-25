import { getStore } from '@netlify/blobs';
export { renderers } from '../../renderers.mjs';

const GET = async ({ url }) => {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const store = getStore("photos");
  const { blobs } = await store.list();
  const photos = await Promise.all(
    blobs.map(async (b) => {
      let meta = {};
      try {
        meta = await store.getMetadata(b.key);
      } catch {
      }
      return {
        key: b.key,
        filename: meta?.filename || b.key,
        contentType: meta?.contentType || "image/jpeg",
        size: Number(meta?.size || 0),
        uploadDate: meta?.uploadDate || ""
      };
    })
  );
  photos.sort((a, b) => a.uploadDate > b.uploadDate ? -1 : 1);
  const total = photos.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const pagePhotos = photos.slice(start, start + limit);
  return new Response(
    JSON.stringify({ photos: pagePhotos, page, totalPages, total }),
    { headers: { "Content-Type": "application/json" } }
  );
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
