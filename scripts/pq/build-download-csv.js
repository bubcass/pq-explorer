import fs from "fs/promises";
import path from "path";

function toCSV(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value) => {
    if (value == null) return "";
    const str = String(value);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  return "\uFEFF" + lines.join("\n"); // BOM for Excel
}

export async function buildDownloadCsv(year) {
  const inputPath = path.resolve(`src/data/pq/${year}/flat-enriched.json`);

  const outputPath = path.resolve(
    `src/data/pq/${year}/parliamentary_questions_${year}.csv`,
  );

  const raw = JSON.parse(await fs.readFile(inputPath, "utf-8"));

  const normalised = raw.map((d) => ({
    department: (d.department ?? "").trim(),
    heading: (d.heading ?? "").trim(),
    deputy: (d.deputy ?? "").trim(),
    type: (d.questionType ?? "").trim().toLowerCase(),
    question: (d.question ?? "").replace(/\s+/g, " ").trim(),
    url: d.url ?? "",
    date: d.date_iso ?? "",
  }));

  const csv = toCSV(normalised);

  await fs.writeFile(outputPath, csv);

  console.log(`✓ CSV written for ${year}`);
}
