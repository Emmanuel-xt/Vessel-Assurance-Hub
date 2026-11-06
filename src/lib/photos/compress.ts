// Browser-side photo compression, run before a photo is uploaded.
// Longest side at most 1600 px, JPEG at quality 0.7; if the result is still over 400 KB, quality steps down and then
// the image shrinks until it fits. Re-encoding also drops EXIF data (including GPS position).

export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.7;
export const PHOTO_TARGET_BYTES = 400 * 1024;

export interface CompressionStep {
  /** Multiplier on the size that fits within PHOTO_MAX_EDGE. */
  scale: number;
  quality: number;
}

/** Tried in order until a result is under the target. */
export const COMPRESSION_STEPS: readonly CompressionStep[] = [
  { scale: 1, quality: PHOTO_QUALITY },
  { scale: 1, quality: 0.6 },
  { scale: 1, quality: 0.5 },
  { scale: 0.85, quality: 0.5 },
  { scale: 0.7, quality: 0.5 },
  { scale: 0.55, quality: 0.5 },
  { scale: 0.4, quality: 0.5 },
];

export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

export class PhotoCompressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoCompressionError";
  }
}

/** Scales width × height down (never up) so the longest side is at most `maxEdge`. */
export function fitWithin(width: number, height: number, maxEdge = PHOTO_MAX_EDGE): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new PhotoCompressionError("This photo has no size.");
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/**
 * Runs the steps with `encode` and returns the first result under `target` bytes,
 * or the smallest result if none gets there.
 */
export async function encodeWithinTarget(
  base: { width: number; height: number },
  encode: (width: number, height: number, quality: number) => Promise<Blob>,
  target = PHOTO_TARGET_BYTES,
  steps: readonly CompressionStep[] = COMPRESSION_STEPS,
): Promise<CompressedPhoto> {
  let best: CompressedPhoto | null = null;
  for (const step of steps) {
    const width = Math.max(1, Math.round(base.width * step.scale));
    const height = Math.max(1, Math.round(base.height * step.scale));
    const blob = await encode(width, height, step.quality);
    const result = { blob, width, height };
    if (blob.size <= target) return result;
    if (!best || blob.size < best.blob.size) best = result;
  }
  if (!best) throw new PhotoCompressionError("No compression steps were given.");
  return best;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Decodes the file the right way up. createImageBitmap first; <img> as a fallback for older Safari. */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined };
  } catch {
    throw new PhotoCompressionError("This photo format can't be read on this device. Try a JPEG or PNG photo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoCompressionError("The photo could not be compressed."))),
      "image/jpeg",
      quality,
    ),
  );
}

/** Compresses an image file chosen from the camera or gallery. Browser only. */
export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new PhotoCompressionError("Only photos can be attached.");
  }
  const decoded = await decode(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoCompressionError("The photo could not be compressed on this device.");
    return await encodeWithinTarget(fitWithin(decoded.width, decoded.height), (width, height, quality) => {
      canvas.width = width;
      canvas.height = height;
      // JPEG has no transparency: paint white first so transparent PNGs don't turn black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, width, height);
      return toJpeg(canvas, quality);
    });
  } finally {
    decoded.close();
  }
}
