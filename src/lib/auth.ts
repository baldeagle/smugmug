const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD;
const AUTH_SECRET = process.env.AUTH_SECRET || import.meta.env.AUTH_SECRET;

if (!ADMIN_PASSWORD) {
  throw new Error(
    "ADMIN_PASSWORD environment variable is required. " +
    "Set it in your Netlify dashboard under Site settings > Environment variables."
  );
}

if (!AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET environment variable is required. " +
    "Generate one with: openssl rand -hex 32"
  );
}

async function sign(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(AUTH_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createToken(): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + 86400000 });
  const payloadB64 = btoa(payload)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = await sign(payloadB64);
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function checkPassword(password: string): boolean {
  const a = new TextEncoder().encode(password);
  const b = new TextEncoder().encode(ADMIN_PASSWORD!);
  if (a.length !== b.length) {
    const dummy = new TextEncoder().encode(ADMIN_PASSWORD!);
    let xor = 0;
    for (let i = 0; i < dummy.length; i++) xor |= a[i % a.length] ^ dummy[i];
    return false;
  }
  let xor = 0;
  for (let i = 0; i < a.length; i++) xor |= a[i] ^ b[i];
  return xor === 0;
}

export async function isAuthenticated(cookies: any): Promise<boolean> {
  const token = cookies.get("session")?.value;
  if (!token) return false;
  return verifyToken(token);
}

export function sanitizeKey(key: string): string {
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    throw new Error("Invalid key");
  }
  return key;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\r\n"]/g, "")
    .replace(/[<>|:*?]/g, "_");
}
