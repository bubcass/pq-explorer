import fs from "fs/promises";
import path from "path";

function formatDateLabel(dateIso) {
  if (!dateIso) return null;

  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function totalValue(node) {
  if (!node) return 0;
  if (typeof node.value === "number") return node.value;
  if (!Array.isArray(node.children)) return 0;
  return node.children.reduce((sum, child) => sum + totalValue(child), 0);
}

function groupRows(rows, getKey) {
  const groups = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return groups;
}

function buildTreemapLeaf(rows) {
  return {
    children: rows.map((row) => ({
      name: row?.question ?? "Untitled question",
      value: 1,
      url: row?.url ?? null,
    })),
  };
}

function buildTreemapLevel(rows, levels, levelIndex = 0) {
  if (levelIndex >= levels.length) return buildTreemapLeaf(rows);

  const level = levels[levelIndex];
  const groups = groupRows(rows, level.getKey);

  const children = [...groups.entries()].map(([key, group]) => {
    const node = buildTreemapLevel(group, levels, levelIndex + 1);

    if (level.extra) {
      return {
        name: key,
        ...level.extra(group[0]),
        children: node.children ?? [node],
      };
    }

    return {
      name: key,
      children: node.children ?? [node],
    };
  });

  children.sort((a, b) => totalValue(b) - totalValue(a));
  return { children };
}

function buildTreemapData(rows) {
  const preparedRows = rows
    .map((row) => ({
      ...row,
      date_label: formatDateLabel(row.date_iso),
    }))
    .filter(
      (row) =>
        row.party &&
        row.heading &&
        row.deputy &&
        row.date_label &&
        row.question,
    );

  const treemapLevels = [
    { getKey: (d) => d.party },
    { getKey: (d) => d.heading },
    { getKey: (d) => d.deputy },
    {
      getKey: (d) => d.date_label,
      extra: (d) => ({ date_iso: d.date_iso ?? null }),
    },
  ];

  return {
    name: "Parliamentary Questions",
    children: buildTreemapLevel(preparedRows, treemapLevels).children ?? [],
  };
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function buildTreemapParties(year) {
  const inputPath = path.resolve(`src/data/pq/${year}/flat-enriched.json`);
  const outputAllPath = path.resolve(
    `src/data/pq/${year}/treemap-parties-all.json`,
  );
  const outputOralPath = path.resolve(
    `src/data/pq/${year}/treemap-parties-oral.json`,
  );
  const outputDefaultPath = path.resolve(
    `src/data/pq/${year}/treemap-parties.json`,
  );

  console.log(`Building party treemap hierarchy from ${inputPath}...`);

  const raw = JSON.parse(await fs.readFile(inputPath, "utf-8"));

  const allRows = raw.filter(
    (row) =>
      row &&
      typeof row === "object" &&
      String(row.questionType ?? "")
        .trim()
        .toLowerCase() !== "all",
  );

  const oralRows = allRows.filter(
    (row) =>
      String(row.questionType ?? "")
        .trim()
        .toLowerCase() === "oral",
  );

  const allData = buildTreemapData(allRows);
  const oralData = buildTreemapData(oralRows);

  await writeJson(outputAllPath, allData);
  await writeJson(outputOralPath, oralData);
  await writeJson(outputDefaultPath, allData);

  console.log(`✓ party treemap hierarchy files written for ${year}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const year = process.argv[2];

  if (!year) {
    console.error("Usage: node scripts/pq/build-treemap-parties.js <year>");
    process.exit(1);
  }

  await buildTreemapParties(year);
}
