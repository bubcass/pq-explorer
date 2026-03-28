import { buildFlatPQs } from "./build-flat-pqs.js";
import { buildMembersLookup } from "./build-members-lookup.js";
import { buildFlatPQsEnriched } from "./build-flat-pqs-enriched.js";
import { buildSummary } from "./build-summary.js";
import { buildPackedCircleHierarchy } from "./build-packed-circle-hierarchy.js";
import { buildSankeyLinks } from "./build-sankey-links.js";
import { buildTreemapHierarchy } from "./build-treemap-hierarchy.js";
import { buildRollupDeputies } from "./rollup-deputies.js";

const year = process.argv[2];

if (!year) {
  console.error("Please provide a year");
  process.exit(1);
}

async function run() {
  await buildMembersLookup();
  await buildFlatPQs(year);
  await buildFlatPQsEnriched(year);
  await buildSummary(year);
  await buildRollupDeputies(year);
  await buildPackedCircleHierarchy(year);
  await buildSankeyLinks(year);
  await buildTreemapHierarchy(year);
}

run();
