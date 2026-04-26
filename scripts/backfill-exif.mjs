import { getStore } from "@netlify/blobs";
import exifr from "exifr";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getExifDateFromBuffer(buffer) {
  try {
    const result = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      iptc: true,
      xmp: true,
      pick: ["DateTimeOriginal", "CreateDate", "DateCreated", "ModifyDate"],
    });
    if (!result) return null;
    const date = result.DateTimeOriginal || result.CreateDate || result.DateCreated || result.ModifyDate;
    if (!date) return null;
    if (date instanceof Date) return date.toISOString();
    return String(date);
  } catch {
    return null;
  }
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
  console.log(`Found ${blobs.length} photos. Checking metadata...`);

  const keysNeedingExif = [];
  for (const blob of blobs) {
    try {
      const meta = await store.getMetadata(blob.key);
      if (!meta?.exifDate) {
        keysNeedingExif.push(blob.key);
      }
    } catch {
      keysNeedingExif.push(blob.key);
    }
  }

  if (keysNeedingExif.length === 0) {
    console.log("All photos already have EXIF dates. Nothing to do.");
    return;
  }

  console.log(`${keysNeedingExif.length} photos need EXIF date backfill.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < keysNeedingExif.length; i += BATCH_SIZE) {
    const batch = keysNeedingExif.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (key) => {
        const data = await store.get(key, { type: "arrayBuffer" });
        if (!data) throw new Error("No data");
        const exifDate = await getExifDateFromBuffer(data);
        const existingMeta = await store.getMetadata(key).catch(() => ({}));
        await store.set(key, data, {
          metadata: {
            ...existingMeta,
            exifDate: exifDate || "",
          },
        });
        return { key, exifDate };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.exifDate) {
          updated++;
        } else {
          skipped++;
        }
      } else {
        failed++;
        console.error(`  Failed: ${result.reason}`);
      }
    }

    const progress = Math.min(i + BATCH_SIZE, keysNeedingExif.length);
    process.stdout.write(
      `\r  [${progress}/${keysNeedingExif.length}] ${updated} updated, ${skipped} no EXIF, ${failed} failed   `
    );

    if (i + BATCH_SIZE < keysNeedingExif.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n\nDone! ${updated} photos updated with EXIF dates, ${skipped} had no EXIF data, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
