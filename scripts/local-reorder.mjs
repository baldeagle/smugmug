import { getStore } from "@netlify/blobs";
import exifr from "exifr";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PHOTOS_DIR = "E:\\Photos\\Capoeria 20th Day 2\\uploads";
const THUMBS_DIR = "E:\\Photos\\Capoeria 20th Day 2\\thumbnails";
const MOBILE_DIR = "E:\\Photos\\Capoeria 20th Day 2\\mobile";
const CACHE_FILE = "scripts/.order-cache.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function filenameFromKey(key) {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

function thumbNameFromFilename(filename) {
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  return base + "_thumb" + ext;
}

function mobileNameFromFilename(filename) {
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  return base + "_mobile" + ext;
}

async function extractExifDates() {
  console.log(`Scanning ${PHOTOS_DIR} for local photos...`);
  const files = readdirSync(PHOTOS_DIR).filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
  console.log(`Found ${files.length} local photo files.\n`);

  console.log("Extracting EXIF dates...");
  const exifMap = {};
  let withExif = 0;
  let withoutExif = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await exifr.parse(join(PHOTOS_DIR, file), {
        tiff: true,
        exif: true,
        iptc: true,
        xmp: true,
        pick: ["DateTimeOriginal", "CreateDate", "DateCreated", "ModifyDate"],
      });
      if (result) {
        const date = result.DateTimeOriginal || result.CreateDate || result.DateCreated || result.ModifyDate;
        if (date) {
          exifMap[file] = date instanceof Date ? date.toISOString() : String(date);
          withExif++;
        } else {
          withoutExif++;
        }
      } else {
        withoutExif++;
      }
    } catch {
      withoutExif++;
    }

    if ((i + 1) % 500 === 0 || i === files.length - 1) {
      process.stdout.write(`\r  Extracted ${i + 1}/${files.length} (${withExif} with EXIF, ${withoutExif} without)   `);
    }
  }

  console.log(`\n`);
  return exifMap;
}

async function main() {
  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;

  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID required.");
    process.exit(1);
  }

  const exifMap = await extractExifDates();

  console.log("Fetching blob list from store...");
  const store = getStore({ name: "photos", siteID, token });
  const thumbStore = getStore({ name: "thumbs", siteID, token });
  const mobileStore = getStore({ name: "mobile", siteID, token });

  const [{ blobs: photoBlobs }, { blobs: thumbBlobs }, { blobs: mobileBlobs }] = await Promise.all([
    store.list(),
    thumbStore.list(),
    mobileStore.list(),
  ]);

  const photoKeys = photoBlobs.filter((b) => !b.key.startsWith("__")).map((b) => b.key);
  const thumbKeys = new Set(thumbBlobs.map((b) => b.key));
  const mobileKeys = new Set(mobileBlobs.map((b) => b.key));

  console.log(`Store has ${photoKeys.length} photo blobs, ${thumbKeys.size} thumb blobs, ${mobileKeys.size} mobile blobs.\n`);

  const blobByFilename = {};
  for (const key of photoKeys) {
    const fname = filenameFromKey(key);
    blobByFilename[fname] = key;
  }

  const localFiles = Object.keys(exifMap);
  const missingFromStore = localFiles.filter((f) => !blobByFilename[f]);
  const extraInStore = photoKeys.filter((k) => {
    const fname = filenameFromKey(k);
    return !exifMap[fname];
  });

  const missingThumbs = [];
  const missingMobile = [];
  for (const key of photoKeys) {
    const fname = filenameFromKey(key);
    const thumbKey = thumbNameFromFilename(fname);
    const mobileKey = mobileNameFromFilename(fname);
    if (!thumbKeys.has(thumbKey)) {
      missingThumbs.push({ key, filename: fname, thumbKey });
    }
    if (!mobileKeys.has(mobileKey)) {
      missingMobile.push({ key, filename: fname, mobileKey });
    }
  }

  console.log(`=== Cross-reference Report ===`);
  console.log(`Local files:        ${localFiles.length}`);
  console.log(`Store blobs:        ${photoKeys.length}`);
  console.log(`Missing from store: ${missingFromStore.length}`);
  console.log(`Extra in store:     ${extraInStore.length}`);
  console.log(`Missing thumbs:     ${missingThumbs.length}`);
  console.log(`Missing mobile:     ${missingMobile.length}`);

  if (missingFromStore.length > 0) {
    writeFileSync("scripts/.missing-photos.json", JSON.stringify(missingFromStore, null, 2));
    console.log(`\nMissing photos saved to scripts/.missing-photos.json`);
    console.log(`First 10: ${missingFromStore.slice(0, 10).join(", ")}`);
  }

  if (missingThumbs.length > 0) {
    writeFileSync("scripts/.missing-thumbs.json", JSON.stringify(missingThumbs, null, 2));
    console.log(`Missing thumbs saved to scripts/.missing-thumbs.json`);
    console.log(`First 10: ${missingThumbs.slice(0, 10).map((m) => m.filename).join(", ")}`);
  }

  if (missingMobile.length > 0) {
    writeFileSync("scripts/.missing-mobile.json", JSON.stringify(missingMobile, null, 2));
    console.log(`Missing mobile saved to scripts/.missing-mobile.json`);
    console.log(`First 10: ${missingMobile.slice(0, 10).map((m) => m.filename).join(", ")}`);
  }

  const entries = photoKeys.map((key) => {
    const fname = filenameFromKey(key);
    return { key, filename: fname, exifDate: exifMap[fname] || "" };
  });

  entries.sort((a, b) => {
    if (a.exifDate && b.exifDate) return a.exifDate.localeCompare(b.exifDate);
    if (a.exifDate) return -1;
    if (b.exifDate) return 1;
    return a.filename.localeCompare(b.filename);
  });

  const sortedKeys = entries.map((e) => e.key);
  const withExif = entries.filter((e) => e.exifDate).length;

  console.log(`\nSorted ${sortedKeys.length} keys (${withExif} with EXIF, ${sortedKeys.length - withExif} by filename).`);

  writeFileSync(CACHE_FILE, JSON.stringify(sortedKeys));
  console.log(`Saved to ${CACHE_FILE}.`);

  console.log("Cooling down 10s before write...");
  await sleep(10000);

  console.log("Writing __order__ cache...");
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await store.set("__order__", JSON.stringify(sortedKeys), {
        metadata: { updatedAt: new Date().toISOString(), count: String(sortedKeys.length) },
      });
      console.log(`Done! Order cache updated with ${sortedKeys.length} photos.`);
      return;
    } catch (err) {
      console.log(`  Write attempt ${attempt}/5 failed: ${err.message || err}`);
      if (attempt < 5) {
        const delay = 15000 * attempt;
        console.log(`  Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }
  console.error("Write failed. Cache file saved locally — re-run to retry write.");
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
