import * as d3 from "npm:d3@7.9.0";
import * as d3Sankey from "npm:d3-sankey@0.12.3";

export function SankeyChart(
  { nodes, links },
  {
    format = ",",
    align = "justify",
    nodeId = (d) => d.id,
    nodeGroup,
    nodeGroups,
    nodeLabel,
    nodeTitle = (d) => `${d.id}\n${format(d.value)}`,
    nodeAlign = align,
    nodeSort,
    nodeWidth = 25,
    nodePadding = 10,
    nodeLabelPadding = 6,
    nodeStroke = "#4a4a4a",
    nodeStrokeWidth = 1,
    nodeStrokeOpacity = 0.9,
    nodeStrokeLinejoin,
    linkSource = ({ source }) => source,
    linkTarget = ({ target }) => target,
    linkValue = ({ value }) => value,
    linkPath = d3Sankey.sankeyLinkHorizontal(),
    linkTitle = (d) => `${d.source.id} → ${d.target.id}\n${format(d.value)}`,
    linkColor = "source-target",
    linkStrokeOpacity = 0.26,
    linkMixBlendMode = "multiply",
    colors = d3.schemeCategory10,
    width = 800,
    height = 600,
    marginTop = 5,
    marginRight = 1,
    marginBottom = 5,
    marginLeft = 1,
  } = {},
) {
  if (typeof nodeAlign !== "function") {
    nodeAlign =
      {
        left: d3Sankey.sankeyLeft,
        right: d3Sankey.sankeyRight,
        center: d3Sankey.sankeyCenter,
      }[nodeAlign] ?? d3Sankey.sankeyJustify;
  }

  const LS = d3.map(links, linkSource).map(intern);
  const LT = d3.map(links, linkTarget).map(intern);
  const LV = d3.map(links, linkValue);

  if (nodes === undefined) {
    nodes = Array.from(d3.union(LS, LT), (id) => ({ id }));
  }

  const N = d3.map(nodes, nodeId).map(intern);
  const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);

  nodes = d3.map(nodes, (_, i) => ({ id: N[i] }));
  links = d3.map(links, (_, i) => ({
    source: LS[i],
    target: LT[i],
    value: LV[i],
  }));

  if (!G && ["source", "target", "source-target"].includes(linkColor)) {
    linkColor = "currentColor";
  }

  if (G && nodeGroups === undefined) nodeGroups = G;

  const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

  d3Sankey
    .sankey()
    .nodeId(({ index: i }) => N[i])
    .nodeAlign(nodeAlign)
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .nodeSort(nodeSort)
    .extent([
      [marginLeft, marginTop],
      [width - marginRight, height - marginBottom],
    ])({ nodes, links });

  if (typeof format !== "function") format = d3.format(format);

  const Tl =
    nodeLabel === undefined
      ? N
      : nodeLabel == null
        ? null
        : d3.map(nodes, nodeLabel);

  const Tt = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
  const Lt = linkTitle == null ? null : d3.map(links, linkTitle);

  const uid = `O-${Math.random().toString(16).slice(2)}`;

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;")
    .style(
      "font-family",
      "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    )
    .style("font-size", "12px");

  const node = svg
    .append("g")
    .attr("stroke", nodeStroke)
    .attr("stroke-width", nodeStrokeWidth)
    .attr("stroke-opacity", nodeStrokeOpacity)
    .attr("stroke-linejoin", nodeStrokeLinejoin)
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0);

  if (G) node.attr("fill", ({ index: i }) => color(G[i]));
  if (Tt) node.append("title").text(({ index: i }) => Tt[i]);

  const link = svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", linkStrokeOpacity)
    .selectAll("g")
    .data(links)
    .join("g")
    .style("mix-blend-mode", linkMixBlendMode);

  if (linkColor === "source-target") {
    link
      .append("linearGradient")
      .attr("id", (d) => `${uid}-link-${d.index}`)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", (d) => d.source.x1)
      .attr("x2", (d) => d.target.x0)
      .call((gradient) =>
        gradient
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", ({ source: { index: i } }) => color(G[i])),
      )
      .call((gradient) =>
        gradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", ({ target: { index: i } }) => color(G[i])),
      );
  }

  link
    .append("path")
    .attr("d", linkPath)
    .attr(
      "stroke",
      linkColor === "source-target"
        ? ({ index: i }) => `url(#${uid}-link-${i})`
        : linkColor === "source"
          ? ({ source: { index: i } }) => color(G[i])
          : linkColor === "target"
            ? ({ target: { index: i } }) => color(G[i])
            : linkColor,
    )
    .attr("stroke-width", ({ width }) => Math.max(1, width))
    .call(
      Lt
        ? (path) => path.append("title").text(({ index: i }) => Lt[i])
        : () => {},
    );

  if (Tl) {
    svg
      .append("g")
      .attr("font-family", "inherit")
      .attr("font-size", 12)
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("x", (d) =>
        d.x0 < width / 2 ? d.x1 + nodeLabelPadding : d.x0 - nodeLabelPadding,
      )
      .attr("y", (d) => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("fill", "#444444")
      .attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
      .text(({ index: i }) => Tl[i]);
  }

  function intern(value) {
    return value !== null && typeof value === "object"
      ? value.valueOf()
      : value;
  }

  return Object.assign(svg.node(), { scales: { color } });
}
