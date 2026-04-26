import { getStore } from "@netlify/blobs";
import exifr from "exifr";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const PHOTOS_DIR = "E:\\Photos\\Capoeria 20th Day 2\\uploads";
const THUMBS_DIR = "E:\\Photos\\Capoeria 20th Day 2\\thumbnails";
const MOBILE_DIR = "E:\\Photos\\Capoeria 20th Day 2\\mobile";
const BATCH_DELAY_MS = 300;
const MISSING_PHOTOS_FILE = "scripts/.missing-photos.json";
const MISSING_THUMBS_FILE = "scripts/.missing-thumbs.json";
const MISSING_MOBILE_FILE = "scripts/.missing-mobile.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function contentTypeFor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

async function getExifDate(filepath) {
  try {
    const result = await exifr.parse(filepath, {
      tiff: true, exif: true, iptc: true, xmp: true,
      pick: ["DateTimeOriginal", "CreateDate", "DateCreated", "ModifyDate"],
    });
    if (!result) return "";
    const date = result.DateTimeOriginal || result.CreateDate || result.DateCreated || result.ModifyDate;
    if (!date) return "";
    return date instanceof Date ? date.toISOString() : String(date);
  } catch {
    return "";
  }
}

async function uploadMissingPhotos(store, missingFiles) {
  if (missingFiles.length === 0) {
    console.log("No missing photos to upload.");
    return 0;
  }

  console.log(`\nUploading ${missingFiles.length} missing photos...\n`);
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < missingFiles.length; i++) {
    const filename = missingFiles[i];
    const filepath = join(PHOTOS_DIR, filename);

    try {
      const data = await readFile(filepath);
      const exifDate = await getExifDate(filepath);
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;

      await store.set(key, new Uint8Array(data), {
        metadata: {
          filename,
          contentType: contentTypeFor(filename),
          size: String(data.length),
          uploadDate: new Date().toISOString(),
          exifDate,
        },
      });
      uploaded++;
    } catch (err) {
      failed++;
      console.error(`\n  Failed ${filename}: ${err.message || err}`);
    }

    process.stdout.write(`\r  [${i + 1}/${missingFiles.length}] ${uploaded} uploaded, ${failed} failed   `);
    if (i < missingFiles.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\nPhotos done: ${uploaded} uploaded, ${failed} failed.`);
  return uploaded;
}

async function uploadMissingThumbs(thumbStore, missingThumbs) {
  if (missingThumbs.length === 0) {
    console.log("No missing thumbnails to upload.");
    return 0;
  }

  console.log(`\nUploading ${missingThumbs.length} missing thumbnails...\n`);
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < missingThumbs.length; i++) {
    const { filename, thumbKey } = missingThumbs[i];
    const thumbFilename = thumbNameFromFilename(filename);
    const filepath = join(THUMBS_DIR, thumbFilename);

    try {
      const data = await readFile(filepath);
      await thumbStore.set(thumbKey, new Uint8Array(data), {
        metadata: {
          filename: thumbFilename,
          contentType: contentTypeFor(thumbFilename),
          size: String(data.length),
        },
      });
      uploaded++;
    } catch (err) {
      failed++;
      console.error(`\n  Failed ${thumbFilename}: ${err.message || err}`);
    }

    process.stdout.write(`\r  [${i + 1}/${missingThumbs.length}] ${uploaded} uploaded, ${failed} failed   `);
    if (i < missingThumbs.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\nThumbs done: ${uploaded} uploaded, ${failed} failed.`);
  return uploaded;
}

async function uploadMissingMobile(mobileStore, missingMobile) {
  if (missingMobile.length === 0) {
    console.log("No missing mobile images to upload.");
    return 0;
  }

  console.log(`\nUploading ${missingMobile.length} missing mobile images...\n`);
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < missingMobile.length; i++) {
    const { filename, mobileKey } = missingMobile[i];
    const mobileFilename = mobileNameFromFilename(filename);
    const filepath = join(MOBILE_DIR, mobileFilename);

    try {
      const data = await readFile(filepath);
      await mobileStore.set(mobileKey, new Uint8Array(data), {
        metadata: {
          filename: mobileFilename,
          contentType: contentTypeFor(mobileFilename),
          size: String(data.length),
        },
      });
      uploaded++;
    } catch (err) {
      failed++;
      console.error(`\n  Failed ${mobileFilename}: ${err.message || err}`);
    }

    process.stdout.write(`\r  [${i + 1}/${missingMobile.length}] ${uploaded} uploaded, ${failed} failed   `);
    if (i < missingMobile.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\nMobile done: ${uploaded} uploaded, ${failed} failed.`);
  return uploaded;
}

async function main() {
  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;

  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID required.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const doPhotos = !args.includes("--thumbs-only") && !args.includes("--mobile-only");
  const doThumbs = !args.includes("--photos-only") && !args.includes("--mobile-only");
  const doMobile = !args.includes("--photos-only") && !args.includes("--thumbs-only");

  const store = getStore({ name: "photos", siteID, token });
  const thumbStore = getStore({ name: "thumbs", siteID, token });
  const mobileStore = getStore({ name: "mobile", siteID, token });

  let totalUploaded = 0;

  if (doPhotos) {
    let missingPhotos = [];
    try {
      missingPhotos = JSON.parse(readFileSync(MISSING_PHOTOS_FILE, "utf-8"));
    } catch {
      console.log("No .missing-photos.json found. Run local-reorder.mjs first.");
    }

    if (missingPhotos.length > 0) {
      const count = await uploadMissingPhotos(store, missingPhotos);
      totalUploaded += count;
    }
  }

  if (doThumbs) {
    let missingThumbs = [];
    try {
      missingThumbs = JSON.parse(readFileSync(MISSING_THUMBS_FILE, "utf-8"));
    } catch {
      console.log("No .missing-thumbs.json found. Run local-reorder.mjs first.");
    }

    if (missingThumbs.length > 0) {
      const count = await uploadMissingThumbs(thumbStore, missingThumbs);
      totalUploaded += count;
    }
  }

  if (doMobile) {
    let missingMobile = [];
    try {
      missingMobile = JSON.parse(readFileSync(MISSING_MOBILE_FILE, "utf-8"));
    } catch {
      console.log("No .missing-mobile.json found. Run local-reorder.mjs first.");
    }

    if (missingMobile.length > 0) {
      const count = await uploadMissingMobile(mobileStore, missingMobile);
      totalUploaded += count;
    }
  }

  if (totalUploaded > 0) {
    console.log(`\n${totalUploaded} total uploads. Run local-reorder.mjs again to rebuild order cache.`);
  } else {
    console.log("\nNothing to upload.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
