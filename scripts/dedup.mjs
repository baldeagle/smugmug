import { getStore } from "@netlify/blobs";

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1000;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function filenameFromKey(key) {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const isThumbs = args.includes("--thumbs");
  return { dryRun, isThumbs };
}

async function main() {
  const { dryRun, isThumbs } = parseArgs();

  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;

  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID environment variables are required.");
    process.exit(1);
  }

  const storeName = isThumbs ? "thumbs" : "photos";
  const store = getStore({ name: storeName, siteID, token });
  const { blobs } = await store.list();
  console.log(`[${storeName}] Found ${blobs.length} blobs.`);

  const byFilename = new Map();
  for (const blob of blobs) {
    const filename = isThumbs ? blob.key : filenameFromKey(blob.key);
    if (!byFilename.has(filename)) byFilename.set(filename, []);
    byFilename.get(filename).push(blob.key);
  }

  const duplicates = [];
  for (const [filename, keys] of byFilename) {
    if (keys.length > 1) {
      keys.sort().reverse();
      const keep = keys[0];
      const remove = keys.slice(1);
      duplicates.push({ filename, keep, remove });
    }
  }

  if (duplicates.length === 0) {
    console.log("No duplicates found.");
    return;
  }

  const totalToRemove = duplicates.reduce((sum, d) => sum + d.remove.length, 0);
  console.log(`Found ${totalToRemove} duplicates across ${duplicates.length} filenames.\n`);

  if (dryRun) {
    console.log("Dry run - would delete:");
    for (const d of duplicates.slice(0, 20)) {
      console.log(`  ${d.filename}: keep ${d.keep.slice(-20)}..., delete ${d.remove.length} duplicate(s)`);
    }
    if (duplicates.length > 20) {
      console.log(`  ... and ${duplicates.length - 20} more`);
    }
    console.log(`\nTotal: ${totalToRemove} blobs would be deleted.`);
    return;
  }

  const toDelete = duplicates.flatMap((d) => d.remove);
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    for (const key of batch) {
      let success = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await store.delete(key);
          deleted++;
          success = true;
          break;
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            await sleep(5000 * attempt);
          } else {
            failed++;
            console.error(`\n  Failed: ${key} - ${err.message || err}`);
          }
        }
      }
    }
    const progress = Math.min(i + BATCH_SIZE, toDelete.length);
    process.stdout.write(`\r  Deleted: ${progress}/${toDelete.length} (${failed} failed)   `);
    if (i + BATCH_SIZE < toDelete.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n\nDeleted ${deleted} duplicates (${failed} failed).`);

  if (!isThumbs) {
    console.log("Updating order cache...");
    const deleteSet = new Set(toDelete);
    const cached = await store.get("__order__", { type: "text" });
    if (cached) {
      const order = JSON.parse(cached);
      const filtered = order.filter((k) => !deleteSet.has(k));
      await store.set("__order__", JSON.stringify(filtered), {
        metadata: { updatedAt: new Date().toISOString(), count: String(filtered.length) },
      });
      console.log(`Order cache updated (${filtered.length} photos remaining).`);
    } else {
      console.log("No order cache found to update.");
    }
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
