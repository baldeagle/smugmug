import { getStore } from "@netlify/blobs";

const store = () => getStore("rate-limit");

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

interface RateEntry {
  count: number;
  start: number;
}

export async function checkRateLimit(
  ip: string,
  prefix: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const key = `${prefix}:${ip}`;
  const s = store();

  try {
    const raw = await s.get(key, { type: "text" });
    if (raw) {
      const entry: RateEntry = JSON.parse(raw);
      if (Date.now() - entry.start < windowMs) {
        if (entry.count >= limit) return false;
        await s.set(key, JSON.stringify({ count: entry.count + 1, start: entry.start }));
        return true;
      }
    }
  } catch {}

  try {
    await s.set(key, JSON.stringify({ count: 1, start: Date.now() }));
  } catch {}
  return true;
}

export function checkReferer(request: Request): boolean {
  const referer = request.headers.get("Referer");
  if (!referer) return true;
  try {
    const url = new URL(referer);
    const allowed = [
      "abaldwin.netlify.app",
      "localhost",
    ];
    return allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export const ROBOTS_HEADERS = {
  "X-Robots-Tag": "noindex, noai, noimageai",
};
