import { readJson, writeJson, filterRowsByType } from "./utils.js";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanConstituencyName(name) {
  return clean(name).replace(/\s*\(\d+\)\s*$/, "");
}

function toISODate(value) {
  const raw =
    value?.date_iso ??
    value?.date ??
    value?.question?.date ??
    value?.contextDate;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildRows(rows, membersLookup) {
  const members = new Map(
    Object.values(membersLookup).map((m) => [
      clean(m.memberCode ?? m.code ?? m.MemberCode),
      cleanConstituencyName(
        m.constituency ??
          m.Constituency ??
          m.newConstituency ??
          m["NEW CONSTITUENCY"],
      ),
    ]),
  );

  const grouped = new Map();

  for (const row of rows) {
    const memberCode = clean(
      row?.memberCode ?? row?.by_memberCode ?? row?.question?.by?.memberCode,
    );

    const constituency = members.get(memberCode);
    if (!constituency) continue;

    const item = {
      date: toISODate(row),
      deputy: clean(row?.deputy ?? row?.question?.by?.showAs ?? row?.by_showAs),
      heading: clean(row?.heading ?? row?.question?.debateSection?.showAs),
      question: clean(row?.question?.showAs ?? row?.question),
      url: clean(row?.url),
    };

    if (!grouped.has(constituency)) grouped.set(constituency, []);
    grouped.get(constituency).push(item);
  }

  return Array.from(grouped, ([constituency, questions]) => ({
    constituency,
    questions: questions
      .filter((d) => d.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15),
  })).sort((a, b) => a.constituency.localeCompare(b.constituency, "en"));
}

export async function buildConstituencyRecentQuestions(year) {
  const membersPath = "src/data/pq/members-lookup.json";
  const pqPath = `src/data/pq/${year}/flat-enriched.json`;

  const membersLookup = await readJson(membersPath);
  const rows = await readJson(pqPath);

  const allRows = buildRows(rows, membersLookup);
  const oralRows = buildRows(filterRowsByType(rows, "oral"), membersLookup);

  await writeJson(
    `src/data/pq/${year}/constituency-recent-questions-all.json`,
    allRows,
  );

  await writeJson(
    `src/data/pq/${year}/constituency-recent-questions-oral.json`,
    oralRows,
  );

  console.log(`✓ constituency recent questions written for ${year}`);
}

const year = process.argv[2];

if (process.argv[1]?.endsWith("build-constituency-recent-questions.js")) {
  buildConstituencyRecentQuestions(year);
}
