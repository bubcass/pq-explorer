import { filterRowsByType, readJson, writeJson } from "./utils.js";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanConstituencyName(name) {
  return clean(name).replace(/\s*\(\d+\)\s*$/, "");
}

function rollupConstituencies(rows) {
  const byConstituency = new Map();

  for (const row of rows) {
    const constituency = cleanConstituencyName(row?.constituency);
    if (!constituency) continue;

    if (!byConstituency.has(constituency)) {
      byConstituency.set(constituency, {
        constituency,
        questionCount: 0,
        deputyIds: new Set(),
        deputyNames: new Set(),
        parties: new Set(),
        topHeadingCounts: new Map(),
        topDepartmentCounts: new Map(),
      });
    }

    const item = byConstituency.get(constituency);
    item.questionCount += 1;

    const deputyId = clean(row?.memberCode || row?.id);
    const deputyName = clean(row?.deputy);
    const party = clean(row?.party);
    const heading = clean(row?.heading);
    const department = clean(row?.department);

    if (deputyId) item.deputyIds.add(deputyId);
    if (deputyName) item.deputyNames.add(deputyName);
    if (party) item.parties.add(party);

    if (heading) {
      item.topHeadingCounts.set(
        heading,
        (item.topHeadingCounts.get(heading) ?? 0) + 1,
      );
    }

    if (department) {
      item.topDepartmentCounts.set(
        department,
        (item.topDepartmentCounts.get(department) ?? 0) + 1,
      );
    }
  }

  return [...byConstituency.values()]
    .map((item) => {
      const topHeading = [...item.topHeadingCounts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"),
      )[0] ?? [null, 0];

      const topDepartment = [...item.topDepartmentCounts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"),
      )[0] ?? [null, 0];

      return {
        constituency: item.constituency,
        questionCount: item.questionCount,
        deputyCount: item.deputyIds.size || item.deputyNames.size,
        deputyNames: [...item.deputyNames].sort((a, b) =>
          a.localeCompare(b, "en"),
        ),
        parties: [...item.parties].sort((a, b) => a.localeCompare(b, "en")),
        topHeading: topHeading[0],
        topHeadingCount: topHeading[1],
        topDepartment: topDepartment[0],
        topDepartmentCount: topDepartment[1],
      };
    })
    .sort(
      (a, b) =>
        b.questionCount - a.questionCount ||
        a.constituency.localeCompare(b.constituency, "en"),
    );
}

export async function buildConstituencySummary(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building constituency summary from ${inPath}...`);

  const rows = await readJson(inPath);

  const allRows = rows;
  const oralRows = filterRowsByType(rows, "oral");

  const allSummary = rollupConstituencies(allRows);
  const oralSummary = rollupConstituencies(oralRows);

  await writeJson(
    `src/data/pq/${year}/constituency-summary-all.json`,
    allSummary,
  );
  await writeJson(
    `src/data/pq/${year}/constituency-summary-oral.json`,
    oralSummary,
  );

  console.log(`✓ constituency summary files written for ${year}`);
}

const year = process.argv[2];

if (
  process.argv[1] &&
  process.argv[1].endsWith("build-constituency-summary.js")
) {
  if (!year) {
    console.error("Please provide a year");
    process.exit(1);
  }

  buildConstituencySummary(year);
}
