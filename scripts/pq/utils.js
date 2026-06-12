import fs from "fs/promises";
import path from "path";

export function normaliseQuestionType(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

export function filterRowsByType(rows, questionType = "all") {
  const type = normaliseQuestionType(questionType);
  if (!type || type === "all") return rows;
  return rows.filter((row) => normaliseQuestionType(row?.questionType) === type);
}

export function toComparableText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function fetchOireachtasApiPaginated(
  baseUrl,
  {
    limit = 1000,
    maxPages = 100,
  } = {},
) {
  if (!baseUrl) {
    throw new Error("A base URL is required");
  }

  const rows = [];
  let totalExpected = null;

  for (let page = 0, skip = 0; page < maxPages; page += 1, skip += limit) {
    const url = new URL(baseUrl);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("skip", String(skip));

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }

    const json = await res.json();
    const batch = Array.isArray(json?.results) ? json.results : [];
    const count = Number(json?.head?.counts?.resultCount);

    if (Number.isFinite(count)) {
      totalExpected = count;
    }

    rows.push(...batch);

    if (!batch.length) break;
    if (totalExpected !== null && rows.length >= totalExpected) break;
    if (batch.length < limit) break;
  }

  if (totalExpected !== null && rows.length < totalExpected) {
    throw new Error(
      `Incomplete paginated fetch for ${baseUrl}: expected ${totalExpected} rows, got ${rows.length}`,
    );
  }

  return rows;
}

export function formatDateLabel(dateIso) {
  if (!dateIso) return null;

  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function totalValue(node) {
  if (!node) return 0;
  if (typeof node.value === "number") return node.value;
  if (!Array.isArray(node.children)) return 0;
  return node.children.reduce((sum, child) => sum + totalValue(child), 0);
}

export function buildPackedHierarchy(rows, rootName = "Parliamentary Questions") {
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
        .map(([heading, value]) => ({
          name: heading,
          value,
        }))
        .sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => totalValue(b) - totalValue(a));

  return { name: rootName, children };
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

export function buildTreemapHierarchy(
  rows,
  {
    rootName = "Parliamentary Questions",
    includeDeputyLevel = true,
  } = {},
) {
  const preparedRows = rows
    .map((row) => ({
      ...row,
      date_label: formatDateLabel(row?.date_iso),
    }))
    .filter(
      (row) =>
        row.department &&
        row.heading &&
        row.date_label &&
        row.question &&
        (!includeDeputyLevel || row.deputy),
    );

  const levels = [
    { getKey: (d) => d.department },
    { getKey: (d) => d.heading },
    {
      getKey: (d) => d.date_label,
      extra: (d) => ({ date_iso: d.date_iso ?? null }),
    },
  ];

  if (includeDeputyLevel) {
    levels.push({ getKey: (d) => d.deputy });
  }

  return {
    name: rootName,
    children: buildTreemapLevel(preparedRows, levels).children ?? [],
  };
}

export function rollupLinks(rows, sourceKey, targetKey) {
  const counts = new Map();

  for (const row of rows) {
    const source = row?.[sourceKey];
    const target = row?.[targetKey];

    if (!source || !target) continue;

    const key = `${source}|||${target}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, value]) => {
    const [source, target] = key.split("|||");
    return { source, target, value };
  });
}

export function buildSankeyLinks(rows) {
  const sankeyData1 = rollupLinks(rows, "constituency", "party");
  const sankeyData2 = rollupLinks(rows, "party", "questionType");
  const sankeyData3 = rollupLinks(rows, "questionType", "department");
  return [...sankeyData1, ...sankeyData2, ...sankeyData3];
}

export function getDeputyMeta(rows) {
  const byDeputy = new Map();

  for (const row of rows) {
    const memberCode = row?.memberCode?.trim();
    if (!memberCode) continue;

    if (!byDeputy.has(memberCode)) {
      const memberName = row?.memberName?.trim() || row?.deputy?.trim() || null;

      byDeputy.set(memberCode, {
        memberCode,
        memberName,
        deputy: row?.deputy?.trim() || memberName,
        party: row?.party?.trim() || "Independent",
        constituency: row?.constituency?.trim() || null,
        memberUrl:
          row?.memberUrl?.trim() ||
          `https://www.oireachtas.ie/en/members/member/${memberCode}/`,
        imageUrl: `https://data.oireachtas.ie/ie/oireachtas/member/id/${memberCode}/image/large`,
      });
    }
  }

  return byDeputy;
}

export function sortRowsChronologically(rows) {
  return rows.slice().sort((a, b) => {
    const dateCompare = String(a?.date_iso ?? "").localeCompare(String(b?.date_iso ?? ""));
    if (dateCompare !== 0) return dateCompare;

    const aNum = Number(a?.questionNumber ?? 0);
    const bNum = Number(b?.questionNumber ?? 0);
    return aNum - bNum;
  });
}

export function buildHeadingOptions(rows) {
  return [...new Set(rows.map((row) => row?.heading?.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function buildInsights(rows) {
  if (!rows.length) {
    return {
      totalQuestions: 0,
      topHeading: null,
      topHeadingCount: 0,
      topDepartment: null,
      topDepartmentCount: 0,
    };
  }

  const headingCounts = new Map();
  const departmentCounts = new Map();

  for (const row of rows) {
    const heading = row?.heading?.trim();
    const department = row?.department?.trim();

    if (heading) headingCounts.set(heading, (headingCounts.get(heading) ?? 0) + 1);
    if (department) {
      departmentCounts.set(department, (departmentCounts.get(department) ?? 0) + 1);
    }
  }

  const [topHeading = null, topHeadingCount = 0] =
    [...headingCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const [topDepartment = null, topDepartmentCount = 0] =
    [...departmentCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  return {
    totalQuestions: rows.length,
    topHeading,
    topHeadingCount,
    topDepartment,
    topDepartmentCount,
  };
}
