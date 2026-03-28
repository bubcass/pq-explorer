import * as d3 from "npm:d3";

export function packedCircleChart(data, options = {}) {
  const width = options.width ?? 900;
  const height = options.height ?? 800;
  const format = d3.format(",d");
  const color = d3
    .scaleOrdinal()
    .domain([2, 1, 0])
    .range(["#7f7f7f", "#1f77b4", "#ff7f0e"]);

  const root = d3
    .pack()
    .size([width - 2, height - 2])
    .padding(3)(
    d3
      .hierarchy(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  );

  const svg = d3
    .create("svg")
    .attr("title", "Packed circle chart")
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("max-width", "100%")
    .style("height", "auto")
    .style("display", "block")
    .style("overflow", "visible")
    .style(
      "font-family",
      "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    )
    .style("font-size", "13px")
    .attr("text-anchor", "middle");

  const node = svg
    .selectAll("g.layer")
    .data(d3.group(root.descendants(), (d) => d.height))
    .join("g")
    .attr("class", "layer")
    .selectAll("g.node")
    .data((d) => d[1])
    .join("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x + 1},${d.y + 1})`);

  node
    .append("circle")
    .attr("r", (d) => d.r)
    .attr("fill", (d) => color(d.height))
    .attr("stroke", "#4a4a4a")
    .attr("stroke-width", 1);

  const leaf = node.filter((d) => !d.children);

  leaf
    .select("circle")
    .attr("id", (_, i) => `leaf-${i}`)
    .attr("stroke", "#4a4a4a")
    .attr("stroke-width", 1);

  leaf
    .append("clipPath")
    .attr("id", (_, i) => `clip-${i}`)
    .append("use")
    .attr("href", (_, i) => `#leaf-${i}`);

  leaf
    .append("text")
    .attr("clip-path", (_, i) => `url(#clip-${i})`)
    .attr("display", (d) => (d.r < 90 ? "none" : "inherit"))
    .style("font-size", "12px")
    .style("font-weight", "400")
    .selectAll("tspan")
    .data((d) =>
      (d.data.name ?? "").split(/(?=[A-Z][a-z])|\s+/g).filter(Boolean),
    )
    .join("tspan")
    .attr("x", 0)
    .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
    .attr("fill", "#444444")
    .text((d) => d);

  node.append("title").text(
    (d) =>
      `${d
        .ancestors()
        .map((d) => d.data.name)
        .reverse()
        .join(" / ")}\nTotal: ${format(d.value ?? 0)}`,
  );

  const deptNodes = root.descendants().filter((d) => d.height === 1);

  const labelLayer = svg
    .append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .style(
      "font-family",
      "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    )
    .style("font-size", "14px")
    .style("font-weight", "600");

  const labelG = labelLayer
    .selectAll("g.dept-label")
    .data(deptNodes, (d) => d.data.name)
    .join("g")
    .attr("class", "dept-label")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

  labelG
    .append("text")
    .attr("dy", "0.35em")
    .attr("fill", "none")
    .attr("stroke", "#444444")
    .attr("stroke-width", 4)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("opacity", 0.9)
    .text((d) => d.data.name);

  labelG
    .append("text")
    .attr("dy", "0.35em")
    .attr("fill", "white")
    .text((d) => d.data.name);

  svg
    .append("text")
    .attr("id", "byline")
    .attr("x", width)
    .attr("y", height)
    .attr("dy", "-2em")
    .attr("text-anchor", "end");

  return svg.node();
}
