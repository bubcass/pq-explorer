---
title: PQ Explorer | Constituencies
header: false
sidebar: false
footer: false
toc: false
---
```js
import * as d3 from "npm:d3";
import { pqControls } from "./components/pq-controls.js";

if (typeof window !== "undefined" && !window.__pqConstituenciesResizeObserver) {
  window.__pqConstituenciesResizeObserver = new ResizeObserver(([entry]) => {
    parent.postMessage({ height: entry.target.scrollHeight }, "*");
  });
  window.__pqConstituenciesResizeObserver.observe(document.body);
}

const format = d3.format(",d");
const heroVideo = await FileAttachment("media/PQs.mp4").url();

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

if (!window.pqConstituenciesState) {
  window.pqConstituenciesState = { year: 2026, questionType: "all" };
}

function getState() { return window.pqConstituenciesState; }
function getVariantKey() { return getState().questionType === "oral" ? "oral" : "all"; }
function getSummary() { return summaries[getState().year]?.[getVariantKey()] ?? null; }

function chartPlaceholder(height = 320, text = "Chart coming soon…") {
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
  const { debounceMs = 50, eventName = "pq-constituencies:change" } = options;
  const eventNames = Array.isArray(eventName) ? eventName : [eventName];
  const el = document.createElement("div");
  if (className) el.className = className;
  let timeoutId = null;

  const run = () => requestAnimationFrame(() => Promise.resolve(renderFn(el)));
  run();

  const onChange = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(run, debounceMs);
  };

  for (const name of eventNames) window.addEventListener(name, onChange);
  return el;
}
```

```js
{
  const hero = document.createElement("section");
  hero.className = "hero";
  hero.innerHTML = `
    <div class="hero__media">
      <video class="hero__video" src="${heroVideo}" autoplay muted loop playsinline></video>
    </div>
    <div class="hero__overlay">
      <div class="hero__content">
        <p class="hero__eyebrow">Stór | Open data insights</p>
        <h1 class="hero__title">PQ Explorer | Constituencies</h1>
        <p class="hero__subtitle">A data-driven perspective on the questions asked in Parliament.</p>
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
      <p>In <strong>${summary.year}</strong>, the total number of ${isOral ? "oral " : ""}parliamentary questions submitted by Deputies, replied to and published to the web is <strong>${format(summary.yearlyTotal)}</strong>.</p>
      <p>Of the total, <strong>${format(summary.oralPQs)}</strong>, or an average of <strong>${format(summary.averageOralPerSittingDay)} for each sitting day</strong>, were questions originally designated for <strong>oral reply</strong>. The number of questions asked by Deputies may vary considerably between constituencies.</p>
      <h2>Explore by Constituency</h2>
      <p>Select a year and question type. This page will explore how parliamentary questions are distributed across constituencies, using custom visualisations built from the Oireachtas open data API.</p>
    `;
  })
);
```

<div class="prose-block controls-block">

```js
pqControls({
  state: window.pqConstituenciesState,
  onChange: () => window.dispatchEvent(new CustomEvent("pq-constituencies:change"))
})
```

</div>

<div class="chart-block">

```js
display(
  mountReactive("", (el) => {
    el.replaceChildren(chartPlaceholder(520, "Constituency visualisation coming soon…"));
  })
);
```

</div>

<div class="prose-block">
  All parliamentary questions can be searched on a <a href="https://www.oireachtas.ie/en/debates/questions/" target="_blank" rel="noreferrer">dedicated questions page</a>. All data are from the <a href="https://api.oireachtas.ie/" target="_blank" rel="noreferrer">Oireachtas open data API</a>.
</div>

```js
{
  const wrap = document.createElement("div");
  wrap.className = "explore-links-block";
  wrap.innerHTML = `
    <div class="explore-links-grid">
      <a class="explore-tile" href="./"><div class="explore-tile-head"><span class="explore-tile-title">Explore: Overview</span><span class="explore-tile-arrow" aria-hidden="true">↗</span></div></a>
      <a class="explore-tile" href="./deputies"><div class="explore-tile-head"><span class="explore-tile-title">Explore: Deputies</span><span class="explore-tile-arrow" aria-hidden="true">↗</span></div></a>
      <a class="explore-tile" href="./parties"><div class="explore-tile-head"><span class="explore-tile-title">Explore: Parties</span><span class="explore-tile-arrow" aria-hidden="true">↗</span></div></a>
    </div>
  `;
  display(wrap);
}
```
