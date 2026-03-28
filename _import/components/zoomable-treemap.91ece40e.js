import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";

export function zoomableTreemap(data, options = {}) {
  const width = options.width ?? 820;
  const height = options.height ?? 620;
  const format = d3.format(",d");

  const x = d3.scaleLinear().rangeRound([0, width]);
  const y = d3.scaleLinear().rangeRound([0, height]);

  function tile(node, x0, y0, x1, y1) {
    d3.treemapBinary(node, 0, 0, width, height);
    if (!node.children) return;

    for (const child of node.children) {
      child.x0 = x0 + (child.x0 / width) * (x1 - x0);
      child.x1 = x0 + (child.x1 / width) * (x1 - x0);
      child.y0 = y0 + (child.y0 / height) * (y1 - y0);
      child.y1 = y0 + (child.y1 / height) * (y1 - y0);
    }
  }

  function treemap(input) {
    return d3.treemap().tile(tile)(
      d3
        .hierarchy(input)
        .sum((d) => d.value ?? 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    );
  }

  function labelForNode(d, root) {
    if (d !== root) {
      return d.data.name.split(/(?=[A-Z][^A-Z])/g).concat(format(d.value ?? 0));
    }

    return root.parent ? ["← Back up"] : ["Parliamentary Questions"];
  }

  const svg = d3
    .create("svg")
    .attr("viewBox", [0.5, -26.5, width, height + 26])
    .style("max-width", "100%")
    .style("height", "auto")
    .style("display", "block")
    .style(
      "font-family",
      "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    )
    .style("font-size", "12px")
    .attr("fill", "white");

  let uidCounter = 0;
  const nextUid = (prefix) =>
    `${prefix}-${Math.random().toString(36).slice(2)}-${uidCounter++}`;

  let group = svg.append("g").call(render, treemap(data));

  function render(group, root) {
    const node = group
      .selectAll("g")
      .data((root.children ?? []).concat(root))
      .join("g");

    node
      .filter((d) => (d === root ? d.parent : d.children))
      .attr("cursor", "pointer")
      .on("click", (_event, d) => (d === root ? zoomout(root) : zoomin(d)));

    node
      .filter((d) => !d.children)
      .on("click", (event, d) => {
        if (d.data.url) window.open(d.data.url, "_blank");
        event.stopPropagation();
      });

    node.append("title").text((d) => `${d.data.name}\n${format(d.value ?? 0)}`);

    node
      .append("rect")
      .attr("id", (d) => {
        d._leafUid = d._leafUid ?? nextUid("leaf");
        return d._leafUid;
      })
      .attr("fill", (d) =>
        d === root ? "#1f77b4" : d.children ? "#1f77b4" : "#7f7f7f",
      )
      .attr("stroke", "#ff7f0e")
      .attr("stroke-width", 1.5);

    node
      .append("clipPath")
      .attr("id", (d) => {
        d._clipUid = d._clipUid ?? nextUid("clip");
        return d._clipUid;
      })
      .append("use")
      .attr("href", (d) => `#${d._leafUid}`);

    node
      .append("text")
      .attr("clip-path", (d) => `url(#${d._clipUid})`)
      .attr("font-weight", (d) => (d === root ? "700" : null))
      .attr("font-family", "inherit")
      .selectAll("tspan")
      .data((d) => labelForNode(d, root))
      .join("tspan")
      .attr("x", 3)
      .attr(
        "y",
        (_d, i, nodes) =>
          `${(i === nodes.length - 1) * 0.3 + 1.05 + i * 0.82}em`,
      )
      .attr("fill-opacity", (d, i, nodes) => {
        const isRootLabel = nodes.length === 1;
        return i === nodes.length - 1 && !isRootLabel ? 0.7 : null;
      })
      .attr("font-weight", (d, i, nodes) => {
        const isRootLabel = nodes.length === 1;
        return i === nodes.length - 1 && !isRootLabel ? "400" : null;
      })
      .text((d) => d);

    const leaf = node.filter((d) => !d.children);

    leaf.select("rect").attr("cursor", "pointer");
    leaf.select("text").attr("cursor", "pointer");

    leaf
      .on("mouseenter.afford", function () {
        d3.select(this).select("text").style("text-decoration", "underline");
      })
      .on("mouseleave.afford", function () {
        d3.select(this).select("text").style("text-decoration", null);
      });

    leaf
      .append("text")
      .attr("class", "ext-icon")
      .attr("y", 12)
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("fill-opacity", 0.75)
      .attr("font-family", "inherit")
      .style("pointer-events", "none")
      .text("↗");

    group.call(position, root);

    leaf.select(".ext-icon").attr("x", (d) => x(d.x1) - x(d.x0) - 6);
  }

  function position(group, root) {
    group
      .selectAll("g")
      .attr("transform", (d) =>
        d === root ? `translate(0,-26)` : `translate(${x(d.x0)},${y(d.y0)})`,
      )
      .select("rect")
      .attr("width", (d) => (d === root ? width : x(d.x1) - x(d.x0)))
      .attr("height", (d) => (d === root ? 28 : y(d.y1) - y(d.y0)));
  }

  function zoomin(d) {
    const group0 = group.attr("pointer-events", "none");
    const group1 = (group = svg.append("g").call(render, d));

    group0.selectAll("text").attr("display", "none");

    x.domain([d.x0, d.x1]);
    y.domain([d.y0, d.y1]);

    svg
      .transition()
      .duration(650)
      .call((t) => group0.transition(t).remove().call(position, d.parent))
      .call((t) =>
        group1
          .transition(t)
          .attrTween("opacity", () => d3.interpolate(0, 1))
          .call(position, d),
      );
  }

  function zoomout(d) {
    if (!d.parent) return;

    const group0 = group.attr("pointer-events", "none");
    const group1 = (group = svg.insert("g", "*").call(render, d.parent));

    group0.selectAll("text").attr("display", "none");

    x.domain([d.parent.x0, d.parent.x1]);
    y.domain([d.parent.y0, d.parent.y1]);

    svg
      .transition()
      .duration(650)
      .call((t) =>
        group0
          .transition(t)
          .remove()
          .attrTween("opacity", () => d3.interpolate(1, 0))
          .call(position, d),
      )
      .call((t) => group1.transition(t).call(position, d.parent));
  }

  return svg.node();
}
