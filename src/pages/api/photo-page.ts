import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { sanitizeKey } from "../../lib/auth";

export const GET: APIRoute = async ({ url }) => {
  const rawKey = url.searchParams.get("key") || "";
  let key: string;
  try {
    key = sanitizeKey(rawKey);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid key" }), { status: 400 });
  }

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), { status: 400 });
  }

  const store = getStore("photos");
  const cached = await store.get("__order__", { type: "text" });
  if (!cached) {
    return new Response(JSON.stringify({ error: "Order cache not found" }), { status: 404 });
  }

  const order: string[] = JSON.parse(cached);
  const index = order.indexOf(key);
  if (index === -1) {
    return new Response(JSON.stringify({ error: "Photo not found" }), { status: 404 });
  }

  return new Response(
    JSON.stringify({ index, total: order.length }),
    { headers: { "Content-Type": "application/json" } }
  );
};
