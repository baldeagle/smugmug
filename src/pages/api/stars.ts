import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";

export const GET: APIRoute = async () => {
  const store = getStore("stars");
  const { blobs } = await store.list();
  const stars: Record<string, number> = {};
  for (const b of blobs) {
    try {
      const raw = await store.get(b.key, { type: "text" });
      stars[b.key] = raw ? parseInt(raw, 10) : 0;
    } catch {}
  }
  return new Response(JSON.stringify(stars), {
    headers: { "Content-Type": "application/json" },
  });
};
