import { getStore } from "@netlify/blobs";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;
const MAX_RETRIES = 3;

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

  const photoBlobs = blobs.filter((b) => !b.key.startsWith("__"));
  console.log(`Found ${blobs.length} blobs (${photoBlobs.length} photos, ${blobs.length - photoBlobs.length} system keys). Fetching metadata...`);

  const entries = [];
  let errors = 0;

  for (let i = 0; i < photoBlobs.length; i += BATCH_SIZE) {
    const batch = photoBlobs.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (blob) => {
        const meta = await store.getMetadata(blob.key);
        return { key: blob.key, exifDate: meta?.exifDate || "" };
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        entries.push(result.value);
      } else {
        entries.push({ key: "?", exifDate: "" });
        errors++;
      }
    }
    const progress = Math.min(i + BATCH_SIZE, photoBlobs.length);
    process.stdout.write(`\r  Fetched metadata: ${progress}/${photoBlobs.length} (${errors} errors)   `);
    if (i + BATCH_SIZE < photoBlobs.length) await sleep(BATCH_DELAY_MS);
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

  const data = JSON.stringify(sortedKeys);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await store.set("__order__", data, {
        metadata: { updatedAt: new Date().toISOString(), count: String(sortedKeys.length) },
      });
      console.log("Done! Order cache updated.");
      return;
    } catch (err) {
      console.log(`\n  Write attempt ${attempt}/${MAX_RETRIES} failed: ${err.message || err}`);
      if (attempt < MAX_RETRIES) {
        const delay = 5000 * attempt;
        console.log(`  Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }
  console.error("Failed to write cache after all retries.");
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
