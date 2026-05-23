/**
 * Regenerate public/data/google-fonts-catalog.json from Google's public metadata.
 * Run from repo root: node scripts/refresh-google-fonts-catalog.mjs
 *
 * Step 1 (PowerShell): Invoke-WebRequest -Uri "https://fonts.google.com/metadata/fonts" -OutFile "scripts/fonts-metadata-raw.json"
 * Step 2: node scripts/refresh-google-fonts-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const rawPath = path.join(root, "scripts", "fonts-metadata-raw.json");
const outPath = path.join(root, "public", "data", "google-fonts-catalog.json");

const raw = fs.readFileSync(rawPath, "utf8");
const j = JSON.parse(raw);
const rows = j.familyMetadataList.map((x) => ({
  family: x.family,
  c: String(x.category || ""),
  p: Number(x.popularity) || 999999,
}));
rows.sort((a, b) => a.p - b.p);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ families: rows }));
