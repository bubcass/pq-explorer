---
title: PQ Explorer | Constituencies
header: false
sidebar: false
footer: false
toc: false
---

```js
import * as d3 from "npm:d3";
import * as Plot from "npm:@observablehq/plot";
import { pqControls } from "./components/pq-controls.js";
import { constituencyMap } from "./components/constituency-map.js";

async function ensureLeafletCss() {
  if (typeof document === "undefined") return;

  const existing = document.getElementById("leaflet-css-cdn");
  if (existing) {
    if (existing.dataset.loaded === "true") return;

    await new Promise((resolve, reject) => {
      existing.addEventListener(
        "load",
        () => {
          existing.dataset.loaded = "true";
          resolve();
        },
        { once: true }
      );
      existing.addEventListener("error", reject, { once: true });
    });

    return;
  }

  await new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = "leaflet-css-cdn";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

    link.addEventListener(
      "load",
      () => {
        link.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );

    link.addEventListener("error", reject, { once: true });

    document.head.appendChild(link);
  });
}

await ensureLeafletCss();

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

const constituencyMembersData = {
  2025: {
    all: await FileAttachment("data/pq/2025/constituency-members-all.json").json(),
    oral: await FileAttachment("data/pq/2025/constituency-members-oral.json").json()
  },
  2026: {
    all: await FileAttachment("data/pq/2026/constituency-members-all.json").json(),
    oral: await FileAttachment("data/pq/2026/constituency-members-oral.json").json()
  }
};

const constituencySummaryData = {
  2025: {
    all: await FileAttachment("data/pq/2025/constituency-summary-all.json").json(),
    oral: await FileAttachment("data/pq/2025/constituency-summary-oral.json").json()
  },
  2026: {
    all: await FileAttachment("data/pq/2026/constituency-summary-all.json").json(),
    oral: await FileAttachment("data/pq/2026/constituency-summary-oral.json").json()
  }
};

const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();

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

if (!window.pqConstituenciesState) {
  window.pqConstituenciesState = {
    year: 2026,
    questionType: "all",
    selectedConstituency: null
  };
}

function getState() {
  return window.pqConstituenciesState;
}

function getVariantKey() {
  return getState().questionType === "oral" ? "oral" : "all";
}

function getMembersData() {
  return constituencyMembersData[getState().year]?.[getVariantKey()] ?? [];
}

function getConstituencySummaryRows() {
  return constituencySummaryData[getState().year]?.[getVariantKey()] ?? [];
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanConstituencyName(name) {
  return clean(name).replace(/\s*\(\d+\)\s*$/, "");
}

function getConstituencyOptions() {
  return [
    ...new Set(
      constituenciesGeo.features
        .map((d) => cleanConstituencyName(d?.properties?.ENG_NAME_VALUE))
        .filter(Boolean)
    )
  ].sort(d3.ascending);
}

function getSelectedConstituencyTopHeadings(limit = 15) {
  const summary = getSelectedConstituencySummary();
  return (summary?.topHeadings ?? []).slice(0, limit);
}

function ensureValidConstituencySelection() {
  const options = getConstituencyOptions();
  const state = getState();

  if (!options.length) {
    state.selectedConstituency = null;
    return null;
  }

  if (state.selectedConstituency && options.includes(state.selectedConstituency)) {
    return state.selectedConstituency;
  }

  state.selectedConstituency = options[0];
  return state.selectedConstituency;
}

function getFilteredMembers() {
  const selected = ensureValidConstituencySelection();
  if (!selected) return [];

  return getMembersData()
    .filter((d) => cleanConstituencyName(d.constituency) === selected)
    .sort((a, b) => d3.ascending(a.memberName ?? "", b.memberName ?? ""));
}

function getSelectedConstituencySummary() {
  const selected = ensureValidConstituencySelection();
  if (!selected) return null;

  return (
    getConstituencySummaryRows().find(
      (d) => cleanConstituencyName(d.constituency) === selected
    ) ?? null
  );
}

function getFilteredConstituencyGeo() {
  const selected = ensureValidConstituencySelection();

  return {
    type: "FeatureCollection",
    features: constituenciesGeo.features.filter(
      (feature) =>
        cleanConstituencyName(feature?.properties?.ENG_NAME_VALUE) === selected
    )
  };
}

function dispatchChange() {
  window.dispatchEvent(new CustomEvent("pq-constituencies:change"));
}

function dispatchConstituencyChange() {
  window.dispatchEvent(new CustomEvent("pq-constituencies:constituency-change"));
}

function mountReactive(className, renderFn, options = {}) {
  const { eventName = "pq-constituencies:change" } = options;
  const events = Array.isArray(eventName) ? eventName : [eventName];

  const el = document.createElement("div");
  if (className) el.className = className;

  const run = () => requestAnimationFrame(() => renderFn(el));
  run();

  for (const event of events) {
    window.addEventListener(event, run);
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
      <video class="hero__video" src="${heroVideo}" autoplay muted loop playsinline></video>
    </div>
    <div class="hero__overlay">
      <div class="hero__content">
        <p class="hero__eyebrow">Open data insights</p>
        <h1 class="hero__title">PQ Explorer: Constituencies</h1>
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
    const summary = summaries[getState().year]?.[getVariantKey()] ?? null;
    const isOral = getVariantKey() === "oral";

    if (!summary) {
      el.innerHTML = `<p>No summary data available for this selection.</p>`;
      return;
    }

    el.innerHTML = `
      <p>
        In <strong>${summary.year}</strong>, the total number of ${
          isOral ? "oral " : ""
        }parliamentary questions submitted by Deputies, replied to and published to the web is <strong>${format(summary.yearlyTotal)}</strong>.
      </p>
      <p>
        ${
          isOral
            ? `This is an average of <strong>${format(summary.averageOralPerSittingDay)}</strong> questions per sitting day originally designated for <strong>oral reply</strong>.`
            : `Of the total, <strong>${format(summary.oralPQs)}</strong>, or an average of <strong>${format(summary.averageOralPerSittingDay)}</strong> for each sitting day, were questions originally designated for <strong>oral reply</strong>.`
        }
        This page explores how parliamentary question activity varies across constituencies and the Members who represent them.
      </p>
      <h2>Explore by constituency</h2>
      <p>
        Select a constituency to explore how different parts of the State are represented in parliamentary questioning activity.
      </p>
    `;
  })
);
```


<div class="prose-block controls-block">

```js
{
  const wrap = document.createElement("div");

  function renderConstituencySelect() {
    wrap.replaceChildren();

    const label = document.createElement("label");
    label.className = "control";

    const labelText = document.createElement("span");
    labelText.className = "control-label";
    labelText.textContent = "Constituency";

    const select = document.createElement("select");
    select.className = "control-input";

    const options = getConstituencyOptions();
    const selected = ensureValidConstituencySelection();

    for (const value of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === selected;
      select.appendChild(option);
    }

    select.addEventListener("change", (event) => {
      window.pqConstituenciesState.selectedConstituency =
        event.target.value || null;
      dispatchConstituencyChange();
    });

    label.appendChild(labelText);
    label.appendChild(select);
    wrap.appendChild(label);
  }

  renderConstituencySelect();

  window.addEventListener("pq-constituencies:change", renderConstituencySelect);

  display(wrap);
}
```

</div>

<div class="prose-block controls-block">

```js
pqControls({
  state: window.pqConstituenciesState,
  onChange: dispatchChange
})
```

</div>


```js
display(
  mountReactive("constituency-map-block", (el) => {
    el.replaceChildren(
      constituencyMap(getFilteredConstituencyGeo(), { height: 420 })
    );
  }, {
    eventName: ["pq-constituencies:change", "pq-constituencies:constituency-change"]
  })
);
```


```js
display(
  mountReactive("constituency-members-grid", (el) => {
    const members = getFilteredMembers();

    const grid = document.createElement("div");
    grid.className = "constituency-members-grid__inner";

    for (const member of members) {
      const party = member.party || "Independent";
      const color = partyColorMap.get(party) ?? "#666666";

      const link = document.createElement("a");
      link.className = "constituency-member-card-link";
      link.href = member.memberUrl;
      link.target = "_blank";
      link.rel = "noreferrer";

      link.innerHTML = `
        <article class="constituency-member-card">
          <div class="constituency-member-card__media" style="--party-color:${color}">
            <div class="constituency-member-card__ring">
              <img
                class="constituency-member-card__image"
                src="https://data.oireachtas.ie/ie/oireachtas/member/id/${member.memberCode}/image/large"
                alt="${member.memberName}"
              />
            </div>
          </div>
          <div class="constituency-member-card__body">
            <div class="constituency-member-card__name">${member.memberName}</div>
            <div class="constituency-member-card__meta-grid">
              <div class="constituency-member-card__meta-item">
                <span class="constituency-member-card__meta-label">Party</span>
                <span class="constituency-member-card__meta-value">${party}</span>
              </div>
              <div class="constituency-member-card__meta-item">
                <span class="constituency-member-card__meta-label">Questions asked</span>
                <span class="constituency-member-card__meta-value">${format(member.questionCount ?? 0)}</span>
              </div>
            </div>
          </div>
        </article>
      `;

      grid.appendChild(link);
    }

    el.replaceChildren(grid);
  }, {
    eventName: ["pq-constituencies:change", "pq-constituencies:constituency-change"]
  })
);
```

```js
display(
  mountReactive("prose-block reactive-prose", (el) => {
    const selected = ensureValidConstituencySelection();
    const members = getFilteredMembers();
    const summary = getSelectedConstituencySummary();
    const isOral = getVariantKey() === "oral";
    const questionLabel = isOral ? "oral questions" : "parliamentary questions";
    const topicQuestionLabel = isOral ? "oral questions" : "questions";
    const year = getState().year;

    el.innerHTML = `
      <p>
        <strong>${selected}</strong> has <strong>${format(members.length)}</strong> TD${
          members.length === 1 ? "" : "s"
        } in the Thirty-fourth Dáil.
        Together they asked <strong>${format(summary?.questionCount ?? 0)}</strong>
        <strong>${questionLabel}</strong> in <strong>${year}</strong>, although the number of questions asked by Deputies may vary considerably.
        Some, such as those holding Cabinet, ministerial or official positions, may not ask any questions.
      </p>
      <p>
        In <strong>${year}</strong>, the most common topic for ${
          isOral ? "oral questions" : "questions"
        } was <strong>${summary?.topHeading ?? "—"}</strong>, which was asked about
        <strong>${summary?.topHeadingCount ?? "—"}</strong> times.
        Deputies in the constituency asked questions of the Department dealing with
        <strong>${summary?.topDepartment ?? "—"}</strong> matters most often, directing
        <strong>${summary?.topDepartmentCount ?? "—"}</strong>
        <strong>${topicQuestionLabel}</strong> to it.
      </p>
    `;
  }, {
    eventName: ["pq-constituencies:change", "pq-constituencies:constituency-change"]
  })
);
```

<div class="prose-block">
  <h2>Explore further</h2>
  <p>
    Take a look at the most common parliamentary question topics raised by Deputies representing the constituency.
  </p>
</div>

```js
display(
  mountReactive("chart-block", (el) => {
    const summary = getSelectedConstituencySummary();
    const isOral = getVariantKey() === "oral";
    const rows = (summary?.topHeadings ?? []).slice(0, 15);

    if (!rows.length) {
      el.innerHTML = `<p class="chart-loading">No topic data available for this constituency.</p>`;
      return;
    }

    const data = rows
      .map((d) => ({
        heading: d.heading,
        count: d.count,
        questionLabel:
          isOral
            ? d.count === 1
              ? "oral question"
              : "oral questions"
            : d.count === 1
            ? "question"
            : "questions"
      }))
      .sort((a, b) => b.count - a.count || a.heading.localeCompare(b.heading, "en"));

    const wrap = document.createElement("div");
    wrap.style.position = "relative";

    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.pointerEvents = "none";
    tooltip.style.opacity = "0";
    tooltip.style.background = "#fff";
    tooltip.style.border = "1px solid #ddd5c2";
    tooltip.style.padding = "8px 10px";
    tooltip.style.font = '12px "IBM Plex Sans", system-ui, sans-serif';
    tooltip.style.color = "#666666";
    tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
    tooltip.style.zIndex = "10";
    tooltip.style.maxWidth = "260px";
    tooltip.style.lineHeight = "1.35";

    const chart = Plot.plot({
      width: 860,
      height: Math.max(420, data.length * 34 + 90),
      marginTop: 10,
      marginRight: 30,
      marginBottom: 46,
      marginLeft: 260,
      x: {
        label: isOral ? "Number of oral questions" : "Number of questions",
        tickSize: 0,
        labelOffset: 40
      },
      y: {
        label: null,
        domain: data.map((d) => d.heading),
        tickSize: 0
      },
      style: {
        fontSize: "14px",
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        background: "transparent"
      },
      marks: [
        Plot.barX(data, {
          x: "count",
          y: "heading",
          inset: 0.8,
          rx: 0,
          fill: "#1f77b4"
        }),
        Plot.text(data, {
          x: "count",
          y: "heading",
          text: (d) => d.count.toLocaleString("en-IE"),
          dx: 8,
          textAnchor: "start",
          lineAnchor: "middle",
          fontSize: 12,
          fill: "#666666"
        }),
        Plot.ruleX([0])
      ]
    });

    wrap.appendChild(chart);
    wrap.appendChild(tooltip);
    el.replaceChildren(wrap);

    const bars = chart.querySelectorAll("rect");
    const barCount = data.length;
    const targetBars = Array.from(bars).slice(-barCount);

    targetBars.forEach((bar, i) => {
      const d = data[i];

      bar.style.cursor = "pointer";

      bar.addEventListener("mousemove", (event) => {
        tooltip.innerHTML = `
          <div><strong>${d.heading}</strong></div>
          <div>${d.count.toLocaleString("en-IE")} ${d.questionLabel}</div>
        `;
        tooltip.style.opacity = "1";

        const wrapRect = wrap.getBoundingClientRect();
        const x = event.clientX - wrapRect.left + 12;
        const y = event.clientY - wrapRect.top - 12;

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
      });

      bar.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
      });
    });
  }, {
    eventName: ["pq-constituencies:change", "pq-constituencies:constituency-change"]
  })
);
```

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
