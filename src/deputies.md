---
title: Deputies
header: false
sidebar: false
footer: false
toc: false
---
```js
import * as d3 from "npm:d3";
import { bubbleChart } from "./components/bubble-chart.js";
import { pqControls } from "./components/pq-controls.js";
import { packedCircleChart } from "./components/packed-circle-chart.js";
import { downloadButton } from "./components/download-button.js";
import { zoomableTreemap } from "./components/zoomable-treemap.js";
import { deputyDetailUrls } from "./generated/deputy-detail-urls.js";
import { renderSectionNav } from "./components/section-nav.js";
import { enhanceHeroWithShare } from "./components/hero-share.js";

if (typeof window !== "undefined" && !window.__pqDeputiesResizeObserver) {
  window.__pqDeputiesResizeObserver = new ResizeObserver(([entry]) => {
    parent.postMessage({ height: entry.target.scrollHeight }, "*");
  });

  window.__pqDeputiesResizeObserver.observe(document.body);
}

const format = d3.format(",d");
const heroVideoPromise = FileAttachment("media/PQs.mp4").url();

const deputyRollups = {
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

if (!window.pqDeputiesState) {
  window.pqDeputiesState = {
    year: 2026,
    questionType: "all",
    selectedDeputy: null,
    selectedHeading: null
  };
}

const deputyDetailCache = new Map();

function getState() {
  return window.pqDeputiesState;
}

function getVariantKey() {
  return getState().questionType === "oral" ? "oral" : "all";
}

async function getSummary() {
  return await summaries[getState().year]?.[getVariantKey()] ?? null;
}

function getSurname(name) {
  if (!name) return "";
  const parts = String(name).trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

function getPartyColor(party) {
  return partyColorMap.get(party) ?? "#666666";
}

function truncateLabel(text, max = 52) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd() + "…";
}

function formatDisplayDate(dateIso) {
  if (!dateIso) return "";
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function cardPlaceholder() {
  const wrap = document.createElement("div");
  wrap.className = "deputy-card deputy-card--empty";
  wrap.style.minHeight = "180px";
  wrap.innerHTML = `
    <div class="deputy-card-body">
      <p class="deputy-card-empty-text">Loading Deputy details…</p>
    </div>
  `;
  return wrap;
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

async function getYearRows() {
  return await deputyRollups[getState().year] ?? [];
}

async function getBubbleRows() {
  const rows = await getYearRows();
  const variant = getVariantKey();

  if (variant === "all") {
    const allRows = rows.filter(
      (d) => String(d.questionType ?? "").trim().toLowerCase() === "all"
    );

    if (allRows.length) {
      return allRows
        .map((d) => ({
          id: d.id,
          name: d.name,
          party: d.party,
          value: d.value
        }))
        .sort((a, b) => d3.ascending(a.name, b.name));
    }

    return Array.from(
      d3.rollup(
        rows.filter((d) => {
          const q = String(d.questionType ?? "").trim().toLowerCase();
          return q === "oral" || q === "written";
        }),
        (group) => ({
          id: group[0].id,
          name: group[0].name,
          party: group[0].party,
          value: d3.sum(group, (d) => d.value)
        }),
        (d) => d.id
      ),
      ([, value]) => value
    ).sort((a, b) => d3.ascending(a.name, b.name));
  }

  return rows
    .filter((d) => String(d.questionType ?? "").trim().toLowerCase() === variant)
    .map((d) => ({
      id: d.id,
      name: d.name,
      party: d.party,
      value: d.value
    }))
    .sort((a, b) => d3.ascending(a.name, b.name));
}

async function getDeputyOptions() {
  return Array.from(
    d3.rollup(
      await getYearRows(),
      (group) => ({
        value: group[0].id,
        label: group[0].name,
        party: group[0].party || "Independent"
      }),
      (d) => d.id
    ),
    ([, value]) => value
  ).sort((a, b) => {
    const surnameCompare = d3.ascending(getSurname(a.label), getSurname(b.label));
    if (surnameCompare !== 0) return surnameCompare;
    return d3.ascending(a.label, b.label);
  });
}

async function ensureValidDeputySelection() {
  const state = getState();
  const options = await getDeputyOptions();

  if (!options.length) {
    state.selectedDeputy = null;
    return null;
  }

  if (state.selectedDeputy && options.some((d) => d.value === state.selectedDeputy)) {
    return state.selectedDeputy;
  }

  state.selectedDeputy = options[0]?.value ?? null;
  return state.selectedDeputy;
}

async function getSelectedDeputyOption() {
  const selected = await ensureValidDeputySelection();
  if (!selected) return null;
  return (await getDeputyOptions()).find((d) => d.value === selected) ?? null;
}

async function getSelectedDeputyBubbleRow() {
  const selected = await ensureValidDeputySelection();
  if (!selected) return null;
  return (await getBubbleRows()).find((d) => d.id === selected) ?? null;
}

function getDeputyDetailUrls(year, memberCode) {
  const rawUrl = new URL(
    `data/pq/${year}/deputies/${encodeURIComponent(memberCode)}.json`,
    document.baseURI
  ).toString();

  const manifestUrl = deputyDetailUrls?.[year]?.[memberCode] ?? null;

  return [rawUrl, manifestUrl].filter(Boolean);
}

async function getDeputyDetail(year, memberCode) {
  const cacheKey = `${year}::${memberCode}`;
  if (deputyDetailCache.has(cacheKey)) {
    return deputyDetailCache.get(cacheKey);
  }

  const urls = getDeputyDetailUrls(year, memberCode);

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const json = await response.json();
      deputyDetailCache.set(cacheKey, json);
      return json;
    } catch (error) {
      console.error("Deputy detail fetch attempt failed", {
        year,
        memberCode,
        url,
        error
      });
    }
  }

  console.error("All deputy detail fetch attempts failed", {
    year,
    memberCode,
    urls
  });

  return null;
}

async function getSelectedDeputyDetail() {
  const selected = await ensureValidDeputySelection();
  if (!selected) return null;
  return await getDeputyDetail(getState().year, selected);
}

function getVariantDetail(detail) {
  return detail?.types?.[getVariantKey()] ?? null;
}

async function getSelectedDeputyViewModel() {
  const option = await getSelectedDeputyOption();
  if (!option) return null;

  const detail = await getSelectedDeputyDetail();
  if (!detail) return null;

  const variant = getVariantDetail(detail) ?? {};
  const questions = variant.questions ?? [];

  return {
    memberCode: detail.memberCode ?? option.value,
    label: detail.memberName ?? detail.deputy ?? option.label,
    deputy: detail.deputy ?? detail.memberName ?? option.label,
    party: detail.party ?? option.party ?? "Independent",
    constituency: detail.constituency ?? "",
    imageUrl:
      detail.imageUrl ??
      `https://data.oireachtas.ie/ie/oireachtas/member/id/${option.value}/image/large`,
    memberUrl:
      detail.memberUrl ??
      `https://www.oireachtas.ie/en/members/member/${option.value}`,
    count: variant.count ?? (await getSelectedDeputyBubbleRow())?.value ?? questions.length,
    headingOptions: (variant.headingOptions ?? []).slice().sort((a, b) => d3.ascending(a, b)),
    insights: variant.insights ?? null,
    packed: variant.packed ?? { name: "Parliamentary Questions", children: [] },
    treemap: variant.treemap ?? { name: "Parliamentary Questions", children: [] },
    questions
  };
}

async function ensureValidHeadingSelection() {
  const state = getState();
  const view = await getSelectedDeputyViewModel();
  const options = view?.headingOptions ?? [];

  if (!options.length) {
    state.selectedHeading = null;
    return null;
  }

  if (options.includes(state.selectedHeading)) {
    return state.selectedHeading;
  }

  state.selectedHeading = options[0];
  return state.selectedHeading;
}

async function getSelectedDeputyTableRows() {
  const view = await getSelectedDeputyViewModel();
  if (!view) return [];

  const selectedHeading = await ensureValidHeadingSelection();
  if (!selectedHeading) return [];

  return view.questions
    .filter((d) => (d.heading ?? "").trim() === selectedHeading)
    .slice()
    .sort((a, b) => {
      const dateCompare = d3.ascending(a.date_iso ?? "", b.date_iso ?? "");
      if (dateCompare !== 0) return dateCompare;
      return d3.ascending(a.questionNumber ?? 0, b.questionNumber ?? 0);
    });
}

function dispatchChange() {
  window.dispatchEvent(new CustomEvent("pq-deputies:change"));
}

function dispatchTableChange() {
  window.dispatchEvent(new CustomEvent("pq-deputies-table:change"));
}

function withPreservedScroll(fn) {
  const x = window.scrollX;
  const y = window.scrollY;
  fn();
  requestAnimationFrame(() => window.scrollTo(x, y));
}

function mountReactive(className, renderFn, options = {}) {
  const {
    debounceMs = 50,
    eventName = "pq-deputies:change",
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
          <h1 class="hero__title">PQ Explorer: Deputies</h1>
          <p class="hero__subtitle">
            A data-driven perspective on the questions asked in Parliament.
          </p>
        </div>
      </div>
    `;
    enhanceHeroWithShare(el, {title: "Deputies — PQ Explorer"});
  })
);
```

```js
display(renderSectionNav("deputies"));
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
      <h2>Explore by Deputy</h2>
      <p>
        Select a Deputy or take a look at the range below by hovering over circles, sized by question count. You can also click through to <a href="https://www.oireachtas.ie/en/members/" class="link-arrow" target="_blank" rel="noreferrer">Member profiles</a>.
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
      el.innerHTML = `<div class="chart-skeleton chart-skeleton--circles skeleton-shimmer" style="height:620px"></div>`;
      return;
    }

    const rows = await getBubbleRows();
    const selectedDeputy = getState().selectedDeputy;

    if (!isCurrent()) return;

    if (!rows.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      bubbleChart(rows, {
        width: 620,
        height: 620,
        selectedId: selectedDeputy,
        label: (d) => [d.name, d.value.toLocaleString("en-IE")].join("\n"),
        value: (d) => d.value,
        group: (d) => d.id,
        title: (d) =>
          `${d.name} has asked ${d.value.toLocaleString("en-IE")} parliamentary questions in ${getState().year}`,
        link: (d) => `https://www.oireachtas.ie/en/members/member/${d.id}`
      })
    );
  }, {
    debounceMs: 50
  })
);
```

</div>

<div class="prose-block controls-block">

```js
{
  const panel = document.createElement("div");
  panel.className = "deputy-selection-panel";

  const controlsCol = document.createElement("div");
  controlsCol.className = "deputy-selection-panel__controls";

  const cardCol = document.createElement("div");
  cardCol.className = "deputy-selection-panel__card";

  const controls = pqControls({
    state: window.pqDeputiesState,
    onChange: async () => {
      await ensureValidDeputySelection();
      window.pqDeputiesState.selectedHeading = null;
      dispatchChange();
    }
  });

  controlsCol.appendChild(controls);

  const deputyWrap = document.createElement("div");
  deputyWrap.className = "deputy-select-wrap";

  async function renderDeputySelect() {
    deputyWrap.replaceChildren();

    const label = document.createElement("label");
    label.className = "control";

    const labelText = document.createElement("span");
    labelText.className = "control-label";
    labelText.textContent = "Deputy";

    const select = document.createElement("select");
    select.className = "control-input deputy-select-input";

    const options = await getDeputyOptions();
    const selected = await ensureValidDeputySelection();

    if (!options.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No Deputies available";
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

      select.addEventListener("change", (event) => {
        window.pqDeputiesState.selectedDeputy = event.target.value || null;
        window.pqDeputiesState.selectedHeading = null;
        dispatchChange();
      });
    }

    label.appendChild(labelText);
    label.appendChild(select);
    deputyWrap.appendChild(label);
  }

  async function renderDeputyCard() {
    cardCol.replaceChildren(cardPlaceholder());

    const currentSelection = await ensureValidDeputySelection();
    const view = await getSelectedDeputyViewModel();

    if (currentSelection !== await ensureValidDeputySelection()) return;

    cardCol.replaceChildren();

    if (!view) {
      const empty = document.createElement("div");
      empty.className = "deputy-card deputy-card--empty";
      empty.innerHTML = `
        <div class="deputy-card-body">
          <p class="deputy-card-empty-text">No Deputy is available for this selection.</p>
        </div>
      `;
      cardCol.appendChild(empty);
      return;
    }

    const questionCount = view.count ?? 0;
    const partyColor = getPartyColor(view.party);

    const link = document.createElement("a");
    link.className = "deputy-card-link deputy-card-link--plain";
    link.href = view.memberUrl;

    const card = document.createElement("article");
    card.className = "deputy-card";

    const media = document.createElement("div");
    media.className = "deputy-card-media";
    media.style.setProperty("--party-color", partyColor);

    const ring = document.createElement("div");
    ring.className = "deputy-card-ring";

    if (view.imageUrl) {
      const img = document.createElement("img");
      img.className = "deputy-card-image";
      img.src = view.imageUrl;
      img.alt = view.label;
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        const placeholder = document.createElement("div");
        placeholder.className = "deputy-card-placeholder";
        placeholder.textContent = "TD";
        ring.appendChild(placeholder);
      };
      ring.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "deputy-card-placeholder";
      placeholder.textContent = "TD";
      ring.appendChild(placeholder);
    }

    media.appendChild(ring);

    const body = document.createElement("div");
    body.className = "deputy-card-body";

    const metaGrid = document.createElement("div");
    metaGrid.className = "deputy-card-meta-grid";

    const metaItems = [
      ["Party", view.party || "—"],
      ["Constituency", view.constituency || "—"],
      ["Questions asked", format(questionCount)]
    ];

    for (const [labelText, valueText] of metaItems) {
      const item = document.createElement("div");
      item.className = "deputy-card-meta-item";

      const itemLabel = document.createElement("span");
      itemLabel.className = "deputy-card-meta-label";
      itemLabel.textContent = labelText;

      const itemValue = document.createElement("span");
      itemValue.className = "deputy-card-meta-value";
      itemValue.textContent = valueText;

      item.appendChild(itemLabel);
      item.appendChild(itemValue);
      metaGrid.appendChild(item);
    }

    body.appendChild(metaGrid);

    card.appendChild(media);
    card.appendChild(body);
    link.appendChild(card);
    cardCol.appendChild(link);
  }

  renderDeputySelect();
  renderDeputyCard();

  let lastControlsKey = `${getState().year}::${getState().questionType}`;

  window.addEventListener("pq-deputies:change", () => {
    const nextKey = `${getState().year}::${getState().questionType}`;

    withPreservedScroll(() => {
      if (nextKey !== lastControlsKey) {
        renderDeputySelect();
        lastControlsKey = nextKey;
      }
      renderDeputyCard();
    });
  });

  controlsCol.appendChild(deputyWrap);
  panel.appendChild(cardCol);
  panel.appendChild(controlsCol);
  display(panel);
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

    const view = await getSelectedDeputyViewModel();
    const state = getState();

    if (!isCurrent()) return;

    if (!view) {
      el.innerHTML = `<p>No data available for this Deputy.</p>`;
      return;
    }

    const total = view.count ?? 0;

    const questionLabel =
      total === 1
        ? state.questionType === "oral"
          ? "oral question"
          : "question"
        : state.questionType === "oral"
        ? "oral questions"
        : "questions";

    if (total === 0) {
      el.innerHTML = `
        <p>
          This Deputy <strong>did not ask any ${state.questionType === "oral" ? "oral questions" : "questions"} in this period</strong>.
        </p>
      `;
      return;
    }

    const insights = view.insights;

    if (!insights) {
      el.innerHTML = `<p>No data available for this Deputy.</p>`;
      return;
    }

    el.innerHTML = `
      <p>
        <strong>Deputy ${view.label}</strong> asked 
        <strong>${total.toLocaleString("en-IE")} ${questionLabel}</strong> 
        in this period, which covers <strong>${state.year}</strong>.
      </p>

      <p>
        The Deputy most frequently raised matters under the heading 
        <strong>${insights.topHeading}</strong>, accounting for 
        <strong>${insights.topHeadingCount.toLocaleString("en-IE")} ${
          insights.topHeadingCount === 1 ? "question" : "questions"
        }</strong>.
      </p>

      <p>
        Take a look at the breakdown of the Deputy's questions and the Departments responding. 
        Hover over circles to reveal information.
      </p>
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

    const view = await getSelectedDeputyViewModel();
    const data = view?.packed;

    if (!isCurrent()) return;

    if (!data || !data.children?.length) {
      el.innerHTML = `<p class="chart-loading">No data available for this selection.</p>`;
      return;
    }

    el.replaceChildren(
      packedCircleChart(data, {
        width: 800,
        height: 700
      })
    );
  }, {
    loading: () => chartPlaceholder(700),
    eventName: "pq-deputies:change"
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

  <p><strong>Click through the squares to drill down</strong> to the Department to which the question is directed, the question topic, date, text of the question and reply as published.</p>

  <p>Click on the top panel to zoom out again.</p>
</div>

<div class="chart-block">

```js
display(
  mountDeferred("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="chart-skeleton chart-skeleton--blocks skeleton-shimmer" style="height:520px"></div>`;
      return;
    }

    const view = await getSelectedDeputyViewModel();
    const data = view?.treemap;

    if (!isCurrent()) return;

    if (!data || !data.children?.length) {
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
    loading: () => chartPlaceholder(520),
    eventName: "pq-deputies:change"
  })
);
```

</div>

<div class="prose-block">

Refine your search further by question topics raised by the Deputy. Check the results in the table below and read the questions and replies in the Official Report.

</div>

<div class="prose-block controls-block">

```js
{
  const wrap = document.createElement("div");

  async function renderHeadingSelect() {
    wrap.replaceChildren();

    const label = document.createElement("label");
    label.className = "control";

    const labelText = document.createElement("span");
    labelText.className = "control-label";
    labelText.textContent = "Question topic";

    const select = document.createElement("select");
    select.className = "control-input";

    const view = await getSelectedDeputyViewModel();
    const options = view?.headingOptions ?? [];
    const selected = await ensureValidHeadingSelection();

    if (!options.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No topics available";
      select.appendChild(option);
      select.disabled = true;
    } else {
      for (const heading of options) {
        const option = document.createElement("option");
        option.value = heading;
        option.textContent = truncateLabel(heading);
        option.selected = heading === selected;
        select.appendChild(option);
      }

      select.addEventListener("change", (event) => {
        window.pqDeputiesState.selectedHeading = event.target.value || null;
        dispatchTableChange();
      });
    }

    label.appendChild(labelText);
    label.appendChild(select);
    wrap.appendChild(label);
  }

  renderHeadingSelect();

  window.addEventListener("pq-deputies:change", renderHeadingSelect);
  window.addEventListener("pq-deputies-table:change", renderHeadingSelect);

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
          <div class="text-skeleton__line text-skeleton__line--w84 skeleton-shimmer"></div>
        </div>
      `;
      return;
    }

    const rows = await getSelectedDeputyTableRows();
    const state = getState();
    const view = await getSelectedDeputyViewModel();

    if (!isCurrent()) return;

    const count = rows.length;
    const topic = state.selectedHeading || null;

    if (!topic || !view) {
      el.innerHTML = "";
      return;
    }

    const isOral = getVariantKey() === "oral";
    const label =
      count === 1
        ? isOral
          ? "oral question"
          : "question"
        : isOral
        ? "oral questions"
        : "questions";

    el.innerHTML = `
      <p>
        <strong>Deputy ${view.label}</strong> has asked <strong>${count.toLocaleString("en-IE")} ${label}</strong>
        about <strong>${topic}</strong>.
      </p>
    `;
  }, {
    eventName: ["pq-deputies:change", "pq-deputies-table:change"]
  })
);
```

```js
display(
  mountDeferred("", async (el, { skeletonOnly, isCurrent }) => {
    if (skeletonOnly) {
      el.innerHTML = `<div class="table-skeleton">${Array.from({ length: 6 }).map(() => `
        <div class="table-skeleton__row">
          <div class="table-skeleton__cell skeleton-shimmer"></div>
          <div class="table-skeleton__cell skeleton-shimmer"></div>
          <div class="table-skeleton__cell skeleton-shimmer"></div>
          <div class="table-skeleton__cell skeleton-shimmer"></div>
        </div>`).join("")}</div>`;
      return;
    }

    const rows = await getSelectedDeputyTableRows();

    if (!isCurrent()) return;

    if (!rows.length) {
      el.innerHTML = `<p class="chart-loading">No questions available for this selection.</p>`;
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "pq-table pq-table--deputies";

    table.innerHTML = `
      <colgroup>
        <col style="width: 9rem" />
        <col style="width: 14rem" />
        <col style="width: 34rem" />
        <col style="width: 8rem" />
      </colgroup>
      <thead>
        <tr>
          <th>Date</th>
          <th>Department</th>
          <th>Question</th>
          <th>Reply</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    for (const row of rows) {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.dataset.label = "Date";
      tdDate.textContent = formatDisplayDate(row.date_iso);

      const tdDept = document.createElement("td");
      tdDept.dataset.label = "Department";
      tdDept.textContent = row.department ?? "";

      const tdQuestion = document.createElement("td");
      tdQuestion.dataset.label = "Question";
      tdQuestion.textContent = (row.question ?? "").replace(/\s+/g, " ").trim();

      const tdReply = document.createElement("td");
      tdReply.dataset.label = "Reply";
      const a = document.createElement("a");
      a.href = row.url ?? "#";
      a.target = "_blank";
      a.rel = "noreferrer";
      a.className = "link-arrow";
      a.textContent = "Read reply";
      tdReply.appendChild(a);

      tr.appendChild(tdDate);
      tr.appendChild(tdDept);
      tr.appendChild(tdQuestion);
      tr.appendChild(tdReply);

      tbody.appendChild(tr);
    }

    wrapper.appendChild(table);
    el.replaceChildren(wrapper);
  }, {
    loading: () => chartPlaceholder(360, "Loading results…"),
    eventName: ["pq-deputies:change", "pq-deputies-table:change"]
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

    const view = await getSelectedDeputyViewModel();

    if (!isCurrent()) return;

    if (!view?.questions?.length) {
      el.innerHTML = "";
      return;
    }

    const filename = `pq_${view.label
      .replace(/\s+/g, "_")
      .toLowerCase()}_${getState().year}.csv`;

    el.replaceChildren(
      downloadButton(view.questions, filename, {
        label: `Download dataset for ${view.label}`
      })
    );
  }, {
    debounceMs: 20
  })
);

```
