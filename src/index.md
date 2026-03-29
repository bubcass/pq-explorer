---
title: PQ Explorer | Overview
header: false
sidebar: false
footer: false
toc: false
---
```js
import * as d3 from "npm:d3";
import { SankeyChart } from "./components/sankey-chart.js";
import { packedCircleChart } from "./components/packed-circle-chart.js";
import { zoomableTreemap } from "./components/zoomable-treemap.js";
import { pqControls } from "./components/pq-controls.js";

const format = d3.format(",d");
const formatMean = d3.format(".2f");

const summaries = {
  2025: {
    all: await FileAttachment("data/pq/2025/summary-all.json").json(),
    oral: await FileAttachment("data/pq/2025/summary-oral.json").json()
  },
  2026: {
    all: await FileAttachment("data/pq/2026/summary-all.json").json(),
    oral: await FileAttachment("data/pq/2026/summary-oral.json").json()
  }
};

const sankeyData = {
  2025: {
    all: await FileAttachment("data/pq/2025/sankey-links-all.json").json(),
    oral: await FileAttachment("data/pq/2025/sankey-links-oral.json").json()
  },
  2026: {
    all: await FileAttachment("data/pq/2026/sankey-links-all.json").json(),
    oral: await FileAttachment("data/pq/2026/sankey-links-oral.json").json()
  }
};

const packedData = {
  2025: {
    all: await FileAttachment("data/pq/2025/packed-circle-hierarchy-all.json").json(),
    oral: await FileAttachment("data/pq/2025/packed-circle-hierarchy-oral.json").json()
  },
  2026: {
    all: await FileAttachment("data/pq/2026/packed-circle-hierarchy-all.json").json(),
    oral: await FileAttachment("data/pq/2026/packed-circle-hierarchy-oral.json").json()
  }
};

const treemapData = {
  2025: {
    all: await FileAttachment("data/pq/2025/treemap-hierarchy-all.json").json(),
    oral: await FileAttachment("data/pq/2025/treemap-hierarchy-oral.json").json()
  },
  2026: {
    all: await FileAttachment("data/pq/2026/treemap-hierarchy-all.json").json(),
    oral: await FileAttachment("data/pq/2026/treemap-hierarchy-oral.json").json()
  }
};

const downloadUrls = {
  2025: await FileAttachment("data/pq/2025/parliamentary_questions_2025.csv").url(),
  2026: await FileAttachment("data/pq/2026/parliamentary_questions_2026.csv").url()
};

if (typeof window !== "undefined" && !window.__pqOverviewResizeObserver) {
  window.__pqOverviewResizeObserver = new ResizeObserver(([entry]) => {
    parent.postMessage({ height: entry.target.scrollHeight }, "*");
  });

  window.__pqOverviewResizeObserver.observe(document.body);
}

if (!window.pqState) {
  window.pqState = {
    year: 2026,
    questionType: "all"
  };
}

function getState() {
  return window.pqState;
}

function getVariantKey() {
  return getState().questionType === "oral" ? "oral" : "all";
}

function getSummary() {
  return summaries[getState().year]?.[getVariantKey()] ?? null;
}

function getSankeyLinks() {
  return sankeyData[getState().year]?.[getVariantKey()] ?? [];
}

function getPackedData() {
  return (
    packedData[getState().year]?.[getVariantKey()] ?? {
      name: "Parliamentary Questions",
      children: []
    }
  );
}

function getTreemapData() {
  return (
    treemapData[getState().year]?.[getVariantKey()] ?? {
      name: "Parliamentary Questions",
      children: []
    }
  );
}

function getDownloadHref() {
  return downloadUrls[getState().year] ?? "";
}

function getDownloadFilename() {
  return `parliamentary_questions_dataset_${getState().year}.csv`;
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

    if (!summary) {
      el.innerHTML = `<p>No summary data available for this selection.</p>`;
      return;
    }

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
    const links = getSankeyLinks();

    if (!links.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      SankeyChart(
        { links },
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

    if (!summary) {
      el.innerHTML = `<p>No summary data available for this selection.</p>`;
      return;
    }

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
    const packed = getPackedData();

    if (!packed?.children?.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      packedCircleChart(packed, { width: 800, height: 700 })
    );
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
    const treemap = getTreemapData();

    if (!treemap?.children?.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      zoomableTreemap(treemap, { width: 650, height: 520 })
    );
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
    const href = getDownloadHref();
    const filename = getDownloadFilename();

    const link = document.createElement("a");
    link.className = "pq-download";
    link.href = href;
    link.download = filename;
    link.textContent = `Download parliamentary question dataset ${getState().year}`;

    el.replaceChildren(link);
  }, {
    debounceMs: 20
  })
);

{
  const wrap = document.createElement("div");
  wrap.className = "explore-links-block";

  wrap.innerHTML = `
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
  `;

  display(wrap);
}
```
