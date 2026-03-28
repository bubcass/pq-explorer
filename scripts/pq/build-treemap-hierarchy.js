import fs from "fs/promises";

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

function sortChildrenByValueDescending(nodes) {
  return nodes.sort((a, b) => totalValue(b) - totalValue(a));
}

function buildLeafNode(rows) {
  return {
    children: rows.map((row) => ({
      name: row?.question ?? "Untitled question",
      value: 1,
      url: row?.url ?? null,
    })),
  };
}

function groupRows(rows, getKey) {
  const groups = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(row);
  }

  return groups;
}

function buildHierarchyLevel(rows, levels, levelIndex = 0) {
  if (levelIndex >= levels.length) {
    return buildLeafNode(rows);
  }

  const level = levels[levelIndex];
  const groups = groupRows(rows, level.getKey);

  const children = [...groups.entries()].map(([key, group]) => {
    const node = buildHierarchyLevel(group, levels, levelIndex + 1);

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

  return {
    children: sortChildrenByValueDescending(children),
  };
}

export async function buildTreemapHierarchy(year) {
  const inPath = `src/data/pq/${year}/flat-enriched.json`;
  const outPath = `src/data/pq/${year}/treemap-hierarchy.json`;

  console.log(`Building treemap-hierarchy.json for ${year}...`);

  const raw = await fs.readFile(inPath, "utf8");
  const rows = JSON.parse(raw);

  const preparedRows = rows
    .map((row) => ({
      ...row,
      date_label: formatDateLabel(row.date_iso),
    }))
    .filter(
      (row) =>
        row.department &&
        row.heading &&
        row.date_label &&
        row.deputy &&
        row.question,
    );

  const levels = [
    {
      getKey: (d) => d.department,
    },
    {
      getKey: (d) => d.heading,
    },
    {
      getKey: (d) => d.date_label,
      extra: (d) => ({
        date_iso: d.date_iso ?? null,
      }),
    },
    {
      getKey: (d) => d.deputy,
    },
  ];

  const hierarchy = {
    name: "Parliamentary Questions",
    children: buildHierarchyLevel(preparedRows, levels).children,
  };

  await fs.writeFile(outPath, JSON.stringify(hierarchy, null, 2));

  console.log(`✓ treemap-hierarchy.json written for ${year}`);
}
