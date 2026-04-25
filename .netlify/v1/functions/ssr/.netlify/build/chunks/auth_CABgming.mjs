const ADMIN_PASSWORD = "admin123";
const AUTH_SECRET = "change-me-in-production";
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
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}
function checkPassword(password) {
  return password === ADMIN_PASSWORD;
}
async function isAuthenticated(cookies) {
  const token = cookies.get("session")?.value;
  if (!token) return false;
  return verifyToken(token);
}

export { createToken as a, checkPassword as c, isAuthenticated as i };
