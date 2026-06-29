---
title: Overview
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
import { renderSectionNav } from "./components/section-nav.js";

const format = d3.format(",d");
const formatMean = d3.format(".2f");

const heroVideoPromise = FileAttachment("media/PQs.mp4").url();

const summaries = {
  2025: {
    all: FileAttachment("data/pq/2025/summary-all.json").json(),
    oral: FileAttachment("data/pq/2025/summary-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/summary-all.json").json(),
    oral: FileAttachment("data/pq/2026/summary-oral.json").json()
  }
};

const sankeyData = {
  2025: {
    all: FileAttachment("data/pq/2025/sankey-links-all.json").json(),
    oral: FileAttachment("data/pq/2025/sankey-links-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/sankey-links-all.json").json(),
    oral: FileAttachment("data/pq/2026/sankey-links-oral.json").json()
  }
};

const packedData = {
  2025: {
    all: FileAttachment("data/pq/2025/packed-circle-hierarchy-all.json").json(),
    oral: FileAttachment("data/pq/2025/packed-circle-hierarchy-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/packed-circle-hierarchy-all.json").json(),
    oral: FileAttachment("data/pq/2026/packed-circle-hierarchy-oral.json").json()
  }
};

const treemapData = {
  2025: {
    all: FileAttachment("data/pq/2025/treemap-hierarchy-all.json").json(),
    oral: FileAttachment("data/pq/2025/treemap-hierarchy-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/treemap-hierarchy-all.json").json(),
    oral: FileAttachment("data/pq/2026/treemap-hierarchy-oral.json").json()
  }
};

const downloadUrls = {
  2025: FileAttachment("data/pq/2025/parliamentary_questions_2025.csv").url(),
  2026: FileAttachment("data/pq/2026/parliamentary_questions_2026.csv").url()
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

async function getSummary() {
  return await summaries[getState().year]?.[getVariantKey()] ?? null;
}

async function getSankeyLinks() {
  return await sankeyData[getState().year]?.[getVariantKey()] ?? [];
}

async function getPackedData() {
  return (
    await packedData[getState().year]?.[getVariantKey()] ?? {
      name: "Parliamentary Questions",
      children: []
    }
  );
}

async function getTreemapData() {
  return (
    await treemapData[getState().year]?.[getVariantKey()] ?? {
      name: "Parliamentary Questions",
      children: []
    }
  );
}

async function getDownloadHref() {
  return await downloadUrls[getState().year] ?? "";
}

function getDownloadFilename() {
  return `parliamentary_questions_${getState().year}.csv`;
}

function chartPlaceholder(height = 320, text = "Updating…") {
  const wrap = document.createElement("div");
  wrap.className = "chart-loading";
  wrap.style.minHeight = `${height}px`;
  wrap.style.display = "grid";
  wrap.style.alignItems = "center";
  wrap.style.justifyItems = "center";
  wrap.style.border = "1px solid var(--border)";
  wrap.style.background = "rgba(255,255,255,0.55)";
  wrap.style.padding = "1rem";
  wrap.textContent = text;
  return wrap;
}

function mountReactive(className, renderFn, options = {}) {
  const { debounceMs = 50, skeletonDelay = 120 } = options;

  const el = document.createElement("div");
  if (className) el.className = className;

  let timeoutId = null;
  let runId = 0;
  let hasRenderedOnce = false;

  const run = () => {
    const currentRun = ++runId;

    requestAnimationFrame(async () => {
      const isCurrent = () => currentRun === runId;

      if (!hasRenderedOnce) {
        await renderFn(el, { skeletonOnly: true, isCurrent });
        await new Promise((resolve) => setTimeout(resolve, skeletonDelay));

        if (!isCurrent()) return;
      }

      await renderFn(el, { skeletonOnly: false, isCurrent });

      if (isCurrent()) {
        hasRenderedOnce = true;
      }
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

function mountDeferred(className, renderFn, options = {}) {
  const {
    rootMargin = "200px",
    loading = () => chartPlaceholder(320),
    eventName = null,
    skeletonDelay = 120
  } = options;

  const eventNames = Array.isArray(eventName)
    ? eventName
    : eventName
    ? [eventName]
    : [];

  const el = document.createElement("div");
  if (className) el.className = className;

  let hasRendered = false;
  let hasRenderedOnce = false;
  let runId = 0;

  const run = () => {
    const currentRun = ++runId;

    requestAnimationFrame(async () => {
      const isCurrent = () => currentRun === runId;

      if (!hasRenderedOnce) {
        await renderFn(el, { skeletonOnly: true, isCurrent });
        await new Promise((resolve) => setTimeout(resolve, skeletonDelay));

        if (!isCurrent()) return;
      }

      await renderFn(el, { skeletonOnly: false, isCurrent });

      if (isCurrent()) {
        hasRenderedOnce = true;
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !hasRendered) {
        hasRendered = true;
        observer.disconnect();
        run();
      }
    },
    { rootMargin }
  );

  el.replaceChildren(
    typeof loading === "function" ? loading() : loading
  );

  observer.observe(el);

  for (const name of eventNames) {
    window.addEventListener(name, () => {
      if (hasRendered) run();
    });
  }

  return el;
}
```

```js
display(
  mountReactive("hero", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="hero__media skeleton-shimmer"></div>`;
      return;
    }

    const heroVideo = await heroVideoPromise;
    if (!isCurrent()) return;

    el.innerHTML = `
      <div class="hero__media">
        <video
          class="hero__video"
          src="${heroVideo}"
          autoplay
          muted
          loop
          playsinline
        ></video>
      </div>

      <div class="hero__overlay">
        <div class="hero__content">
          <p class="hero__eyebrow">Open data insights</p>
          <h1 class="hero__title">PQ Explorer</h1>
          <p class="hero__subtitle">
            A data-driven perspective on the questions asked in Parliament.
          </p>
        </div>
      </div>
    `;
  })
);
```

```js
display(renderSectionNav("overview"));
```

<div class="prose-block">

<p><a class="link-arrow" href="https://www.oireachtas.ie/en/debates/questions/">Parliamentary questions</a> are an intrinsic part of Parliament and each year tens of thousands of questions are asked by Members. They are directed to each Department and answered by the appropriate Minister or Minister of State.</p>

<p>PQ Explorer is part of our series of <strong><a class="link-arrow" href="https://bubcass.github.io/open-data-insights/" target="_self">Open Data Insights</a>.</strong></p>
</div>

<div class="prose-block">

<h2> Parliamentary questions</h2>

<p>Questions are directed to all Departments but some Departments get more than others. Questions designated for oral reply may be heard in plenary sessions of the Dáil but the vast majority of questions are answered in written replies.</p>

<p>Take a look with our interactive overview of the questions asked by Members for each year. Visuals are rendered in real time using information from the Oireachtas open data API.</p>

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
  mountReactive("prose-block reactive-prose", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="text-skeleton">
          <div class="text-skeleton__line text-skeleton__line--w100 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w72 skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const summary = await getSummary();
    const isOral = getVariantKey() === "oral";

    if (!isCurrent()) return;

    if (!summary) {
      el.innerHTML = `<p>No summary data available for this selection.</p>`;
      return;
    }

    el.innerHTML = `
      <p>
        In <strong>${summary.year}</strong>, the total number of ${
          isOral ? "oral " : ""
        }parliamentary questions submitted, replied to and published to the web is <strong>${format(summary.yearlyTotal)}</strong>.
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
  mountReactive("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="chart-skeleton chart-skeleton--bars">
          <div class="chart-skeleton__bar skeleton-shimmer"></div>
          <div class="chart-skeleton__bar skeleton-shimmer"></div>
          <div class="chart-skeleton__bar skeleton-shimmer"></div>
          <div class="chart-skeleton__bar skeleton-shimmer"></div>
          <div class="chart-skeleton__bar skeleton-shimmer"></div>
          <div class="chart-skeleton__bar skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const links = await getSankeyLinks();

    if (!isCurrent()) return;

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
    debounceMs: 50
  })
);
```

</div>

<div class="prose-block">

## Explore by Department

</div>

```js
display(
  mountReactive("prose-block reactive-prose", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="text-skeleton">
          <div class="text-skeleton__line text-skeleton__line--w100 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w92 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w84 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w72 skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const summary = await getSummary();
    const isOral = getVariantKey() === "oral";

    if (!isCurrent()) return;

    if (!summary) {
      el.innerHTML = `<p>No summary data available for this selection.</p>`;
      return;
    }

    el.innerHTML = `
      ${
        !isOral
          ? `<p>This period covers <strong>${summary.year}</strong>, when the total number of <strong>parliamentary questions submitted, replied to and published to the web</strong> is <strong>${format(summary.yearlyTotal)}</strong>. This equates to an <strong>average of ${format(summary.averagePerSittingDay)} being published for each sitting day</strong>.</p>`
          : ""
      }

      <p>
        ${
          isOral
            ? `This period covers <strong>${summary.year}</strong>, when the total number of <strong>oral parliamentary questions submitted, replied to and published to the web</strong> is <strong>${format(summary.yearlyTotal)}</strong>. This equates to an <strong>average of ${format(summary.averagePerSittingDay)} being published for each sitting day</strong>.`
            : `Of the total, <strong>${format(summary.oralPQs)}</strong>, or an average of <strong>${format(summary.averageOralPerSittingDay)} for each sitting day</strong>, were questions originally designated for <strong>oral reply</strong>.`
        }
        The most popular question topic this year for the selected options is <strong>${summary.mostPopularHeading}</strong>.
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
  mountDeferred("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="chart-skeleton chart-skeleton--circles skeleton-shimmer" style="height:700px"></div>`;
      return;
    }

    const packed = await getPackedData();

    if (!isCurrent()) return;

    if (!packed?.children?.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      packedCircleChart(packed, { width: 800, height: 700 })
    );
  }, {
    loading: () => chartPlaceholder(700),
    eventName: "pq:change"
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
  mountDeferred("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="chart-skeleton chart-skeleton--blocks skeleton-shimmer" style="height:520px"></div>`;
      return;
    }

    const treemap = await getTreemapData();

    if (!isCurrent()) return;

    if (!treemap?.children?.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      zoomableTreemap(treemap, { width: 650, height: 520 })
    );
  }, {
    loading: () => chartPlaceholder(520),
    eventName: "pq:change"
  })
);
```

</div>

<div class="prose-block">
  All parliamentary questions can be searched on a
  <a
    class="link-arrow"
    href="https://www.oireachtas.ie/en/debates/questions/"
    target="_blank"
    rel="noreferrer"
  >
    dedicated questions page
  </a>.
  All data are from the
  <a
    class="link-arrow"
    href="https://api.oireachtas.ie/"
    target="_blank"
    rel="noreferrer"
  >
    Oireachtas open data API
  </a>.
</div>

```js
display(
  mountReactive("download-block", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="text-skeleton">
          <div class="text-skeleton__line text-skeleton__line--w72 skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const href = await getDownloadHref();
    const filename = getDownloadFilename();

    if (!isCurrent()) return;

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

```
