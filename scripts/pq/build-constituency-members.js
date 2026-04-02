import { pathToFileURL } from "node:url";
import { readJson, writeJson, filterRowsByType } from "./utils.js";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanConstituencyName(name) {
  return clean(name).replace(/\s*\(\d+\)\s*$/, "");
}

function getRowMemberCode(row) {
  return clean(
    row?.memberCode ??
      row?.by_memberCode ??
      row?.member?.memberCode ??
      row?.question?.by?.memberCode ??
      row?.question?.by?.["@id"],
  );
}

function getMemberName(member) {
  return clean(
    member?.memberName ??
      member?.deputy ??
      member?.name ??
      member?.fullName ??
      member?.showAs,
  );
}

function parseDate(value) {
  const v = clean(value);
  if (!v) return null;

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getYearNumber(value) {
  const d = parseDate(value);
  return d ? d.getFullYear() : null;
}

function getMemberEndDate(member) {
  return clean(
    member?.endDate ??
      member?.membershipEndDate ??
      member?.end_date ??
      member?.to,
  );
}

function getMemberStartDate(member) {
  return clean(
    member?.startDate ??
      member?.membershipStartDate ??
      member?.start_date ??
      member?.from,
  );
}

function memberServedInYear(member, year) {
  const selectedYear = Number(year);
  const startYear = getYearNumber(member.startDate);
  const endYear = getYearNumber(member.endDate);

  // If we know they started after the selected year, do not show them.
  if (startYear && startYear > selectedYear) return false;

  // If they ended before the selected year, do not show them.
  if (endYear && endYear < selectedYear) return false;

  // Otherwise, they served in that year.
  return true;
}

function buildRows(membersLookup, rows, year) {
  const counts = new Map();

  for (const row of rows) {
    const memberCode = getRowMemberCode(row);
    if (!memberCode) continue;

    counts.set(memberCode, (counts.get(memberCode) ?? 0) + 1);
  }

  const members = Array.isArray(membersLookup)
    ? membersLookup
    : Object.values(membersLookup ?? {});

  return members
    .map((member) => {
      const memberCode = clean(
        member?.memberCode ?? member?.code ?? member?.MemberCode,
      );
      if (!memberCode) return null;

      const questionCount = counts.get(memberCode) ?? 0;
      const startDate = getMemberStartDate(member);
      const endDate = getMemberEndDate(member);
      const endYear = getYearNumber(endDate);
      const selectedYear = Number(year);

      return {
        memberCode,
        memberName: getMemberName(member),
        party: clean(member?.party ?? member?.Party) || "Independent",
        constituency: cleanConstituencyName(
          member?.constituency ??
            member?.Constituency ??
            member?.newConstituency ??
            member?.["NEW CONSTITUENCY"],
        ),
        memberUrl:
          member?.memberUrl ??
          `https://www.oireachtas.ie/en/members/member/${memberCode}`,
        questionCount,
        startDate,
        endDate,
        isFormerMember: Boolean(parseDate(endDate)),
        showServedUntil: Boolean(endYear && endYear === selectedYear),
      };
    })
    .filter(Boolean)
    .filter((member) => member.memberName && member.constituency)
    .filter((member) => memberServedInYear(member, year))
    .sort((a, b) => a.memberName.localeCompare(b.memberName, "en"));
}

export async function buildConstituencyMembers(year) {
  const membersPath = "src/data/pq/members-lookup.json";
  const pqPath = `src/data/pq/${year}/flat-enriched.json`;

  console.log(`Building constituency member summaries for ${year}...`);

  const membersLookup = await readJson(membersPath);
  const rows = await readJson(pqPath);

  const allRows = buildRows(membersLookup, rows, year);
  const oralRows = buildRows(
    membersLookup,
    filterRowsByType(rows, "oral"),
    year,
  );

  await writeJson(`src/data/pq/${year}/constituency-members-all.json`, allRows);
  await writeJson(
    `src/data/pq/${year}/constituency-members-oral.json`,
    oralRows,
  );

  console.log(`✓ constituency member summary files written for ${year}`);
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const year = process.argv[2];

  if (!year) {
    console.error("Please provide a year");
    process.exit(1);
  }

  await buildConstituencyMembers(year);
}
