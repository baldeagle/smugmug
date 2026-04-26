import { getStore } from '@netlify/blobs';
import { i as isAuthenticated, s as sanitizeKey } from '../../../chunks/auth_VDEDaLTA.mjs';
export { renderers } from '../../../renderers.mjs';

const DELETE = async ({ params, cookies }) => {
  if (!await isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (params.key === "__all__") {
    const store2 = getStore("photos");
    const { blobs } = await store2.list();
    await Promise.all(blobs.map((b) => store2.delete(b.key)));
    return new Response(JSON.stringify({ success: true, deleted: blobs.length }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  let key;
  try {
    key = sanitizeKey(params.key ?? "");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid key" }), { status: 400 });
  }
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), { status: 400 });
  }
  const store = getStore("photos");
  await store.delete(key);
  const cached = await store.get("__order__", { type: "text" });
  if (cached) {
    const order = JSON.parse(cached);
    const filtered = order.filter((k) => k !== key);
    if (filtered.length !== order.length) {
      await store.set("__order__", JSON.stringify(filtered), {
        metadata: { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), count: String(filtered.length) }
      });
    }
  }
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
