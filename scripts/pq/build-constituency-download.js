import { filterRowsByType, readJson, writeJson } from "./utils.js";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanConstituencyName(name) {
  return clean(name).replace(/\s*\(\d+\)\s*$/, "");
}

function buildRows(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const constituency = cleanConstituencyName(row?.constituency);
    if (!constituency) continue;

    if (!grouped.has(constituency)) grouped.set(constituency, []);

    grouped.get(constituency).push({
      date: clean(row?.date_iso ?? row?.date),
      deputy: clean(row?.deputy),
      department: clean(row?.department),
      heading: clean(row?.heading),
      question: clean(row?.question),
      url: clean(row?.url),
    });
  }

  return Array.from(grouped, ([constituency, questions]) => ({
    constituency,
    questions: questions.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.deputy.localeCompare(b.deputy, "en") ||
        a.heading.localeCompare(b.heading, "en"),
    ),
  })).sort((a, b) => a.constituency.localeCompare(b.constituency, "en"));
}

export async function buildConstituencyDownload(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building constituency download data from ${inPath}...`);

  const rows = await readJson(inPath);

  const allRows = buildRows(rows);
  const oralRows = buildRows(filterRowsByType(rows, "oral"));

  await writeJson(
    `src/data/pq/${year}/constituency-download-all.json`,
    allRows,
  );
  await writeJson(
    `src/data/pq/${year}/constituency-download-oral.json`,
    oralRows,
  );

  console.log(`✓ constituency download files written for ${year}`);
}

const year = process.argv[2];

if (
  process.argv[1] &&
  process.argv[1].endsWith("build-constituency-download.js")
) {
  if (!year) {
    console.error("Please provide a year");
    process.exit(1);
  }

  buildConstituencyDownload(year);
}
