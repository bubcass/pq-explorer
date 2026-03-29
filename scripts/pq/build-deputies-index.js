import { getDeputyMeta, normaliseQuestionType, readJson, toComparableText, writeJson } from "./utils.js";

function getSurname(name) {
  if (!name) return "";
  const parts = String(name).trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

export async function buildDeputiesIndex(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;
  const outPath = `src/data/pq/${year}/deputies-index.json`;

  console.log(`Building deputies-index.json for ${year}...`);

  const rows = await readJson(inPath);
  const deputyMeta = getDeputyMeta(rows);

  const counts = new Map();

  for (const row of rows) {
    const memberCode = row?.memberCode?.trim();
    if (!memberCode) continue;

    const questionType = normaliseQuestionType(row?.questionType);
    if (!questionType) continue;

    if (!counts.has(memberCode)) {
      const meta = deputyMeta.get(memberCode);
      counts.set(memberCode, {
        memberCode,
        memberName: meta?.memberName ?? row?.memberName?.trim() ?? row?.deputy?.trim() ?? null,
        deputy: meta?.deputy ?? row?.deputy?.trim() ?? null,
        party: meta?.party ?? row?.party?.trim() ?? "Independent",
        constituency: meta?.constituency ?? row?.constituency?.trim() ?? null,
        memberUrl:
          meta?.memberUrl ??
          row?.memberUrl?.trim() ??
          `https://www.oireachtas.ie/en/members/member/${memberCode}/`,
        imageUrl: meta?.imageUrl ?? `https://data.oireachtas.ie/ie/oireachtas/member/id/${memberCode}/image/large`,
        counts: {
          all: 0,
          oral: 0,
          written: 0,
        },
      });
    }

    const entry = counts.get(memberCode);
    entry.counts.all += 1;
    if (questionType === "oral") entry.counts.oral += 1;
    if (questionType === "written") entry.counts.written += 1;
  }

  const result = [...counts.values()].sort((a, b) => {
    const surnameCompare = getSurname(a.memberName).localeCompare(getSurname(b.memberName));
    if (surnameCompare !== 0) return surnameCompare;
    return toComparableText(a.memberName).localeCompare(toComparableText(b.memberName));
  });

  await writeJson(outPath, result);

  console.log(`✓ deputies-index.json written for ${year}`);
}
