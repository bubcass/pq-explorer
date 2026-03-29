import path from "path";
import {
  buildHeadingOptions,
  buildInsights,
  buildPackedHierarchy,
  buildTreemapHierarchy,
  filterRowsByType,
  getDeputyMeta,
  readJson,
  sortRowsChronologically,
  writeJson,
} from "./utils.js";

function shapeQuestionRows(rows) {
  return sortRowsChronologically(rows).map((row) => ({
    date_iso: row?.date_iso ?? null,
    department: row?.department ?? null,
    heading: row?.heading ?? null,
    questionNumber: row?.questionNumber ?? null,
    questionType: row?.questionType ?? null,
    question: row?.question ?? null,
    url: row?.url ?? null,
  }));
}

function buildTypePayload(rows) {
  const questions = shapeQuestionRows(rows);
  const headingOptions = buildHeadingOptions(rows);

  return {
    count: rows.length,
    headingOptions,
    insights: buildInsights(rows),
    packed: buildPackedHierarchy(rows),
    treemap: buildTreemapHierarchy(rows, { includeDeputyLevel: false }),
    questions,
  };
}

export async function buildDeputyDetails(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;
  const outDir = `src/data/pq/${year}/deputies`;

  console.log(`Building deputy detail files from ${inPath}...`);

  const rows = await readJson(inPath);
  const deputyMeta = getDeputyMeta(rows);

  const grouped = new Map();

  for (const row of rows) {
    const memberCode = row?.memberCode?.trim();
    if (!memberCode) continue;

    if (!grouped.has(memberCode)) grouped.set(memberCode, []);
    grouped.get(memberCode).push(row);
  }

  for (const [memberCode, deputyRows] of grouped.entries()) {
    const meta = deputyMeta.get(memberCode);
    const oralRows = filterRowsByType(deputyRows, "oral");

    const detail = {
      year: Number(year),
      memberCode,
      memberName: meta?.memberName ?? deputyRows[0]?.memberName ?? deputyRows[0]?.deputy ?? null,
      deputy: meta?.deputy ?? deputyRows[0]?.deputy ?? null,
      party: meta?.party ?? deputyRows[0]?.party ?? "Independent",
      constituency: meta?.constituency ?? deputyRows[0]?.constituency ?? null,
      memberUrl:
        meta?.memberUrl ??
        deputyRows[0]?.memberUrl ??
        `https://www.oireachtas.ie/en/members/member/${memberCode}/`,
      imageUrl: meta?.imageUrl ?? `https://data.oireachtas.ie/ie/oireachtas/member/id/${memberCode}/image/large`,
      types: {
        all: buildTypePayload(deputyRows),
        oral: buildTypePayload(oralRows),
      },
    };

    await writeJson(path.join(outDir, `${memberCode}.json`), detail);
  }

  console.log(`✓ deputy detail files written for ${year}`);
}
