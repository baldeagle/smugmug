import { getStore } from "@netlify/blobs";

const token = process.env.NETLIFY_BLOBS_SECRET;
const siteID = process.env.NETLIFY_SITE_ID;

if (!token || !siteID) {
  console.error("Set NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID");
  process.exit(1);
}

console.log(`Site ID: ${siteID}`);
console.log(`Token: ${token.slice(0, 8)}...${token.slice(-4)}`);

const store = getStore({ name: "photos", siteID, token });

console.log("\nTesting read (list)...");
const { blobs } = await store.list();
console.log(`OK - found ${blobs.length} blobs`);

console.log("\nTesting write...");
await store.set("__test__", "hello");
console.log("OK - write succeeded");

console.log("\nTesting read back...");
const val = await store.get("__test__", { type: "text" });
console.log(`OK - read back: "${val}"`);

console.log("\nTesting delete...");
await store.delete("__test__");
console.log("OK - delete succeeded");

console.log("\nAll tests passed!");
