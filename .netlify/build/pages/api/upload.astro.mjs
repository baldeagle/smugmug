import { getStore } from '@netlify/blobs';
import { i as isAuthenticated } from '../../chunks/auth_CABgming.mjs';
export { renderers } from '../../renderers.mjs';

const POST = async ({ request, cookies }) => {
  if (!await isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const formData = await request.formData();
  const files = formData.getAll("files");
  if (!files || files.length === 0) {
    return new Response(JSON.stringify({ error: "No files provided" }), { status: 400 });
  }
  const store = getStore("photos");
  const uploaded = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
    const buffer = await file.arrayBuffer();
    await store.set(key, new Uint8Array(buffer), {
      metadata: {
        filename: file.name,
        contentType: file.type,
        size: String(file.size),
        uploadDate: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    uploaded.push({ key, filename: file.name });
  }
  return new Response(JSON.stringify({ uploaded }), {
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
