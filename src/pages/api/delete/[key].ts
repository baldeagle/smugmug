import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { isAuthenticated, sanitizeKey } from "../../../lib/auth";

export const DELETE: APIRoute = async ({ params, cookies }) => {
  if (!(await isAuthenticated(cookies))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (params.key === "__all__") {
    const store = getStore("photos");
    const { blobs } = await store.list();
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return new Response(JSON.stringify({ success: true, deleted: blobs.length }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let key: string;
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

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
