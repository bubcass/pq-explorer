import { writeJson } from "./utils.js";

function toISODate(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function buildURL(dateIso, questionNumber) {
  if (!dateIso || !questionNumber) return null;
  return `https://www.oireachtas.ie/en/debates/question/${dateIso}/${questionNumber}/`;
}

export async function buildFlatPQs(year) {
  const url = `https://raw.githubusercontent.com/bubcass/PQs/refs/heads/main/PQs_${year}_paginated.json`;

  console.log(`Fetching PQs for ${year}...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const json = await res.json();
  const rows = Array.isArray(json) ? json : (json.results ?? []);

  console.log(`Transforming ${rows.length} rows...`);

  const flat = rows.map((d) => {
    const date_iso = toISODate(d?.contextDate);
    const questionNumber = d?.question?.questionNumber ?? null;

    return {
      year: Number(year),
      date_iso,
      department: d?.question?.to?.showAs ?? null,
      heading: d?.question?.debateSection?.showAs ?? null,
      deputy: d?.question?.by?.showAs ?? null,
      memberCode: d?.question?.by?.memberCode ?? null,
      questionType: d?.question?.questionType ?? null,
      questionNumber,
      question: d?.question?.showAs ?? null,
      url: buildURL(date_iso, questionNumber),
    };
  });

  const outPath = `src/data/pq/${year}/flat.json`;
  await writeJson(outPath, flat);

  console.log(`✓ flat.json written for ${year}`);
}
