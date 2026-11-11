import sharp from "sharp";
import { readFileSync } from "node:fs";

const mk = (inner, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${bg}"/>${inner}</svg>`;
const flake = (s) =>
  `<g transform="translate(256 256) scale(${s})" stroke="#E0F2FE" stroke-width="30" stroke-linecap="round"><path d="M0-200V200M-173-100L173 100M173-100-173 100"/><circle r="40" fill="#38BDF8" stroke="none"/></g>`;
const round = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0369A1"/>${inner}</svg>`;

await sharp(Buffer.from(round(flake(1)))).resize(192).png().toFile("public/icon-192.png");
await sharp(Buffer.from(round(flake(1)))).resize(512).png().toFile("public/icon-512.png");
await sharp(Buffer.from(mk(flake(0.7), "#0369A1"))).resize(512).png().toFile("public/icon-maskable-512.png");
console.log("icons ok");
