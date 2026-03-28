import fs from "fs/promises";

function normaliseQuestionType(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

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

export async function buildSummary(year) {
  const inPath = `src/data/pq/${year}/flat.json`;
  const outPath = `src/data/pq/${year}/summary.json`;

  console.log(`Building summary from ${inPath}...`);

  const raw = await fs.readFile(inPath, "utf8");
  const rows = JSON.parse(raw);

  const yearlyTotal = rows.length;

  const sittingDaySet = new Set(rows.map((d) => d?.date_iso).filter(Boolean));
  const sittingDays = sittingDaySet.size;

  const oralPQs = rows.filter((d) => {
    const qt = normaliseQuestionType(d?.questionType);
    return qt === "oral";
  }).length;

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

  const summary = {
    year: Number(year),
    yearlyTotal,
    sittingDays,
    oralPQs,
    averagePerSittingDay,
    averageOralPerSittingDay,
    mostPopularHeading: mostPopularHeading(rows),
    medianQuestionsPerDeputy: median(countsArray),
    meanQuestionsPerDeputy: Number(mean(countsArray).toFixed(2)),
  };

  await fs.writeFile(outPath, JSON.stringify(summary, null, 2));

  console.log(`✓ summary.json written for ${year}`);
}
