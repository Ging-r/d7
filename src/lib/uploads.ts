import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_PHOTO_BYTES } from "./config";
import { UserError } from "./errors";

const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR ?? "uploads");

const EXTENSIONS = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
type Extension = keyof typeof EXTENSIONS;

/** Generated names only, so a request can never reach outside the upload directory. */
const FILENAME_PATTERN = /^[a-f0-9]{24}\.(jpg|png|webp)$/;

/** Detects the format from magic bytes instead of trusting the browser-supplied type. */
function sniff(buf: Buffer): Extension | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new UserError(`Each photo can be at most ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new UserError("Photos must be JPEG, PNG or WebP images.");
  const filename = `${randomBytes(12).toString("hex")}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buf);
  return filename;
}

export async function readImage(filename: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!FILENAME_PATTERN.test(filename)) return null;
  try {
    const data = await readFile(path.join(UPLOAD_DIR, filename));
    return { data, contentType: EXTENSIONS[filename.split(".")[1] as Extension] };
  } catch {
    return null;
  }
}

export async function deleteImage(filename: string) {
  if (!FILENAME_PATTERN.test(filename)) return;
  await unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
}
