import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";

export const GET: APIRoute = async () => {
  const store = getStore("photos");
  const { blobs } = await store.list();

  const photos = await Promise.all(
    blobs.map(async (b) => {
      let meta: Record<string, string> = {};
      try {
        meta = (await store.getMetadata(b.key)) as Record<string, string>;
      } catch {}
      return {
        key: b.key,
        filename: meta?.filename || b.key,
        contentType: meta?.contentType || "image/jpeg",
        size: Number(meta?.size || 0),
        uploadDate: meta?.uploadDate || "",
      };
    })
  );

  photos.sort((a, b) => (a.uploadDate > b.uploadDate ? -1 : 1));

  return new Response(JSON.stringify(photos), {
    headers: { "Content-Type": "application/json" },
  });
};
