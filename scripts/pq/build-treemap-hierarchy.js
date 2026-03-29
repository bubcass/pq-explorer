import { buildTreemapHierarchy, filterRowsByType, readJson, writeJson } from "./utils.js";

export async function buildTreemapHierarchyForYear(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building treemap hierarchy from ${inPath}...`);

  const rows = await readJson(inPath);

  const allHierarchy = buildTreemapHierarchy(rows, { includeDeputyLevel: true });
  const oralHierarchy = buildTreemapHierarchy(filterRowsByType(rows, "oral"), {
    includeDeputyLevel: true,
  });

  await writeJson(`src/data/pq/${year}/treemap-hierarchy.json`, allHierarchy);
  await writeJson(`src/data/pq/${year}/treemap-hierarchy-all.json`, allHierarchy);
  await writeJson(`src/data/pq/${year}/treemap-hierarchy-oral.json`, oralHierarchy);

  console.log(`✓ treemap hierarchy files written for ${year}`);
}

export { buildTreemapHierarchyForYear as buildTreemapHierarchy };
