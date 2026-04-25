import { getStore } from '@netlify/blobs';
export { renderers } from '../../renderers.mjs';

const GET = async () => {
  const store = getStore("photos");
  const { blobs } = await store.list();
  const photos = blobs.filter((b) => b.metadata?.filename).map((b) => ({
    key: b.key,
    filename: b.metadata.filename,
    contentType: b.metadata.contentType,
    size: Number(b.metadata.size),
    uploadDate: b.metadata.uploadDate
  })).sort((a, b) => a.uploadDate > b.uploadDate ? -1 : 1);
  return new Response(JSON.stringify(photos), {
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
