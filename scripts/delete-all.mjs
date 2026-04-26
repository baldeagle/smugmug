import { getStore } from "@netlify/blobs";

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1000;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteStore(name, token, siteID) {
  const store = getStore({ name, siteID, token });
  const { blobs } = await store.list();
  console.log(`\n[${name}] Found ${blobs.length} blobs.`);

  if (blobs.length === 0) {
    console.log(`[${name}] Nothing to delete.`);
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
    const batch = blobs.slice(i, i + BATCH_SIZE);

    for (const blob of batch) {
      let success = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await store.delete(blob.key);
          deleted++;
          success = true;
          break;
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            await sleep(2000 * attempt);
          } else {
            failed++;
            console.error(`\n  Failed: ${blob.key} - ${err.message || err}`);
          }
        }
      }
    }

    const progress = Math.min(i + BATCH_SIZE, blobs.length);
    process.stdout.write(`\r  [${name}] Deleted: ${progress}/${blobs.length} (${failed} failed)   `);
    if (i + BATCH_SIZE < blobs.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n[${name}] Done: ${deleted} deleted, ${failed} failed.`);
}

async function main() {
  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;

  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID environment variables are required.");
    process.exit(1);
  }

  console.log("Deleting all blobs from photos and thumbs stores...");

  await deleteStore("photos", token, siteID);
  await deleteStore("thumbs", token, siteID);
  await deleteStore("stars", token, siteID);
  await deleteStore("rate-limit", token, siteID);

  console.log("\n\nAll stores cleared!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
