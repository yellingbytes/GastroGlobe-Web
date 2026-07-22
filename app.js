import { buildAtlasHierarchy, countries, datasetMeta, googleMapsUrl, metropolitanEditions } from "./restaurants.js?v=emoji-map-1";

const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const TOPOJSON_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";
const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const scene = document.querySelector("#scene");
const cursorLabel = document.querySelector("#cursor-label");

const state = {
  visualization: window.localStorage.getItem("gastroglobe-dev-visualization") || "emoji",
  cityId: null,
  countryId: null,
  cuisineId: null,
  treeFocusId: null,
};

const CONTINENT_COLORS = {
  Americas: "#df0024",
  Europe: "#0085c7",
  Africa: "#2a2a28",
  Asia: "#f4c300",
  Oceania: "#009f3d",
};

let d3;
let topojson;
let worldTopology;
let worldFeatures = [];
let worldMesh;
let hierarchyRoot;
let cityNodes = [];
let countryNodes = [];
let resizeTimer;

const countryNameAliases = new Map([
  ["bosnia and herz", "bosnia & herzegovina"],
  ["bosnia and herzegovina", "bosnia & herzegovina"],
  ["czech republic", "czechia"],
  ["republic of korea", "south korea"],
  ["south korea", "south korea"],
  ["turkey", "türkiye"],
  ["united states of america", "united states"],
]);

async function initialize() {
  scene.innerHTML = `<div class="atlas-loading">Drawing the edible world…</div>`;
  try {
    const [d3Module, topojsonModule, worldResponse] = await Promise.all([
      import(D3_URL),
      import(TOPOJSON_URL),
      fetch(WORLD_URL),
    ]);
    if (!worldResponse.ok) throw new Error(`World topology failed to load (${worldResponse.status}).`);
    d3 = d3Module;
    topojson = topojsonModule;
    worldTopology = await worldResponse.json();
    worldFeatures = topojson.feature(worldTopology, worldTopology.objects.countries).features;
    worldMesh = topojson.mesh(worldTopology, worldTopology.objects.countries, (a, b) => a !== b);
    buildDataIndex();
    renderGallery();
  } catch (error) {
    console.error(error);
    scene.innerHTML = `<div class="atlas-error" role="alert"><strong>The culinary map could not load.</strong><span>Check the network connection and reload.</span></div>`;
  }
}

function buildDataIndex() {
  hierarchyRoot = d3.hierarchy(buildAtlasHierarchy());
  hierarchyRoot.sum((datum) => datum.layoutValue ?? 0);
  cityNodes = hierarchyRoot.children ?? [];
  const munich = cityNodes.find((node) => node.data.id === "munich");
  countryNodes = (munich?.children ?? []).flatMap((continent) => continent.children ?? []);
}

function renderGallery() {
  state.cityId = null;
  state.countryId = null;
  state.cuisineId = null;
  state.treeFocusId = null;
  scene.innerHTML = `
    <section class="metropolitan-gallery semantic-layer emoji-gallery" aria-label="Metropolitan culinary maps">
      ${cityNodes.map(cityCardMarkup).join("")}
      ${devMenuMarkup()}
    </section>
  `;
  scene.querySelectorAll("[data-city-id]").forEach((button) => {
    button.addEventListener("click", () => openCity(button.dataset.cityId));
  });
  bindDevMenu();
}

function cityCardMarkup(city) {
  const live = city.data.id === "munich";
  const caption = live
    ? `${city.data.country} · ${datasetMeta.includedRestaurants.toLocaleString("en")} restaurants`
    : `${city.data.country} · Preview distribution`;
  return `
    <button class="metropolitan-card world-card${live ? " is-live" : " is-planned"}" type="button" data-city-id="${escapeHtml(city.data.id)}" aria-label="Open ${escapeHtml(city.data.name)} culinary world map">
      ${thumbnailMarkup(city.data.id, live)}
      <span class="metropolitan-card-caption">
        <strong>${escapeHtml(city.data.name)}</strong>
        <span>${escapeHtml(caption)}</span>
      </span>
    </button>
  `;
}

function thumbnailMarkup(cityId, live) {
  const width = 360;
  const height = 176;
  const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [width - 8, height - 8]], { type: "Sphere" });
  const path = d3.geoPath(projection);
  const candidates = countryNodes.map((node) => ({
    node,
    point: projection([node.data.lng, node.data.lat]),
    value: live ? node.data.available : previewCount(cityId, node.data.id),
  })).filter((item) => item.point && item.value > 0);
  const featured = (live
    ? candidates.sort((a, b) => b.value - a.value).slice(0, 11)
    : seededShuffle(candidates, cityId).slice(0, 9));
  const countriesPath = worldFeatures.map((feature) => `<path d="${path(feature)}"></path>`).join("");
  const flags = featured.map(({ node, point, value }) => {
    const size = live ? clamp(13 + Math.sqrt(value) * 0.7, 14, 25) : clamp(14 + value * 0.25, 14, 22);
    return `<text x="${point[0].toFixed(1)}" y="${point[1].toFixed(1)}" font-size="${size.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${node.data.flag}</text>`;
  }).join("");
  return `
    <svg class="metropolitan-thumbnail world-thumbnail" viewBox="0 0 ${width} ${height}" role="img" aria-label="World preview with cuisine flags">
      <g class="thumbnail-land">${countriesPath}</g>
      <path class="thumbnail-borders" d="${d3.geoPath(projection)(worldMesh)}"></path>
      <g class="thumbnail-flags">${flags}</g>
    </svg>
  `;
}

function previewCount(cityId, countryId) {
  const random = seededRandom(`${cityId}-${countryId}`);
  return random() > 0.55 ? 2 + Math.floor(random() * 42) : 0;
}

function seededShuffle(values, seedValue) {
  const random = seededRandom(seedValue);
  return values.map((value) => ({ value, key: random() })).sort((a, b) => a.key - b.key).map(({ value }) => value);
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

function openCity(cityId) {
  state.cityId = cityId;
  state.countryId = null;
  state.cuisineId = null;
  state.treeFocusId = null;
  transitionScene(renderCurrentVisualization);
}

function renderCurrentVisualization() {
  if (state.visualization === "treemap") return renderInteractiveTreemap();
  if (state.visualization === "cartogram") {
    return state.countryId ? renderRegionalCartogram() : renderCuisineCartogram();
  }
  return state.countryId ? renderCountryMap() : renderWorldMap();
}

function renderWorldMap() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  if (!city) return renderGallery();
  const live = city.data.id === "munich";
  const values = live
    ? countryNodes
    : countryNodes.map((node) => previewCountryNode(city.data.id, node));
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const projection = d3.geoNaturalEarth1().fitExtent([[38, 68], [width - 38, height - 36]], { type: "Sphere" });
  const path = d3.geoPath(projection);
  const maxCount = d3.max(values, (node) => node.data.available) || 1;
  const radius = d3.scaleSqrt().domain([1, maxCount]).range([18, 43]);
  const fill = d3.scaleSqrt().domain([0, maxCount]).range([0.04, 0.48]);
  const byName = new Map(values.map((node) => [normalizeCountryName(node.data.name), node]));

  scene.innerHTML = `
    <section class="culinary-map semantic-layer" aria-label="${escapeHtml(city.data.name)} world cuisine map">
      ${breadcrumbMarkup(city, null)}
      <div class="map-heading">
        <p><strong>${escapeHtml(city.data.name)}</strong> through the world’s kitchens</p>
        <span>${live ? `${datasetMeta.includedRestaurants.toLocaleString("en")} restaurants · flag size shows density` : "Preview distribution · dataset pending"}</span>
      </div>
      <svg class="world-map" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="world-map-title world-map-desc">
        <title id="world-map-title">Country cuisines represented in ${escapeHtml(city.data.name)}</title>
        <desc id="world-map-desc">Country shapes contain flags sized by the number of restaurants. Select a country to reveal its regional cuisines.</desc>
        <g class="map-zoom-layer">
          <g class="country-shapes"></g>
          <path class="country-borders" d="${path(worldMesh)}"></path>
          <g class="country-flags"></g>
        </g>
      </svg>
      <p class="map-legend"><span class="legend-flag">🇮🇹</span><span>Flag size + country tint = restaurant density</span><span class="legend-action">Select a country to taste deeper</span></p>
      ${devMenuMarkup()}
    </section>
  `;

  const svg = d3.select(scene.querySelector(".world-map"));
  svg.select(".country-shapes")
    .selectAll("path")
    .data(worldFeatures)
    .join("path")
    .attr("class", (feature) => countryNodeForFeature(feature, byName) ? "country-shape has-cuisine" : "country-shape")
    .attr("d", path)
    .style("--density", (feature) => fill(countryNodeForFeature(feature, byName)?.data.available ?? 0))
    .attr("tabindex", (feature) => countryNodeForFeature(feature, byName) ? 0 : null)
    .attr("role", (feature) => countryNodeForFeature(feature, byName) ? "button" : null)
    .attr("aria-label", (feature) => {
      const node = countryNodeForFeature(feature, byName);
      return node ? `${node.data.name}, ${node.data.available} restaurants` : null;
    })
    .on("click", (_, feature) => {
      const node = countryNodeForFeature(feature, byName);
      if (node) openCountry(node.data.countryId);
    })
    .on("keydown", (event, feature) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const node = countryNodeForFeature(feature, byName);
      if (node) openCountry(node.data.countryId);
    })
    .on("pointerenter", (event, feature) => {
      const node = countryNodeForFeature(feature, byName);
      if (node) showCursorLabel(event, `${node.data.flag} ${node.data.name} · ${node.data.available} restaurants`);
    })
    .on("pointermove", moveCursorLabel)
    .on("pointerleave", hideCursorLabel);

  const flagNodes = countryFlagPositions(
    values.filter((node) => node.data.available > 0 && Number.isFinite(node.data.lat)),
    projection,
    radius,
    width,
    height,
  );
  const flags = svg.select(".country-flags")
    .selectAll("g")
    .data(flagNodes, (item) => item.node.data.id)
    .join("g")
    .attr("class", "country-flag")
    .attr("transform", (item) => `translate(${item.x},${item.y})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `Open ${item.node.data.name}, ${item.node.data.available} restaurants`)
    .on("click", (_, item) => openCountry(item.node.data.countryId))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCountry(item.node.data.countryId);
    })
    .on("pointerenter", (event, item) => showCursorLabel(event, `${item.node.data.flag} ${item.node.data.name} · ${item.node.data.available} restaurants`))
    .on("pointermove", moveCursorLabel)
    .on("pointerleave", hideCursorLabel);

  flags.append("circle").attr("r", (item) => radius(Math.max(1, item.node.data.available)));
  flags.append("text")
    .attr("class", "flag-glyph")
    .attr("font-size", (item) => radius(Math.max(1, item.node.data.available)) * 1.12)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .text((item) => item.node.data.flag);
  flags.append("text")
    .attr("class", "flag-count")
    .attr("y", (item) => radius(Math.max(1, item.node.data.available)) + 12)
    .attr("text-anchor", "middle")
    .text((item) => item.node.data.available);

  bindMapZoom(svg, width, height);
  bindBreadcrumbs();
  bindDevMenu();
}

function previewCountryNode(cityId, source) {
  return {
    ...source,
    data: { ...source.data, available: previewCount(cityId, source.data.id) },
  };
}

function countryFlagPositions(nodes, projection, radius, width, height) {
  const items = nodes.map((node) => {
    const [anchorX, anchorY] = projection([node.data.lng, node.data.lat]);
    return { node, anchorX, anchorY, x: anchorX, y: anchorY };
  });
  const simulation = d3.forceSimulation(items)
    .force("x", d3.forceX((item) => item.anchorX).strength(0.3))
    .force("y", d3.forceY((item) => item.anchorY).strength(0.3))
    .force("collide", d3.forceCollide((item) => radius(Math.max(1, item.node.data.available)) + 4).iterations(4))
    .stop();
  for (let index = 0; index < 220; index += 1) simulation.tick();
  items.forEach((item) => {
    const padding = radius(Math.max(1, item.node.data.available)) + 4;
    item.x = clamp(item.x, padding, width - padding);
    item.y = clamp(item.y, 132 + padding, height - 58 - padding);
  });
  return items;
}

function openCountry(countryId) {
  const node = countryNodes.find((candidate) => candidate.data.countryId === countryId);
  if (!node) return;
  state.countryId = countryId;
  state.cuisineId = null;
  transitionScene(renderCurrentVisualization);
}

function renderCountryMap() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  const country = countryNodes.find((node) => node.data.countryId === state.countryId);
  if (!city || !country) return renderWorldMap();
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const feature = featureForCountry(country);
  const projection = d3.geoMercator();
  if (feature) projection.fitExtent([[90, 100], [width - 90, height - 72]], feature);
  else projection.center([country.data.lng, country.data.lat]).scale(720).translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);
  const cuisines = cuisineNodesFor(country);
  const maxCount = d3.max(cuisines, (node) => node.data.available) || 1;
  const radius = d3.scaleSqrt().domain([0, maxCount]).range([28, 60]);

  scene.innerHTML = `
    <section class="culinary-map country-map-view semantic-layer" aria-label="${escapeHtml(country.data.name)} regional cuisines">
      ${breadcrumbMarkup(city, country)}
      <div class="map-heading">
        <p><strong>${country.data.flag} ${escapeHtml(country.data.name)}</strong> · regional kitchens in ${escapeHtml(city.data.name)}</p>
        <span>${country.data.available} restaurants · ${cuisines.length} cuisine traditions</span>
      </div>
      <svg class="world-map country-detail-map" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="country-map-title country-map-desc">
        <title id="country-map-title">${escapeHtml(country.data.name)} regional cuisine map</title>
        <desc id="country-map-desc">Cuisine emojis are positioned by regional origin and sized by verified Munich restaurants. Empty rings indicate zero verified restaurants.</desc>
        <g class="country-focus-shape">${feature ? `<path d="${path(feature)}"></path>` : ""}</g>
        <g class="cuisine-markers"></g>
      </svg>
      <p class="map-legend"><span class="legend-flag">${country.data.flag}</span><span>Emoji = cuisine tradition · size = Munich restaurants</span><span class="legend-action">Dashed rings are meaningful absences</span></p>
      <aside class="cuisine-drawer" aria-live="polite"></aside>
      ${devMenuMarkup()}
    </section>
  `;

  const svg = d3.select(scene.querySelector(".country-detail-map"));
  const positioned = cuisineMarkerPositions(cuisines, projection, width, height, radius);
  const markers = svg.select(".cuisine-markers")
    .selectAll("g")
    .data(positioned, (item) => item.node.data.id)
    .join("g")
    .attr("class", (item) => `cuisine-marker${item.node.data.available === 0 ? " is-empty" : ""}`)
    .attr("transform", (item) => `translate(${item.x},${item.y})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.node.data.name}, ${item.node.data.available} restaurants`)
    .on("click", (_, item) => selectCuisine(item.node))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCuisine(item.node);
    })
    .on("pointerenter", (event, item) => showCursorLabel(event, `${item.node.data.emoji} ${item.node.data.name} · ${item.node.data.available} verified`))
    .on("pointermove", moveCursorLabel)
    .on("pointerleave", hideCursorLabel);

  markers.append("circle").attr("r", (item) => radius(item.node.data.available));
  markers.append("text")
    .attr("class", "cuisine-glyph")
    .attr("font-size", (item) => radius(item.node.data.available) * 0.9)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .text((item) => item.node.data.emoji);
  markers.append("text")
    .attr("class", "cuisine-name")
    .attr("y", (item) => radius(item.node.data.available) + 18)
    .attr("text-anchor", "middle")
    .text((item) => item.node.data.name);
  markers.append("text")
    .attr("class", "cuisine-count")
    .attr("y", (item) => radius(item.node.data.available) + 33)
    .attr("text-anchor", "middle")
    .text((item) => `${item.node.data.available} ${item.node.data.available === 1 ? "place" : "places"}`);

  bindBreadcrumbs();
  bindDevMenu();
  if (state.cuisineId) {
    const selected = cuisines.find((node) => node.data.id === state.cuisineId);
    if (selected) selectCuisine(selected, false);
  }
}

function cuisineNodesFor(country) {
  const directRestaurants = country.children?.every((child) => child.data.kind === "restaurant");
  if (directRestaurants) {
    const source = countries.find((item) => item.id === country.data.countryId);
    return [{
      data: {
        id: `national-${country.data.countryId}`,
        name: "National cuisine",
        emoji: source?.symbol ?? country.data.flag,
        kind: "region",
        lat: country.data.lat,
        lng: country.data.lng,
        available: country.children?.length ?? 0,
      },
      children: country.children ?? [],
    }];
  }
  return (country.children ?? []).map((node) => ({
    ...node,
    data: { ...node.data, emoji: node.data.emoji ?? country.data.flag },
  }));
}

function cuisineMarkerPositions(cuisines, projection, width, height, radius) {
  const items = cuisines.map((node, index) => {
    const projected = projection([node.data.lng, node.data.lat]) ?? [width / 2, height / 2];
    return { node, index, anchorX: projected[0], anchorY: projected[1], x: projected[0], y: projected[1] };
  });
  const simulation = d3.forceSimulation(items)
    .force("x", d3.forceX((item) => item.anchorX).strength(0.24))
    .force("y", d3.forceY((item) => item.anchorY).strength(0.24))
    .force("collide", d3.forceCollide((item) => radius(item.node.data.available) + 34).iterations(3))
    .stop();
  for (let index = 0; index < 180; index += 1) simulation.tick();
  items.forEach((item) => {
    const padding = radius(item.node.data.available) + 42;
    item.x = clamp(item.x, padding, width - padding);
    item.y = clamp(item.y, 112 + padding, height - 50 - padding);
  });
  return items;
}

function selectCuisine(cuisine, rerender = true) {
  state.cuisineId = cuisine.data.id;
  if (rerender) {
    d3.select(scene).selectAll(".cuisine-marker").classed("is-selected", (item) => item.node.data.id === cuisine.data.id);
  }
  const drawer = scene.querySelector(".cuisine-drawer");
  if (!drawer) return;
  const restaurants = (cuisine.children ?? []).map((node) => node.data);
  drawer.classList.add("is-open");
  drawer.innerHTML = `
    <div class="cuisine-drawer-heading">
      <p><span>${cuisine.data.emoji}</span><strong>${escapeHtml(cuisine.data.name)}</strong><small>${cuisine.data.available} verified in Munich</small></p>
      <button type="button" data-close-cuisine aria-label="Close cuisine details">×</button>
    </div>
    ${restaurants.length
      ? `<div class="restaurant-ribbon">${restaurants.map((restaurant) => `<a href="${googleMapsUrl(restaurant)}" target="_blank" rel="noreferrer"><span>${restaurant.symbol ?? cuisine.data.emoji}</span><strong>${escapeHtml(restaurant.name)}</strong><small>${escapeHtml(restaurant.address)}</small></a>`).join("")}</div>`
      : `<p class="empty-cuisine">No dedicated restaurant is verified yet. The absence stays on the map as part of Munich’s culinary portrait.</p>`}
  `;
  drawer.querySelector("[data-close-cuisine]").addEventListener("click", () => {
    state.cuisineId = null;
    drawer.classList.remove("is-open");
    d3.select(scene).selectAll(".cuisine-marker").classed("is-selected", false);
  });
}

function featureForCountry(country) {
  const target = normalizeCountryName(country.data.name);
  return worldFeatures.find((feature) => normalizeCountryName(feature.properties?.name) === target);
}

function countryNodeForFeature(feature, byName) {
  return byName.get(normalizeCountryName(feature.properties?.name));
}

function normalizeCountryName(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-zà-ž& ]/gi, " ").replace(/\s+/g, " ").trim();
  return countryNameAliases.get(normalized) ?? normalized;
}

function breadcrumbMarkup(city, country) {
  return `
    <nav class="map-breadcrumbs" aria-label="Culinary map breadcrumb">
      <button type="button" data-map-home>Metropolitans</button><span aria-hidden="true">/</span>
      <button type="button" data-map-city>${escapeHtml(city.data.name)}</button>
      ${country ? `<span aria-hidden="true">/</span><button type="button" aria-current="page">${country.data.flag} ${escapeHtml(country.data.name)}</button>` : ""}
    </nav>
  `;
}

function bindBreadcrumbs() {
  scene.querySelector("[data-map-home]")?.addEventListener("click", () => transitionScene(renderGallery));
  scene.querySelector("[data-map-city]")?.addEventListener("click", () => {
    state.countryId = null;
    state.cuisineId = null;
    transitionScene(renderCurrentVisualization);
  });
}

function devMenuMarkup() {
  return `
    <label class="dev-visualization-menu">
      <span>Dev view</span>
      <select aria-label="Choose visualization strategy">
        <option value="treemap"${state.visualization === "treemap" ? " selected" : ""}>1 · Interactive treemap</option>
        <option value="emoji"${state.visualization === "emoji" ? " selected" : ""}>2 · Emoji density map</option>
        <option value="cartogram"${state.visualization === "cartogram" ? " selected" : ""}>3 · Cuisine territory map</option>
      </select>
    </label>
  `;
}

function bindDevMenu() {
  const select = scene.querySelector(".dev-visualization-menu select");
  if (!select) return;
  select.addEventListener("change", () => {
    state.visualization = select.value;
    state.countryId = null;
    state.cuisineId = null;
    state.treeFocusId = null;
    window.localStorage.setItem("gastroglobe-dev-visualization", state.visualization);
    transitionScene(state.cityId ? renderCurrentVisualization : renderGallery);
  });
}

function renderInteractiveTreemap() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  if (!city) return renderGallery();
  const sourceRoot = d3.hierarchy(city.data);
  const sourceById = new Map(sourceRoot.descendants().map((node) => [node.data.id, node]));
  const focusNode = sourceById.get(state.treeFocusId) ?? sourceRoot;
  state.treeFocusId = focusNode.data.id;
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const headerHeight = 64;
  const layout = d3.hierarchy(focusNode.data)
    .sum((datum) => datum.kind === "restaurant" ? 1 : datum.zeroCountCuisine ? 0.7 : datum.layoutValue ?? 0)
    .sort((a, b) => b.value - a.value || a.data.name.localeCompare(b.data.name));
  d3.treemap().size([width, height - headerHeight]).paddingInner(3).paddingOuter(1).round(true)(layout);
  const children = layout.children ?? [];

  scene.innerHTML = `
    <section class="interactive-treemap semantic-layer" aria-label="Interactive cuisine treemap for ${escapeHtml(city.data.name)}">
      ${treeBreadcrumbMarkup(city, focusNode)}
      <svg class="dev-treemap" viewBox="0 0 ${width} ${height}" role="img" aria-label="Zoomable hierarchy sized by restaurant counts">
        <g class="dev-treemap-cells" transform="translate(0,${headerHeight})"></g>
      </svg>
      <p class="map-legend"><span class="legend-flag">▦</span><span>Rectangle area = restaurants · color = continent</span><span class="legend-action">Select any tile to drill down</span></p>
      <aside class="treemap-leaf-drawer" aria-live="polite"></aside>
      ${devMenuMarkup()}
    </section>
  `;

  const continentById = new Map(sourceRoot.descendants().map((node) => {
    const continent = node.ancestors().find((ancestor) => ancestor.data.kind === "continent");
    return [node.data.id, continent?.data.name ?? node.data.name];
  }));
  const cells = d3.select(scene.querySelector(".dev-treemap-cells"))
    .selectAll("g")
    .data(children, (node) => node.data.id)
    .join("g")
    .attr("class", (node) => `dev-treemap-cell kind-${node.data.kind}${node.data.zeroCountCuisine ? " is-empty" : ""}`)
    .attr("transform", (node) => `translate(${node.x0},${node.y0})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (node) => `${treeDisplayName(node.data)}, ${node.data.available ?? Math.round(node.value)} restaurants`)
    .on("click", (_, node) => activateTreeNode(node.data, sourceById))
    .on("keydown", (event, node) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activateTreeNode(node.data, sourceById);
    })
    .on("pointerenter", (event, node) => showCursorLabel(event, `${treeDisplayName(node.data)} · ${node.data.available ?? Math.round(node.value)} restaurants`))
    .on("pointermove", moveCursorLabel)
    .on("pointerleave", hideCursorLabel);

  cells.append("rect")
    .attr("width", (node) => Math.max(0, node.x1 - node.x0))
    .attr("height", (node) => Math.max(0, node.y1 - node.y0))
    .style("--tree-color", (node) => CONTINENT_COLORS[continentById.get(node.data.id)] ?? "#aaa59a");
  cells.append("foreignObject")
    .attr("width", (node) => Math.max(0, node.x1 - node.x0))
    .attr("height", (node) => Math.max(0, node.y1 - node.y0))
    .append("xhtml:div")
    .attr("class", "dev-treemap-label")
    .html((node) => {
      const widthAvailable = node.x1 - node.x0;
      const heightAvailable = node.y1 - node.y0;
      if (widthAvailable < 54 || heightAvailable < 34) return `<strong>${escapeHtml(treeEmoji(node.data))}</strong>`;
      return `<strong>${escapeHtml(treeDisplayName(node.data))}</strong><span>${node.data.available ?? Math.round(node.value)} ${node.data.zeroCountCuisine ? "verified" : "places"}</span>`;
    });

  bindTreeBreadcrumbs(sourceById);
  bindDevMenu();
}

function activateTreeNode(datum, sourceById) {
  const source = sourceById.get(datum.id);
  if (source?.children?.length) {
    state.treeFocusId = datum.id;
    transitionScene(renderInteractiveTreemap);
    return;
  }
  const drawer = scene.querySelector(".treemap-leaf-drawer");
  if (!drawer) return;
  drawer.classList.add("is-open");
  if (datum.kind === "restaurant") {
    drawer.innerHTML = `<span>${datum.symbol ?? datum.flag ?? "🍽️"}</span><strong>${escapeHtml(datum.name)}</strong><small>${escapeHtml(datum.address ?? datum.cuisine ?? "Restaurant")}</small><a href="${googleMapsUrl(datum)}" target="_blank" rel="noreferrer">Open in Google Maps ↗</a>`;
  } else {
    drawer.innerHTML = `<span>${datum.emoji ?? datum.flag ?? "◌"}</span><strong>${escapeHtml(datum.name)}</strong><small>No dedicated restaurant is verified in Munich.</small>`;
  }
}

function treeBreadcrumbMarkup(city, focusNode) {
  const path = focusNode.ancestors().reverse();
  return `
    <nav class="map-breadcrumbs tree-breadcrumbs" aria-label="Treemap breadcrumb">
      <button type="button" data-map-home>Metropolitans</button><span aria-hidden="true">/</span>
      ${path.map((node, index) => `<button type="button" data-tree-focus="${escapeHtml(node.data.id)}"${index === path.length - 1 ? " aria-current=\"page\"" : ""}>${escapeHtml(treeDisplayName(node.data))}</button>${index < path.length - 1 ? `<span aria-hidden="true">/</span>` : ""}`).join("")}
    </nav>
  `;
}

function bindTreeBreadcrumbs(sourceById) {
  scene.querySelector("[data-map-home]")?.addEventListener("click", () => transitionScene(renderGallery));
  scene.querySelectorAll("[data-tree-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!sourceById.has(button.dataset.treeFocus)) return;
      state.treeFocusId = button.dataset.treeFocus;
      transitionScene(renderInteractiveTreemap);
    });
  });
}

function treeEmoji(datum) {
  return datum.emoji ?? datum.flag ?? datum.symbol ?? "";
}

function treeDisplayName(datum) {
  const emoji = treeEmoji(datum);
  return emoji ? `${emoji} ${datum.name}` : datum.name;
}

function renderCuisineCartogram() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  if (!city) return renderGallery();
  const live = city.data.id === "munich";
  const values = live ? countryNodes : countryNodes.map((node) => previewCountryNode(city.data.id, node));
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const grid = buildGridCartogram(values, width, height);

  scene.innerHTML = `
    <section class="culinary-map cartogram-view grid-cartogram-view semantic-layer" aria-label="${escapeHtml(city.data.name)} grid cuisine cartogram">
      ${breadcrumbMarkup(city, null)}
      <div class="map-heading cartogram-heading">
        <p><strong>${escapeHtml(city.data.name)}</strong> · a pixel cuisine world</p>
        <span>Country area = restaurant representation · location remains geographic</span>
      </div>
      <svg class="world-map cartogram-map grid-cartogram-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pixel world cartogram with country area proportional to restaurant counts">
        <defs>
          <pattern id="world-grid" width="${grid.cellSize}" height="${grid.cellSize}" patternUnits="userSpaceOnUse">
            <path d="M ${grid.cellSize} 0 L 0 0 0 ${grid.cellSize}" class="grid-pattern-line"></path>
          </pattern>
        </defs>
        <g class="grid-cartogram-layer">
          <rect class="grid-cartogram-field" x="${grid.originX}" y="${grid.originY}" width="${grid.gridWidth}" height="${grid.gridHeight}"></rect>
          <g class="grid-cartogram-territories"></g>
          <g class="grid-cartogram-labels"></g>
        </g>
      </svg>
      <p class="map-legend"><span class="legend-flag">▦</span><span>Fine cells preserve relative direction and island geography</span><span class="legend-action">Connected cuisine territories · select to drill down</span></p>
      ${devMenuMarkup()}
    </section>
  `;

  const svg = d3.select(scene.querySelector(".cartogram-map"));
  const territories = svg.select(".grid-cartogram-territories").selectAll("g")
    .data(grid.items, (item) => item.node.data.id)
    .join("g")
    .attr("class", "grid-cartogram-country")
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.node.data.name}, ${item.cells.length} connected grid cells represent ${item.node.data.available} restaurants`)
    .on("click", (_, item) => openCountry(item.node.data.countryId))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCountry(item.node.data.countryId);
    })
    .on("pointerenter", (event, item) => showCursorLabel(event, `${item.node.data.flag} ${item.node.data.name} · ${item.node.data.available} restaurants`))
    .on("pointermove", moveCursorLabel)
    .on("pointerleave", hideCursorLabel);
  territories.each(function renderGridCells(item) {
    d3.select(this).selectAll("rect")
      .data(item.cells)
      .join("rect")
      .attr("x", (cell) => grid.originX + cell.x * grid.cellSize)
      .attr("y", (cell) => grid.originY + cell.y * grid.cellSize)
      .attr("width", grid.cellSize)
      .attr("height", grid.cellSize)
      .style("--territory-color", cartogramCountryColor(item));
  });
  territories.append("path")
    .attr("class", "grid-country-separator")
    .attr("d", (item) => gridBoundaryPath(item, grid));
  territories.append("path")
    .attr("class", "grid-country-border")
    .attr("d", (item) => gridBoundaryPath(item, grid));

  const labels = svg.select(".grid-cartogram-labels").selectAll("g")
    .data(grid.items, (item) => item.node.data.id)
    .join("g")
    .attr("class", "grid-cartogram-label")
    .attr("transform", (item) => `translate(${grid.originX + (item.labelX + 0.5) * grid.cellSize},${grid.originY + (item.labelY + 0.5) * grid.cellSize})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `Open ${item.node.data.name}`)
    .on("click", (_, item) => openCountry(item.node.data.countryId))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCountry(item.node.data.countryId);
    });
  labels.append("rect").attr("class", "grid-label-hit").attr("x", -18).attr("y", -18).attr("width", 36).attr("height", 36);
  labels.append("text")
    .attr("class", "grid-cartogram-flag")
    .attr("text-anchor", "middle")
    .attr("y", -2)
    .style("font-size", (item) => `${clamp(7 + Math.sqrt(item.cells.length) * 0.9, 9, 17)}px`)
    .text((item) => item.node.data.flag);
  labels.append("text").attr("class", "grid-cartogram-name").attr("text-anchor", "middle").attr("y", 12).text((item) => item.cells.length >= 8 ? item.node.data.name : "");
  labels.append("text").attr("class", "grid-cartogram-count").attr("text-anchor", "middle").attr("y", 23).text((item) => item.cells.length >= 8 ? item.node.data.available : "");

  const zoom = d3.zoom().scaleExtent([0.85, 10]).on("zoom", (event) => svg.select(".grid-cartogram-layer").attr("transform", event.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  bindBreadcrumbs();
  bindDevMenu();
}

function buildGridCartogram(values, width, height) {
  const columns = 150;
  const rows = 62;
  const cellSize = Math.min((width - 34) / columns, (height - 174) / rows);
  const gridWidth = columns * cellSize;
  const gridHeight = rows * cellSize;
  const originX = (width - gridWidth) / 2;
  const originY = 116 + Math.max(0, (height - 174 - gridHeight) / 2);
  const projection = d3.geoNaturalEarth1().fitExtent([[2, 2], [columns - 3, rows - 3]], { type: "Sphere" });
  const projectedPath = d3.geoPath(projection);
  const shapeContext = document.createElement("canvas").getContext("2d");
  const items = values.filter((node) => node.data.available > 0).map((node) => {
    const projected = projection([node.data.lng, node.data.lat]);
    const anchor = cartogramGeographicAnchor(node, projected, projection);
    const quota = Math.max(4, Math.round(2 + Math.sqrt(node.data.available) * 3));
    const feature = featureForCountry(node);
    const bounds = feature ? projectedPath.bounds(feature) : [[0, 0], [1, 1]];
    const shapeWidth = Math.max(0.5, bounds[1][0] - bounds[0][0]);
    const shapeHeight = Math.max(0.5, bounds[1][1] - bounds[0][1]);
    const shapeArea = feature ? Math.max(0.2, projectedPath.area(feature)) : 1;
    const shapeCenter = feature ? projectedPath.centroid(feature) : projected;
    const shapeAspect = clamp(shapeWidth / shapeHeight, 0.24, 4.2);
    const slenderShapeBoost = shapeAspect < 0.8 ? 1.35 : 1;
    return {
      node,
      quota,
      anchorX: anchor[0],
      anchorY: anchor[1],
      feature,
      shapeCenter,
      shapeScale: clamp(Math.sqrt(quota / shapeArea) * 1.45 * slenderShapeBoost, 0.35, 52),
      shapePath: feature && shapeContext && typeof Path2D !== "undefined" ? new Path2D(projectedPath(feature)) : null,
      shapeAspect,
      cells: [],
      cellKeys: new Set(),
    };
  });
  assignCartogramShades(items);

  const occupied = new Map();
  [...items].sort((a, b) => a.quota - b.quota).forEach((item) => {
    const seed = nearestGridCell(Math.round(item.anchorX), Math.round(item.anchorY), occupied, columns, rows);
    addGridCell(item, seed, occupied);
    item.seedX = seed.x;
    item.seedY = seed.y;
    item.containsTargetCell = item.shapePath ? (cell) => {
      const sourcePoint = [
        item.shapeCenter[0] + (cell.x - item.seedX) / item.shapeScale,
        item.shapeCenter[1] + (cell.y - item.seedY) / item.shapeScale,
      ];
      return shapeContext.isPointInPath(item.shapePath, sourcePoint[0], sourcePoint[1]);
    } : null;
  });

  let remaining = d3.sum(items, (item) => item.quota - item.cells.length);
  let guard = remaining * 3 + 100;
  while (remaining > 0 && guard > 0) {
    guard -= 1;
    let progress = false;
    const active = items
      .filter((item) => item.cells.length < item.quota)
      .sort((a, b) => (b.quota - b.cells.length) / b.quota - (a.quota - a.cells.length) / a.quota || b.quota - a.quota);
    active.forEach((item) => {
      const candidate = bestGrowthCell(item, occupied, columns, rows);
      if (!candidate) return;
      addGridCell(item, candidate, occupied);
      remaining -= 1;
      progress = true;
    });
    if (!progress) break;
  }

  items.forEach((item) => {
    const center = item.cells.reduce((sum, cell) => ({ x: sum.x + cell.x, y: sum.y + cell.y }), { x: 0, y: 0 });
    const centroidX = center.x / item.cells.length;
    const centroidY = center.y / item.cells.length;
    item.labelX = item.seedX * 0.72 + centroidX * 0.28;
    item.labelY = item.seedY * 0.72 + centroidY * 0.28;
  });
  return { items, columns, rows, cellSize, gridWidth, gridHeight, originX, originY };
}

function cartogramGeographicAnchor(node, projected, projection) {
  if (node.parent?.data.name !== "Europe") return projected;
  const center = projection([14, 51]);
  return [
    center[0] + (projected[0] - center[0]) * 2.45,
    center[1] + (projected[1] - center[1]) * 2.35,
  ];
}

function assignCartogramShades(items) {
  [...items].sort((a, b) => b.quota - a.quota).forEach((item) => {
    const nearby = items.filter((other) => other !== item
      && other.shadeIndex !== undefined
      && other.node.parent?.data.name === item.node.parent?.data.name
      && Math.hypot(other.anchorX - item.anchorX, other.anchorY - item.anchorY) < 14);
    const scores = [0, 1, 2, 3].map((shadeIndex) => d3.sum(nearby, (other) => (
      other.shadeIndex === shadeIndex
        ? 1 / Math.max(1, Math.hypot(other.anchorX - item.anchorX, other.anchorY - item.anchorY))
        : 0
    )));
    item.shadeIndex = d3.minIndex(scores);
  });
}

function cartogramCountryColor(item) {
  const base = d3.hsl(CONTINENT_COLORS[item.node.parent?.data.name] ?? "#77736b");
  const lightnessOffsets = [-0.13, -0.035, 0.07, 0.16];
  base.l = clamp(base.l + lightnessOffsets[item.shadeIndex ?? 0], 0.25, 0.76);
  return base.formatHex();
}

function nearestGridCell(targetX, targetY, occupied, columns, rows) {
  for (let radius = 0; radius < Math.max(columns, rows); radius += 1) {
    for (let y = targetY - radius; y <= targetY + radius; y += 1) {
      for (let x = targetX - radius; x <= targetX + radius; x += 1) {
        if (x < 0 || x >= columns || y < 0 || y >= rows) continue;
        if (Math.max(Math.abs(x - targetX), Math.abs(y - targetY)) !== radius) continue;
        if (!occupied.has(`${x},${y}`)) return { x, y };
      }
    }
  }
  return { x: clamp(targetX, 0, columns - 1), y: clamp(targetY, 0, rows - 1) };
}

function addGridCell(item, cell, occupied) {
  const key = `${cell.x},${cell.y}`;
  item.cells.push(cell);
  item.cellKeys.add(key);
  occupied.set(key, item);
}

function bestGrowthCell(item, occupied, columns, rows) {
  const candidates = new Map();
  item.cells.forEach((cell) => {
    gridNeighbors(cell.x, cell.y).forEach((candidate) => {
      if (candidate.x < 0 || candidate.x >= columns || candidate.y < 0 || candidate.y >= rows) return;
      const key = `${candidate.x},${candidate.y}`;
      if (!occupied.has(key)) candidates.set(key, candidate);
    });
  });
  let best = null;
  let bestScore = Infinity;
  candidates.forEach((candidate) => {
    const friendlyNeighbors = gridNeighbors(candidate.x, candidate.y)
      .filter((neighbor) => item.cellKeys.has(`${neighbor.x},${neighbor.y}`)).length;
    const deltaX = candidate.x - item.anchorX;
    const deltaY = candidate.y - item.anchorY;
    const shapeDistance = deltaX ** 2 / item.shapeAspect + deltaY ** 2 * item.shapeAspect;
    const seedDistance = (candidate.x - item.seedX) ** 2 + (candidate.y - item.seedY) ** 2;
    const silhouettePenalty = item.containsTargetCell?.(candidate) ? 0 : Math.max(180, item.quota * 2.5);
    const score = silhouettePenalty + shapeDistance * 0.72 + seedDistance * 0.12 - friendlyNeighbors * 5.5;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return best;
}

function gridNeighbors(x, y) {
  return [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }];
}

function gridBoundaryPath(item, grid) {
  const segments = [];
  item.cells.forEach((cell) => {
    const x = grid.originX + cell.x * grid.cellSize;
    const y = grid.originY + cell.y * grid.cellSize;
    const size = grid.cellSize;
    if (!item.cellKeys.has(`${cell.x},${cell.y - 1}`)) segments.push(`M${x},${y}H${x + size}`);
    if (!item.cellKeys.has(`${cell.x + 1},${cell.y}`)) segments.push(`M${x + size},${y}V${y + size}`);
    if (!item.cellKeys.has(`${cell.x},${cell.y + 1}`)) segments.push(`M${x + size},${y + size}H${x}`);
    if (!item.cellKeys.has(`${cell.x - 1},${cell.y}`)) segments.push(`M${x},${y + size}V${y}`);
  });
  return segments.join("");
}

function renderRegionalCartogram() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  const country = countryNodes.find((node) => node.data.countryId === state.countryId);
  if (!city || !country) return renderCuisineCartogram();
  const cuisines = cuisineNodesFor(country);
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const packWidth = width - 90;
  const packHeight = height - 155;
  const packedRoot = d3.pack().size([packWidth, packHeight]).padding(7)(
    d3.hierarchy({ children: cuisines }).sum((item) => item.data ? Math.max(item.data.available, 0.65) : 0),
  );
  const packed = packedRoot.children ?? [];
  const feature = featureForCountry(country);
  const projection = d3.geoMercator();
  if (feature) projection.fitExtent([[60, 96], [width - 60, height - 54]], feature);
  const path = d3.geoPath(projection);
  const continent = country.parent?.data.name;

  scene.innerHTML = `
    <section class="culinary-map regional-cartogram-view semantic-layer" aria-label="${escapeHtml(country.data.name)} regional cuisine cartogram">
      ${breadcrumbMarkup(city, country)}
      <div class="map-heading cartogram-heading">
        <p><strong>${country.data.flag} ${escapeHtml(country.data.name)}</strong> · cuisine territories</p>
        <span>Regional area = verified restaurants · zero-count traditions retain a minimum territory</span>
      </div>
      <svg class="world-map regional-cartogram-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="Regional cuisines sized by verified restaurants">
        ${feature ? `<g class="regional-country-silhouette"><path d="${path(feature)}"></path></g>` : ""}
        <g class="regional-territories" transform="translate(45,105)"></g>
      </svg>
      <p class="map-legend"><span class="legend-flag">${country.data.flag}</span><span>Regional territory = restaurant count</span><span class="legend-action">Select a cuisine to see its restaurants</span></p>
      <aside class="cuisine-drawer" aria-live="polite"></aside>
      ${devMenuMarkup()}
    </section>
  `;

  const nodes = d3.select(scene.querySelector(".regional-territories")).selectAll("g")
    .data(packed, (item) => item.data.data.id)
    .join("g")
    .attr("class", (item) => `regional-territory${item.data.data.available === 0 ? " is-empty" : ""}`)
    .attr("transform", (item) => `translate(${item.x},${item.y})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.data.data.name}, ${item.data.data.available} restaurants`)
    .on("click", (_, item) => selectCuisine(item.data))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCuisine(item.data);
    });
  nodes.append("circle").attr("r", (item) => item.r).style("--territory-color", CONTINENT_COLORS[continent] ?? "#77736b");
  nodes.append("text").attr("class", "regional-territory-emoji").attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("font-size", (item) => clamp(item.r * 0.72, 13, 48)).text((item) => item.data.data.emoji);
  nodes.append("text").attr("class", "regional-territory-name").attr("text-anchor", "middle").attr("y", (item) => Math.min(item.r * 0.48, 32)).text((item) => item.r > 24 ? item.data.data.name : "");
  nodes.append("text").attr("class", "regional-territory-count").attr("text-anchor", "middle").attr("y", (item) => Math.min(item.r * 0.48, 32) + 13).text((item) => item.r > 19 ? item.data.data.available : "");

  bindBreadcrumbs();
  bindDevMenu();
  if (state.cuisineId) {
    const selected = cuisines.find((node) => node.data.id === state.cuisineId);
    if (selected) selectCuisine(selected, false);
  }
}

function bindMapZoom(svg, width, height) {
  const layer = svg.select(".map-zoom-layer");
  const zoom = d3.zoom()
    .scaleExtent([1, 7])
    .translateExtent([[0, 0], [width, height]])
    .extent([[0, 0], [width, height]])
    .on("zoom", (event) => layer.attr("transform", event.transform));
  svg.call(zoom).on("dblclick.zoom", null);
}

function transitionScene(update) {
  hideCursorLabel();
  if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(update);
  } else update();
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!state.cityId) renderGallery();
    else renderCurrentVisualization();
  }, 180);
});

initialize();
