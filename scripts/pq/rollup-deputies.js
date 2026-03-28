import fs from "fs/promises";

function normaliseQuestionType(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

export async function buildRollupDeputies(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;
  const outPath = `src/data/pq/${year}/rollup-deputies.json`;

  console.log(`Building deputy rollup from ${inPath}...`);

  const raw = await fs.readFile(inPath, "utf8");
  const rows = JSON.parse(raw);

  const grouped = new Map();

  for (const row of rows) {
    const questionType = normaliseQuestionType(row?.questionType);
    const id = row?.memberCode?.trim();
    const name = row?.memberName?.trim() || row?.deputy?.trim();
    const party = row?.party?.trim() || "Independent";

    if (!questionType || !id || !name) continue;

    const key = `${questionType}|||${id}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        year: Number(year),
        questionType,
        id,
        name,
        party,
        value: 0,
      });
    }

    grouped.get(key).value += 1;
  }

  const result = [...grouped.values()].sort((a, b) => {
    if (a.questionType !== b.questionType) {
      return a.questionType.localeCompare(b.questionType);
    }
    return a.name.localeCompare(b.name);
  });

  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log(`✓ rollup-deputies.json written for ${year}`);
}
