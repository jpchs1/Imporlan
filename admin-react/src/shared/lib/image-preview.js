import { fetchPrivateFile } from './file-download';

// HEIC/HEIF uploads stay private and keep their original format for downloads.
// Only the decoder code comes from the CDN; image bytes never leave this browser.
const DECODER_URL = 'https://cdn.jsdelivr.net/npm/heic-to@1.6.6/+esm';
const MAX_CACHE_BYTES = 48 * 1024 * 1024;
const cache = new Map();
const pending = new Map();
let cacheBytes = 0;
let queue = Promise.resolve();
let decoder;

export function isHeicImage(mimeType = '', originalName = '') {
  return /^image\/hei[cf](?:-sequence)?(?:;|$)/i.test(mimeType) || /\.hei[cf]$/i.test(originalName);
}

// MIME/extension can be absent or incorrect on older uploads. Inspect the ISO
// container as well; AVIF's ftyp container must not be mistaken for HEIC.
export async function hasHeicSignature(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
  const word = (i) => String.fromCharCode(...bytes.slice(i, i + 4));
  if (word(4) !== 'ftyp') return false;
  const size = new DataView(bytes.buffer).getUint32(0);
  for (let i = 8; i + 4 <= Math.min(size, bytes.length); i += 4) {
    if (i !== 12 && /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs)$/.test(word(i))) return true;
  }
  return false;
}

async function decodeHeic(blob) {
  if (!decoder) {
    decoder = import(/* @vite-ignore */ DECODER_URL).catch(error => {
      decoder = undefined;
      throw error;
    });
  }
  const { heicTo } = await decoder;
  return heicTo({ blob, type: 'image/jpeg', quality: 0.85 });
}

/** Serialize downloads/conversions: a batch of 30 phone photos must not decode
 * simultaneously. Cache only bounded preview blobs, keyed by the signed URL. */
export function getImagePreview(src) {
  if (cache.has(src)) {
    const blob = cache.get(src);
    cache.delete(src);
    cache.set(src, blob);
    return Promise.resolve(blob);
  }
  if (pending.has(src)) return pending.get(src);
  const task = queue.then(async () => {
    const response = await fetchPrivateFile(src);
    const original = await response.blob();
    const blob = await hasHeicSignature(original) ? await decodeHeic(original) : original;
    if (blob.size <= MAX_CACHE_BYTES) {
      while (cache.size && (cache.size >= 32 || cacheBytes + blob.size > MAX_CACHE_BYTES)) {
        const oldest = cache.keys().next().value;
        cacheBytes -= cache.get(oldest).size;
        cache.delete(oldest);
      }
      cache.set(src, blob);
      cacheBytes += blob.size;
    }
    return blob;
  });
  pending.set(src, task);
  // A failed/expired link must not block the rest of a batch or stay cached.
  queue = task.then(() => { pending.delete(src); }, () => { pending.delete(src); });
  return task;
}
