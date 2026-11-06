import { describe, expect, it } from "vitest";
import { COMPRESSION_STEPS, PHOTO_TARGET_BYTES, encodeWithinTarget, fitWithin } from "./compress";

describe("fitWithin", () => {
  it("scales the longest side down to 1600 px, keeping the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("rejects an image with no size", () => {
    expect(() => fitWithin(0, 100)).toThrow();
  });
});

/** Fake encoder: size proportional to pixels × quality, so later steps get smaller. */
function fakeEncoder(bytesPerPixelAtFullQuality: number) {
  const calls: { width: number; height: number; quality: number }[] = [];
  const encode = async (width: number, height: number, quality: number) => {
    calls.push({ width, height, quality });
    return new Blob([new Uint8Array(Math.round(width * height * quality * bytesPerPixelAtFullQuality))], {
      type: "image/jpeg",
    });
  };
  return { encode, calls };
}

describe("encodeWithinTarget", () => {
  it("stops at the first step that is under 400 KB (quality 0.7 first)", async () => {
    const { encode, calls } = fakeEncoder(0.2); // 1600×1200×0.7×0.2 ≈ 269 KB
    const result = await encodeWithinTarget({ width: 1600, height: 1200 }, encode);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ width: 1600, height: 1200, quality: 0.7 });
    expect(result.blob.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES);
  });

  it("lowers quality, then size, until it fits", async () => {
    const { encode, calls } = fakeEncoder(0.6); // needs a smaller image, not just lower quality
    const result = await encodeWithinTarget({ width: 1600, height: 1200 }, encode);
    expect(calls.map((c) => c.quality).slice(0, 3)).toEqual([0.7, 0.6, 0.5]);
    expect(result.width).toBeLessThan(1600);
    expect(result.blob.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES);
  });

  it("returns the smallest result if nothing gets under the target", async () => {
    const { encode, calls } = fakeEncoder(50);
    const result = await encodeWithinTarget({ width: 1600, height: 1200 }, encode);
    expect(calls).toHaveLength(COMPRESSION_STEPS.length);
    expect(result.width).toBe(Math.round(1600 * 0.4));
  });
});
