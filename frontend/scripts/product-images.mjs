import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const publicDir = new URL("../public/", import.meta.url);
const outputDir = new URL("products/", publicDir);
await mkdir(outputDir, { recursive: true });

for (const name of ["crushed-ice", "ice-block", "ice-tube", "purified-h20"]) {
  for (const size of [256, 960]) {
    await sharp(fileURLToPath(new URL(`${name}.png`, publicDir)))
      .resize({ width: size, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(fileURLToPath(new URL(`${name}-${size}.webp`, outputDir)));
  }
}
console.log("Created optimized product photos.");
