import { filterRowsByType, normaliseQuestionType, readJson, writeJson } from "./utils.js";

function mostPopularHeading(rows) {
  const counts = new Map();

  for (const row of rows) {
    const heading = row?.heading?.trim();
    if (!heading) continue;
    counts.set(heading, (counts.get(heading) ?? 0) + 1);
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildSummaryForRows(year, rows, questionType) {
  const yearlyTotal = rows.length;

  const sittingDaySet = new Set(rows.map((d) => d?.date_iso).filter(Boolean));
  const sittingDays = sittingDaySet.size;

  const oralPQs = rows.filter((d) => normaliseQuestionType(d?.questionType) === "oral").length;

  const averagePerSittingDay =
    sittingDays > 0 ? Math.round(yearlyTotal / sittingDays) : 0;

  const averageOralPerSittingDay =
    sittingDays > 0 ? Math.round(oralPQs / sittingDays) : 0;

  const deputyCounts = new Map();

  for (const row of rows) {
    const deputy = row?.deputy?.trim();
    if (!deputy) continue;
    deputyCounts.set(deputy, (deputyCounts.get(deputy) ?? 0) + 1);
  }

  const countsArray = [...deputyCounts.values()];

  return {
    year: Number(year),
    questionType,
    yearlyTotal,
    sittingDays,
    oralPQs,
    averagePerSittingDay,
    averageOralPerSittingDay,
    mostPopularHeading: mostPopularHeading(rows),
    medianQuestionsPerDeputy: median(countsArray),
    meanQuestionsPerDeputy: Number(mean(countsArray).toFixed(2)),
  };
}

export async function buildSummary(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building summaries from ${inPath}...`);

  const rows = await readJson(inPath);

  const allSummary = buildSummaryForRows(year, rows, "all");
  const oralRows = filterRowsByType(rows, "oral");
  const oralSummary = buildSummaryForRows(year, oralRows, "oral");

  await writeJson(`src/data/pq/${year}/summary.json`, allSummary);
  await writeJson(`src/data/pq/${year}/summary-all.json`, allSummary);
  await writeJson(`src/data/pq/${year}/summary-oral.json`, oralSummary);

  console.log(`✓ summary files written for ${year}`);
}
