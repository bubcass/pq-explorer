import fs from "fs/promises";

function rollupLinks(rows, sourceKey, targetKey) {
  const counts = new Map();

  for (const row of rows) {
    const source = row?.[sourceKey];
    const target = row?.[targetKey];

    if (!source || !target) continue;

    const key = `${source}|||${target}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, value]) => {
    const [source, target] = key.split("|||");
    return { source, target, value };
  });
}

export async function buildSankeyLinks(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;
  const outPath = `src/data/pq/${year}/sankey-links.json`;

  console.log(`Building sankey-links.json for ${year}...`);

  const raw = await fs.readFile(inPath, "utf8");
  const rows = JSON.parse(raw);

  const sankeyData1 = rollupLinks(rows, "constituency", "party");
  const sankeyData2 = rollupLinks(rows, "party", "questionType");
  const sankeyData3 = rollupLinks(rows, "questionType", "department");

  const combined = [...sankeyData1, ...sankeyData2, ...sankeyData3];

  await fs.writeFile(outPath, JSON.stringify(combined, null, 2));

  console.log(`✓ sankey-links.json written for ${year}`);
}
