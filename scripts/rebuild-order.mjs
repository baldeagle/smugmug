import { getStore } from "@netlify/blobs";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const DELAY_MS = 400;
const MAX_RETRIES = 5;
const BACKOFF = [2000, 5000, 15000, 30000, 60000];
const CACHE_FILE = "scripts/.order-cache.json";
const PROGRESS_FILE = "scripts/.order-progress.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getMetadataWithRetry(store, key) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const meta = await store.getMetadata(key);
      return { key, exifDate: meta?.exifDate || "" };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
        process.stdout.write(`\n  Retry ${attempt + 1}/${MAX_RETRIES} for ${key.slice(-30)} (${delay}ms)...`);
        await sleep(delay);
      }
    }
  }
  return { key, exifDate: "" };
}

async function writeCache(store, sortedKeys) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await store.set("__order__", JSON.stringify(sortedKeys), {
        metadata: { updatedAt: new Date().toISOString(), count: String(sortedKeys.length) },
      });
      return true;
    } catch (err) {
      console.log(`\n  Write attempt ${attempt}/5 failed: ${err.message || err}`);
      if (attempt < 5) {
        const delay = 15000 * attempt;
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
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID required.");
    process.exit(1);
  }

  const store = getStore({ name: "photos", siteID, token });

  if (existsSync(CACHE_FILE) && !existsSync(PROGRESS_FILE)) {
    console.log(`Found completed cache (${CACHE_FILE}). Use --force to re-fetch.`);
    const sortedKeys = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    console.log(`Loaded ${sortedKeys.length} keys. Writing to store...`);
    await sleep(10000);
    const ok = await writeCache(store, sortedKeys);
    if (ok) console.log("Done! Order cache updated.");
    else {
      console.error("Write failed. Re-run to retry.");
      process.exit(1);
    }
    return;
  }

  let existingEntries = {};
  let keysToFetch = [];
  const { blobs } = await store.list();
  const photoBlobs = blobs.filter((b) => !b.key.startsWith("__"));
  console.log(`Found ${photoBlobs.length} photos.`);

  if (existsSync(PROGRESS_FILE)) {
    existingEntries = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    const fetched = Object.keys(existingEntries).length;
    console.log(`Resuming from progress file (${fetched} already fetched).`);
    keysToFetch = photoBlobs.map((b) => b.key).filter((k) => !(k in existingEntries));
    console.log(`${keysToFetch.length} remaining.`);
  } else {
    keysToFetch = photoBlobs.map((b) => b.key);
  }

  if (keysToFetch.length > 0) {
    console.log(`Fetching metadata sequentially (${DELAY_MS}ms delay, ${MAX_RETRIES} retries)...\n`);
    let batchSave = 0;

    for (let i = 0; i < keysToFetch.length; i++) {
      const key = keysToFetch[i];
      const result = await getMetadataWithRetry(store, key);
      existingEntries[result.key] = result.exifDate;

      batchSave++;
      if (batchSave >= 50 || i === keysToFetch.length - 1) {
        writeFileSync(PROGRESS_FILE, JSON.stringify(existingEntries));
        batchSave = 0;
      }

      const progress = Object.keys(existingEntries).length;
      const withExif = Object.values(existingEntries).filter((v) => v).length;
      process.stdout.write(`\r  ${progress}/${photoBlobs.length} fetched (${withExif} with EXIF, ${progress - withExif} without)   `);

      if (i < keysToFetch.length - 1) await sleep(DELAY_MS);
    }
  }

  const allEntries = photoBlobs.map((b) => ({
    key: b.key,
    exifDate: existingEntries[b.key] || "",
  }));

  console.log("\n\nSorting...");
  const withExif = allEntries.filter((e) => e.exifDate).length;
  const without = allEntries.length - withExif;
  console.log(`${withExif} with EXIF dates, ${without} without.`);

  allEntries.sort((a, b) => {
    if (a.exifDate && b.exifDate) return a.exifDate.localeCompare(b.exifDate);
    if (a.exifDate) return -1;
    if (b.exifDate) return 1;
    return a.key.localeCompare(b.key);
  });

  const sortedKeys = allEntries.map((e) => e.key);
  writeFileSync(CACHE_FILE, JSON.stringify(sortedKeys));
  console.log(`Saved ${sortedKeys.length} keys to ${CACHE_FILE}.`);

  console.log("Cooling down 10s before write...");
  await sleep(10000);

  console.log("Writing __order__ cache...");
  const ok = await writeCache(store, sortedKeys);
  if (ok) {
    console.log("Done! Order cache updated.");
    if (existsSync(PROGRESS_FILE)) {
      const { unlinkSync } = await import("node:fs");
      try { unlinkSync(PROGRESS_FILE); } catch {}
    }
  } else {
    console.error(`\nWrite failed. Progress saved in ${PROGRESS_FILE}. Re-run to retry.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
