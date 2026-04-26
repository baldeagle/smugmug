import { getStore } from "@netlify/blobs";
import { readdir, stat, readFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import exifr from "exifr";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const JPEG_EXTENSIONS = new Set([".jpg", ".jpeg"]);

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function filenameFromKey(key) {
  const parts = key.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return key;
}

async function scanDirectory(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

async function getExifDate(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!JPEG_EXTENSIONS.has(ext)) return null;
  try {
    const result = await exifr.parse(filePath, {
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

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds % 60}s`;
}

async function uploadPhoto(store, filePath) {
  const filename = basename(filePath);
  const ext = extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "image/octet-stream";
  const fileStat = await stat(filePath);
  const buffer = await readFile(filePath);
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;

  const exifDate = await getExifDate(filePath);

  await store.set(key, new Uint8Array(buffer), {
    metadata: {
      filename,
      contentType,
      size: String(fileStat.size),
      uploadDate: new Date().toISOString(),
      exifDate: exifDate || "",
    },
  });

  return { key, exifDate: exifDate || "" };
}

async function uploadWithRetry(store, filePath) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await uploadPhoto(store, filePath);
      return { ok: true, ...result };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        process.stdout.write(`\n    Retrying ${basename(filePath)} (${attempt}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        return { ok: false, error: err.message || String(err) };
      }
    }
  }
}

async function updateOrderCache(store, newEntries) {
  if (newEntries.length === 0) return;
  console.log("\nUpdating photo order cache...");
  const cached = await store.get("__order__", { type: "text" });
  let order = cached ? JSON.parse(cached) : [];
  const existingSet = new Set(order);
  for (const entry of newEntries) {
    if (!existingSet.has(entry.key)) {
      order.push(entry.key);
      existingSet.add(entry.key);
    }
  }
  const metaMap = new Map(newEntries.map((e) => [e.key, e.exifDate]));
  const BATCH = 20;
  for (let i = 0; i < order.length; i += BATCH) {
    const batch = order.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.filter((k) => !metaMap.has(k)).map(async (key) => {
        try {
          const meta = await store.getMetadata(key);
          return [key, meta?.exifDate || ""];
        } catch {
          return [key, ""];
        }
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") metaMap.set(r.value[0], r.value[1]);
    }
    if (i + BATCH < order.length) await sleep(200);
  }
  order.sort((a, b) => {
    const da = metaMap.get(a) || "";
    const db = metaMap.get(b) || "";
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return a.localeCompare(b);
  });
  await store.set("__order__", JSON.stringify(order), {
    metadata: { updatedAt: new Date().toISOString(), count: String(order.length) },
  });
  console.log(`Order cache updated (${order.length} photos).`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const isThumbs = args.includes("--thumbs");
  const inputDir = args.find((a) => !a.startsWith("--"));
  return { isThumbs, inputDir };
}

async function uploadThumb(store, filePath) {
  const filename = basename(filePath);
  const ext = extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "image/octet-stream";
  const buffer = await readFile(filePath);
  const key = filename;

  await store.set(key, new Uint8Array(buffer), {
    metadata: { contentType },
  });

  return { key, exifDate: "" };
}

async function main() {
  const { isThumbs, inputDir } = parseArgs();
  if (!inputDir) {
    console.error("Usage: node scripts/upload-missing.mjs [--thumbs] <directory>");
    process.exit(1);
  }

  const token = process.env.NETLIFY_BLOBS_SECRET;
  const siteID = process.env.NETLIFY_SITE_ID;
  if (!token || !siteID) {
    console.error("Error: NETLIFY_BLOBS_SECRET and NETLIFY_SITE_ID environment variables are required.");
    process.exit(1);
  }

  const dir = await stat(inputDir).catch(() => null);
  if (!dir?.isDirectory()) {
    console.error(`Error: "${inputDir}" is not a directory.`);
    process.exit(1);
  }

  console.log("Scanning local directory...");
  const localFiles = await scanDirectory(inputDir);
  if (localFiles.length === 0) {
    console.log("No image files found.");
    return;
  }
  console.log(`Found ${localFiles.length} local image(s).`);

  console.log("Fetching existing photos from store...");
  const storeName = isThumbs ? "thumbs" : "photos";
  const store = getStore({ name: storeName, siteID, token });
  const { blobs } = await store.list();
  const existingFilenames = new Set(
    isThumbs
      ? blobs.map((b) => b.key.toLowerCase())
      : blobs.map((b) => filenameFromKey(b.key).toLowerCase())
  );
  console.log(`Store has ${blobs.length} entries.`);

  const missing = localFiles.filter((f) => !existingFilenames.has(basename(f).toLowerCase()));
  if (missing.length === 0) {
    console.log("All photos already uploaded. Nothing to do.");
    return;
  }
  const label = isThumbs ? "thumbnails" : "photos";
  console.log(`\n${missing.length} ${label} need uploading.\n`);

  const start = Date.now();
  let uploaded = 0;
  let failed = 0;
  const uploadedEntries = [];
  const failedFiles = [];

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (filePath) => {
        if (isThumbs) {
          try {
            const result = await uploadThumb(store, filePath);
            return { ok: true, ...result };
          } catch (err) {
            return { ok: false, error: err.message || String(err) };
          }
        }
        return uploadWithRetry(store, filePath);
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value.ok) {
        uploaded++;
        uploadedEntries.push({ key: result.value.key, exifDate: result.value.exifDate });
      } else {
        failed++;
        const reason = result.status === "fulfilled" ? result.value.error : result.reason;
        console.error(`\n  Failed: ${basename(batch[j])} - ${reason}`);
        failedFiles.push(batch[j]);
      }
    }

    const progress = Math.min(i + BATCH_SIZE, missing.length);
    const elapsed = Date.now() - start;
    const rate = uploaded / (elapsed / 1000);
    const remaining = rate > 0 ? Math.round((missing.length - progress) / rate) : "?";

    process.stdout.write(
      `\r  [${progress}/${missing.length}] ${uploaded} ok, ${failed} failed, ${rate.toFixed(1)} photos/s, ${formatElapsed(elapsed)} elapsed, ~${remaining}s remaining   `
    );

    if (i + BATCH_SIZE < missing.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const elapsed = Date.now() - start;
  console.log(`\n\nDone! Uploaded ${uploaded} ${label} in ${formatElapsed(elapsed)}.`);
  if (failed > 0) {
    console.log(`${failed} ${label} failed. Re-run this script to retry them.`);
  }

  if (!isThumbs && uploadedEntries.length > 0) {
    await updateOrderCache(store, uploadedEntries);
  }
  console.log("All done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
