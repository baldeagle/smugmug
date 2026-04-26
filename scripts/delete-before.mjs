import { getStore } from "@netlify/blobs";
import { extname, basename } from "node:path";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const beforeIdx = args.indexOf("--before");
  if (beforeIdx === -1 || !args[beforeIdx + 1]) {
    return { dryRun, before: null };
  }
  return { dryRun, before: new Date(args[beforeIdx + 1] + "T00:00:00Z") };
}

function thumbFilename(filename) {
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  return base + "_thumb" + ext;
}

function filenameFromKey(key) {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

function dateFromKey(key) {
  const ts = parseInt(key, 10);
  if (!isNaN(ts) && ts > 1000000000000) return new Date(ts);
  return null;
}

async function main() {
  const { dryRun, before } = parseArgs();

  if (!before || isNaN(before.getTime())) {
    console.error("Usage: node scripts/delete-before.mjs --before YYYY-MM-DD [--dry-run]");
    console.error("");
    console.error("Examples:");
    console.error("  node scripts/delete-before.mjs --before 2026-04-27 --dry-run");
    console.error("  node scripts/delete-before.mjs --before 2026-04-27");
    process.exit(1);
  }

  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;

  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID environment variables are required.");
    process.exit(1);
  }

  const photoStore = getStore({ name: "photos", siteID, token });
  const thumbStore = getStore({ name: "thumbs", siteID, token });
  const { blobs } = await photoStore.list();

  const photoBlobs = blobs.filter((b) => !b.key.startsWith("__"));
  console.log(`Found ${photoBlobs.length} photos. Checking upload dates...`);

  const toDelete = [];
  for (let i = 0; i < photoBlobs.length; i += 10) {
    const batch = photoBlobs.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (blob) => {
        let uploadDate = null;
        try {
          const meta = await photoStore.getMetadata(blob.key);
          if (meta?.uploadDate) uploadDate = new Date(meta.uploadDate);
        } catch {}
        if (!uploadDate || isNaN(uploadDate.getTime())) {
          uploadDate = dateFromKey(blob.key);
        }
        return { key: blob.key, filename: filenameFromKey(blob.key), uploadDate };
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.uploadDate) {
        if (result.value.uploadDate < before) {
          toDelete.push(result.value);
        }
      }
    }
    const progress = Math.min(i + 10, photoBlobs.length);
    process.stdout.write(`\r  Checked: ${progress}/${photoBlobs.length} (${toDelete.length} to delete)   `);
    if (i + 10 < photoBlobs.length) await sleep(200);
  }

  console.log(`\n\nFound ${toDelete.length} photos uploaded before ${before.toISOString().slice(0, 10)}.`);

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (dryRun) {
    console.log("\nDry run - would delete:");
    for (const photo of toDelete.slice(0, 20)) {
      console.log(`  ${photo.filename} (${photo.uploadDate.toISOString().slice(0, 10)})`);
    }
    if (toDelete.length > 20) {
      console.log(`  ... and ${toDelete.length - 20} more`);
    }
    console.log(`\nTotal: ${toDelete.length} photos (and their thumbnails)`);
    return;
  }

  console.log(`Deleting ${toDelete.length} photos and thumbnails...\n`);

  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (photo) => {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await photoStore.delete(photo.key);
            const thumbKey = thumbFilename(photo.filename);
            await thumbStore.delete(thumbKey).catch(() => {});
            return;
          } catch (err) {
            if (attempt === MAX_RETRIES) throw err;
            await sleep(2000 * attempt);
          }
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") deleted++;
      else { failed++; console.error(`  Failed: ${result.reason}`); }
    }

    const progress = Math.min(i + BATCH_SIZE, toDelete.length);
    process.stdout.write(`\r  Deleted: ${progress}/${toDelete.length} (${failed} failed)   `);
    if (i + BATCH_SIZE < toDelete.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n\nDeleted ${deleted} photos (${failed} failed).`);

  console.log("Updating order cache...");
  const cached = await photoStore.get("__order__", { type: "text" });
  if (cached) {
    const order = JSON.parse(cached);
    const deleteSet = new Set(toDelete.map((p) => p.key));
    const filtered = order.filter((k) => !deleteSet.has(k));
    await photoStore.set("__order__", JSON.stringify(filtered), {
      metadata: { updatedAt: new Date().toISOString(), count: String(filtered.length) },
    });
    console.log(`Order cache updated (${filtered.length} photos remaining).`);
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
