import { buildSankeyLinks, filterRowsByType, readJson, writeJson } from "./utils.js";

export async function buildSankeyLinksForYear(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building sankey links from ${inPath}...`);

  const rows = await readJson(inPath);

  const allLinks = buildSankeyLinks(rows);
  const oralLinks = buildSankeyLinks(filterRowsByType(rows, "oral"));

  await writeJson(`src/data/pq/${year}/sankey-links.json`, allLinks);
  await writeJson(`src/data/pq/${year}/sankey-links-all.json`, allLinks);
  await writeJson(`src/data/pq/${year}/sankey-links-oral.json`, oralLinks);

  console.log(`✓ sankey link files written for ${year}`);
}

export { buildSankeyLinksForYear as buildSankeyLinks };
