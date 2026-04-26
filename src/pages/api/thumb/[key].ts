import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { sanitizeKey } from "../../../lib/auth";
import { getClientIP, checkRateLimit, checkReferer, ROBOTS_HEADERS } from "../../../lib/rate-limit";

export const GET: APIRoute = async ({ params, request, clientAddress }) => {
  const ip = clientAddress || getClientIP(request);
  if (!await checkRateLimit(ip, "thumb", 60, 60000)) {
    return new Response("Rate limited", { status: 429, headers: ROBOTS_HEADERS });
  }

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

  const store = getStore("thumbs");
  const blob = await store.get(key, { type: "arrayBuffer" });
  if (!blob) {
    return new Response("Not found", { status: 404, headers: ROBOTS_HEADERS });
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
