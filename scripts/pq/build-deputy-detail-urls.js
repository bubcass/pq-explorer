import fs from "fs/promises";
import path from "path";

function jsString(value) {
  return JSON.stringify(String(value));
}

async function listJsonFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, "en-IE"));
  } catch {
    return [];
  }
}

export async function buildDeputyDetailUrls(years = [2025, 2026]) {
  const outPath = path.join("src", "generated", "deputy-detail-urls.js");

  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const yearBlocks = [];

  for (const year of years) {
    const dir = path.join("src", "data", "pq", String(year), "deputies");
    const files = await listJsonFiles(dir);

    const lines = files.map((filename) => {
      const memberCode = filename.replace(/\.json$/i, "");
      const relPath = `../data/pq/${year}/deputies/${filename}`;
      return `    ${jsString(memberCode)}: import.meta.resolve(${jsString(relPath)})`;
    });

    yearBlocks.push(`  ${year}: {\n${lines.join(",\n")}\n  }`);
  }

  const content = `export const deputyDetailUrls = {\n${yearBlocks.join(",\n")}\n};\n`;

  await fs.writeFile(outPath, content, "utf8");
  console.log(`✓ deputy-detail-urls.js written`);
}
