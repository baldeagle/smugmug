import { getStore } from "@netlify/blobs";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 300;
const MAX_RETRIES = 4;
const COOLDOWN_MS = 10000;
const CACHE_FILE = "scripts/.order-cache.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMetadata(store, photoBlobs) {
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
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        entries.push(result.value);
      } else {
        entries.push({ key: batch[j].key, exifDate: "" });
        errors++;
      }
    }
    const progress = Math.min(i + BATCH_SIZE, photoBlobs.length);
    process.stdout.write(`\r  Fetched metadata: ${progress}/${photoBlobs.length} (${errors} errors)   `);
    if (i + BATCH_SIZE < photoBlobs.length) await sleep(BATCH_DELAY_MS);
  }

  return entries;
}

function sortEntries(entries) {
  entries.sort((a, b) => {
    if (a.exifDate && b.exifDate) return a.exifDate.localeCompare(b.exifDate);
    if (a.exifDate) return -1;
    if (b.exifDate) return 1;
    return a.key.localeCompare(b.key);
  });
  return entries.map((e) => e.key);
}

async function writeCache(store, sortedKeys) {
  const data = JSON.stringify(sortedKeys);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await store.set("__order__", data, {
        metadata: { updatedAt: new Date().toISOString(), count: String(sortedKeys.length) },
      });
      return true;
    } catch (err) {
      console.log(`\n  Write attempt ${attempt}/${MAX_RETRIES} failed: ${err.message || err}`);
      if (attempt < MAX_RETRIES) {
        const delay = 10000 * attempt;
        console.log(`  Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }
  return false;
}

async function main() {
  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;

  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID environment variables are required.");
    process.exit(1);
  }

  const store = getStore({ name: "photos", siteID, token });

  if (existsSync(CACHE_FILE)) {
    console.log(`Found local cache file (${CACHE_FILE}). Skipping metadata fetch.`);
    console.log("Delete the cache file to re-fetch metadata.\n");
    const sortedKeys = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    console.log(`Loaded ${sortedKeys.length} keys from cache.`);

    console.log(`Cooling down ${COOLDOWN_MS / 1000}s before write...`);
    await sleep(COOLDOWN_MS);

    console.log("Writing __order__ cache...");
    const ok = await writeCache(store, sortedKeys);
    if (ok) {
      console.log("Done! Order cache updated.");
    } else {
      writeFileSync(CACHE_FILE, JSON.stringify(sortedKeys));
      console.error(`Failed to write cache. Sorted keys saved to ${CACHE_FILE}.`);
      console.error("Wait a few minutes and re-run to retry the write.");
      process.exit(1);
    }
    return;
  }

  const { blobs } = await store.list();
  const photoBlobs = blobs.filter((b) => !b.key.startsWith("__"));
  console.log(`Found ${blobs.length} blobs (${photoBlobs.length} photos, ${blobs.length - photoBlobs.length} system keys). Fetching metadata...`);

  const entries = await fetchMetadata(store, photoBlobs);

  console.log("\n\nSorting by EXIF date...");
  const sortedKeys = sortEntries(entries);
  const withExif = entries.filter((e) => e.exifDate).length;
  const withoutExif = entries.length - withExif;

  console.log(`Sorted ${sortedKeys.length} keys (${withExif} with EXIF, ${withoutExif} without).`);

  writeFileSync(CACHE_FILE, JSON.stringify(sortedKeys));
  console.log(`Saved sorted keys to ${CACHE_FILE} (backup).`);

  console.log(`Cooling down ${COOLDOWN_MS / 1000}s before write...`);
  await sleep(COOLDOWN_MS);

  console.log("Writing __order__ cache...");
  const ok = await writeCache(store, sortedKeys);
  if (ok) {
    console.log("Done! Order cache updated.");
  } else {
    console.error(`\nFailed to write cache after ${MAX_RETRIES} attempts.`);
    console.error(`Sorted keys are saved in ${CACHE_FILE}.`);
    console.error("Wait a few minutes and re-run to retry the write (metadata fetch will be skipped).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
