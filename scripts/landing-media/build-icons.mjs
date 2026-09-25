/**
 * App icons from the brand mark (PLAN-2026-09-LANDING-REDESIGN T1.10).
 *
 * `apps/erp/public/cendaro-logo.png` is a 1150×1122, 633 KB white mark on a
 * transparent background. Browsers and iOS only need small square icons, so
 * this renders them on the dark brand canvas (--background dark, #0d0d0d)
 * with the mark inside the maskable safe zone.
 *
 * Run: node scripts/landing-media/build-icons.mjs
 */
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ERP = join(ROOT, "apps/erp");
const sharp = createRequire(join(ERP, "package.json"))("sharp");

const SOURCE = join(ERP, "public/cendaro-logo.png");
const CANVAS = { r: 13, g: 13, b: 13, alpha: 1 };

/** size: output px; mark: share of the canvas the mark may occupy. */
const ICONS = [
  { file: "apple-touch-icon.png", size: 180, mark: 0.62 },
  { file: "icon-192.png", size: 192, mark: 0.6 },
  // Maskable: platforms may crop to a circle of 80 % — keep the mark at 56 %.
  { file: "icon-512.png", size: 512, mark: 0.56 },
];

for (const { file, size, mark } of ICONS) {
  const inner = Math.round(size * mark);
  const glyph = await sharp(SOURCE)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();
  const out = join(ERP, "public", file);
  await sharp({
    create: { width: size, height: size, channels: 4, background: CANVAS },
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(out);
  const { size: bytes } = await stat(out);
  console.log(`${file}: ${size}×${size}, ${(bytes / 1024).toFixed(1)} KB`);
}
