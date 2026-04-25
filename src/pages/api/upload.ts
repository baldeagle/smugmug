import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { isAuthenticated } from "../../lib/auth";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 20;

const IMAGE_SIGNATURES: { name: string; offset: number; bytes: number[] }[] = [
  { name: "jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { name: "png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { name: "gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { name: "webp", offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
];

function validateImageMagicBytes(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer.slice(0, 16));
  return IMAGE_SIGNATURES.some((sig) => {
    if (view.length < sig.offset + sig.bytes.length) return false;
    return sig.bytes.every(
      (byte, i) => view[sig.offset + i] === byte
    );
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    if (!(await isAuthenticated(cookies))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
      });
    }

    if (files.length > MAX_FILES) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_FILES} files per upload` }),
        { status: 400 }
      );
    }

    const store = getStore("photos");
    const uploaded = [];
    const errors = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          filename: file.name,
          error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        });
        continue;
      }

      const buffer = await file.arrayBuffer();

      if (!validateImageMagicBytes(buffer)) {
        errors.push({
          filename: file.name,
          error: "File is not a valid image",
        });
        continue;
      }

      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
      await store.set(key, new Uint8Array(buffer), {
        metadata: {
          filename: file.name,
          contentType: file.type,
          size: String(file.size),
          uploadDate: new Date().toISOString(),
        },
      });
      uploaded.push({ key, filename: file.name });
    }

    return new Response(JSON.stringify({ uploaded, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || String(err), stack: err?.stack }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
