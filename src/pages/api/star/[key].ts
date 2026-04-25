import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { sanitizeKey } from "../../../lib/auth";

export const POST: APIRoute = async ({ params }) => {
  let key: string;
  try {
    key = sanitizeKey(params.key ?? "");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid key" }), { status: 400 });
  }

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), { status: 400 });
  }

  const store = getStore("stars");
  let count = 0;
  try {
    const raw = await store.get(key, { type: "text" });
    count = raw ? parseInt(raw, 10) : 0;
  } catch {}
  count += 1;
  await store.set(key, String(count));

  return new Response(JSON.stringify({ key, stars: count }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  let key: string;
  try {
    key = sanitizeKey(params.key ?? "");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid key" }), { status: 400 });
  }

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), { status: 400 });
  }

  const store = getStore("stars");
  let count = 0;
  try {
    const raw = await store.get(key, { type: "text" });
    count = raw ? parseInt(raw, 10) : 0;
  } catch {}
  count = Math.max(0, count - 1);
  await store.set(key, String(count));

  return new Response(JSON.stringify({ key, stars: count }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = async () => {
  return new Response(null, { status: 404 });
};
