import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const publicDir = new URL("../public/", import.meta.url);
const source = fileURLToPath(new URL("frost-point-transparent-bg-logo.png", publicDir));
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
await mkdir(new URL("branding/", publicDir), { recursive: true });
for (const size of [256, 512]) {
  await sharp(fileURLToPath(new URL("frost-point-logo-name.png", publicDir))).resize({ width: size }).webp({ quality: 90 })
    .toFile(fileURLToPath(new URL(`branding/frost-point-name-${size}.webp`, publicDir)));
}
for (const size of [128, 384]) {
  await sharp(source).resize(size, size, { fit: "contain", background: transparent }).webp({ quality: 85 })
    .toFile(fileURLToPath(new URL(`branding/frost-point-logo-${size}.webp`, publicDir)));
}
for (const [size, filename] of [[32, "favicon.png"], [192, "icon-192.png"], [512, "icon-512.png"]]) {
  await sharp(source).resize(size, size, { fit: "contain", background: transparent }).png()
    .toFile(fileURLToPath(new URL(filename, publicDir)));
}
// Keep the entire mascot within the safe area of rounded installed-app icons.
const mascot = await sharp(source).resize(358, 358, { fit: "contain", background: transparent }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#fff" } })
  .composite([{ input: mascot, gravity: "centre" }]).png()
  .toFile(fileURLToPath(new URL("icon-maskable-512.png", publicDir)));
console.log("Frostpoint logo and app icons generated.");
