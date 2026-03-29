import { buildPackedHierarchy, filterRowsByType, readJson, writeJson } from "./utils.js";

export async function buildPackedCircleHierarchy(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building packed circle hierarchy from ${inPath}...`);

  const rows = await readJson(inPath);

  const allHierarchy = buildPackedHierarchy(rows);
  const oralHierarchy = buildPackedHierarchy(filterRowsByType(rows, "oral"));

  await writeJson(`src/data/pq/${year}/packed-circle-hierarchy.json`, allHierarchy);
  await writeJson(`src/data/pq/${year}/packed-circle-hierarchy-all.json`, allHierarchy);
  await writeJson(`src/data/pq/${year}/packed-circle-hierarchy-oral.json`, oralHierarchy);

  console.log(`✓ packed circle hierarchy files written for ${year}`);
}
