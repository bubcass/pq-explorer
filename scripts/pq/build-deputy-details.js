import fs from "fs/promises";
import path from "path";

function ascending(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "en-IE");
}

function descendingNumber(a, b) {
  return (b ?? 0) - (a ?? 0);
}

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

function countBy(rows, getKey) {
  const counts = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
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

  children.sort((a, b) => descendingNumber(totalValue(a), totalValue(b)));
  return { children };
}

function buildPackedFromRows(rows) {
  if (!rows.length) {
    return {
      name: "Parliamentary Questions",
      children: [],
    };
  }

  const departmentMap = new Map();

  for (const row of rows) {
    const department = row?.department?.trim();
    const heading = row?.heading?.trim();

    if (!department || !heading) continue;

    if (!departmentMap.has(department)) {
      departmentMap.set(department, new Map());
    }

    const headingMap = departmentMap.get(department);
    headingMap.set(heading, (headingMap.get(heading) ?? 0) + 1);
  }

  const children = [...departmentMap.entries()]
    .map(([department, headingMap]) => ({
      name: department,
      children: [...headingMap.entries()]
        .map(([heading, value]) => ({ name: heading, value }))
        .sort((a, b) => descendingNumber(a.value, b.value)),
    }))
    .sort((a, b) => {
      const aTotal = a.children.reduce((sum, d) => sum + d.value, 0);
      const bTotal = b.children.reduce((sum, d) => sum + d.value, 0);
      return descendingNumber(aTotal, bTotal);
    });

  return {
    name: "Parliamentary Questions",
    children,
  };
}

function buildTreemapFromRows(rows) {
  const preparedRows = rows
    .map((row) => ({
      ...row,
      date_label: formatDateLabel(row.date_iso),
    }))
    .filter(
      (row) => row.department && row.heading && row.date_label && row.question,
    );

  if (!preparedRows.length) {
    return {
      name: "Parliamentary Questions",
      children: [],
    };
  }

  const treemapLevels = [
    { getKey: (d) => d.department },
    { getKey: (d) => d.heading },
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

function buildInsightsFromRows(rows) {
  if (!rows.length) return null;

  const headingCounts = [...countBy(rows, (d) => d.heading).entries()].sort(
    (a, b) => descendingNumber(a[1], b[1]),
  );

  const departmentCounts = [
    ...countBy(rows, (d) => d.department).entries(),
  ].sort((a, b) => descendingNumber(a[1], b[1]));

  return {
    topHeading: headingCounts[0]?.[0] ?? null,
    topHeadingCount: headingCounts[0]?.[1] ?? 0,
    topDepartment: departmentCounts[0]?.[0] ?? null,
    topDepartmentCount: departmentCounts[0]?.[1] ?? 0,
  };
}

function getHeadingOptions(rows) {
  return [
    ...new Set(rows.map((d) => (d.heading ?? "").trim()).filter(Boolean)),
  ].sort(ascending);
}

function slimQuestions(rows) {
  return rows.map((row) => ({
    date_iso: row.date_iso ?? "",
    questionNumber: row.questionNumber ?? null,
    department: row.department ?? "",
    heading: row.heading ?? "",
    question: (row.question ?? "").replace(/\s+/g, " ").trim(),
    url: row.url ?? "",
    questionType: row.questionType ?? "",
  }));
}

function buildTypePayload(rows) {
  const questions = slimQuestions(rows);

  return {
    count: questions.length,
    headingOptions: getHeadingOptions(questions),
    insights: buildInsightsFromRows(questions),
    packed: buildPackedFromRows(questions),
    treemap: buildTreemapFromRows(questions),
    questions,
  };
}

function sanitizeFilename(name) {
  return String(name).replaceAll("/", "_").replaceAll("\\", "_");
}

export async function buildDeputyDetails(year) {
  const inPath = path.join(
    "src",
    "data",
    "pq",
    String(year),
    "flat-enriched.json",
  );
  const outDir = path.join(
    "src",
    "data",
    "pq",
    String(year),
    "deputies",
  );
  const staticOutDir = path.join(
    "src",
    "static",
    "data",
    "pq",
    String(year),
    "deputies",
  );

  console.log(`Building deputy detail files from ${inPath}...`);

  const raw = await fs.readFile(inPath, "utf8");
  const rows = JSON.parse(raw);

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(staticOutDir, { recursive: true });

  const byDeputy = groupRows(rows, (d) => d.memberCode);

  for (const [memberCode, deputyRows] of byDeputy.entries()) {
    if (!memberCode) continue;

    const allRows = deputyRows.slice();
    const oralRows = deputyRows.filter(
      (d) =>
        String(d.questionType ?? "")
          .trim()
          .toLowerCase() === "oral",
    );

    const first = deputyRows[0];

    const payload = {
      year,
      memberCode,
      memberName: first.memberName ?? first.deputy ?? "",
      deputy: first.deputy ?? first.memberName ?? "",
      party: first.party ?? "",
      constituency: first.constituency ?? "",
      memberUrl:
        first.memberUrl ??
        `https://www.oireachtas.ie/en/members/member/${memberCode}/`,
      imageUrl:
        first.imageUrl ??
        `https://data.oireachtas.ie/ie/oireachtas/member/id/${memberCode}/image/large`,
      types: {
        all: buildTypePayload(allRows),
        oral: buildTypePayload(oralRows),
      },
    };

    const filename = `${sanitizeFilename(memberCode)}.json`;
    const json = JSON.stringify(payload, null, 2);
    const outPath = path.join(outDir, filename);
    const staticOutPath = path.join(staticOutDir, filename);
    await fs.writeFile(outPath, json, "utf8");
    await fs.writeFile(staticOutPath, json, "utf8");
  }

  console.log(`✓ deputy detail files written for ${year}`);
}
