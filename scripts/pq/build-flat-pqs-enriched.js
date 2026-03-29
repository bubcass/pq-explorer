import { readJson, writeJson } from "./utils.js";

export async function buildFlatPQsEnriched(year) {
  const flatPath = `src/data/pq/${year}/flat.json`;
  const lookupPath = "src/data/pq/members-lookup.json";
  const outPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building flat-enriched.json for ${year}...`);

  const rows = await readJson(flatPath);
  const lookup = await readJson(lookupPath);

  const enriched = rows.map((row) => {
    const member = row?.memberCode ? lookup[row.memberCode] : null;

    return {
      ...row,
      party: member?.party ?? null,
      partyCode: member?.partyCode ?? null,
      constituency: member?.constituency ?? null,
      constituencyCode: member?.constituencyCode ?? null,
      memberName: member?.memberName ?? row?.deputy ?? null,
      memberUrl: member?.memberUrl ?? null,
    };
  });

  await writeJson(outPath, enriched);

  console.log(`✓ flat-enriched.json written for ${year}`);
}
