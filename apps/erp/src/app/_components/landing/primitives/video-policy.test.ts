import { describe, expect, it } from "vitest";

import type { MediaClip, VideoRendition } from "./video-policy";
import { pickFormat, pickRendition, shouldPlayVideo } from "./video-policy";

const r = (width: number): VideoRendition => ({
  width,
  av1: `/m/${width}.webm`,
  h264: `/m/${width}.mp4`,
});
const RENDITIONS = [r(1440), r(720), r(960)];

describe("pickRendition", () => {
  it("picks the smallest rendition covering width × DPR", () => {
    expect(pickRendition(RENDITIONS, 480, 1)?.width).toBe(720);
    expect(pickRendition(RENDITIONS, 480, 2)?.width).toBe(960);
    expect(pickRendition(RENDITIONS, 900, 1)?.width).toBe(960);
  });

  it("caps the device pixel ratio at 2", () => {
    expect(pickRendition(RENDITIONS, 360, 3)?.width).toBe(720);
  });

  it("falls back to the largest when none is big enough", () => {
    expect(pickRendition(RENDITIONS, 1400, 2)?.width).toBe(1440);
  });

  it("treats a DPR below 1 as 1 and handles no renditions", () => {
    expect(pickRendition(RENDITIONS, 800, 0.5)?.width).toBe(960);
    expect(pickRendition([], 800, 1)).toBeUndefined();
  });
});

describe("shouldPlayVideo", () => {
  it("plays only without reduced motion and without data saver", () => {
    expect(
      shouldPlayVideo({ prefersReducedMotion: false, saveData: false }),
    ).toBe(true);
    expect(
      shouldPlayVideo({ prefersReducedMotion: true, saveData: false }),
    ).toBe(false);
    expect(
      shouldPlayVideo({ prefersReducedMotion: false, saveData: true }),
    ).toBe(false);
  });
});

describe("pickFormat", () => {
  const themed = { poster: "/p.avif", videos: [r(720)] };
  const wide = { width: 1440, height: 900, light: themed, dark: themed };
  const tall = { width: 390, height: 844, light: themed, dark: themed };

  it("uses the portrait recording on phones when present", () => {
    const clip: MediaClip = { id: "c", wide, tall };
    expect(pickFormat(clip, true)).toBe(tall);
    expect(pickFormat(clip, false)).toBe(wide);
  });

  it("keeps the wide recording when there is no portrait one", () => {
    expect(pickFormat({ id: "c", wide }, true)).toBe(wide);
  });
});
