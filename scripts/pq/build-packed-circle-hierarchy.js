import fs from "fs/promises";

function makePackedCircleHierarchy(rows) {
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
    .sort((a, b) => {
      const aTotal = a.children.reduce((sum, d) => sum + d.value, 0);
      const bTotal = b.children.reduce((sum, d) => sum + d.value, 0);
      return bTotal - aTotal;
    });

  return {
    name: "Parliamentary Questions",
    children,
  };
}

export async function buildPackedCircleHierarchy(year) {
  const inPath = `src/data/pq/${year}/flat.json`;
  const outPath = `src/data/pq/${year}/packed-circle-hierarchy.json`;

  console.log(`Building packed circle hierarchy from ${inPath}...`);

  const raw = await fs.readFile(inPath, "utf8");
  const rows = JSON.parse(raw);

  const hierarchy = makePackedCircleHierarchy(rows);

  await fs.writeFile(outPath, JSON.stringify(hierarchy, null, 2));

  console.log(`✓ packed-circle-hierarchy.json written for ${year}`);
}
