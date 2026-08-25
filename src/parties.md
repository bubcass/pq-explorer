---
title: Parties
header: false
sidebar: false
footer: false
toc: false
---
```js
import * as d3 from "npm:d3@7.9.0";
import { bubbleChart } from "./components/bubble-chart.js";
import { pqControls } from "./components/pq-controls.js";
import { zoomableTreemap } from "./components/zoomable-treemap.js";
import { downloadButton } from "./components/download-button.js";
import { renderSectionNav } from "./components/section-nav.js";
import { enhanceHeroWithShare } from "./components/hero-share.js";

if (typeof window !== "undefined" && !window.__pqPartiesResizeObserver) {
  window.__pqPartiesResizeObserver = new ResizeObserver(([entry]) => {
    parent.postMessage({ height: entry.target.scrollHeight }, "*");
  });

  window.__pqPartiesResizeObserver.observe(document.body);
}

const format = d3.format(",d");
const heroVideoPromise = FileAttachment("media/PQs.mp4").url();

const partyRollups = {
  2025: FileAttachment("data/pq/2025/rollup-deputies.json").json(),
  2026: FileAttachment("data/pq/2026/rollup-deputies.json").json()
};

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

const partyTreemapData = {
  2025: {
    all: FileAttachment("data/pq/2025/treemap-parties-all.json").json(),
    oral: FileAttachment("data/pq/2025/treemap-parties-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/treemap-parties-all.json").json(),
    oral: FileAttachment("data/pq/2026/treemap-parties-oral.json").json()
  }
};

const partyDetailsData = {
  2025: {
    all: FileAttachment("data/pq/2025/party-details-all.json").json(),
    oral: FileAttachment("data/pq/2025/party-details-oral.json").json()
  },
  2026: {
    all: FileAttachment("data/pq/2026/party-details-all.json").json(),
    oral: FileAttachment("data/pq/2026/party-details-oral.json").json()
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
    questionType: "all",
    selectedParty: null
  };
}

function getState() {
  return window.pqPartiesState;
}

function getVariantKey() {
  return getState().questionType === "oral" ? "oral" : "all";
}

async function getSummary() {
  return await summaries[getState().year]?.[getVariantKey()] ?? null;
}

async function getYearRows() {
  return await partyRollups[getState().year] ?? [];
}

async function getPartyTreemapData() {
  return (
    await partyTreemapData[getState().year]?.[getVariantKey()] ?? {
      name: "Parliamentary Questions",
      children: []
    }
  );
}

async function getPartyDetailsRows() {
  return await partyDetailsData[getState().year]?.[getVariantKey()] ?? [];
}

async function getPartyRows() {
  const rows = await getYearRows();
  const variant = getVariantKey();

  let filtered;

  if (variant === "all") {
    const allRows = rows.filter(
      (d) => String(d.questionType ?? "").trim().toLowerCase() === "all"
    );

    filtered = allRows.length
      ? allRows
      : rows.filter((d) => {
          const q = String(d.questionType ?? "").trim().toLowerCase();
          return q === "oral" || q === "written";
        });
  } else {
    filtered = rows.filter(
      (d) => String(d.questionType ?? "").trim().toLowerCase() === variant
    );
  }

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

async function getPartyOptions() {
  return (await getPartyRows()).map((d) => ({
    value: d.party,
    label: d.party
  }));
}

async function ensureValidPartySelection() {
  const state = getState();
  const options = await getPartyOptions();

  if (!options.length) {
    state.selectedParty = null;
    return null;
  }

  if (state.selectedParty && options.some((d) => d.value === state.selectedParty)) {
    return state.selectedParty;
  }

  state.selectedParty = options[0].value;
  return state.selectedParty;
}

async function getSelectedPartyDetail() {
  const selected = await ensureValidPartySelection();
  if (!selected) return null;
  return (await getPartyDetailsRows()).find((d) => d.party === selected) ?? null;
}

function getPartyOrder(rows) {
  return rows.map((d) => d.party);
}

function getPartyColors(rows) {
  return rows.map((d) => partyColorMap.get(d.party) ?? "#666666");
}

function dispatchChange() {
  window.dispatchEvent(new CustomEvent("pq-parties:change"));
}

function dispatchPartyChange() {
  window.dispatchEvent(new CustomEvent("pq-parties:party-change"));
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
    eventName = "pq-parties:change",
    skeletonDelay = 120
  } = options;

  const eventNames = Array.isArray(eventName) ? eventName : [eventName];

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

  for (const name of eventNames) {
    window.addEventListener(name, onChange);
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
          <h1 class="hero__title">PQ Explorer: Parties</h1>
          <p class="hero__subtitle">
            A data-driven perspective on the questions asked in Parliament.
          </p>
        </div>
      </div>
    `;
    enhanceHeroWithShare(el, {title: "Parties — PQ Explorer"});
  })
);
```

```js
display(renderSectionNav("parties"));
```

```js
display(
  mountReactive("prose-block reactive-prose", async (el, { skeletonOnly, isCurrent }) => {
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
        }parliamentary questions submitted by Deputies, replied to and published to the web is <strong>${format(summary.yearlyTotal)}</strong>.
      </p>

      <p>
        ${
          isOral
            ? `This is an average of <strong>${format(summary.averageOralPerSittingDay)}</strong> questions per sitting day originally designated for <strong>oral reply</strong>.`
            : `Of the total, <strong>${format(summary.oralPQs)}</strong>, or an average of <strong>${format(summary.averageOralPerSittingDay)}</strong> for each sitting day, were questions originally designated for <strong>oral reply</strong>.`
        }
        The number of questions asked by Deputies may vary considerably and some, such as those holding Cabinet or ministerial positions, may not ask any questions.
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
  onChange: async () => {
    await withPreservedScroll(async () => {
      window.pqPartiesState.selectedParty = null;
      dispatchChange();
    });
  }
})
```

</div>

<div class="chart-block">

```js
display(
  mountReactive("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="chart-skeleton chart-skeleton--circles skeleton-shimmer" style="height:620px"></div>`;
      return;
    }

    const rows = await getPartyRows();

    if (!isCurrent()) return;

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
    debounceMs: 50
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
  <h3>Explore to topic and question level</h3>

  <p>
    <strong>Click through the squares to drill down</strong> by party, question topic, Deputy, date and the text of each parliamentary question as published.
  </p>

  <p>
    Click on the top panel to zoom out again.
  </p>
</div>

<div class="chart-block">

```js
display(
  mountReactive("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="chart-skeleton chart-skeleton--blocks skeleton-shimmer" style="height:520px"></div>`;
      return;
    }

    const data = await getPartyTreemapData();

    if (!isCurrent()) return;

    if (!data?.children?.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      zoomableTreemap(data, {
        width: 650,
        height: 520
      })
    );
  }, {
    debounceMs: 50
  })
);
```

</div>
<div class="prose-block">
  <h2>Explore further</h2>
</div>

<div class="prose-block controls-block">

```js
{
  const wrap = document.createElement("div");

  async function renderPartySelect() {
    wrap.replaceChildren();

    const label = document.createElement("label");
    label.className = "control";

    const labelText = document.createElement("span");
    labelText.className = "control-label";
    labelText.textContent = "Select a party";

    const select = document.createElement("select");
    select.className = "control-input";

    const options = await getPartyOptions();
    const selected = await ensureValidPartySelection();

    if (!options.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No parties available";
      select.appendChild(option);
      select.disabled = true;
    } else {
      for (const optionData of options) {
        const option = document.createElement("option");
        option.value = optionData.value;
        option.textContent = optionData.label;
        option.selected = optionData.value === selected;
        select.appendChild(option);
      }

      select.addEventListener("change", async (event) => {
        window.pqPartiesState.selectedParty = event.target.value || null;

        await withPreservedScroll(async () => {
          dispatchPartyChange();
        });
      });
    }

    label.appendChild(labelText);
    label.appendChild(select);
    wrap.appendChild(label);
  }

  renderPartySelect();

  window.addEventListener("pq-parties:change", async () => {
    await withPreservedScroll(async () => {
      await renderPartySelect();
    });
  });

  display(wrap);
}
```

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
        </div>
      `;
      return;
    }

    const detail = await getSelectedPartyDetail();
    const isOral = getVariantKey() === "oral";
    const questionLabel = isOral ? "oral questions" : "questions";

    if (!isCurrent()) return;

    if (!detail) {
      el.innerHTML = `<p>No data available for this party.</p>`;
      return;
    }

    el.innerHTML = `
      <p>
        In this period, <strong>${format(detail.memberCount)}</strong> <strong>${detail.party}</strong> ${
          detail.memberCount === 1 ? "Member" : "Members"
        } asked <strong>${format(detail.questionCount)}</strong> <strong>${questionLabel}</strong> across <strong>${format(detail.topHeadings?.length ?? 0)} topic headings</strong>.
      </p>

      <p>
        The most popular question heading from Members in this party is <strong>${detail.topHeading}</strong>, with <strong>${format(detail.topHeadingCount)} ${questionLabel}</strong> asked about the topic.
      </p>

      <p>
        The Department dealing with the most ${questionLabel} from the party is <strong>${detail.topDepartment}</strong>, with the Minister responding to <strong>${format(detail.topDepartmentCount)}</strong> ${questionLabel} in this period.
      </p>
    `;
  }, {
    eventName: ["pq-parties:change", "pq-parties:party-change"]
  })
);
```

```js
display(
  mountReactive("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="table-skeleton">${Array.from({ length: 8 }).map(() => `
        <div class="table-skeleton__row">
          <div class="table-skeleton__cell skeleton-shimmer"></div>
          <div class="table-skeleton__cell skeleton-shimmer"></div>
        </div>`).join("")}</div>`;
      return;
    }

    const detail = await getSelectedPartyDetail();
    const rows = detail?.topHeadings?.slice(0, 20) ?? [];

    if (!isCurrent()) return;

    if (!rows.length) {
      el.innerHTML = `<p class="chart-loading">No heading data available for this party.</p>`;
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "pq-table";

    table.innerHTML = `
      <thead>
        <tr>
          <th>Question heading</th>
          <th>Number of questions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    for (const row of rows) {
      const tr = document.createElement("tr");

      const tdHeading = document.createElement("td");
      tdHeading.dataset.label = "Question heading";
      tdHeading.textContent = row.heading ?? "";

      const tdCount = document.createElement("td");
      tdCount.dataset.label = "Number of questions";
      tdCount.textContent = format(row.count ?? 0);

      tr.appendChild(tdHeading);
      tr.appendChild(tdCount);
      tbody.appendChild(tr);
    }

    wrapper.appendChild(table);
    el.replaceChildren(wrapper);
  }, {
    eventName: ["pq-parties:change", "pq-parties:party-change"]
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
  mountReactive("download-block", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="text-skeleton"><div class="text-skeleton__line text-skeleton__line--w72 skeleton-shimmer"></div></div>`;
      return;
    }

    const detail = await getSelectedPartyDetail();

    if (!isCurrent()) return;

    if (!detail?.topHeadings?.length) {
      el.innerHTML = "";
      return;
    }

    const rows = detail.topHeadings.map((d, i) => ({
      rank: i + 1,
      party: detail.party,
      heading: d.heading,
      count: d.count,
      year: getState().year,
      question_type: getVariantKey()
    }));

    const filename = `pq_topic_summary_${detail.party
      .replace(/\s+/g, "_")
      .toLowerCase()}_${getState().year}_${getVariantKey()}.csv`;

    el.replaceChildren(
      downloadButton(rows, filename, {
        label: `Download topic summary for ${detail.party}`
      })
    );
  }, {
    eventName: ["pq-parties:change", "pq-parties:party-change"],
    debounceMs: 20
  })
);
```
