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
import { pqControls } from "./components/pq-controls.js";

const format = d3.format(",d");
const formatMean = d3.format(".2f");

const summaries = {
  2025: await FileAttachment("data/pq/2025/summary.json").json(),
  2026: await FileAttachment("data/pq/2026/summary.json").json()
};

const flatData = {
  2025: await FileAttachment("data/pq/2025/flat-enriched.json").json(),
  2026: await FileAttachment("data/pq/2026/flat-enriched.json").json()
};

if (!window.pqState) {
  window.pqState = {
    year: 2026,
    questionType: "all"
  };
}

function getState() {
  return window.pqState;
}

function getSummary() {
  return summaries[getState().year];
}

function getRows() {
  const rows = flatData[getState().year] ?? [];
  if (getState().questionType === "all") return rows;
  return rows.filter(
    (row) => String(row?.questionType ?? "").trim().toLowerCase() === "oral"
  );
}

const computedCache = new Map();

function getCacheKey() {
  const state = getState();
  return `${state.year}::${state.questionType}`;
}

function getComputedData() {
  const key = getCacheKey();
  if (computedCache.has(key)) return computedCache.get(key);

  const rows = getRows();
  const computed = {
    rows,
    sankeyLinks: buildCombinedSankey(rows),
    packed: buildPackedHierarchy(rows),
    treemapData: buildTreemapData(rows)
  };

  computedCache.set(key, computed);
  return computed;
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
  return {
    children: rows.map((row) => ({
      name: row?.question ?? "Untitled question",
      value: 1,
      url: row?.url ?? null
    }))
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

function buildTreemapData(rows) {
  const preparedTreemapRows = rows
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
    { getKey: (d) => d.deputy }
  ];

  return {
    name: "Parliamentary Questions",
    children: buildTreemapLevel(preparedTreemapRows, treemapLevels).children
  };
}

function mountReactive(className, renderFn, options = {}) {
  const { debounceMs = 50, loadingHtml = "", loadingDelayMs = 100 } = options;

  const el = document.createElement("div");
  if (className) el.className = className;

  let timeoutId = null;

  const run = () => {
    let didRender = false;

    const loadingTimer = setTimeout(() => {
      if (!didRender && loadingHtml) {
        el.innerHTML = loadingHtml;
      }
    }, loadingDelayMs);

    requestAnimationFrame(() => {
      renderFn(el);
      didRender = true;
      clearTimeout(loadingTimer);
    });
  };

  run();

  const onChange = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(run, debounceMs);
  };

  window.addEventListener("pq:change", onChange);

  return el;
}
```

<div class="prose-block">

[Parliamentary questions](https://www.oireachtas.ie/en/debates/questions/) are an intrinsic part of Parliament and each year tens of thousands of questions are asked by Members. They are directed to each Department and answered by the appropriate Minister or Minister of State.

</div>

<div class="prose-block">

## Parliamentary questions

Questions are directed to all Departments but some Departments get more than others. Questions designated for oral reply may be heard in plenary sessions of the Dáil but the vast majority of questions are answered in written replies.

Take a look with our interactive overview of the questions asked by Members for each year. Visuals are rendered in real time using information from the Oireachtas open data API.

</div>

<div class="prose-block controls-block">

```js
pqControls({
  state: window.pqState,
  onChange: () => {
    window.dispatchEvent(new CustomEvent("pq:change"));
  }
})
```

</div>

```js
display(
  mountReactive("prose-block reactive-prose", (el) => {
    const summary = getSummary();
    el.innerHTML = `
      <p>
        In <strong>${summary.year}</strong>, the total number of parliamentary questions submitted, replied to and published to the web is <strong>${format(summary.yearlyTotal)}</strong>.
      </p>
      <p>
        See the breakdown by constituency, party, question type and Department.
      </p>
    `;
  })
);
```

<div class="chart-block">

```js
display(
  mountReactive("", (el) => {
    const { sankeyLinks } = getComputedData();
    el.replaceChildren(
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
  }, {
    loadingHtml: `<p class="chart-loading">Updating…</p>`,
    loadingDelayMs: 100
  })
);
```

</div>

<div class="prose-block">
  <h2>Explore by Department</h2>
</div>

```js
display(
  mountReactive("prose-block reactive-prose", (el) => {
    const summary = getSummary();
    el.innerHTML = `
      <p>
        This period covers <strong>${summary.year}</strong>, when the total number of <strong>parliamentary questions submitted, replied to and published to the web</strong> was <strong>${format(summary.yearlyTotal)}</strong>. This equates to an <strong>average of ${format(summary.averagePerSittingDay)} being published for each sitting day</strong>.
      </p>

      <p>
        Of the total, <strong>${format(summary.oralPQs)}</strong>, or an average of <strong>${format(summary.averageOralPerSittingDay)} for each sitting day</strong>, were questions originally designated for <strong>oral reply</strong>. The most popular question topic this year for the selected options is <strong>${summary.mostPopularHeading}</strong>.
      </p>

      <p>
        For the selection, the <a href="https://en.wikipedia.org/wiki/Median">median average</a> of questions asked by a Deputy was <strong>${format(summary.medianQuestionsPerDeputy)}</strong> and the <a href="https://en.wikipedia.org/wiki/Mean#Statistical_location">mean average</a> of questions asked per Deputy was <strong>${formatMean(summary.meanQuestionsPerDeputy)}</strong>.
      </p>

      <p>Hover over circles to reveal information.</p>
    `;
  })
);
```

<div class="chart-block">

```js
display(
  mountReactive("", (el) => {
    const { packed } = getComputedData();
    el.replaceChildren(packedCircleChart(packed, { width: 800, height: 700 }));
  }, {
    loadingHtml: `<p class="chart-loading">Updating…</p>`,
    loadingDelayMs: 100
  })
);
```

</div>

<div class="prose-block">
  <p class="chart-caption">
    Large circles denote Departments to which the selected Deputy directed questions. Smaller circles denote question headings, sized by the number of questions.
  </p>
</div>

<div class="prose-block">
  <h2>Explore further</h2>

  <p>
    <strong>Click through the squares to drill down</strong> to the Department to which the question is directed, the question topic, date, Deputy, text of the question and reply as published.
  </p>

  <p>
    Click on the top panel to zoom out again.
  </p>
</div>

<div class="chart-block">

```js
display(
  mountReactive("", (el) => {
    const { treemapData } = getComputedData();
    el.replaceChildren(zoomableTreemap(treemapData, { width: 650, height: 520 }));
  }, {
    loadingHtml: `<p class="chart-loading">Updating…</p>`,
    loadingDelayMs: 100
  })
);
```

</div>

<div class="prose-block">
  All parliamentary questions can be searched on a <a href="https://www.oireachtas.ie/en/debates/questions/" target="_blank" rel="noreferrer">
      dedicated questions page</a>. All data are from the <a href="https://api.oireachtas.ie/" target="_blank" rel="noreferrer">
    Oireachtas open data API
  </a>.
</div>

```js
display(
  mountReactive("download-block", (el) => {
    const { rows } = getComputedData();
    el.replaceChildren(downloadButton(rows, "pq_explorer.csv"));
  }, {
    debounceMs: 20
  })
);
```

<div class="explore-links-block">
  <div class="explore-links-grid">
    <a class="explore-tile" href="./deputies">
      <div class="explore-tile-head">
        <span class="explore-tile-title">Explore: Deputies</span>
        <span class="explore-tile-arrow" aria-hidden="true">↗</span>
      </div>
    </a>
    <a class="explore-tile" href="./constituencies">
      <div class="explore-tile-head">
        <span class="explore-tile-title">Explore: Constituencies</span>
        <span class="explore-tile-arrow" aria-hidden="true">↗</span>
      </div>
    </a>
    <a class="explore-tile" href="./parties">
      <div class="explore-tile-head">
        <span class="explore-tile-title">Explore: Parties</span>
        <span class="explore-tile-arrow" aria-hidden="true">↗</span>
      </div>
    </a>
  </div>
</div>
