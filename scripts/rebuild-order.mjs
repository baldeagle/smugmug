import { getStore } from "@netlify/blobs";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;

  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID environment variables are required.");
    process.exit(1);
  }

  const store = getStore({ name: "photos", siteID, token });
  const { blobs } = await store.list();
  console.log(`Found ${blobs.length} blobs. Fetching metadata...`);

  const entries = [];
  for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
    const batch = blobs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (blob) => {
        try {
          const meta = await store.getMetadata(blob.key);
          return { key: blob.key, exifDate: meta?.exifDate || "" };
        } catch {
          return { key: blob.key, exifDate: "" };
        }
      })
    );
    entries.push(...results);
    const progress = Math.min(i + BATCH_SIZE, blobs.length);
    process.stdout.write(`\r  Fetched metadata: ${progress}/${blobs.length}   `);
    if (i + BATCH_SIZE < blobs.length) await sleep(BATCH_DELAY_MS);
  }

  console.log("\n\nSorting by EXIF date...");
  entries.sort((a, b) => {
    if (a.exifDate && b.exifDate) return a.exifDate.localeCompare(b.exifDate);
    if (a.exifDate) return -1;
    if (b.exifDate) return 1;
    return a.key.localeCompare(b.key);
  });

  const sortedKeys = entries.map((e) => e.key);
  const withExif = entries.filter((e) => e.exifDate).length;
  const withoutExif = entries.length - withExif;

  console.log(`Sorted ${sortedKeys.length} keys (${withExif} with EXIF, ${withoutExif} without).`);
  console.log("Writing __order__ cache...");

  await store.set("__order__", JSON.stringify(sortedKeys), {
    metadata: { updatedAt: new Date().toISOString(), count: String(sortedKeys.length) },
  });

  console.log("Done! Order cache updated.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
