import { buildAtlasHierarchy, datasetMeta, googleMapsUrl, metropolitanEditions, restaurants } from "./restaurants.js";

const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const PACK_SIZE = 1000;

const scene = document.querySelector("#scene");
const selectionCard = document.querySelector("#selection-card");
const railContent = document.querySelector("#rail-content");
const coordinates = document.querySelector("#coordinates");
const cursorLabel = document.querySelector("#cursor-label");

const state = {
  mode: "pack",
  focusId: "atlas-root",
  selectedNode: null,
  selectedRestaurant: null,
};

let d3;
let root;
let focus;
let view;
let svg;
let circles;
let labels;
let nodeById = new Map();
let mapResizeObserver = null;

async function initialize() {
  scene.innerHTML = `<div class="pack-loading">Packing the atlas…</div>`;
  try {
    d3 = await import(D3_URL);
    buildPackedHierarchy();
    renderPack(false);
  } catch (error) {
    console.error(error);
    scene.innerHTML = `
      <div class="pack-error" role="alert">
        <strong>The atlas could not load.</strong>
        <span>Check the network connection and reload this page.</span>
      </div>
    `;
  }
}

function buildPackedHierarchy() {
  root = d3.hierarchy(buildAtlasHierarchy());
  root.sum((datum) => datum.layoutValue ?? 0);
  sortChildrenGeographically(root);
  d3.pack().size([PACK_SIZE, PACK_SIZE]).padding((node) => Math.max(3, 10 - node.depth * 1.4))(root);
  orientHierarchyGeographically(root);
  nodeById = new Map(root.descendants().map((node) => [node.data.id, node]));
  focus = nodeById.get(state.focusId) ?? root;
}

function sortChildrenGeographically(node) {
  node.eachBefore((parent) => {
    if (!parent.children?.length) return;
    const origin = geographicOrigin(parent);
    parent.children.sort((a, b) => geographicAngle(a, origin) - geographicAngle(b, origin));
  });
}

function geographicOrigin(node) {
  if (Number.isFinite(node.data.lat) && Number.isFinite(node.data.lng)) return node.data;
  const children = node.children ?? [];
  return {
    lat: d3.mean(children, (child) => child.data.lat) ?? 0,
    lng: d3.mean(children, (child) => child.data.lng) ?? 0,
  };
}

function geographicAngle(node, origin) {
  const latitude = node.data.lat ?? origin.lat;
  const longitude = node.data.lng ?? origin.lng;
  const x = (longitude - origin.lng) * Math.cos((origin.lat * Math.PI) / 180);
  const y = -(latitude - origin.lat);
  return Math.atan2(y, x);
}

function orientHierarchyGeographically(parent) {
  const children = parent.children ?? [];
  if (children.length > 1) {
    const origin = geographicOrigin(parent);
    const candidates = [false, true].map((mirror) => bestOrientation(parent, children, origin, mirror));
    const best = candidates.sort((a, b) => a.error - b.error)[0];
    children.forEach((child) => transformSubtree(child, parent.x, parent.y, best.mirror, best.angle));
  }
  children.forEach(orientHierarchyGeographically);
}

function bestOrientation(parent, children, origin, mirror) {
  const pairs = children.map((child) => {
    const dx = (mirror ? -1 : 1) * (child.x - parent.x);
    const dy = child.y - parent.y;
    const currentLength = Math.hypot(dx, dy) || 1;
    const longitudeScale = Math.cos((origin.lat * Math.PI) / 180);
    const gx = ((child.data.lng ?? origin.lng) - origin.lng) * longitudeScale;
    const gy = -((child.data.lat ?? origin.lat) - origin.lat);
    const geoLength = Math.hypot(gx, gy) || 1;
    return { cx: dx / currentLength, cy: dy / currentLength, gx: gx / geoLength, gy: gy / geoLength };
  });

  const dot = d3.sum(pairs, (pair) => pair.cx * pair.gx + pair.cy * pair.gy);
  const cross = d3.sum(pairs, (pair) => pair.cx * pair.gy - pair.cy * pair.gx);
  const angle = Math.atan2(cross, dot);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const error = d3.sum(pairs, (pair) => {
    const x = pair.cx * cosine - pair.cy * sine;
    const y = pair.cx * sine + pair.cy * cosine;
    return 1 - (x * pair.gx + y * pair.gy);
  });
  return { mirror, angle, error };
}

function transformSubtree(node, cx, cy, mirror, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  node.each((descendant) => {
    const dx = (mirror ? -1 : 1) * (descendant.x - cx);
    const dy = descendant.y - cy;
    descendant.x = cx + dx * cosine - dy * sine;
    descendant.y = cy + dx * sine + dy * cosine;
  });
}

function renderPack(animate = true) {
  cleanupMap();
  state.mode = "pack";
  scene.innerHTML = `
    <div class="pack-shell semantic-layer">
      <svg class="pack-svg" viewBox="-500 -500 1000 1000" role="img" aria-labelledby="pack-title pack-description">
        <title id="pack-title">Zoomable metropolitan food hierarchy</title>
        <desc id="pack-description">Circle area represents loaded restaurant records. Circle orientation follows geographic bearing at every hierarchy level.</desc>
      </svg>
      <div class="pack-compass" aria-hidden="true"><span>N</span><span>E</span><span>S</span><span>W</span></div>
    </div>
  `;

  svg = d3.select(scene.querySelector(".pack-svg"));
  const descendants = root.descendants().slice(1);
  const nodeLayer = svg.append("g").attr("class", "pack-node-layer");

  circles = nodeLayer
    .selectAll("circle")
    .data(descendants)
    .join("circle")
    .attr("class", (node) => circleClass(node))
    .attr("role", "button")
    .attr("aria-label", (node) => nodeAriaLabel(node))
    .attr("tabindex", -1)
    .on("click", (event, node) => {
      event.stopPropagation();
      handleNodeActivation(node);
    })
    .on("keydown", (event, node) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNodeActivation(node);
      }
    })
    .on("pointerenter", (event, node) => showCursorLabel(event, hoverText(node)))
    .on("pointermove", (event) => moveCursorLabel(event))
    .on("pointerleave", hideCursorLabel);

  labels = svg
    .append("g")
    .attr("class", "pack-label-layer")
    .attr("text-anchor", "middle")
    .attr("pointer-events", "none")
    .selectAll("text")
    .data(descendants)
    .join("text")
    .attr("class", (node) => labelClass(node))
    .style("display", "none")
    .style("fill-opacity", 0);

  labels
    .append("tspan")
    .attr("class", "pack-label-name")
    .attr("x", 0)
    .attr("dy", "-0.1em")
    .text((node) => shortLabel(node.data.name));

  labels
    .append("tspan")
    .attr("class", "pack-label-count")
    .attr("x", 0)
    .attr("dy", "1.45em")
    .text((node) => nodeCountLabel(node));

  svg.on("click", () => {
    if (focus.parent) zoomToNode(focus.parent);
  });

  view = undefined;
  zoomToNode(focus, animate);
}

function circleClass(node) {
  const classes = ["pack-circle", `kind-${node.data.kind}`];
  const continent = node.ancestors().find((ancestor) => ancestor.data.kind === "continent");
  if (continent) classes.push(`series-${continent.data.name.toLowerCase()}`);
  if (node.data.planned) classes.push("is-planned");
  return classes.join(" ");
}

function labelClass(node) {
  const classes = ["pack-label", `kind-${node.data.kind}`];
  const continent = node.ancestors().find((ancestor) => ancestor.data.kind === "continent");
  if (continent) classes.push(`series-${continent.data.name.toLowerCase()}`);
  return classes.join(" ");
}

function nodeAriaLabel(node) {
  if (node.data.planned) return `${node.data.name}, planned metropolitan edition`;
  if (node.data.kind === "restaurant") return `${node.data.name}, ${node.data.cuisine}, ${node.data.address}`;
  const next = node.children?.[0]?.data.kind ?? "restaurant";
  return `Zoom into ${node.data.name}, ${node.data.available} loaded restaurants, next layer ${next}`;
}

function nodeCountLabel(node) {
  if (node.data.planned) return "planned";
  if (node.data.kind === "restaurant") return node.data.cuisine;
  return `${node.data.available} ${node.data.available === 1 ? "place" : "places"}`;
}

function shortLabel(name) {
  return name.length > 20 ? `${name.slice(0, 18)}…` : name;
}

function hoverText(node) {
  if (node.data.planned) return `${node.data.name} · edition planned`;
  if (node.data.kind === "restaurant") return `${node.data.name} · ${node.data.cuisine}`;
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
    return;
  }
  zoomToNode(node);
}

function zoomToNode(node, animate = true) {
  if (!node) return;
  focus = node;
  state.focusId = node.data.id;
  state.selectedNode = null;
  state.selectedRestaurant = null;

  const target = [focus.x, focus.y, focus.r * 2.08];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!view || !animate || reducedMotion) {
    zoomTo(target);
    updateLabelVisibility(false);
    updateInteractivity();
    updateInterface();
    return;
  }

  const transition = svg
    .transition()
    .duration(760)
    .ease(d3.easeCubicInOut)
    .tween("zoom", () => {
      const interpolate = d3.interpolateZoom(view, target);
      return (time) => zoomTo(interpolate(time));
    });

  labels
    .filter(function filterLabel(labelNode) {
      return labelNode.parent === focus || this.style.display === "inline";
    })
    .transition(transition)
    .style("fill-opacity", (labelNode) => (labelNode.parent === focus ? 1 : 0))
    .on("start", function showLabel(labelNode) {
      if (labelNode.parent === focus) this.style.display = "inline";
    })
    .on("end", function hideLabel(labelNode) {
      if (labelNode.parent !== focus) this.style.display = "none";
    });

  transition.on("end", () => {
    updateLabelVisibility(false);
    updateInteractivity();
    updateInterface();
  });
  updateInterface();
}

function zoomTo(nextView) {
  const scale = PACK_SIZE / nextView[2];
  view = nextView;
  circles
    .attr("transform", (node) => `translate(${(node.x - nextView[0]) * scale},${(node.y - nextView[1]) * scale})`)
    .attr("r", (node) => node.r * scale);
  labels.attr("transform", (node) => `translate(${(node.x - nextView[0]) * scale},${(node.y - nextView[1]) * scale})`);
}

function updateLabelVisibility(transitioned = false) {
  if (transitioned) return;
  labels
    .style("display", (node) => (labelVisible(node) ? "inline" : "none"))
    .style("fill-opacity", (node) => (labelVisible(node) ? 1 : 0));
}

function labelVisible(node) {
  if (node.parent !== focus || !view) return false;
  const radius = node.r * (PACK_SIZE / view[2]);
  return radius >= (node.data.kind === "restaurant" ? 25 : 18);
}

function updateInteractivity() {
  circles
    .attr("tabindex", (node) => (node.parent === focus ? 0 : -1))
    .style("pointer-events", (node) => (node.parent === focus ? "auto" : "none"))
    .classed("is-focus-child", (node) => node.parent === focus)
    .classed("is-muted", (node) => node.parent !== focus && !isAncestor(node, focus));
}

function isAncestor(candidate, node) {
  return node.ancestors().includes(candidate);
}

function updateInterface() {
  updateCopy();
  updateDepthPath();
  updateRail();
  updateSelectionCard();
  updateControls();
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
        title: "Cities,<br>packed by food.",
        intro: "Choose a metropolitan edition, then move through continents, countries, and culinary regions.",
        caption: `${metropolitanEditions.length} metropolitan editions · Munich ${datasetMeta.includedRestaurants.toLocaleString("en")} live`,
        key: "Area = food available",
      },
      metropolitan: {
        kicker: `${focus.data.name} · continents`,
        title: "A city becomes<br>a world of food.",
        intro: "Continents are packed by loaded restaurants and oriented by their real geographic bearing.",
        caption: `${focus.children?.length ?? 0} continents · ${focus.data.available} restaurants`,
        key: "Position = geographic bearing",
      },
      continent: {
        kicker: `${focus.data.name} · countries`,
        title: "A continent,<br>through Munich.",
        intro: "Country bubbles preserve their geographic relationship while their area reveals local availability.",
        caption: `${focus.children?.length ?? 0} countries · ${focus.data.available} restaurants`,
        key: "Area = restaurants in Munich",
      },
      country: {
        kicker: `${focus.data.name} · regions`,
        title: "A country opens<br>into traditions.",
        intro: "Open the national cuisine layer and any unambiguous regional or style traditions, or map the whole country cuisine directly.",
        caption: `${focus.children?.length ?? 0} regions · ${focus.data.available} restaurants`,
        key: "Position = regional origin",
      },
      region: {
        kicker: `${focus.data.name} · restaurants`,
        title: "A region finds<br>its restaurants.",
        intro: "The deepest circles are named Munich restaurants carrying this country-specific OSM cuisine tag.",
        caption: `${focus.children?.length ?? 0} ${focus.children?.length === 1 ? "restaurant" : "restaurants"} · select for details`,
        key: "Position = Munich address",
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
      <p class="metric-row"><span>${children.length} ${pluralize(childKind, children.length)}</span><span>Geo-oriented</span></p>
      <p class="metric-row"><span>Circle area</span><span>Record count</span></p>
    </div>
  `;
}

function updateSelectionCard() {
  const selected = state.selectedRestaurant?.data ?? null;
  if (selected) {
    const contextMapAction = state.mode === "pack"
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
  if (focus === root) return "Select a metropolitan circle. Munich is the live edition; smaller rings mark planned cities.";
  if (focus.data.kind === "continent") return "Zoom into a country, or reveal every qualifying restaurant from this continent directly on the Munich map.";
  if (focus.data.kind === "country") return "Zoom into a cuisine tradition, or reveal every qualifying restaurant for this country directly on the Munich map.";
  if (focus.data.kind === "region") return "Select a restaurant circle for its sourced address, or reveal this cuisine tradition on the physical map.";
  return `Select a ${focus.children?.[0]?.data.kind ?? "circle"} to continue the geographic zoom.`;
}

function updateControls() {
  const isRoot = focus === root && state.mode === "pack";
  document.querySelector("[data-action='back']").hidden = isRoot;
  document.querySelector("[data-action='zoom-out']").disabled = isRoot;
  document.querySelector("[data-action='zoom-in']").disabled = state.mode === "map" || !focus.children?.length;
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
  cleanupMap();
  state.mode = "map";
  const mapView = mapViewFor(visible);
  if (!state.selectedRestaurant || !visible.some((restaurant) => restaurant.id === state.selectedRestaurant.data.id)) {
    state.selectedRestaurant = nodeById.get(visible[0].id);
  }
  const iframeUrl = googleMapEmbedUrl(mapView);

  scene.innerHTML = `
    <div class="physical-map semantic-layer" aria-label="Google map of ${escapeHtml(focus.data.name)} restaurants in Munich">
      <iframe class="google-map-iframe" src="${iframeUrl}" loading="eager" referrerpolicy="no-referrer-when-downgrade" title="Google Maps basemap centered on Munich" tabindex="-1"></iframe>
      <div class="coordinate-overlay" role="group" aria-label="Sourced restaurant locations"></div>
      <div class="map-source-strip"><span>Google Maps</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a><span class="map-cluster-status">${visible.length} restaurants</span></div>
    </div>
  `;

  const overlay = scene.querySelector(".coordinate-overlay");
  const iframe = scene.querySelector(".google-map-iframe");
  const refresh = () => renderClusteredMarkers(overlay, visible, mapView, iframe);
  requestAnimationFrame(refresh);
  mapResizeObserver = new ResizeObserver(refresh);
  mapResizeObserver.observe(overlay);
  updateInterface();
}

function googleMapEmbedUrl(mapView) {
  return `https://www.google.com/maps?ll=${mapView.center.lat},${mapView.center.lng}&z=${mapView.zoom}&output=embed`;
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

function restaurantMarkerMarkup(restaurant, x, y) {
  const active = restaurant.id === state.selectedRestaurant?.data.id ? " is-active" : "";
  return `
    <button class="coordinate-marker marker-${restaurant.markerKind}${active}" style="left:${x}px;top:${y}px" type="button" data-restaurant="${restaurant.id}" data-name="${escapeHtml(restaurant.name)}" aria-label="Select ${escapeHtml(restaurant.name)}">
      <span aria-hidden="true">${restaurant.symbol}</span><strong>${escapeHtml(restaurant.name)}</strong>
    </button>
  `;
}

function clusterMarkerMarkup(cluster, index, x, y) {
  const count = cluster.restaurants.length;
  return `
    <button class="coordinate-marker coordinate-cluster" style="left:${x}px;top:${y}px" type="button" data-cluster="${index}" data-name="${count} restaurants nearby" aria-label="Zoom into ${count} nearby restaurants">
      <span aria-hidden="true">${count}</span><strong>${count} restaurants nearby</strong>
    </button>
  `;
}

function renderClusteredMarkers(container, list, mapView, iframe) {
  if (!container?.isConnected || !container.clientWidth || !container.clientHeight) return;
  const centerPoint = worldPixel(mapView.center.lat, mapView.center.lng, mapView.zoom);
  const clusters = clusterRestaurants(list, mapView.zoom);
  container.innerHTML = clusters.map((cluster, index) => {
    const x = container.clientWidth / 2 + cluster.x - centerPoint.x;
    const y = container.clientHeight / 2 + cluster.y - centerPoint.y;
    return cluster.restaurants.length === 1
      ? restaurantMarkerMarkup(cluster.restaurants[0], x, y)
      : clusterMarkerMarkup(cluster, index, x, y);
  }).join("");

  const status = scene.querySelector(".map-cluster-status");
  if (status) status.textContent = `${clusters.length} markers · ${list.length} restaurants`;

  container.querySelectorAll(".coordinate-marker").forEach((marker) => {
    marker.addEventListener("click", () => {
      if (marker.dataset.restaurant) {
        selectMapRestaurant(marker.dataset.restaurant);
        return;
      }
      const cluster = clusters[Number(marker.dataset.cluster)];
      if (!cluster) return;
      mapView.center = { lat: cluster.lat, lng: cluster.lng };
      mapView.zoom = Math.min(mapView.zoom + 2, 17);
      iframe.src = googleMapEmbedUrl(mapView);
      renderClusteredMarkers(container, list, mapView, iframe);
    });
    marker.addEventListener("pointerenter", (event) => showCursorLabel(event, marker.dataset.name));
    marker.addEventListener("pointermove", moveCursorLabel);
    marker.addEventListener("pointerleave", hideCursorLabel);
  });
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
  mapResizeObserver?.disconnect();
  mapResizeObserver = null;
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
    state.mode = "pack";
    state.selectedRestaurant = null;
    transitionScene(() => renderPack(false));
    return;
  }
  if (focus.parent) zoomToNode(focus.parent);
}

document.addEventListener("click", (event) => {
  const focusTrigger = event.target.closest("[data-focus-id]");
  if (focusTrigger) {
    const node = nodeById.get(focusTrigger.dataset.focusId);
    if (node && node !== focus) zoomToNode(node);
    return;
  }

  const trigger = event.target.closest("[data-action]");
  const action = trigger?.dataset.action;
  if (!action) return;
  if (action === "home") {
    state.mode = "pack";
    state.focusId = root.data.id;
    state.selectedNode = null;
    state.selectedRestaurant = null;
    transitionScene(() => renderPack(false));
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
