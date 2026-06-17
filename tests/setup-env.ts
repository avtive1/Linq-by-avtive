import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

for (const file of [".env", ".env.local"]) {
  const envPath = path.join(projectRoot, file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}
