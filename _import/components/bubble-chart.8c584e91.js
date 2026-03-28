import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";

// Adapted from the Observable / D3 bubble chart example.
// Reusable component for Observable Framework
export function bubbleChart(
  data,
  {
    name = (d) => d?.id,
    label = name,
    value = (d) => d?.value,
    group,
    title,
    link,
    linkTarget = "_blank",
    selectedId = null,
    width = 800,
    height = width,
    padding = 3,
    margin = 1,
    marginTop = margin,
    marginRight = margin,
    marginBottom = margin,
    marginLeft = margin,
    groups,
    colors = d3.schemeCategory10,
    fill = "#ccc",
    fillOpacity = 1,
    stroke = null,
    strokeWidth = null,
    strokeOpacity = null,
  } = {},
) {
  const D = d3.map(data, (d) => d);
  const V = d3.map(data, value);
  const G = group == null ? null : d3.map(data, group);

  const I = d3.range(V.length).filter((i) => (V[i] ?? 0) > 0);

  if (G && groups === undefined) groups = I.map((i) => G[i]);
  groups = G && new d3.InternSet(groups);

  const color = G ? d3.scaleOrdinal(groups, colors) : null;

  const L = label == null ? null : d3.map(data, label);
  const T =
    title === undefined ? L : title == null ? null : d3.map(data, title);

  const root = d3
    .pack()
    .size([width - marginLeft - marginRight, height - marginTop - marginBottom])
    .padding(padding)(d3.hierarchy({ children: I }).sum((i) => V[i]));

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-marginLeft, -marginTop, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
    .attr("text-anchor", "middle")
    .style(
      "font-family",
      '"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    )
    .style("font-size", "12px");

  const leaf = svg
    .selectAll("a")
    .data(root.leaves())
    .join("a")
    .attr(
      "xlink:href",
      link == null ? null : (d, i) => link(D[d.data], i, data),
    )
    .attr("target", link == null ? null : linkTarget)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  leaf
    .append("circle")
    .attr("stroke", (d) => {
      if (!selectedId) return stroke;
      const datum = D[d.data];
      return datum?.id === selectedId ? "#d62728" : null;
    })
    .attr("stroke-width", (d) => {
      if (!selectedId) return strokeWidth;
      const datum = D[d.data];
      return datum?.id === selectedId ? 3.5 : 0;
    })
    .attr("stroke-opacity", (d) => {
      if (!selectedId) return strokeOpacity;
      const datum = D[d.data];
      return datum?.id === selectedId ? 0.9 : 0;
    })
    .attr("fill", (d) => (color ? color(G[d.data]) : fill))
    .attr("fill-opacity", (d) => {
      if (!selectedId) return fillOpacity;
      const datum = D[d.data];
      return datum?.id === selectedId ? fillOpacity : 0.8;
    })
    .attr("r", (d) => d.r);

  if (T) {
    leaf.append("title").text((d) => T[d.data]);
  }

  if (L) {
    const uid = `O-${Math.random().toString(16).slice(2)}`;

    leaf
      .append("clipPath")
      .attr("id", (d) => `${uid}-clip-${d.data}`)
      .append("circle")
      .attr("r", (d) => d.r);

    const text = leaf
      .append("text")
      .attr(
        "clip-path",
        (d) => `url(${new URL(`#${uid}-clip-${d.data}`, location)})`,
      )
      .style(
        "font-family",
        '"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      )
      .style("font-size", "12px")
      .style("font-weight", "400");

    text
      .selectAll("tspan")
      .data((d) =>
        `${L[d.data]}`.split(/\n/g).map((line, i, arr) => ({
          line,
          lineIndex: i,
          lineCount: arr.length,
          datumIndex: d.data,
        })),
      )
      .join("tspan")
      .attr("x", 0)
      .attr("y", (d) => `${d.lineIndex - d.lineCount / 2 + 0.85}em`)
      .attr("fill", "white")
      .attr("fill-opacity", (d) => (d.lineIndex === d.lineCount - 1 ? 0.7 : 1))
      .text((d) => d.line);
  }

  return Object.assign(svg.node(), { scales: { color } });
}
