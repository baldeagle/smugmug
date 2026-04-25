import { getStore } from '@netlify/blobs';
import { i as isAuthenticated } from '../../../chunks/auth_CABgming.mjs';
export { renderers } from '../../../renderers.mjs';

const DELETE = async ({ params, cookies }) => {
  if (!await isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const key = params.key;
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), { status: 400 });
  }
  const store = getStore("photos");
  await store.delete(key);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
