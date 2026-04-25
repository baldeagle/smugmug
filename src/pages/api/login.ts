import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { checkPassword, createToken } from "../../lib/auth";

export const GET: APIRoute = async () => {
  const pw = process.env.ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD;
  return new Response(JSON.stringify({
    envLoaded: !!pw,
    length: pw?.length ?? 0,
    first: pw?.[0] ?? "",
    last: pw?.[pw.length - 1] ?? "",
  }), {
    headers: { "Content-Type": "application/json" },
  });
};

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

async function getRateLimit(ip: string): Promise<RateLimitEntry | null> {
  const store = getStore("rate-limit");
  try {
    const raw = await store.get(ip, { type: "text" });
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setRateLimit(ip: string, entry: RateLimitEntry): Promise<void> {
  const store = getStore("rate-limit");
  await store.set(ip, JSON.stringify(entry), {
    metadata: { ttl: String(WINDOW_MS) },
  });
}

async function clearRateLimit(ip: string): Promise<void> {
  const store = getStore("rate-limit");
  try {
    await store.delete(ip);
  } catch {}
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIP(request);
  const rateLimit = await getRateLimit(ip);

  if (rateLimit) {
    const elapsed = Date.now() - rateLimit.firstAttempt;
    if (elapsed < WINDOW_MS && rateLimit.count >= MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((WINDOW_MS - elapsed) / 1000);
      return new Response(
        JSON.stringify({
          error: "Too many login attempts. Try again later.",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        }
      );
    }
    if (elapsed >= WINDOW_MS) {
      await clearRateLimit(ip);
    }
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.password || !checkPassword(body.password)) {
    const current = rateLimit && Date.now() - rateLimit.firstAttempt < WINDOW_MS
      ? rateLimit
      : null;
    await setRateLimit(ip, {
      count: (current?.count || 0) + 1,
      firstAttempt: current?.firstAttempt || Date.now(),
    });
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await clearRateLimit(ip);
  const token = await createToken();

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
    },
  });
};
