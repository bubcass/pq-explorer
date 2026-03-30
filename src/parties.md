---
title: PQ Explorer | Parties
header: false
sidebar: false
footer: false
toc: false
---
```js
import * as d3 from "npm:d3";
import { bubbleChart } from "./components/bubble-chart.js";
import { pqControls } from "./components/pq-controls.js";

if (typeof window !== "undefined" && !window.__pqPartiesResizeObserver) {
  window.__pqPartiesResizeObserver = new ResizeObserver(([entry]) => {
    parent.postMessage({ height: entry.target.scrollHeight }, "*");
  });

  window.__pqPartiesResizeObserver.observe(document.body);
}

const format = d3.format(",d");
const heroVideo = await FileAttachment("media/PQs.mp4").url();

const partyRollups = {
  2025: await FileAttachment("data/pq/2025/rollup-deputies.json").json(),
  2026: await FileAttachment("data/pq/2026/rollup-deputies.json").json()
};

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

const partyColorMap = new Map([
  ["Fianna Fáil", "#2c8737"],
  ["Sinn Féin", "#088460"],
  ["Fine Gael", "#303591"],
  ["Independent", "#666666"],
  ["Labour Party", "#c82832"],
  ["Social Democrats", "#782b81"],
  ["Independent Ireland", "#087b87"],
  ["People Before Profit-Solidarity", "#be417d"],
  ["Aontú", "#b35400"],
  ["100% RDR", "#985564"],
  ["Green Party", "#6c7e26"]
]);

if (!window.pqPartiesState) {
  window.pqPartiesState = {
    year: 2026,
    questionType: "all"
  };
}

function getState() {
  return window.pqPartiesState;
}

function getVariantKey() {
  return getState().questionType === "oral" ? "oral" : "all";
}

function getSummary() {
  return summaries[getState().year]?.[getVariantKey()] ?? null;
}

function getYearRows() {
  return partyRollups[getState().year] ?? [];
}

function getPartyRows() {
  const rows = getYearRows();
  const variant = getVariantKey();

  const filtered =
    variant === "all"
      ? rows
      : rows.filter(
          (d) => String(d.questionType ?? "").trim().toLowerCase() === variant
        );

  return Array.from(
    d3.rollup(
      filtered,
      (group) => ({
        party: group[0].party || "Independent",
        value: d3.sum(group, (d) => d.value),
        members: group.length
      }),
      (d) => d.party || "Independent"
    ),
    ([, value]) => value
  ).sort((a, b) => d3.descending(a.value, b.value));
}

function getPartyOrder(rows) {
  return rows.map((d) => d.party);
}

function getPartyColors(rows) {
  return rows.map((d) => partyColorMap.get(d.party) ?? "#666666");
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
  const {
    debounceMs = 50,
    loadingHtml = "",
    loadingDelayMs = 100,
    eventName = "pq-parties:change"
  } = options;

  const eventNames = Array.isArray(eventName) ? eventName : [eventName];

  const el = document.createElement("div");
  if (className) el.className = className;

  let timeoutId = null;

  const run = () => {
    let didRender = false;

    const loadingTimer = setTimeout(() => {
      if (!didRender && loadingHtml) {
        if (typeof loadingHtml === "string") {
          el.innerHTML = loadingHtml;
        } else {
          el.replaceChildren(loadingHtml.cloneNode(true));
        }
      }
    }, loadingDelayMs);

    requestAnimationFrame(() => {
      Promise.resolve(renderFn(el)).finally(() => {
        didRender = true;
        clearTimeout(loadingTimer);
      });
    });
  };

  run();

  const onChange = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(run, debounceMs);
  };

  for (const name of eventNames) {
    window.addEventListener(name, onChange);
  }

  return el;
}
```

```js
{
  const hero = document.createElement("section");
  hero.className = "hero";

  hero.innerHTML = `
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
        <p class="hero__eyebrow">Stór | Open data insights</p>
        <h1 class="hero__title">PQ Explorer | Parties</h1>
        <p class="hero__subtitle">
          A data-driven perspective on the questions asked in Parliament.
        </p>
      </div>
    </div>
  `;

  display(hero);
}
```

```js
display(
  mountReactive("prose-block reactive-prose", (el) => {
    const summary = getSummary();
    const isOral = getVariantKey() === "oral";

    if (!summary) {
      el.innerHTML = `<p>No summary data available for this selection.</p>`;
      return;
    }

    el.innerHTML = `
      <p>In <strong>${summary.year}</strong>, the total number of ${
        isOral ? "oral " : ""
      }parliamentary questions submitted by Deputies, replied to and published to the web is <strong>${format(summary.yearlyTotal)}</strong>.</p>
      <p>
        Of the total, <strong>${format(summary.oralPQs)}</strong>, or an average of <strong>${format(summary.averageOralPerSittingDay)} for each sitting day</strong>, were questions originally designated for <strong>oral reply</strong>. The number of questions asked by Deputies may vary considerably and some, such as those holding Cabinet or ministerial positions, may not ask any questions.
      </p>
      <h2>Explore by party</h2>
      <p>
        Select a year and question type, then explore the range below by hovering over circles, sized by the number of questions asked by Members belonging to each party.
      </p>
    `;
  })
);
```

<div class="prose-block controls-block">

```js
pqControls({
  state: window.pqPartiesState,
  onChange: () => {
    window.dispatchEvent(new CustomEvent("pq-parties:change"));
  }
})
```

</div>

<div class="chart-block">

```js
display(
  mountReactive("", (el) => {
    const rows = getPartyRows();

    if (!rows.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      bubbleChart(rows, {
        width: 620,
        height: 620,
        label: (d) => [d.party, d.value.toLocaleString("en-IE")].join("\n"),
        value: (d) => d.value,
        group: (d) => d.party,
        groups: getPartyOrder(rows),
        colors: getPartyColors(rows),
        title: (d) =>
          `${d.party} Members asked ${d.value.toLocaleString("en-IE")} parliamentary questions in ${getState().year}`,
        link: null
      })
    );
  }, {
    loadingHtml: chartPlaceholder(620),
    loadingDelayMs: 80
  })
);
```

</div>

<div class="prose-block">
  <p class="chart-caption">
    Circles denote political parties, sized by the number of parliamentary questions asked by Members belonging to each party in the selected year and question type.
  </p>
</div>

<div class="prose-block">
  All parliamentary questions can be searched on a <a href="https://www.oireachtas.ie/en/debates/questions/" target="_blank" rel="noreferrer">
      dedicated questions page</a>. All data are from the <a href="https://api.oireachtas.ie/" target="_blank" rel="noreferrer">
    Oireachtas open data API
  </a>.
</div>

```js
{
  const wrap = document.createElement("div");
  wrap.className = "explore-links-block";

  wrap.innerHTML = `
    <div class="explore-links-grid">
      <a class="explore-tile" href="./">
        <div class="explore-tile-head">
          <span class="explore-tile-title">Explore: Overview</span>
          <span class="explore-tile-arrow" aria-hidden="true">↗</span>
        </div>
      </a>

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
    </div>
  `;

  display(wrap);
}
```
