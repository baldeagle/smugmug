import { getStore } from "@netlify/blobs";
import exifr from "exifr";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";

const DELAY_MS = 500;
const BATCH_DELAY_MS = 1500;
const PROGRESS_FILE = "scripts/.backfill-progress.json";

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
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID required.");
    process.exit(1);
  }

  const store = getStore({ name: "photos", siteID, token });
  const { blobs } = await store.list();
  const photoBlobs = blobs.filter((b) => !b.key.startsWith("__"));
  console.log(`Found ${photoBlobs.length} photos. Checking metadata...\n`);

  let completed = {};
  if (existsSync(PROGRESS_FILE)) {
    completed = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    console.log(`Resuming: ${Object.keys(completed).length} already processed.\n`);
  }

  let needsExif = [];
  let alreadyHasExif = 0;

  for (const blob of photoBlobs) {
    if (completed[blob.key] === "has-exif" || completed[blob.key] === "no-exif") {
      if (completed[blob.key] === "has-exif") alreadyHasExif++;
      continue;
    }
    if (completed[blob.key] === "skip") continue;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const meta = await store.getMetadata(blob.key);
        if (meta?.exifDate) {
          completed[blob.key] = "has-exif";
          alreadyHasExif++;
          needsExif = undefined;
          break;
        } else {
          needsExif.push(blob.key);
          completed[blob.key] = "needs-exif";
          break;
        }
      } catch {
        if (attempt < 2) {
          await sleep(5000 * (attempt + 1));
        } else {
          needsExif.push(blob.key);
          completed[blob.key] = "needs-exif";
        }
      }
    }
  }

  needsExif = photoBlobs.filter((b) => completed[b.key] === "needs-exif");
  console.log(`${alreadyHasExif} already have EXIF, ${needsExif.length} need extraction.\n`);

  if (needsExif.length === 0) {
    console.log("All photos have EXIF dates. Nothing to do.");
    if (existsSync(PROGRESS_FILE)) try { unlinkSync(PROGRESS_FILE); } catch {}
    return;
  }

  let updated = 0;
  let noExif = 0;
  let failed = 0;

  for (let i = 0; i < needsExif.length; i++) {
    const key = needsExif[i];

    try {
      const data = await store.get(key, { type: "arrayBuffer" });
      if (!data) throw new Error("No data");

      const exifDate = await getExifDateFromBuffer(data);

      let existingMeta = {};
      try { existingMeta = await store.getMetadata(key) || {}; } catch {}

      await store.set(key, data, {
        metadata: { ...existingMeta, exifDate: exifDate || "" },
      });

      if (exifDate) {
        updated++;
        completed[key] = "has-exif";
      } else {
        noExif++;
        completed[key] = "no-exif";
      }
    } catch (err) {
      failed++;
      console.error(`\n  Failed ${key.slice(-30)}: ${err.message || err}`);
    }

    const progress = i + 1;
    process.stdout.write(
      `\r  [${progress}/${needsExif.length}] ${updated} updated, ${noExif} no EXIF, ${failed} failed   `
    );

    if (progress % 20 === 0) {
      writeFileSync(PROGRESS_FILE, JSON.stringify(completed));
    }

    if (i < needsExif.length - 1) await sleep(DELAY_MS);
  }

  writeFileSync(PROGRESS_FILE, JSON.stringify(completed));

  console.log(`\n\nDone! ${updated} updated, ${noExif} no EXIF data, ${failed} failed.`);

  if (updated > 0) {
    console.log("\nRun rebuild-order.mjs to update the gallery sort order.");
  }

  if (failed === 0 && existsSync(PROGRESS_FILE)) {
    try { unlinkSync(PROGRESS_FILE); } catch {}
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
