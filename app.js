import { buildAtlasHierarchy, datasetMeta, googleMapsUrl, metropolitanEditions } from "./restaurants.js?v=metropolitan-gallery-1";

const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const TREEMAP_HEADER = 46;
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 168;
const PAPER = "#f2efe8";
const CONTINENT_COLORS = {
  Americas: "#df0024",
  Europe: "#0085c7",
  Africa: "#111111",
  Asia: "#f4c300",
  Oceania: "#009f3d",
};

const scene = document.querySelector("#scene");
const selectionCard = document.querySelector("#selection-card");
const railContent = document.querySelector("#rail-content");
const coordinates = document.querySelector("#coordinates");
const cursorLabel = document.querySelector("#cursor-label");

const state = {
  mode: "home",
  focusId: "atlas-root",
  selectedNode: null,
  selectedRestaurant: null,
};

let d3;
let root;
let focus;
let svg;
let activeGroup;
let xScale;
let yScale;
let layoutWidth = 1000;
let layoutHeight = 650;
let nodeById = new Map();
let leafletMap = null;
let leafletMarkerLayer = null;
let resizeTimer = null;
let treemapTransitioning = false;

async function initialize() {
  scene.innerHTML = `<div class="treemap-loading">Tiling the atlas…</div>`;
  try {
    d3 = await import(D3_URL);
    renderMetropolitanGallery();
  } catch (error) {
    console.error(error);
    scene.innerHTML = `
      <div class="treemap-error" role="alert">
        <strong>The atlas could not load.</strong>
        <span>Check the network connection and reload this page.</span>
      </div>
    `;
  }
}

function renderMetropolitanGallery() {
  cleanupMap();
  treemapTransitioning = false;
  state.mode = "home";
  state.focusId = "atlas-root";
  state.selectedNode = null;
  state.selectedRestaurant = null;
  measureTreemap();
  buildTreemapHierarchy();

  const cityCards = (root.children ?? []).map((city) => metropolitanCardMarkup(city)).join("");
  scene.innerHTML = `
    <section class="metropolitan-gallery semantic-layer" aria-label="Metropolitan food atlases">
      ${cityCards}
    </section>
  `;
}

function metropolitanCardMarkup(city) {
  const status = city.data.available
    ? `${city.data.available.toLocaleString("en")} loaded restaurants`
    : "0 loaded restaurants";
  const caption = city.data.available
    ? `${city.data.country} · ${city.data.available.toLocaleString("en")} restaurants`
    : `${city.data.country} · Dataset pending`;
  const plannedClass = city.data.planned ? " is-planned" : "";
  return `
    <button class="metropolitan-card${plannedClass}" type="button" data-city-id="${city.data.id}" aria-label="Open ${escapeHtml(city.data.name)} treemap, ${status}">
      ${metropolitanThumbnailMarkup(city)}
      <span class="metropolitan-card-caption">
        <strong>${escapeHtml(city.data.name)}</strong>
        <span>${escapeHtml(caption)}</span>
      </span>
    </button>
  `;
}

function metropolitanThumbnailMarkup(city) {
  const random = seededRandom(city.data.id);
  const thumbnailNodes = (city.children ?? []).map((continent) => ({
    data: continent.data,
    value: 0.5 + random() * 1.8,
  }));
  geographicPartition(thumbnailNodes, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  const opacity = city.data.planned ? 0.7 : 0.92;
  const tiles = thumbnailNodes.map((continent) => {
    const width = Math.max(0, continent.x1 - continent.x0);
    const height = Math.max(0, continent.y1 - continent.y0);
    return `<rect x="${continent.x0}" y="${continent.y0}" width="${width}" height="${height}" fill="${CONTINENT_COLORS[continent.data.name]}" fill-opacity="${opacity}" />`;
  }).join("");
  return `
    <svg class="metropolitan-thumbnail" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
      ${tiles}
    </svg>
  `;
}

function seededRandom(value) {
  let seed = 2166136261;
  for (const character of value) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223;
    return (seed >>> 0) / 4294967296;
  };
}

function openMetropolitan(cityId) {
  const city = nodeById.get(cityId);
  if (!city || city.data.kind !== "metropolitan") return;
  state.mode = "treemap";
  state.focusId = cityId;
  state.selectedNode = null;
  state.selectedRestaurant = null;
  transitionScene(renderTreemap);
}

function returnToMetropolitanGallery() {
  transitionScene(renderMetropolitanGallery);
}

function buildTreemapHierarchy() {
  const selectedNodeId = state.selectedNode?.data.id;
  const selectedRestaurantId = state.selectedRestaurant?.data.id;
  root = d3.hierarchy(buildAtlasHierarchy());
  root.sum((datum) => datum.layoutValue ?? 0);
  d3.treemap()
    .size([layoutWidth, layoutHeight])
    .tile(geographicTile)
    .paddingInner(2)
    .paddingOuter(1)
    .round(true)(root);
  nodeById = new Map(root.descendants().map((node) => [node.data.id, node]));
  focus = nodeById.get(state.focusId) ?? root;
  state.focusId = focus.data.id;
  state.selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  state.selectedRestaurant = selectedRestaurantId ? nodeById.get(selectedRestaurantId) ?? null : null;
}

function geographicTile(node, x0, y0, x1, y1) {
  if (!node.children?.length) return;
  geographicPartition(node.children, 0, 0, layoutWidth, layoutHeight);
  const scaleX = (x1 - x0) / layoutWidth;
  const scaleY = (y1 - y0) / layoutHeight;
  node.children.forEach((child) => {
    child.x0 = x0 + child.x0 * scaleX;
    child.x1 = x0 + child.x1 * scaleX;
    child.y0 = y0 + child.y0 * scaleY;
    child.y1 = y0 + child.y1 * scaleY;
  });
}

function geographicPartition(nodes, x0, y0, x1, y1) {
  if (!nodes.length) return;
  if (nodes.length === 1) {
    Object.assign(nodes[0], { x0, y0, x1, y1 });
    return;
  }

  const points = nodes.map((node) => ({ node, ...geographicPoint(node) }));
  const meanLatitude = d3.mean(points, (point) => point.lat) ?? 0;
  const longitudeScale = Math.cos((meanLatitude * Math.PI) / 180);
  points.forEach((point) => {
    point.geoX = point.lng * longitudeScale;
    point.geoY = -point.lat;
  });

  const xExtent = d3.extent(points, (point) => point.geoX);
  const yExtent = d3.extent(points, (point) => point.geoY);
  const xSpan = (xExtent[1] ?? 0) - (xExtent[0] ?? 0);
  const ySpan = (yExtent[1] ?? 0) - (yExtent[0] ?? 0);
  const visualWidth = x1 - x0;
  const visualHeight = y1 - y0;
  const splitAlongLongitude = xSpan === 0
    ? false
    : ySpan === 0
      ? true
      : visualWidth >= visualHeight;
  const primary = splitAlongLongitude ? "geoX" : "geoY";
  const secondary = splitAlongLongitude ? "geoY" : "geoX";
  points.sort((a, b) => a[primary] - b[primary] || a[secondary] - b[secondary] || a.node.data.name.localeCompare(b.node.data.name));

  const total = d3.sum(points, (point) => tileWeight(point.node));
  let splitIndex = 1;
  let firstWeight = tileWeight(points[0].node);
  while (splitIndex < points.length - 1 && firstWeight + tileWeight(points[splitIndex].node) <= total / 2) {
    firstWeight += tileWeight(points[splitIndex].node);
    splitIndex += 1;
  }

  const first = points.slice(0, splitIndex).map((point) => point.node);
  const second = points.slice(splitIndex).map((point) => point.node);
  const ratio = Math.min(0.98, Math.max(0.02, firstWeight / total));
  if (splitAlongLongitude) {
    const split = x0 + (x1 - x0) * ratio;
    geographicPartition(first, x0, y0, split, y1);
    geographicPartition(second, split, y0, x1, y1);
  } else {
    const split = y0 + (y1 - y0) * ratio;
    geographicPartition(first, x0, y0, x1, split);
    geographicPartition(second, x0, split, x1, y1);
  }
}

function geographicPoint(node) {
  if (Number.isFinite(node.data.lat) && Number.isFinite(node.data.lng)) {
    return { lat: node.data.lat, lng: node.data.lng };
  }
  const descendants = node.leaves().map((leaf) => leaf.data).filter((datum) => Number.isFinite(datum.lat) && Number.isFinite(datum.lng));
  return {
    lat: d3.mean(descendants, (datum) => datum.lat) ?? 0,
    lng: d3.mean(descendants, (datum) => datum.lng) ?? 0,
  };
}

function tileWeight(node) {
  if (node.data.kind === "region" && !node.data.unclassified) {
    return Math.max(Number(node.value) || 0, 1, (node.parent?.data.available ?? 0) * 0.05);
  }
  return Math.max(Number(node.value) || 0, 0.001);
}

function measureTreemap() {
  layoutWidth = Math.max(320, Math.round(scene.clientWidth || 1000));
  // The SVG viewBox includes the drill-navigation header above the data area.
  // Reserve that height here so the combined viewBox matches the viewport and
  // the treemap can render edge-to-edge without aspect-ratio letterboxing.
  layoutHeight = Math.max(274, Math.round(scene.clientHeight || 650) - TREEMAP_HEADER);
}

function renderTreemap() {
  cleanupMap();
  treemapTransitioning = false;
  state.mode = "treemap";
  measureTreemap();
  buildTreemapHierarchy();
  const metropolitan = focus.ancestors().find((node) => node.data.kind === "metropolitan") ?? focus;
  scene.innerHTML = `
    <div class="treemap-shell semantic-layer">
      <svg class="treemap-svg" viewBox="0 ${-TREEMAP_HEADER} ${layoutWidth} ${layoutHeight + TREEMAP_HEADER}" role="img" aria-labelledby="treemap-title treemap-description">
        <title id="treemap-title">Zoomable ${escapeHtml(metropolitan.data.name)} restaurant treemap</title>
        <desc id="treemap-description">Rectangle area represents loaded restaurant records. Continents, countries, and cuisines are arranged from their geographic origin coordinates; zero counts remain visible.</desc>
      </svg>
      <nav class="treemap-breadcrumbs" aria-label="Treemap breadcrumb"></nav>
    </div>
  `;

  svg = d3.select(scene.querySelector(".treemap-svg"));
  xScale = d3.scaleLinear().domain([focus.x0, focus.x1]).rangeRound([0, layoutWidth]);
  yScale = d3.scaleLinear().domain([focus.y0, focus.y1]).rangeRound([0, layoutHeight]);
  activeGroup = svg.append("g").call(renderTreemapGroup, focus);
  positionGroup(activeGroup, focus);
  updateInterface();
}

function renderTreemapGroup(group, renderRoot) {
  const nodes = [...(renderRoot.children ?? []), renderRoot];
  const node = group
    .selectAll("g")
    .data(nodes, (datum) => datum.data.id)
    .join("g")
    .attr("class", (datum) => treemapNodeClass(datum, renderRoot))
    .attr("role", "button")
    .attr("aria-label", (datum) => datum === renderRoot ? headerAriaLabel(datum) : nodeAriaLabel(datum))
    .attr("tabindex", (datum) => datum === renderRoot && !datum.parent ? -1 : 0)
    .style("--tile-ink", (datum) => tileTextColor(datum, renderRoot))
    .style("--label-font-size", (datum) => `${labelFontSize(datum, renderRoot)}px`)
    .on("click", (event, datum) => {
      event.stopPropagation();
      if (datum === renderRoot) {
        if (datum.parent === root) returnToMetropolitanGallery();
        else if (datum.parent) zoomToNode(datum.parent);
      } else {
        handleNodeActivation(datum);
      }
    })
    .on("keydown", (event, datum) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (datum === renderRoot) {
        if (datum.parent === root) returnToMetropolitanGallery();
        else if (datum.parent) zoomToNode(datum.parent);
      } else {
        handleNodeActivation(datum);
      }
    })
    .on("pointerenter", (event, datum) => showCursorLabel(event, datum === renderRoot ? headerHoverText(datum) : hoverText(datum)))
    .on("pointermove", moveCursorLabel)
    .on("pointerleave", hideCursorLabel);

  node
    .append("rect")
    .attr("class", "treemap-rect")
    .attr("fill", (datum) => tileFill(datum, renderRoot));

  node
    .append("foreignObject")
    .attr("class", "treemap-label-object")
    .attr("aria-hidden", "true")
    .append("xhtml:div")
    .attr("class", (datum) => datum === renderRoot ? "treemap-header-label" : "treemap-label")
    .html((datum) => datum === renderRoot ? headerLabelMarkup(datum) : tileLabelMarkup(datum));
}

function treemapNodeClass(node, renderRoot) {
  const classes = ["treemap-node", node === renderRoot ? "treemap-header" : "treemap-cell", `kind-${node.data.kind}`];
  const continent = node.ancestors().find((ancestor) => ancestor.data.kind === "continent");
  if (continent) classes.push(`series-${continent.data.name.toLowerCase()}`);
  if (node.data.planned) classes.push("is-planned");
  if (node.data.zeroCountCuisine) classes.push("is-zero-count");
  if (node.data.unclassified) classes.push("is-unclassified");
  if (node.data.id === state.selectedRestaurant?.data.id) classes.push("is-selected");
  return classes.join(" ");
}

function continentFor(node) {
  const continent = node.ancestors().find((ancestor) => ancestor.data.kind === "continent");
  return continent?.data.name ?? null;
}

function tileFill(node, renderRoot) {
  if (node === renderRoot) return PAPER;
  if (node.data.planned) return "rgba(242, 239, 232, 0.4)";
  const continent = continentFor(node);
  if (!continent) return node.data.live ? "#ccc6b9" : "#e2ddd3";
  const base = CONTINENT_COLORS[continent];
  const paperMix = { continent: 0, country: 0.13, region: 0.26, restaurant: 0.4 }[node.data.kind] ?? 0.18;
  return d3.interpolateRgb(base, PAPER)(paperMix);
}

function tileTextColor(node, renderRoot) {
  if (node === renderRoot || node.data.planned) return "#1d211f";
  const color = d3.rgb(tileFill(node, renderRoot));
  const luminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  return luminance < 0.48 ? PAPER : "#1d211f";
}

function tileLabelMarkup(node) {
  const detail = node.data.kind === "restaurant" ? "" : `<span>${escapeHtml(nodeCountLabel(node))}</span>`;
  return `<strong>${escapeHtml(displayNameWithEmoji(node))}</strong>${detail}`;
}

function displayNameWithEmoji(node) {
  if (node.data.kind === "country" && node.data.flag) return `${node.data.flag} ${node.data.name}`;
  if (node.data.kind === "region" && node.data.emoji) return `${node.data.emoji} ${node.data.name}`;
  return node.data.name;
}

function headerLabelMarkup(node) {
  return `<em>${node.parent ? "Click empty header area to go up" : "Choose a tile to explore"}</em>`;
}

function headerAriaLabel(node) {
  if (!node.parent) return `${node.data.name}, top of hierarchy`;
  return `Zoom out from ${node.data.name} to ${node.parent.data.name}`;
}

function headerHoverText(node) {
  return node.parent ? `Back to ${node.parent.data.name}` : `${node.data.name} · top level`;
}

function nodeAriaLabel(node) {
  if (node.data.planned) return `${node.data.name}, planned metropolitan edition`;
  if (node.data.kind === "restaurant") return `${node.data.name}, ${node.data.cuisine}, ${node.data.address}`;
  if (!node.children?.length) return `${node.data.name}, ${node.data.available} loaded restaurants, no deeper data`;
  const next = node.children?.[0]?.data.kind ?? "restaurant";
  return `Zoom into ${node.data.name}, ${node.data.available} loaded restaurants, next layer ${next}`;
}

function nodeCountLabel(node) {
  if (node.data.planned) return "planned";
  if (node.data.kind === "restaurant") return node.data.cuisine;
  if (node.data.zeroCountCuisine) return "0 verified places";
  return `${node.data.available} ${node.data.available === 1 ? "place" : "places"}`;
}

function hoverText(node) {
  if (node.data.planned) return `${node.data.name} · edition planned`;
  if (node.data.kind === "restaurant") return `${node.data.name} · ${node.data.cuisine}`;
  if (node.data.zeroCountCuisine) return `${node.data.name} · 0 verified in Munich`;
  return `${node.data.name} · ${node.data.available} loaded`;
}

function handleNodeActivation(node) {
  if (node.data.planned) {
    state.selectedNode = node;
    state.selectedRestaurant = null;
    updateInterface();
    return;
  }
  if (node.data.kind === "restaurant") {
    state.selectedRestaurant = node;
    state.selectedNode = node;
    updateInterface();
    activeGroup?.selectAll(".treemap-cell").classed("is-selected", (datum) => datum.data.id === node.data.id);
    return;
  }
  if (!node.children?.length) {
    state.selectedNode = node;
    state.selectedRestaurant = null;
    updateInterface();
    return;
  }
  zoomToNode(node);
}

function zoomToNode(node, animate = true) {
  if (!node || treemapTransitioning) return;
  if (node === root) {
    returnToMetropolitanGallery();
    return;
  }
  const previousFocus = focus;
  if (node === previousFocus) return;
  focus = node;
  state.focusId = node.data.id;
  state.selectedNode = null;
  state.selectedRestaurant = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!animate || reducedMotion || !activeGroup || state.mode !== "treemap") {
    xScale.domain([node.x0, node.x1]);
    yScale.domain([node.y0, node.y1]);
    activeGroup?.remove();
    activeGroup = svg.append("g").call(renderTreemapGroup, node);
    positionGroup(activeGroup, node);
  } else if (node.parent === previousFocus) {
    zoomInTreemap(node);
  } else if (previousFocus.parent === node) {
    zoomOutTreemap(previousFocus);
  } else {
    xScale.domain([node.x0, node.x1]);
    yScale.domain([node.y0, node.y1]);
    activeGroup.remove();
    activeGroup = svg.append("g").call(renderTreemapGroup, node);
    positionGroup(activeGroup, node);
  }
  updateInterface();
}

function positionGroup(group, renderRoot, updateLabels = true) {
  const nodes = group.selectAll("g");
  nodes
    .attr("transform", (node) => node === renderRoot ? `translate(0,${-TREEMAP_HEADER})` : `translate(${xScale(node.x0)},${yScale(node.y0)})`);
  nodes.select("rect")
    .attr("width", (node) => tileWidth(node, renderRoot))
    .attr("height", (node) => tileHeight(node, renderRoot));
  nodes.select("foreignObject")
    .attr("width", (node) => tileWidth(node, renderRoot))
    .attr("height", (node) => tileHeight(node, renderRoot));
  nodes.style("--label-font-size", (node) => `${labelFontSize(node, renderRoot)}px`);

  if (updateLabels) {
    const labelNodes = typeof nodes.selection === "function" ? nodes.selection() : nodes;
    labelNodes.classed("label-compact", (node) =>
      node !== renderRoot && compactLabel(node, tileWidth(node, renderRoot), tileHeight(node, renderRoot)),
    );
    labelNodes.classed("label-hidden", (node) =>
      node !== renderRoot && !labelFits(node, tileWidth(node, renderRoot), tileHeight(node, renderRoot)),
    );
  }
}

function tileWidth(node, renderRoot) {
  return node === renderRoot ? layoutWidth : Math.max(0, xScale(node.x1) - xScale(node.x0));
}

function tileHeight(node, renderRoot) {
  return node === renderRoot ? TREEMAP_HEADER : Math.max(0, yScale(node.y1) - yScale(node.y0));
}

function labelFits(node, width, height) {
  if (node.data.kind === "restaurant") return width >= 42 && height >= 32;
  const fontSize = labelFontSize(node, null, width, height);
  const isCompact = compactLabel(node, width, height);
  const horizontalPadding = isCompact ? 12 : node.data.kind === "region" ? 16 : 22;
  const verticalPadding = isCompact ? 10 : node.data.kind === "region" ? 14 : 20;
  const detailHeight = isCompact ? 0 : 13;
  const textWidth = Math.max(1, width - horizontalPadding);
  const estimatedLines = Math.ceil((displayNameWithEmoji(node).length * fontSize * 0.52) / textWidth);
  if (estimatedLines > 3) return false;
  const cappedLines = Math.min(estimatedLines, 3);
  const neededHeight = cappedLines * fontSize * 1.08 + detailHeight + verticalPadding;
  return width >= 24 && height >= neededHeight;
}

function compactLabel(node, width, height) {
  return node.data.kind !== "restaurant" && (height < 54 || width < 76);
}

function labelFontSize(node, renderRoot, measuredWidth, measuredHeight) {
  if (node === renderRoot) return 20;
  const width = measuredWidth ?? tileWidth(node, renderRoot);
  const height = measuredHeight ?? tileHeight(node, renderRoot);
  if (node.data.kind === "continent") return clampNumber(Math.min(width / 9, height / 3.7), 22, 34);
  if (node.data.kind === "country") return clampNumber(Math.min(width / 6.6, height / 2.5), 8, 25);
  if (node.data.kind === "region") return clampNumber(Math.min(width / 7.2, height / 2.7), 8, 17);
  if (node.data.kind === "restaurant") return clampNumber(Math.min(width / 8, height / 3.4), 8, 10);
  return 14;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value || min));
}

function zoomInTreemap(node) {
  treemapTransitioning = true;
  const outgoing = activeGroup.attr("pointer-events", "none");
  const incoming = activeGroup = svg.append("g")
    .attr("opacity", 0)
    .attr("pointer-events", "none")
    .call(renderTreemapGroup, node);

  // Lay out the entering layer in the clicked tile's current coordinate space
  // before changing the domains. This makes it expand from its actual origin.
  positionGroup(incoming, node);
  xScale.domain([node.x0, node.x1]);
  yScale.domain([node.y0, node.y1]);
  const transition = svg.transition().duration(750).ease(d3.easeCubicInOut);

  // Match the D3 zoomable-treemap pattern: the old layer expands and is
  // removed without fading, while the new detail layer fades in above it.
  outgoing.transition(transition)
    .remove()
    .call(positionGroup, node.parent, false);
  incoming.transition(transition)
    .attrTween("opacity", () => d3.interpolate(0, 1))
    .call(positionGroup, node, false)
    .on("end", finishTreemapTransition);
}

function zoomOutTreemap(node) {
  treemapTransitioning = true;
  const parent = node.parent;
  const outgoing = activeGroup.attr("pointer-events", "none");
  const incoming = activeGroup = svg.insert("g", "*")
    .attr("pointer-events", "none")
    .call(renderTreemapGroup, parent);

  // Start the parent layer in the current child's coordinate space underneath
  // the outgoing layer, then contract it into the parent overview.
  positionGroup(incoming, parent);
  xScale.domain([parent.x0, parent.x1]);
  yScale.domain([parent.y0, parent.y1]);
  const transition = svg.transition().duration(750).ease(d3.easeCubicInOut);

  // Keep the old child layer on top while it contracts and fades; reveal the
  // already-positioned parent layer underneath.
  outgoing.transition(transition)
    .remove()
    .attrTween("opacity", () => d3.interpolate(1, 0))
    .call(positionGroup, node, false);
  incoming.transition(transition)
    .call(positionGroup, parent, false)
    .on("end", finishTreemapTransition);
}

function finishTreemapTransition() {
  treemapTransitioning = false;
  activeGroup
    ?.attr("pointer-events", null)
    .attr("opacity", 1);
  positionGroup(activeGroup, focus, true);
  updateControls();
}

function updateInterface() {
  updateBreadcrumbs();
  updateCopy();
  updateDepthPath();
  updateRail();
  updateSelectionCard();
  updateControls();
}

function updateBreadcrumbs() {
  const breadcrumbs = scene.querySelector(".treemap-breadcrumbs");
  if (!breadcrumbs || !focus) return;
  const path = focus.ancestors().reverse().filter((node) => node !== root);
  const levels = path.map((node) => {
    const siblings = node.parent?.children ?? [node];
    const options = siblings.map((sibling) => `
      <option value="${escapeHtml(sibling.data.id)}"${sibling === node ? " selected" : ""}>${escapeHtml(displayNameWithEmoji(sibling))}</option>
    `).join("");
    const currentAttribute = node === focus ? ` aria-current="page"` : "";
    return `
      <span class="breadcrumb-separator" aria-hidden="true">/</span>
      <span class="breadcrumb-level">
        <button class="breadcrumb-link" type="button" data-breadcrumb-target="${escapeHtml(node.data.id)}"${currentAttribute} aria-label="Go to ${escapeHtml(displayNameWithEmoji(node))}">
          ${escapeHtml(displayNameWithEmoji(node))}
        </button>
        <select class="breadcrumb-select" data-breadcrumb-level="${node.depth}" aria-label="Choose another ${breadcrumbLevelLabel(node)}">
          ${options}
        </select>
        <span class="breadcrumb-chevron" aria-hidden="true">⌄</span>
      </span>
    `;
  }).join("");
  breadcrumbs.innerHTML = `
    <button class="breadcrumb-home" type="button" data-action="home">Metropolitans</button>
    ${levels}
  `;
}

function breadcrumbLevelLabel(node) {
  return {
    metropolitan: "city",
    continent: "continent",
    country: "country",
    region: "regional cuisine",
    restaurant: "restaurant",
  }[node.data.kind] ?? "level";
}

function updateCopy() {
  let copy;
  if (state.mode === "map") {
    const count = mapRestaurants().length;
    copy = {
      kicker: `${focus.data.name} · physical layer`,
      title: "Cuisine,<br>at street level.",
      intro: `Every visible point is an OpenStreetMap restaurant coordinate for ${focus.data.name} inside Munich.`,
      caption: `${count} sourced ${count === 1 ? "location" : "locations"} · Munich`,
      key: "OSM restaurant coordinates",
    };
  } else {
    const copies = {
      root: {
        kicker: "Metropolitan atlas · 01",
        title: "Cities,<br>tiled by food.",
        intro: "Choose a metropolitan edition, then move through continents, countries, and culinary regions.",
        caption: `${metropolitanEditions.length} metropolitan editions · Munich ${datasetMeta.includedRestaurants.toLocaleString("en")} live`,
        key: "Rectangle area = food available",
      },
      metropolitan: {
        kicker: `${focus.data.name} · continents`,
        title: "A city becomes<br>a world of food.",
        intro: "Continents are sized by loaded restaurants; each color stays consistent as you drill into countries and cuisines.",
        caption: `${focus.children?.length ?? 0} continents · ${focus.data.available} restaurants`,
        key: "Color = continent · Area = restaurants",
      },
      continent: {
        kicker: `${focus.data.name} · countries`,
        title: "A continent,<br>through Munich.",
        intro: "Country tiles preserve geographic neighborhoods while their area reveals local restaurant availability.",
        caption: `${focus.children?.length ?? 0} countries · ${focus.data.available} restaurants`,
        key: "Area = restaurants in Munich",
      },
      country: {
        kicker: `${focus.data.name} · ${focus.children?.[0]?.data.kind === "restaurant" ? "restaurants" : "regions"}`,
        title: focus.children?.[0]?.data.kind === "restaurant" ? "A national cuisine,<br>place by place." : "A country opens<br>into traditions.",
        intro: focus.children?.[0]?.data.kind === "restaurant"
          ? "No additional regional cuisine layer is available, so the country opens directly into its Munich restaurants."
          : "Regional cuisines come from the researched taxonomy. Zero-count tiles show traditions not yet verified in Munich; uncertain restaurants remain unclassified.",
        caption: focus.children?.[0]?.data.kind === "restaurant"
          ? `${focus.children.length} restaurants · select for details`
          : `${focus.children?.length ?? 0} regions · ${focus.data.available} restaurants`,
        key: focus.children?.[0]?.data.kind === "restaurant"
          ? "Neighboring tiles = nearby addresses"
          : "Position = origin · Area = count with label minimum",
      },
      region: {
        kicker: `${focus.data.name} · restaurants`,
        title: "A region finds<br>its restaurants.",
        intro: focus.data.zeroCountCuisine
          ? "No dedicated Munich restaurant currently has enough evidence for this regional cuisine. Its visible absence is part of the atlas."
          : focus.data.unclassified
            ? "These restaurants are country-specific, but available evidence is not precise enough for a responsible regional assignment."
            : "Only restaurants with explicit regional evidence appear in this cuisine tradition.",
        caption: `${focus.children?.length ?? 0} ${focus.children?.length === 1 ? "restaurant" : "restaurants"} · select for details`,
        key: "Neighboring tiles = nearby addresses",
      },
    };
    copy = copies[focus.data.kind] ?? copies.root;
  }

  document.querySelector("#view-kicker").textContent = copy.kicker;
  document.querySelector("#view-title").innerHTML = copy.title;
  document.querySelector("#view-intro").textContent = copy.intro;
  document.querySelector("#stage-caption").textContent = copy.caption;
  document.querySelector("#key-label").textContent = copy.key;
}

function updateDepthPath() {
  const path = focus.ancestors().reverse();
  const pathNode = document.querySelector("#depth-path");
  pathNode.innerHTML = path
    .map((node, index) => {
      const label = node === root ? "Metropolitans" : node.data.name;
      const current = node === focus ? ` aria-current="step"` : "";
      return `<li><button type="button" data-focus-id="${node.data.id}"${current}><span>${String(index + 1).padStart(2, "0")}</span>${label}</button></li>`;
    })
    .join("");
}

function updateRail() {
  const selected = state.selectedRestaurant?.data ?? null;
  if (selected) {
    coordinates.innerHTML = coordinateMarkup(selected.lat, selected.lng);
    railContent.innerHTML = `
      <p class="place-number place-number-small">${selected.symbol}</p>
      <div class="metric-block">
        <p class="metric-label">Selected restaurant</p>
        <p class="metric-row metric-row-wrap"><span>${escapeHtml(selected.name)}</span></p>
        <p class="rail-address">${escapeHtml(selected.address)}</p>
        <a class="rail-source" href="${selected.source}" target="_blank" rel="noreferrer">Restaurant source ↗</a>
      </div>
      <div class="metric-block">
        <p class="metric-label">Origin hierarchy</p>
        <p class="metric-row"><span>${escapeHtml(selected.region)}</span><span>${escapeHtml(selected.cuisine)}</span></p>
      </div>
    `;
    return;
  }

  if (Number.isFinite(focus.data.lat) && Number.isFinite(focus.data.lng)) coordinates.innerHTML = coordinateMarkup(focus.data.lat, focus.data.lng);
  else coordinates.innerHTML = `Geographic<br>bearings`;

  const children = focus.children ?? [];
  const childKind = children[0]?.data.kind ?? "restaurant";
  railContent.innerHTML = `
    <p class="place-number">${focus.data.available ?? 0}</p>
    <div class="metric-block">
      <p class="metric-label">Loaded food records</p>
      <p class="metric-row"><span>${focus.data.name}</span><span>${focus.data.kind}</span></p>
    </div>
    <div class="metric-block">
      <p class="metric-label">Next layer</p>
      <p class="metric-row"><span>${children.length} ${pluralize(childKind, children.length)}</span><span>Geo-neighboring</span></p>
      <p class="metric-row"><span>Rectangle area</span><span>Record count</span></p>
    </div>
  `;
}

function updateSelectionCard() {
  const selected = state.selectedRestaurant?.data ?? null;
  if (selected) {
    const contextMapAction = state.mode === "treemap"
      ? `<button class="map-settings-action" type="button" data-action="map-focus">Map this cuisine tradition</button>`
      : "";
    selectionCard.innerHTML = `
      <div>
        <div class="selection-name"><strong>${escapeHtml(selected.name)}</strong><span>${escapeHtml(selected.region)}</span></div>
        <p class="selection-copy">${escapeHtml(selected.address)} · ${escapeHtml(selected.cuisine)}</p>
      </div>
      <div class="map-actions">
        ${contextMapAction}
        <a class="primary-action" href="${googleMapsUrl(selected)}" target="_blank" rel="noreferrer"><span>Open in Google Maps</span><span aria-hidden="true">↗</span></a>
      </div>
    `;
    return;
  }

  if (state.selectedNode?.data.planned) {
    const edition = state.selectedNode.data;
    selectionCard.innerHTML = `
      <div>
        <div class="selection-name"><strong>${edition.name}</strong><span>${edition.country}</span></div>
        <p class="selection-copy">This metropolitan edition is positioned geographically and reserved for a future verified dataset.</p>
      </div>
      <span class="planned-status">Edition planned</span>
    `;
    return;
  }

  const next = [...(focus.children ?? [])]
    .filter((node) => !node.data.planned)
    .sort((a, b) => b.value - a.value)[0];
  const canMap = ["continent", "country", "region"].includes(focus.data.kind) && restaurantLeaves(focus).length > 0;
  const mapCount = restaurantLeaves(focus).length;
  const actions = canMap
    ? `<div class="map-actions">
        ${["continent", "country"].includes(focus.data.kind) && next ? `<button class="map-settings-action" type="button" data-action="zoom-forward">Open ${escapeHtml(next.data.name)}</button>` : ""}
        <button class="primary-action" type="button" data-action="map-focus"><span>Map ${mapCount} ${mapCount === 1 ? "restaurant" : "restaurants"}</span><span aria-hidden="true">↗</span></button>
      </div>`
    : next
      ? `<button class="primary-action" type="button" data-action="zoom-forward"><span>Zoom into ${escapeHtml(next.data.name)}</span><span aria-hidden="true">＋</span></button>`
      : "";
  selectionCard.innerHTML = `
    <div>
      <div class="selection-name"><strong>${focus.data.name}</strong><span>${focus.data.available ?? 0} loaded</span></div>
      <p class="selection-copy">${selectionInstruction()}</p>
    </div>
    ${actions}
  `;
}

function selectionInstruction() {
  if (focus === root) return "Select a metropolitan tile. Munich is the live edition; smaller outlined tiles mark planned cities.";
  if (focus.data.kind === "continent") return "Zoom into a country, or reveal every qualifying restaurant from this continent directly on the Munich map.";
  if (focus.data.kind === "country" && focus.children?.[0]?.data.kind === "restaurant") return "Select a restaurant tile for its sourced address, or reveal the national cuisine directly on the Munich map.";
  if (focus.data.kind === "country") return "Open a regional cuisine. Zero-count traditions remain visible, while uncertain restaurants are collected without a guessed assignment.";
  if (focus.data.kind === "region" && focus.data.zeroCountCuisine) return "No dedicated restaurant is verified for this tradition in the current Munich snapshot.";
  if (focus.data.kind === "region" && focus.data.unclassified) return "These restaurants need stronger menu or first-party evidence before regional classification.";
  if (focus.data.kind === "region") return "Select a restaurant tile for its evidence-backed regional classification, or reveal it on the physical map.";
  return `Select a ${focus.children?.[0]?.data.kind ?? "tile"} tile to continue the geographic zoom.`;
}

function updateControls() {
  const isRoot = focus === root && state.mode === "treemap";
  document.querySelector("[data-action='back']").hidden = isRoot;
  document.querySelector("[data-action='back']").disabled = treemapTransitioning || isRoot;
  document.querySelector("[data-action='zoom-out']").disabled = treemapTransitioning || isRoot;
  document.querySelector("[data-action='zoom-in']").disabled = treemapTransitioning || state.mode === "map" || !focus.children?.length;
}

function coordinateMarkup(lat, lng) {
  const latitude = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;
  return `${latitude}<br>${longitude}`;
}

function pluralize(kind, count) {
  if (count === 1) return kind;
  if (kind === "country") return "countries";
  return `${kind}s`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function restaurantLeaves(node) {
  return node.leaves().filter((leaf) => leaf.data.kind === "restaurant");
}

function mapRestaurants() {
  return restaurantLeaves(focus).map((leaf) => leaf.data);
}

function renderPhysicalMap() {
  const visible = mapRestaurants();
  if (!visible.length) return;
  if (!window.L) {
    scene.innerHTML = `<div class="treemap-error" role="alert"><strong>The interactive map could not load.</strong><span>Check the network connection and try again.</span></div>`;
    return;
  }
  cleanupMap();
  state.mode = "map";
  const mapView = mapViewFor(visible);
  if (!state.selectedRestaurant || !visible.some((restaurant) => restaurant.id === state.selectedRestaurant.data.id)) {
    state.selectedRestaurant = nodeById.get(visible[0].id);
  }
  scene.innerHTML = `
    <div class="physical-map semantic-layer" aria-label="Interactive map of ${escapeHtml(focus.data.name)} restaurants in Munich">
      <div class="leaflet-map" id="restaurant-map" role="application" aria-label="Pan and zoom map of sourced restaurant locations"></div>
      <div class="map-source-strip"><span>Interactive map</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a><span class="map-cluster-status">${visible.length} restaurants</span></div>
    </div>
  `;

  leafletMap = window.L.map(scene.querySelector("#restaurant-map"), {
    center: [mapView.center.lat, mapView.center.lng],
    zoom: mapView.zoom,
    minZoom: 10,
    maxZoom: 18,
    scrollWheelZoom: true,
    dragging: true,
    doubleClickZoom: true,
    touchZoom: true,
    keyboard: true,
    zoomControl: true,
    attributionControl: false,
  });

  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 10,
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors",
  }).addTo(leafletMap);

  leafletMarkerLayer = window.L.layerGroup().addTo(leafletMap);
  const refreshMarkers = () => renderLeafletMarkers(visible);
  leafletMap.on("zoomend", refreshMarkers);
  window.setTimeout(() => {
    leafletMap?.invalidateSize({ pan: false });
    refreshMarkers();
  });
  updateInterface();
}

function mapViewFor(list) {
  const center = list.length === 1
    ? { lat: list[0].lat, lng: list[0].lng }
    : {
        lat: d3.mean(list, (restaurant) => restaurant.lat),
        lng: d3.mean(list, (restaurant) => restaurant.lng),
      };
  return { center, zoom: list.length === 1 ? 15 : list.length <= 3 ? 14 : 12 };
}

function renderLeafletMarkers(list) {
  if (!leafletMap || !leafletMarkerLayer) return;
  hideCursorLabel();
  leafletMarkerLayer.clearLayers();
  const clusters = clusterRestaurants(list, leafletMap.getZoom());
  clusters.forEach((cluster) => {
    if (cluster.restaurants.length === 1) addRestaurantMarker(cluster.restaurants[0]);
    else addClusterMarker(cluster);
  });
  const status = scene.querySelector(".map-cluster-status");
  if (status) status.textContent = `${clusters.length} markers · ${list.length} restaurants`;
}

function addRestaurantMarker(restaurant) {
  const active = restaurant.id === state.selectedRestaurant?.data.id ? " is-active" : "";
  const icon = window.L.divIcon({
    className: `coordinate-marker marker-${restaurant.markerKind}${active}`,
    html: `<span aria-hidden="true">${restaurant.symbol}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  const marker = window.L.marker([restaurant.lat, restaurant.lng], {
    icon,
    keyboard: true,
    riseOnHover: true,
  }).addTo(leafletMarkerLayer);
  const element = marker.getElement();
  element.dataset.restaurant = restaurant.id;
  element.dataset.name = restaurant.name;
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", `Select ${restaurant.name}`);
  marker.on("click", () => selectMapRestaurant(restaurant.id));
  bindLeafletHover(marker, `${restaurant.name} · ${restaurant.cuisine}`);
}

function addClusterMarker(cluster) {
  const count = cluster.restaurants.length;
  const icon = window.L.divIcon({
    className: "coordinate-marker coordinate-cluster",
    html: `<span aria-hidden="true">${count}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  const marker = window.L.marker([cluster.lat, cluster.lng], {
    icon,
    keyboard: true,
    riseOnHover: true,
  }).addTo(leafletMarkerLayer);
  const element = marker.getElement();
  element.dataset.name = `${count} restaurants nearby`;
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", `Zoom into ${count} nearby restaurants`);
  marker.on("click", () => {
    leafletMap.flyTo([cluster.lat, cluster.lng], Math.min(leafletMap.getZoom() + 2, 18), { duration: 0.5 });
  });
  bindLeafletHover(marker, `${count} restaurants nearby`);
}

function bindLeafletHover(marker, label) {
  marker.on("mouseover", (event) => showCursorLabel(event.originalEvent, label));
  marker.on("mousemove", (event) => moveCursorLabel(event.originalEvent));
  marker.on("mouseout", hideCursorLabel);
}

function clusterRestaurants(list, zoom) {
  const threshold = zoom >= 15 ? 12 : zoom >= 13 ? 18 : 24;
  const clusters = [];
  list.forEach((restaurant) => {
    const point = worldPixel(restaurant.lat, restaurant.lng, zoom);
    let nearest = null;
    let nearestDistance = Infinity;
    clusters.forEach((cluster) => {
      const distance = Math.hypot(point.x - cluster.x, point.y - cluster.y);
      if (distance <= threshold && distance < nearestDistance) {
        nearest = cluster;
        nearestDistance = distance;
      }
    });
    if (!nearest) {
      clusters.push({ x: point.x, y: point.y, lat: restaurant.lat, lng: restaurant.lng, restaurants: [restaurant] });
      return;
    }
    const count = nearest.restaurants.length;
    nearest.x = (nearest.x * count + point.x) / (count + 1);
    nearest.y = (nearest.y * count + point.y) / (count + 1);
    nearest.lat = (nearest.lat * count + restaurant.lat) / (count + 1);
    nearest.lng = (nearest.lng * count + restaurant.lng) / (count + 1);
    nearest.restaurants.push(restaurant);
  });
  return clusters;
}

function worldPixel(lat, lng, zoom) {
  const scale = 256 * 2 ** zoom;
  const sine = Math.sin((Math.min(Math.max(lat, -85), 85) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
}

function selectMapRestaurant(id) {
  state.selectedRestaurant = nodeById.get(id) ?? state.selectedRestaurant;
  scene.querySelectorAll(".coordinate-marker").forEach((marker) => marker.classList.toggle("is-active", marker.dataset.restaurant === id));
  updateRail();
  updateSelectionCard();
}

function cleanupMap() {
  leafletMap?.off();
  leafletMap?.remove();
  leafletMap = null;
  leafletMarkerLayer = null;
}

function transitionScene(update) {
  if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

function showCursorLabel(event, text) {
  cursorLabel.textContent = text;
  cursorLabel.classList.add("is-visible");
  moveCursorLabel(event);
}

function moveCursorLabel(event) {
  cursorLabel.style.left = `${event.clientX}px`;
  cursorLabel.style.top = `${event.clientY}px`;
}

function hideCursorLabel() {
  cursorLabel.classList.remove("is-visible");
}

function zoomForward() {
  const child = [...(focus.children ?? [])]
    .filter((node) => !node.data.planned)
    .sort((a, b) => b.value - a.value)[0];
  if (child) handleNodeActivation(child);
}

function goBack() {
  if (state.mode === "map") {
    state.mode = "treemap";
    state.selectedRestaurant = null;
    transitionScene(renderTreemap);
    return;
  }
  if (focus.parent === root) returnToMetropolitanGallery();
  else if (focus.parent) zoomToNode(focus.parent);
}

document.addEventListener("click", (event) => {
  const cityTrigger = event.target.closest("[data-city-id]");
  if (cityTrigger) {
    openMetropolitan(cityTrigger.dataset.cityId);
    return;
  }

  const focusTrigger = event.target.closest("[data-focus-id]");
  if (focusTrigger) {
    const node = nodeById.get(focusTrigger.dataset.focusId);
    if (node && node !== focus) zoomToNode(node);
    return;
  }

  const breadcrumbTarget = event.target.closest("[data-breadcrumb-target]");
  if (breadcrumbTarget) {
    const node = nodeById.get(breadcrumbTarget.dataset.breadcrumbTarget);
    if (!node || node === focus) return;
    if (node.data.kind === "metropolitan") {
      openMetropolitan(node.data.id);
      return;
    }
    const isDirectDrill = node.parent === focus || focus.parent === node;
    zoomToNode(node, isDirectDrill);
    return;
  }

  const trigger = event.target.closest("[data-action]");
  const action = trigger?.dataset.action;
  if (!action) return;
  if (action === "home") {
    returnToMetropolitanGallery();
  }
  if (action === "back" || action === "zoom-out") goBack();
  if (action === "zoom-in" || action === "zoom-forward") zoomForward();
  if (action === "map-focus") transitionScene(renderPhysicalMap);
  if (action === "about") {
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!expanded));
    document.querySelector("#about-drawer").setAttribute("aria-hidden", String(expanded));
  }
});

document.addEventListener("change", (event) => {
  const select = event.target.closest(".breadcrumb-select");
  if (!select) return;
  const targetId = select.value;
  requestAnimationFrame(() => {
    const node = nodeById.get(targetId);
    if (!node || node === focus) return;
    if (node.data.kind === "metropolitan") {
      openMetropolitan(node.data.id);
      return;
    }
    const isDirectDrill = node.parent === focus || focus.parent === node;
    zoomToNode(node, isDirectDrill);
  }, 80);
});

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (state.mode !== "treemap") return;
    const nextWidth = Math.max(320, Math.round(scene.clientWidth || layoutWidth));
    const nextHeight = Math.max(274, Math.round(scene.clientHeight || layoutHeight + TREEMAP_HEADER) - TREEMAP_HEADER);
    if (Math.abs(nextWidth - layoutWidth) < 8 && Math.abs(nextHeight - layoutHeight) < 8) return;
    renderTreemap();
  }, 160);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const aboutButton = document.querySelector("[data-action='about']");
  if (aboutButton.getAttribute("aria-expanded") === "true") {
    aboutButton.click();
    aboutButton.focus();
  } else {
    goBack();
  }
});

initialize();
