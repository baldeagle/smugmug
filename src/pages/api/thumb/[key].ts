import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { sanitizeKey } from "../../../lib/auth";

export const GET: APIRoute = async ({ params }) => {
  let key;
  try {
    key = sanitizeKey(params.key ?? "");
  } catch {
    return new Response("Invalid key", { status: 400 });
  }

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const store = getStore("thumbs");
  const blob = await store.get(key, { type: "arrayBuffer" });
  if (!blob) {
    return new Response("Not found", { status: 404 });
  }

  const meta = await store.getMetadata(key);
  const contentType = meta?.contentType || "image/jpeg";

  return new Response(blob, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
