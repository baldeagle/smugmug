import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { sanitizeKey, sanitizeFilename } from "../../../lib/auth";

export const GET: APIRoute = async ({ params, url }) => {
  let key: string;
  try {
    key = sanitizeKey(params.key ?? "");
  } catch {
    return new Response("Invalid key", { status: 400 });
  }

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const store = getStore("photos");
  const blob = await store.get(key, { type: "arrayBuffer" });
  if (!blob) {
    return new Response("Not found", { status: 404 });
  }

  const meta = await store.getMetadata(key);
  const contentType = meta?.contentType || "image/jpeg";
  const filename = sanitizeFilename(meta?.filename || key);

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  if (url.searchParams.has("download")) {
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  }

  return new Response(blob, { headers });
};
