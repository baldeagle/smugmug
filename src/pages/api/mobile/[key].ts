import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { sanitizeKey } from "../../../lib/auth";
import { checkReferer, ROBOTS_HEADERS } from "../../../lib/rate-limit";

export const GET: APIRoute = async ({ params, request }) => {
  if (!checkReferer(request)) {
    return new Response("Forbidden", { status: 403, headers: ROBOTS_HEADERS });
  }

  let key;
  try {
    key = sanitizeKey(params.key ?? "");
  } catch {
    return new Response("Invalid key", { status: 400 });
  }

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const store = getStore("mobile");
  const blob = await store.get(key, { type: "arrayBuffer" });
  if (!blob) {
    const photoStore = getStore("photos");
    const photoKey = key.replace("_mobile.", ".");
    const fallback = await photoStore.get(photoKey, { type: "arrayBuffer" });
    if (!fallback) {
      return new Response("Not found", { status: 404, headers: ROBOTS_HEADERS });
    }
    const meta = await photoStore.getMetadata(photoKey);
    return new Response(fallback, {
      headers: {
        "Content-Type": meta?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        ...ROBOTS_HEADERS,
      },
    });
  }

  const meta = await store.getMetadata(key);
  const contentType = meta?.contentType || "image/jpeg";

  return new Response(blob, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ...ROBOTS_HEADERS,
    },
  });
};
