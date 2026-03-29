import fs from "fs/promises";
import path from "path";

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

for (const year of [2025, 2026]) {
  const src = path.join("src", "data", "pq", String(year), "deputies");
  const dest = path.join("dist", "data", "pq", String(year), "deputies");

  await copyDir(src, dest);
  console.log(`✓ copied deputy JSON files for ${year} to dist`);
}
