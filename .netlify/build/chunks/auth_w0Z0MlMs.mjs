const ADMIN_PASSWORD = undefined                              ;
const AUTH_SECRET = undefined                           ;
{
  throw new Error(
    "ADMIN_PASSWORD environment variable is required. Set it in your Netlify dashboard under Site settings > Environment variables."
  );
}
async function sign(data) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function createToken() {
  const payload = JSON.stringify({ exp: Date.now() + 864e5 });
  const payloadB64 = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}
async function verifyToken(token) {
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
function checkPassword(password) {
  const a = new TextEncoder().encode(password);
  const b = new TextEncoder().encode(ADMIN_PASSWORD);
  if (a.length !== b.length) {
    const dummy = new TextEncoder().encode(ADMIN_PASSWORD);
    let xor2 = 0;
    for (let i = 0; i < dummy.length; i++) xor2 |= a[i % a.length] ^ dummy[i];
    return false;
  }
  let xor = 0;
  for (let i = 0; i < a.length; i++) xor |= a[i] ^ b[i];
  return xor === 0;
}
async function isAuthenticated(cookies) {
  const token = cookies.get("session")?.value;
  if (!token) return false;
  return verifyToken(token);
}
function sanitizeKey(key) {
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    throw new Error("Invalid key");
  }
  return key;
}
function sanitizeFilename(filename) {
  return filename.replace(/[\r\n"]/g, "").replace(/[<>|:*?]/g, "_");
}

export { createToken as a, sanitizeFilename as b, checkPassword as c, isAuthenticated as i, sanitizeKey as s };
