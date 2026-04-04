---
title: Constituencies
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

ensureLeafletCss();

if (typeof window !== "undefined" && !window.__pqConstituenciesResizeObserver) {
  window.__pqConstituenciesResizeObserver = new ResizeObserver(([entry]) => {
    parent.postMessage({ height: entry.target.scrollHeight }, "*");
  });

  window.__pqConstituenciesResizeObserver.observe(document.body);
}

const format = d3.format(",d");
const heroVideoPromise = FileAttachment("media/PQs.mp4").url();
const constituenciesGeoPromise = FileAttachment("data/geo/constituencies.json").json();

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

const constituencyMembersData = {
  2025: {
    all: FileAttachment("data/pq/2025/constituency-members-all.json").json(),
    oral: FileAttachment("data/pq/2025/constituency-members-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/constituency-members-all.json").json(),
    oral: FileAttachment("data/pq/2026/constituency-members-oral.json").json()
  }
};

const constituencySummaryData = {
  2025: {
    all: FileAttachment("data/pq/2025/constituency-summary-all.json").json(),
    oral: FileAttachment("data/pq/2025/constituency-summary-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/constituency-summary-all.json").json(),
    oral: FileAttachment("data/pq/2026/constituency-summary-oral.json").json()
  }
};

const constituencyDownloadData = {
  2025: {
    all: FileAttachment("data/pq/2025/constituency-download-all.json").json(),
    oral: FileAttachment("data/pq/2025/constituency-download-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/constituency-download-all.json").json(),
    oral: FileAttachment("data/pq/2026/constituency-download-oral.json").json()
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

const constituencyRecentQuestionsData = {
  2025: {
    all: FileAttachment("data/pq/2025/constituency-recent-questions-all.json").json(),
    oral: FileAttachment("data/pq/2025/constituency-recent-questions-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/constituency-recent-questions-all.json").json(),
    oral: FileAttachment("data/pq/2026/constituency-recent-questions-oral.json").json()
  }
};

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

async function getMembersData() {
  return await constituencyMembersData[getState().year]?.[getVariantKey()] ?? [];
}

async function getConstituencySummaryRows() {
  return await constituencySummaryData[getState().year]?.[getVariantKey()] ?? [];
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanConstituencyName(name) {
  return clean(name).replace(/\s*\(\d+\)\s*$/, "");
}

async function getConstituenciesGeo() {
  return await constituenciesGeoPromise;
}

async function getConstituencyOptions() {
  const constituenciesGeo = await getConstituenciesGeo();

  return [
    ...new Set(
      constituenciesGeo.features
        .map((d) => cleanConstituencyName(d?.properties?.ENG_NAME_VALUE))
        .filter(Boolean)
    )
  ].sort(d3.ascending);
}

function formatIrishDate(isoDate) {
  if (!isoDate) return "—";

  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;

  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
}

async function getSelectedConstituencyTopHeadings(limit = 15) {
  const summary = await getSelectedConstituencySummary();
  return (summary?.topHeadings ?? []).slice(0, limit);
}

async function ensureValidConstituencySelection() {
  const options = await getConstituencyOptions();
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

async function getFilteredMembers() {
  const selected = await ensureValidConstituencySelection();
  if (!selected) return [];

  return (await getMembersData())
    .filter((d) => cleanConstituencyName(d.constituency) === selected)
    .sort((a, b) => d3.ascending(a.memberName ?? "", b.memberName ?? ""));
}

async function getSelectedConstituencySummary() {
  const selected = await ensureValidConstituencySelection();
  if (!selected) return null;

  return (
    (await getConstituencySummaryRows()).find(
      (d) => cleanConstituencyName(d.constituency) === selected
    ) ?? null
  );
}

async function getFilteredConstituencyGeo() {
  const selected = await ensureValidConstituencySelection();
  const constituenciesGeo = await getConstituenciesGeo();

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

async function getRecentQuestionsForSelectedConstituency() {
  const selected = await ensureValidConstituencySelection();
  const rows =
    await constituencyRecentQuestionsData[getState().year]?.[getVariantKey()] ?? [];

  return (
    rows.find(
      (d) => cleanConstituencyName(d.constituency) === selected
    )?.questions ?? []
  );
}

async function getDownloadRowsForSelectedConstituency() {
  const selected = await ensureValidConstituencySelection();
  if (!selected) return [];

  const rows =
    await constituencyDownloadData[getState().year]?.[getVariantKey()] ?? [];

  return (
    rows.find((d) => cleanConstituencyName(d.constituency) === selected)
      ?.questions ?? []
  );
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildConstituencyCsv(rows) {
  const headers = [
    "date",
    "deputy",
    "department",
    "heading",
    "question",
    "url"
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(",")
    )
  ];

  return `\uFEFF\${lines.join("\n")}`;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function withPreservedScroll(fn) {
  const x = window.scrollX;
  const y = window.scrollY;

  await fn();

  const restore = () => window.scrollTo(x, y);

  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(() => {
      restore();
      setTimeout(restore, 0);
      setTimeout(restore, 60);
      setTimeout(restore, 150);
    });
  });
}

function mountReactive(className, renderFn, options = {}) {
  const {
    eventName = "pq-constituencies:change",
    skeletonDelay = 120
  } = options;
  const events = Array.isArray(eventName) ? eventName : [eventName];

  const el = document.createElement("div");
  if (className) el.className = className;

  let runId = 0;
  let hasRenderedOnce = false;

  const run = () => {
    const currentRun = ++runId;

    requestAnimationFrame(async () => {
      const isCurrent = () => currentRun === runId;

      if (!hasRenderedOnce) {
        await renderFn(el, { isCurrent, skeletonOnly: true });
        await new Promise((resolve) => setTimeout(resolve, skeletonDelay));

        if (!isCurrent()) return;
      }

      await renderFn(el, { isCurrent, skeletonOnly: false });

      if (isCurrent()) {
        hasRenderedOnce = true;
      }
    });
  };

  run();

  for (const event of events) {
    window.addEventListener(event, run);
  }

  return el;
}
```

```js
display(
  mountReactive("hero", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="hero__media skeleton-shimmer"></div>`;
      return;
    }

    const heroVideo = await heroVideoPromise;

    if (!isCurrent()) return;

    el.innerHTML = `
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
  }, { skeletonDelay: 120 })
);
```

```js
display(
  mountReactive("prose-block reactive-prose", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="text-skeleton">
          <div class="text-skeleton__line text-skeleton__line--lg text-skeleton__line--w100 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w92 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w84 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w72 skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const summary = await summaries[getState().year]?.[getVariantKey()] ?? null;
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
  let lastOptionsKey = "";

  async function renderConstituencySelect() {
    wrap.replaceChildren();

    const label = document.createElement("label");
    label.className = "control";

    const labelText = document.createElement("span");
    labelText.className = "control-label";
    labelText.textContent = "Constituency";

    const select = document.createElement("select");
    select.className = "control-input";

    const options = await getConstituencyOptions();
    const selected = await ensureValidConstituencySelection();

    for (const value of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === selected;
      select.appendChild(option);
    }

    select.addEventListener("change", async (event) => {
      window.pqConstituenciesState.selectedConstituency =
        event.target.value || null;

      await withPreservedScroll(async () => {
        dispatchConstituencyChange();
      });
    });

    label.appendChild(labelText);
    label.appendChild(select);
    wrap.appendChild(label);

    lastOptionsKey = options.join("||");
  }

  renderConstituencySelect();

  window.addEventListener("pq-constituencies:change", async () => {
    const options = await getConstituencyOptions();
    const nextOptionsKey = options.join("||");

    if (nextOptionsKey !== lastOptionsKey) {
      await withPreservedScroll(async () => {
        await renderConstituencySelect();
      });
    }
  });

  display(wrap);
}
```

</div>

<div class="prose-block controls-block">

```js
pqControls({
  state: window.pqConstituenciesState,
  onChange: async () => {
    await withPreservedScroll(async () => {
      dispatchChange();
    });
  }
})
```

</div>

```js
display(
  mountReactive("constituency-map-block", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="map-skeleton skeleton-shimmer"></div>`;
      return;
    }

    const geo = await getFilteredConstituencyGeo();

    if (!isCurrent()) return;

    el.replaceChildren(
      constituencyMap(geo, { height: 420 })
    );
  }, {
    eventName: ["pq-constituencies:change", "pq-constituencies:constituency-change"]
  })
);
```

```js
display(
  mountReactive("constituency-members-grid", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="cards-skeleton">
          <div class="cards-skeleton__inner">
            ${Array.from({ length: 3 }).map(() => `
              <div class="cards-skeleton__card">
                <div class="cards-skeleton__avatar skeleton-shimmer"></div>
                <div class="cards-skeleton__line cards-skeleton__line--name skeleton-shimmer"></div>
                <div class="cards-skeleton__line skeleton-shimmer"></div>
                <div class="cards-skeleton__line cards-skeleton__line--short skeleton-shimmer"></div>
                <div class="cards-skeleton__line skeleton-shimmer"></div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    const members = await getFilteredMembers();

    if (!isCurrent()) return;

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

      const metaRows = [
        ["Party", party],
        ["Questions asked", format(member.questionCount ?? 0)],
        ...(member.showServedUntil
          ? [["Served until", formatIrishDate(member.endDate)]]
          : [])
      ];

      const metaHtml = metaRows
        .map(
          ([label, value]) => `
            <div class="constituency-member-card__meta-item">
              <span class="constituency-member-card__meta-label">${label}</span>
              <span class="constituency-member-card__meta-value">${value}</span>
            </div>
          `
        )
        .join("");

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
              ${metaHtml}
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
  mountReactive("prose-block reactive-prose", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="text-skeleton">
          <div class="text-skeleton__line text-skeleton__line--w100 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w92 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w84 skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const selected = await ensureValidConstituencySelection();
    const members = await getFilteredMembers();
    const summary = await getSelectedConstituencySummary();
    const isOral = getVariantKey() === "oral";
    const questionLabel = isOral ? "oral questions" : "parliamentary questions";
    const topicQuestionLabel = isOral ? "oral questions" : "questions";
    const year = getState().year;

    if (!isCurrent()) return;

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
  mountReactive("chart-block", async (el, { isCurrent, skeletonOnly }) => {
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

    const summary = await getSelectedConstituencySummary();
    const isOral = getVariantKey() === "oral";
    const rows = (summary?.topHeadings ?? []).slice(0, 15);

    if (!isCurrent()) return;

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
          fill: "#1f77b4",
          ariaHidden: true
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
        Plot.ruleX([0], {ariaHidden: true})
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
display(
  mountReactive("prose-block", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="text-skeleton">
          <div class="text-skeleton__line text-skeleton__line--w100 skeleton-shimmer"></div>
          <div class="text-skeleton__line text-skeleton__line--w84 skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const selected = await ensureValidConstituencySelection();

    if (!isCurrent()) return;

    el.innerHTML = `
      <p>
        Take a closer look at some of the most recent questions asked by representatives in
        <strong>${selected}</strong>, or see all questions on our
        <a
          href="https://www.oireachtas.ie/en/debates/questions/"
          target="_blank"
          rel="noreferrer"
        >
          dedicated questions page
        </a>.
      </p>
    `;
  }, {
    eventName: [
      "pq-constituencies:change",
      "pq-constituencies:constituency-change"
    ]
  })
);
```

```js
display(
  mountReactive("chart-block", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `
        <div class="table-skeleton">
          ${Array.from({ length: 6 }).map(() => `
            <div class="table-skeleton__row">
              <div class="table-skeleton__cell skeleton-shimmer"></div>
              <div class="table-skeleton__cell skeleton-shimmer"></div>
              <div class="table-skeleton__cell skeleton-shimmer"></div>
              <div class="table-skeleton__cell skeleton-shimmer"></div>
            </div>
          `).join("")}
        </div>
      `;
      return;
    }

    const rows = await getRecentQuestionsForSelectedConstituency();

    if (!isCurrent()) return;

    if (!rows.length) {
      el.innerHTML = `<p class="chart-loading">No recent questions available.</p>`;
      return;
    }

    const table = document.createElement("table");
    table.className = "observablehq";

    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Deputy</th>
          <th>Heading</th>
          <th>Question</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (d) => `
              <tr>
                <td>${formatIrishDate(d.date)}</td>
                <td>${d.deputy}</td>
                <td><strong>${d.heading}</strong></td>
                <td>
                  <a href="${d.url}" target="_blank" rel="noreferrer">
                    ${d.question}
                  </a>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    `;

    el.replaceChildren(table);
  }, {
    eventName: [
      "pq-constituencies:change",
      "pq-constituencies:constituency-change"
    ]
  })
);
```

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
  mountReactive("download-block", async (el, { isCurrent, skeletonOnly }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="text-skeleton"><div class="text-skeleton__line text-skeleton__line--w72 skeleton-shimmer"></div></div>`;
      return;
    }

    const selected = await ensureValidConstituencySelection();
    const rows = await getDownloadRowsForSelectedConstituency();

    if (!isCurrent()) return;

    if (!selected || !rows.length) {
      el.innerHTML = "";
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pq-download";
    button.textContent = `Download the data for ${selected} TDs`;

    button.addEventListener("click", () => {
      const csv = buildConstituencyCsv(rows);
      const filename = `pq_${selected
        .replace(/\s+/g, "_")
        .toLowerCase()}_${getState().year}_${getVariantKey()}.csv`;

      downloadTextFile(filename, csv, "text/csv;charset=utf-8;");
    });

    el.replaceChildren(button);
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
