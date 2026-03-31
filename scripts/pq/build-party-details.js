import fs from "fs/promises";
import path from "path";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function countBy(rows, keyFn) {
  const counts = new Map();

  for (const row of rows) {
    const key = clean(keyFn(row));
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "en"));
}

function createPartyDetails(rows) {
  const byParty = new Map();

  for (const row of rows) {
    const party = clean(row.party) || "Independent";
    if (!byParty.has(party)) byParty.set(party, []);
    byParty.get(party).push(row);
  }

  const output = [...byParty.entries()].map(([party, partyRows]) => {
    const memberIds = new Set(
      partyRows
        .map((row) => clean(row.memberCode || row.id || row.deputy))
        .filter(Boolean),
    );

    const headingCounts = countBy(partyRows, (row) => row.heading);
    const departmentCounts = countBy(partyRows, (row) => row.department);

    const topHeading = headingCounts[0] ?? { key: null, count: 0 };
    const topDepartment = departmentCounts[0] ?? { key: null, count: 0 };

    return {
      party,
      memberCount: memberIds.size,
      questionCount: partyRows.length,
      topHeading: topHeading.key,
      topHeadingCount: topHeading.count,
      topDepartment: topDepartment.key,
      topDepartmentCount: topDepartment.count,
      topHeadings: headingCounts.slice(0, 20).map((d) => ({
        heading: d.key,
        count: d.count,
      })),
    };
  });

  return output.sort(
    (a, b) =>
      b.questionCount - a.questionCount || a.party.localeCompare(b.party, "en"),
  );
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function buildPartyDetails(year) {
  const inputPath = path.resolve(`src/data/pq/${year}/flat-enriched.json`);
  const outputAllPath = path.resolve(
    `src/data/pq/${year}/party-details-all.json`,
  );
  const outputOralPath = path.resolve(
    `src/data/pq/${year}/party-details-oral.json`,
  );
  const outputDefaultPath = path.resolve(
    `src/data/pq/${year}/party-details.json`,
  );

  console.log(`Building party details from ${inputPath}...`);

  const raw = JSON.parse(await fs.readFile(inputPath, "utf-8"));

  const usableRows = raw.filter(
    (row) =>
      row &&
      typeof row === "object" &&
      clean(row.party) &&
      clean(row.deputy) &&
      clean(row.question),
  );

  const allRows = usableRows.filter((row) => {
    const q = clean(row.questionType).toLowerCase();
    return q !== "all";
  });

  const oralRows = usableRows.filter(
    (row) => clean(row.questionType).toLowerCase() === "oral",
  );

  const allData = createPartyDetails(allRows);
  const oralData = createPartyDetails(oralRows);

  await writeJson(outputAllPath, allData);
  await writeJson(outputOralPath, oralData);
  await writeJson(outputDefaultPath, allData);

  console.log(`✓ party detail files written for ${year}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const year = process.argv[2];

  if (!year) {
    console.error("Usage: node scripts/pq/build-party-details.js <year>");
    process.exit(1);
  }

  await buildPartyDetails(year);
}
