import { buildFlatPQs } from "./build-flat-pqs.js";
import { buildMembersLookup } from "./build-members-lookup.js";
import { buildDeputyDetailUrls } from "./build-deputy-detail-urls.js";
import { buildFlatPQsEnriched } from "./build-flat-pqs-enriched.js";
import { buildSummary } from "./build-summary.js";
import { buildRollupDeputies } from "./rollup-deputies.js";
import { buildDeputiesIndex } from "./build-deputies-index.js";
import { buildPackedCircleHierarchy } from "./build-packed-circle-hierarchy.js";
import { buildSankeyLinks } from "./build-sankey-links.js";
import { buildTreemapHierarchy } from "./build-treemap-hierarchy.js";
import { buildDeputyDetails } from "./build-deputy-details.js";
import { buildDownloadCsv } from "./build-download-csv.js";
import { buildTreemapParties } from "./build-treemap-parties.js";
import { buildPartyDetails } from "./build-party-details.js";
import { buildConstituencySummary } from "./build-constituency-summary.js";
import { buildConstituencyMembers } from "./build-constituency-members.js";

const year = process.argv[2];

if (!year) {
  console.error("Please provide a year");
  process.exit(1);
}

async function run() {
  await buildMembersLookup();
  await buildFlatPQs(year);
  await buildFlatPQsEnriched(year);
  await buildDownloadCsv(year);
  await buildSummary(year);
  await buildRollupDeputies(year);
  await buildDeputiesIndex(year);
  await buildPackedCircleHierarchy(year);
  await buildSankeyLinks(year);
  await buildTreemapHierarchy(year);
  await buildDeputyDetails(year);
  await buildTreemapParties(year);
  await buildPartyDetails(year);
  await buildConstituencySummary(year);
  await buildConstituencyMembers(year);
}

run();
