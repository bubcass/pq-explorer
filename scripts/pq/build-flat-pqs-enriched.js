import fs from "fs/promises";

export async function buildFlatPQsEnriched(year) {
  const flatPath = `src/data/pq/${year}/flat.json`;
  const lookupPath = "src/data/pq/members-lookup.json";
  const outPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building flat-enriched.json for ${year}...`);

  const flatRaw = await fs.readFile(flatPath, "utf8");
  const lookupRaw = await fs.readFile(lookupPath, "utf8");

  const rows = JSON.parse(flatRaw);
  const lookup = JSON.parse(lookupRaw);

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

  await fs.writeFile(outPath, JSON.stringify(enriched, null, 2));

  console.log(`✓ flat-enriched.json written for ${year}`);
}
