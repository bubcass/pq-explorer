---
title: PQ Explorer | Overview
header: false
sidebar:
---

```js
import * as d3 from "npm:d3";
import { SankeyChart } from "./components/sankey-chart.js";
import { packedCircleChart } from "./components/packed-circle-chart.js";
import { zoomableTreemap } from "./components/zoomable-treemap.js";
import { downloadButton } from "./components/download-button.js";

const format = d3.format(",d");
const formatMean = d3.format(".2f");

const summary =
  year === 2025
    ? await FileAttachment("data/pq/2025/summary.json").json()
    : await FileAttachment("data/pq/2026/summary.json").json();

const flatEnriched =
  year === 2025
    ? await FileAttachment("data/pq/2025/flat-enriched.json").json()
    : await FileAttachment("data/pq/2026/flat-enriched.json").json();

function normaliseQuestionType(value) {
  return String(value ?? "").trim().toLowerCase();
}

function filterRowsByQuestionType(rows, filter) {
  if (filter === "all") return rows;
  return rows.filter((row) => normaliseQuestionType(row.questionType) === "oral");
}

function rollupLinks(rows, sourceKey, targetKey) {
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

function buildCombinedSankey(rows) {
  const sankeyData1 = rollupLinks(rows, "constituency", "party");
  const sankeyData2 = rollupLinks(rows, "party", "questionType");
  const sankeyData3 = rollupLinks(rows, "questionType", "department");
  return [...sankeyData1, ...sankeyData2, ...sankeyData3];
}

function buildPackedHierarchy(rows) {
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
        .sort((a, b) => b.value - a.value)
    }))
    .sort((a, b) => {
      const aTotal = a.children.reduce((sum, d) => sum + d.value, 0);
      const bTotal = b.children.reduce((sum, d) => sum + d.value, 0);
      return bTotal - aTotal;
    });

  return {
    name: "Parliamentary Questions",
    children
  };
}

function formatDateLabel(dateIso) {
  if (!dateIso) return null;
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long"
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

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(row);
  }

  return groups;
}

function buildTreemapLeaf(rows) {
  const first = rows[0];

  return {
    name: first?.question ?? "Untitled question",
    value: rows.length,
    url: first?.url ?? null
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
        children: node.children ?? [node]
      };
    }

    return {
      name: key,
      children: node.children ?? [node]
    };
  });

  children.sort((a, b) => totalValue(b) - totalValue(a));
  return { children };
}

const filteredRows = filterRowsByQuestionType(flatEnriched, questionFilter);
const sankeyLinks = buildCombinedSankey(filteredRows);
const packed = buildPackedHierarchy(filteredRows);

const preparedTreemapRows = filteredRows
  .map((row) => ({
    ...row,
    date_label: formatDateLabel(row.date_iso)
  }))
  .filter(
    (row) =>
      row.department &&
      row.heading &&
      row.date_label &&
      row.deputy &&
      row.question
  );

const treemapLevels = [
  { getKey: (d) => d.department },
  { getKey: (d) => d.heading },
  {
    getKey: (d) => d.date_label,
    extra: (d) => ({ date_iso: d.date_iso ?? null })
  },
  { getKey: (d) => d.deputy },
  { getKey: (d) => d.question }
];

const treemapData = {
  name: "Parliamentary Questions",
  children: buildTreemapLevel(preparedTreemapRows, treemapLevels).children
};
```

<div class="prose-block lead">

[Parliamentary questions](https://www.oireachtas.ie/en/debates/questions/) are an intrinsic part of Parliament and each year tens of thousands of questions are asked by Members. They are directed to each Department and answered by the appropriate Minister or Minister of State.

</div>

<div class="prose-block control-block">

## Parliamentary questions

Questions are directed to all Departments but some Departments get more than others. Questions designated for oral reply may be heard in plenary sessions of the Dáil but the vast majority of questions are answered in written replies.

Take a look with our interactive overview of the questions asked by Members for each year. Visuals are rendered in real time using information from the Oireachtas open data API.

</div>

<div class="prose-block control-block">

```js
const year = view(
  Inputs.select([2026, 2025], {
    label: "Year",
    value: 2026,
    format: (d) => String(d)
  })
);

const questionFilter = view(
  Inputs.radio(["all", "oral"], {
    label: "Questions type",
    value: "all",
    format: (d) => (d === "all" ? "All questions" : "Oral questions only")
  })
);
```

</div>
<div class="prose-block">

So far in **${summary.year}**, the total number of parliamentary questions submitted, replied to and published to the web has been **${format(summary.yearlyTotal)}**. See the breakdown by constituency, party, question type and Department.

</div>
<div class="chart-block">

```js
display(
  SankeyChart(
    { links: sankeyLinks },
    {
      nodeGroup: (d) => d.id.split(/\W/)[0],
      nodeAlign: "justify",
      linkColor: "source-target",
      format: (d) => format(d) + " questions",
      width: 820,
      height: 600
    }
  )
);
```

</div>

## Explore by Department

<div class="prose-block">

This period covers **${summary.year}**, when the total number of **parliamentary questions submitted, replied to and published to the web** was **${format(summary.yearlyTotal)}**. This equates to an **average of ${format(summary.averagePerSittingDay)} being published for each sitting day**.

Of the total, **${format(summary.oralPQs)}**, or an average of **${format(summary.averageOralPerSittingDay)} for each sitting day**, were questions originally designated for **oral reply**. The most popular question topic this year by Department is **${summary.mostPopularHeading}**.

For the selection, the [median average](https://en.wikipedia.org/wiki/Median) of questions asked by a Deputy was **${format(summary.medianQuestionsPerDeputy)}** and the [mean average](https://en.wikipedia.org/wiki/Mean#Statistical_location) of questions asked per Deputy was **${formatMean(summary.meanQuestionsPerDeputy)}**.

</div>
<div class="prose-block">

**Large circles denote Departments to which questions are directed. Smaller circles denote question topics, sized by the number of questions.**

Hover over circles to reveal information.

</div>
<div class="chart-block">

```js
display(packedCircleChart(packed, { width: 800, height: 700 }));
```

</div>

## Explore further

<div class="prose-block">

Click through the squares to drill down to the Department to which the question is directed, the question topic, date, Deputy, text of the question and reply as published.

Click on the top panel to zoom out again.

</div>
<div class="chart-block">

```js
display(zoomableTreemap(treemapData, { width: 750, height: 620 }));
```

</div>
<div class="prose-block">
  All parliamentary questions can be searched on a dedicated Oireachtas page. All data are from the Oireachtas open data API.
</div>


<div class="download-block">

```js
downloadButton(filteredRows, "pq_explorer.csv")
```

</div>
