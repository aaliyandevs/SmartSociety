import 'server-only';

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { serverEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';

/**
 * Secure handling of resident-uploaded complaint photos (SRS §1.6, Residents #4).
 *
 * Uploads never land in /public. They are written to an application-owned
 * directory and served back through an authenticated route handler, so a
 * complaint photo cannot be fetched by guessing a URL.
 */

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

/** Magic bytes, checked so a renamed .exe cannot masquerade as a JPEG. */
const MAGIC_SIGNATURES: { mime: string; bytes: number[]; offset: number }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { mime: 'image/heic', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export const MAX_ATTACHMENTS_PER_COMPLAINT = 4;

function uploadRoot(): string {
  return path.resolve(process.cwd(), serverEnv.uploadDir);
}

function detectMime(buffer: Buffer): string | null {
  for (const signature of MAGIC_SIGNATURES) {
    const slice = buffer.subarray(signature.offset, signature.offset + signature.bytes.length);
    if (slice.length === signature.bytes.length && signature.bytes.every((byte, i) => slice[i] === byte)) {
      return signature.mime;
    }
  }
  return null;
}

export interface StoredFile {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validates and stores one uploaded image.
 *
 * `folder` becomes a path segment, so it is restricted to a safe character set
 * and the resolved path is re-checked against the upload root to make directory
 * traversal impossible.
 */
export async function storeUpload(file: File, folder: string): Promise<StoredFile> {
  const maxBytes = serverEnv.uploadMaxBytes;

  if (file.size === 0) {
    throw new AppError('That file appears to be empty.');
  }
  if (file.size > maxBytes) {
    throw new AppError(
      `"${file.name}" is ${(file.size / 1_048_576).toFixed(1)} MB. The limit is ${(maxBytes / 1_048_576).toFixed(0)} MB per photo.`,
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new AppError('Only JPEG, PNG, WebP and HEIC photos can be uploaded.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectMime(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected)) {
    throw new AppError('That file is not a valid image. Please upload a real photo.');
  }

  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'misc';
  const extension = EXTENSIONS[detected] ?? 'bin';
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${extension}`;
  const storageKey = `${safeFolder}/${name}`;

  const root = uploadRoot();
  const destination = path.resolve(root, safeFolder, name);
  if (!destination.startsWith(root + path.sep)) {
    throw new AppError('Invalid upload destination.');
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, buffer);

  return {
    storageKey,
    // Keep the original name for display, stripped of anything path-like.
    fileName: path.basename(file.name).slice(0, 120) || name,
    mimeType: detected,
    sizeBytes: buffer.byteLength,
  };
}

/** Reads a stored file back for the authenticated /api/files route. */
export async function readUpload(storageKey: string): Promise<Buffer> {
  const root = uploadRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(root + path.sep)) {
    throw new AppError('Invalid file path.', { status: 400 });
  }
  return readFile(resolved);
}
