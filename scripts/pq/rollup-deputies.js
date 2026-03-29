import { getDeputyMeta, normaliseQuestionType, readJson, writeJson } from "./utils.js";

export async function buildRollupDeputies(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;
  const outPath = `src/data/pq/${year}/rollup-deputies.json`;

  console.log(`Building deputy rollup from ${inPath}...`);

  const rows = await readJson(inPath);
  const deputyMeta = getDeputyMeta(rows);

  const grouped = new Map();

  for (const row of rows) {
    const rawType = normaliseQuestionType(row?.questionType);
    const id = row?.memberCode?.trim();
    if (!rawType || !id) continue;

    for (const questionType of ["all", rawType]) {
      const key = `${questionType}|||${id}`;

      if (!grouped.has(key)) {
        const meta = deputyMeta.get(id);
        grouped.set(key, {
          year: Number(year),
          questionType,
          id,
          name: meta?.memberName ?? row?.memberName?.trim() ?? row?.deputy?.trim() ?? null,
          party: meta?.party ?? row?.party?.trim() ?? "Independent",
          constituency: meta?.constituency ?? row?.constituency?.trim() ?? null,
          memberUrl:
            meta?.memberUrl ??
            row?.memberUrl?.trim() ??
            `https://www.oireachtas.ie/en/members/member/${id}/`,
          imageUrl: meta?.imageUrl ?? `https://data.oireachtas.ie/ie/oireachtas/member/id/${id}/image/large`,
          value: 0,
        });
      }

      grouped.get(key).value += 1;
    }
  }

  const result = [...grouped.values()].sort((a, b) => {
    if (a.questionType !== b.questionType) {
      return a.questionType.localeCompare(b.questionType);
    }
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  await writeJson(outPath, result);

  console.log(`✓ rollup-deputies.json written for ${year}`);
}
