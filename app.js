import { buildAtlasHierarchy, countries, datasetMeta, googleMapsUrl, metropolitanEditions } from "./restaurants.js?v=regional-cartogram-3";

const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const TOPOJSON_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";
const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const scene = document.querySelector("#scene");
const cursorLabel = document.querySelector("#cursor-label");
const savedVisualization = window.localStorage.getItem("gastroglobe-dev-visualization");

const state = {
  visualization: ["treemap", "cartogram"].includes(savedVisualization) ? savedVisualization : "cartogram",
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

const CARTOGRAM_CONTINENT_COLORS = {
  Americas: "#a95553",
  Europe: "#527f9c",
  Africa: "#303331",
  Asia: "#b99a3f",
  Oceania: "#56816b",
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
  if (state.visualization === "atlas") {
    return state.countryId ? renderEditorialCountryAtlas() : renderEditorialWorldAtlas();
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
        <p><strong>${escapeHtml(city.data.name)}</strong> · culinary demographic atlas</p>
        <span>Country area = restaurant representation · adjacency preserves geography</span>
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
          <g class="grid-cartogram-leaders"></g>
          <g class="grid-cartogram-labels"></g>
        </g>
      </svg>
      <p class="map-legend"><span class="legend-flag">◫</span><span>Area = restaurants · color = continent</span><span class="legend-action">Labels follow country centroids · select to drill down</span></p>
      ${devMenuMarkup()}
    </section>
  `;

  const svg = d3.select(scene.querySelector(".cartogram-map"));
  let labels;
  const setCountryHighlight = (item, active) => {
    territories.classed("is-highlighted", (candidate) => (
      active && candidate.node.data.id === item.node.data.id
    ));
    labels?.classed("is-highlighted", (candidate) => (
      active && candidate.node.data.id === item.node.data.id
    ));
  };
  const territories = svg.select(".grid-cartogram-territories").selectAll("g")
    .data(grid.items, (item) => item.node.data.id)
    .join("g")
    .attr("class", "grid-cartogram-country")
    .attr("data-country-id", (item) => item.node.data.id)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.node.data.name}, ${item.cells.length} connected grid cells represent ${item.node.data.available} restaurants`)
    .on("click", (_, item) => openCountry(item.node.data.countryId))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCountry(item.node.data.countryId);
    })
    .on("pointerover", function handleTerritoryPointerOver(event, item) {
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      setCountryHighlight(item, true);
      showCursorLabel(event, `${item.node.data.flag} ${item.node.data.name} · ${item.node.data.available} restaurants`);
    })
    .on("pointermove", moveCursorLabel)
    .on("pointerout", function handleTerritoryPointerOut(event, item) {
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      setCountryHighlight(item, false);
      hideCursorLabel();
    })
    .on("focusin", (_, item) => setCountryHighlight(item, true))
    .on("focusout", (_, item) => setCountryHighlight(item, false));
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

  svg.select(".grid-cartogram-leaders").selectAll("path")
    .data(grid.items.filter((item) => item.showName && Math.hypot(item.labelX - item.centroidX, item.labelY - item.centroidY) > 2.4))
    .join("path")
    .attr("class", "grid-label-leader")
    .attr("data-country-id", (item) => item.node.data.id)
    .attr("d", (item) => {
      const startX = grid.originX + (item.centroidX + 0.5) * grid.cellSize;
      const startY = grid.originY + (item.centroidY + 0.5) * grid.cellSize;
      const endX = grid.originX + (item.labelX + 0.5) * grid.cellSize;
      const endY = grid.originY + (item.labelY + 0.5) * grid.cellSize;
      return `M${startX},${startY}L${endX},${endY}`;
    });

  labels = svg.select(".grid-cartogram-labels").selectAll("g")
    .data(grid.items, (item) => item.node.data.id)
    .join("g")
    .attr("class", "grid-cartogram-label")
    .attr("data-country-id", (item) => item.node.data.id)
    .attr("transform", (item) => `translate(${grid.originX + (item.labelX + 0.5) * grid.cellSize},${grid.originY + (item.labelY + 0.5) * grid.cellSize})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `Open ${item.node.data.name}`)
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCountry(item.node.data.countryId);
    })
    .on("focusin", (_, item) => setCountryHighlight(item, true))
    .on("focusout", (_, item) => setCountryHighlight(item, false));
  labels.append("text")
    .attr("class", "grid-cartogram-flag")
    .attr("text-anchor", "middle")
    .attr("y", -4)
    .style("font-size", (item) => `${item.labelFontSize}px`)
    .text((item) => item.hideLabel ? "" : item.node.data.flag);
  labels.append("text")
    .attr("class", "grid-cartogram-name")
    .attr("text-anchor", "middle")
    .attr("y", 9)
    .style("font-size", (item) => `${item.nameFontSize}px`)
    .text((item) => item.showName ? item.node.data.name : "");
  labels.append("text")
    .attr("class", "grid-cartogram-count")
    .attr("text-anchor", "middle")
    .attr("y", 19)
    .text((item) => item.showCount ? `${item.node.data.available}` : "");

  const zoom = d3.zoom().scaleExtent([0.7, 12]).on("zoom", (event) => svg.select(".grid-cartogram-layer").attr("transform", event.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  svg.call(zoom.transform, gridCartogramFitTransform(grid, width, height));
  declutterRenderedCartogramLabels(svg.node());
  updateCartogramLeaderVisibility(svg.node());
  document.fonts?.ready.then(() => {
    declutterRenderedCartogramLabels(svg.node());
    updateCartogramLeaderVisibility(svg.node());
  });
  bindBreadcrumbs();
  bindDevMenu();
}

function renderEditorialWorldAtlas() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  if (!city) return renderGallery();
  const live = city.data.id === "munich";
  const values = live ? countryNodes : countryNodes.map((node) => previewCountryNode(city.data.id, node));
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const grid = buildGridCartogram(values, width, height);
  const continentLeaders = new Set(d3.groups(grid.items, (item) => item.node.parent?.data.name)
    .map(([, items]) => d3.greatest(items, (item) => item.node.data.available)?.node.data.id)
    .filter(Boolean));
  grid.items.forEach((item) => {
    item.editorialPath = editorialCountryPath(item, grid);
    item.editorialLabel = item.node.data.available >= 50 || continentLeaders.has(item.node.data.id);
    item.editorialLabelX = d3.mean(item.cells, (cell) => cell.x);
    item.editorialLabelY = d3.mean(item.cells, (cell) => cell.y);
  });

  scene.innerHTML = `
    <section class="editorial-atlas-view semantic-layer" aria-label="${escapeHtml(city.data.name)} living cultural atlas">
      ${breadcrumbMarkup(city, null)}
      <div class="editorial-atlas-heading">
        <p class="editorial-atlas-kicker">A city contains a miniature world</p>
        <h2>${escapeHtml(city.data.name)}</h2>
        <p><strong>${city.data.available.toLocaleString()}</strong> restaurants · <span>${grid.items.length} culinary countries</span></p>
      </div>
      <svg class="editorial-atlas-map" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="editorial-atlas-title editorial-atlas-desc">
        <title id="editorial-atlas-title">${escapeHtml(city.data.name)} living cultural atlas</title>
        <desc id="editorial-atlas-desc">An organic topological world where country area represents restaurants and muted color groups continents.</desc>
        <defs>
          <filter id="paper-cutout" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="11" result="paperNoise"></feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="paperNoise" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="softEdge"></feDisplacementMap>
            <feDropShadow in="softEdge" dx="0" dy="3" stdDeviation="3.5" flood-color="#4f493f" flood-opacity="0.16"></feDropShadow>
          </filter>
          <filter id="paper-hover" x="-25%" y="-25%" width="150%" height="160%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="11" result="paperNoise"></feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="paperNoise" scale="1.8" result="softEdge"></feDisplacementMap>
            <feDropShadow in="softEdge" dx="0" dy="7" stdDeviation="7" flood-color="#4f493f" flood-opacity="0.24"></feDropShadow>
          </filter>
          <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="5" result="grain"></feTurbulence>
            <feColorMatrix in="grain" type="saturate" values="0" result="monoGrain"></feColorMatrix>
            <feComponentTransfer in="monoGrain">
              <feFuncA type="table" tableValues="0 0.035"></feFuncA>
            </feComponentTransfer>
          </filter>
        </defs>
        <rect class="editorial-paper-field" x="0" y="0" width="${width}" height="${height}"></rect>
        <rect class="editorial-paper-grain" x="0" y="0" width="${width}" height="${height}"></rect>
        <g class="editorial-atlas-zoom-layer"></g>
      </svg>
      <p class="editorial-atlas-legend"><span>Area represents restaurants</span><span>Color groups continents</span><span>Select a country to enter its cuisines</span></p>
      ${devMenuMarkup()}
    </section>
  `;

  const svg = d3.select(scene.querySelector(".editorial-atlas-map"));
  const layer = svg.select(".editorial-atlas-zoom-layer");
  const continentGroups = layer.selectAll("g")
    .data(d3.groups(grid.items, (item) => item.node.parent?.data.name))
    .join("g")
    .attr("class", ([continent]) => `editorial-continent editorial-continent-${normalizeCountryName(continent).replaceAll(" ", "-")}`)
    .style("--float-delay", (_, index) => `${index * -1.7}s`)
    .style("--float-x", (_, index) => `${index % 2 ? 1.8 : -1.4}px`)
    .style("--float-y", (_, index) => `${index % 3 ? -2.2 : 1.6}px`);

  const countries = continentGroups.selectAll("g")
    .data(([, items]) => items, (item) => item.node.data.id)
    .join("g")
    .attr("class", "editorial-country")
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.node.data.name}, ${item.node.data.available} restaurants`)
    .style("--country-fill", (item) => editorialCountryColor(item))
    .style("--breath-delay", (_, index) => `${(index % 9) * -0.43}s`)
    .on("click", (_, item) => openCountry(item.node.data.countryId))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCountry(item.node.data.countryId);
    })
    .on("pointerover", function handleEditorialPointerOver(event, item) {
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      showCursorLabel(event, `${item.node.data.flag} ${item.node.data.name} · ${item.node.data.available} restaurants`);
    })
    .on("pointermove", moveCursorLabel)
    .on("pointerout", function handleEditorialPointerOut(event) {
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      hideCursorLabel();
    });

  countries.append("path")
    .attr("class", "editorial-country-cutout")
    .attr("d", (item) => item.editorialPath)
    .attr("filter", "url(#paper-cutout)");

  const labels = countries.append("g")
    .attr("class", "editorial-country-label")
    .attr("transform", (item) => `translate(${grid.originX + (item.editorialLabelX + 0.5) * grid.cellSize},${grid.originY + (item.editorialLabelY + 0.5) * grid.cellSize})`);
  labels.append("text")
    .attr("class", "editorial-country-flag")
    .attr("text-anchor", "middle")
    .attr("y", (item) => item.editorialLabel ? -18 : 2)
    .text((item) => item.node.data.flag);
  labels.append("text")
    .attr("class", "editorial-country-name")
    .attr("text-anchor", "middle")
    .attr("y", 3)
    .text((item) => item.editorialLabel ? item.node.data.name : "");
  labels.append("text")
    .attr("class", "editorial-country-meta")
    .attr("text-anchor", "middle")
    .attr("y", 20)
    .text((item) => item.editorialLabel
      ? `${item.node.data.available} ${item.node.data.available === 1 ? "Restaurant" : "Restaurants"}`
      : "");

  const zoom = d3.zoom()
    .scaleExtent([0.72, 8])
    .on("zoom", (event) => layer.attr("transform", event.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  svg.call(zoom.transform, gridCartogramFitTransform(grid, width, height));
  declutterEditorialLabels(svg.node());
  document.fonts?.ready.then(() => declutterEditorialLabels(svg.node()));
  bindBreadcrumbs();
  bindDevMenu();
}

function editorialCountryPath(item, grid) {
  const mask = new Uint8Array(grid.columns * grid.rows);
  item.cells.forEach((cell) => {
    mask[cell.y * grid.columns + cell.x] = 1;
  });
  const contour = d3.contours()
    .size([grid.columns, grid.rows])
    .smooth(true)
    .thresholds([0.5])(mask)[0];
  if (!contour) return gridBoundaryPath(item, grid);
  const projection = d3.geoIdentity()
    .scale(grid.cellSize)
    .translate([grid.originX, grid.originY]);
  return d3.geoPath(projection)(contour);
}

function editorialCountryColor(item) {
  const palette = {
    Americas: ["#b96f5d", "#c68571", "#a86153", "#d39a86"],
    Europe: ["#78929f", "#8ca4ae", "#657f8c", "#a7b8bd"],
    Africa: ["#8d8966", "#a09a73", "#777654", "#b0a982"],
    Asia: ["#c29a4b", "#d0aa5b", "#aa823d", "#ddbd75"],
    Oceania: ["#6f9991", "#85aaa2", "#5d837c", "#9dbbb4"],
  };
  const colors = palette[item.node.parent?.data.name] ?? ["#918b80"];
  return colors[item.shadeIndex % colors.length];
}

function declutterEditorialLabels(svgElement) {
  if (!svgElement) return;
  const groups = [...svgElement.querySelectorAll(".editorial-country-label")];
  for (let pass = 0; pass < groups.length * 2; pass += 1) {
    const visible = groups.map((group) => ({
      group,
      item: group.parentElement.__data__,
      rect: group.getBoundingClientRect(),
      visible: group.textContent.trim().length > 0,
    })).filter((entry) => entry.visible);
    let collision;
    for (let index = 0; index < visible.length && !collision; index += 1) {
      const a = visible[index];
      for (let otherIndex = index + 1; otherIndex < visible.length; otherIndex += 1) {
        const b = visible[otherIndex];
        if (a.rect.left < b.rect.right + 5
          && a.rect.right + 5 > b.rect.left
          && a.rect.top < b.rect.bottom + 5
          && a.rect.bottom + 5 > b.rect.top) {
          collision = a.item.displayArea <= b.item.displayArea ? a : b;
          break;
        }
      }
    }
    if (!collision) break;
    const meta = collision.group.querySelector(".editorial-country-meta");
    const name = collision.group.querySelector(".editorial-country-name");
    const flag = collision.group.querySelector(".editorial-country-flag");
    if (meta?.textContent) meta.textContent = "";
    else if (name?.textContent) name.textContent = "";
    else if (flag?.textContent) flag.textContent = "";
  }
}

function renderEditorialCountryAtlas() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  const country = countryNodes.find((node) => node.data.countryId === state.countryId);
  if (!city || !country) return renderEditorialWorldAtlas();
  const cuisines = cuisineNodesFor(country);
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const feature = featureForCountry(country);
  const projection = d3.geoMercator();
  if (feature) projection.fitExtent([[110, 124], [width - 110, height - 74]], feature);
  else projection.center([country.data.lng, country.data.lat]).scale(720).translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);
  const maxCount = d3.max(cuisines, (node) => node.data.available) || 1;
  const radius = d3.scaleSqrt().domain([0, maxCount]).range([34, 74]);
  const positioned = cuisineMarkerPositions(cuisines, projection, width, height, radius);

  scene.innerHTML = `
    <section class="editorial-atlas-view editorial-country-view semantic-layer" aria-label="${escapeHtml(country.data.name)} cuisine atlas">
      ${breadcrumbMarkup(city, country)}
      <div class="editorial-atlas-heading editorial-country-heading">
        <p class="editorial-atlas-kicker">${escapeHtml(city.data.name)} · regional kitchens</p>
        <h2>${country.data.flag} ${escapeHtml(country.data.name)}</h2>
        <p><strong>${country.data.available}</strong> restaurants · <span>${cuisines.length} cuisine traditions</span></p>
      </div>
      <svg class="editorial-atlas-map editorial-country-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(country.data.name)} regional cuisines">
        <defs>
          <filter id="cuisine-paper" x="-30%" y="-30%" width="160%" height="170%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="17" result="noise"></feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" result="softEdge"></feDisplacementMap>
            <feDropShadow in="softEdge" dx="0" dy="4" stdDeviation="5" flood-color="#4f493f" flood-opacity="0.15"></feDropShadow>
          </filter>
        </defs>
        <rect class="editorial-paper-field" x="0" y="0" width="${width}" height="${height}"></rect>
        <g class="editorial-country-silhouette">${feature ? `<path d="${path(feature)}"></path>` : ""}</g>
        <g class="editorial-cuisine-layer"></g>
      </svg>
      <p class="editorial-atlas-legend"><span>Regional cuisine</span><span>Size represents restaurants</span><span>Empty traditions remain visible</span></p>
      <aside class="cuisine-drawer editorial-cuisine-drawer" aria-live="polite"></aside>
      ${devMenuMarkup()}
    </section>
  `;

  const svg = d3.select(scene.querySelector(".editorial-country-map"));
  const islands = svg.select(".editorial-cuisine-layer")
    .selectAll("g")
    .data(positioned, (item) => item.node.data.id)
    .join("g")
    .attr("class", (item) => `editorial-cuisine-island${item.node.data.available === 0 ? " is-empty" : ""}`)
    .attr("transform", (item) => `translate(${item.x},${item.y})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.node.data.name}, ${item.node.data.available} restaurants`)
    .style("--breath-delay", (_, index) => `${(index % 7) * -0.58}s`)
    .on("click", (_, item) => selectCuisine(item.node))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCuisine(item.node);
    })
    .on("pointerover", (event, item) => showCursorLabel(event, `${item.node.data.emoji} ${item.node.data.name} · ${item.node.data.available} restaurants`))
    .on("pointermove", moveCursorLabel)
    .on("pointerout", hideCursorLabel);

  islands.append("circle")
    .attr("r", (item) => radius(item.node.data.available))
    .attr("filter", "url(#cuisine-paper)");
  islands.append("text")
    .attr("class", "editorial-cuisine-emoji")
    .attr("text-anchor", "middle")
    .attr("y", -12)
    .text((item) => item.node.data.emoji);
  islands.append("text")
    .attr("class", "editorial-cuisine-name")
    .attr("text-anchor", "middle")
    .attr("y", 14)
    .text((item) => item.node.data.name);
  islands.append("text")
    .attr("class", "editorial-cuisine-count")
    .attr("text-anchor", "middle")
    .attr("y", 32)
    .text((item) => `${item.node.data.available} ${item.node.data.available === 1 ? "Restaurant" : "Restaurants"}`);

  bindBreadcrumbs();
  bindDevMenu();
  if (state.cuisineId) {
    const selected = cuisines.find((node) => node.data.id === state.cuisineId);
    if (selected) selectCuisine(selected, false);
  }
}

function buildGridCartogram(values, width, height) {
  const columns = 320;
  const rows = 132;
  const resolutionScale = columns / 150;
  const quotaScale = resolutionScale ** 2;
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
    const quota = Math.max(8, Math.round((2 + Math.sqrt(node.data.available) * 3) * quotaScale));
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
      shapeScale: clamp(Math.sqrt(quota / shapeArea) * 1.45 * slenderShapeBoost, 0.35, 96),
      shapePath: feature && shapeContext && typeof Path2D !== "undefined" ? new Path2D(projectedPath(feature)) : null,
      shapeAspect,
      radius: Math.sqrt(quota / Math.PI) * 0.58 + resolutionScale * 0.42,
      cells: [],
      cellKeys: new Set(),
    };
  });
  relaxCartogramAnchors(items, columns, rows, resolutionScale);
  assignCartogramShades(items, resolutionScale);

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
    item.centroidX = centroidX;
    item.centroidY = centroidY;
    item.displayArea = item.cells.length / quotaScale;
    item.labelX = item.displayArea >= 20 ? centroidX : item.seedX * 0.72 + centroidX * 0.28;
    item.labelY = item.displayArea >= 20 ? centroidY : item.seedY * 0.72 + centroidY * 0.28;
    item.showName = item.displayArea >= 4.5;
    item.showCount = item.displayArea >= 10;
    item.labelFontSize = clamp(6 + Math.sqrt(item.displayArea) * 0.62, 8, 13);
    item.nameFontSize = clamp(5.8 + Math.sqrt(item.displayArea) * 0.38, 6.5, 10.5);
  });
  relaxCartogramLabels(items, cellSize, columns, rows);
  return { items, columns, rows, cellSize, gridWidth, gridHeight, originX, originY };
}

function relaxCartogramAnchors(items, columns, rows, resolutionScale) {
  compactContinentAnchors(items);
  const links = cartogramNeighborLinks(items, resolutionScale);
  items.forEach((item) => {
    item.x = item.anchorX;
    item.y = item.anchorY;
  });
  const simulation = d3.forceSimulation(items)
    .force("link", d3.forceLink(links)
      .id((item) => item.node.data.id)
      .distance((link) => link.distance)
      .strength((link) => link.direct ? 0.94 : 0.42)
      .iterations(5))
    .force("x", d3.forceX((item) => item.anchorX).strength(0.135))
    .force("y", d3.forceY((item) => item.anchorY).strength(0.135))
    .force("collide", d3.forceCollide((item) => item.radius + resolutionScale * 0.08).strength(0.98).iterations(10))
    .force("charge", d3.forceManyBody().strength(-0.025 * resolutionScale))
    .stop();
  for (let tick = 0; tick < 420; tick += 1) simulation.tick();
  items.forEach((item) => {
    item.anchorX = clamp(item.x, item.radius + 3, columns - item.radius - 4);
    item.anchorY = clamp(item.y, item.radius + 3, rows - item.radius - 4);
  });
}

function compactContinentAnchors(items) {
  const compactness = {
    Americas: 0.72,
    Europe: 0.78,
    Africa: 0.52,
    Asia: 0.69,
    Oceania: 0.72,
  };
  d3.groups(items, (item) => item.node.parent?.data.name).forEach(([continent, group]) => {
    const centerX = d3.mean(group, (item) => item.anchorX);
    const centerY = d3.mean(group, (item) => item.anchorY);
    const scale = compactness[continent] ?? 0.84;
    group.forEach((item) => {
      item.anchorX = centerX + (item.anchorX - centerX) * scale;
      item.anchorY = centerY + (item.anchorY - centerY) * scale;
    });
  });
}

function cartogramNeighborLinks(items, resolutionScale) {
  const links = [];
  const linkKeys = new Set();
  const addLink = (source, target, direct) => {
    if (!source || !target || source === target) return;
    const ids = [source.node.data.id, target.node.data.id].sort();
    const key = ids.join("|");
    if (linkKeys.has(key)) return;
    linkKeys.add(key);
    const anchorDistance = Math.hypot(source.anchorX - target.anchorX, source.anchorY - target.anchorY);
    const touchingDistance = source.radius + target.radius + resolutionScale * (direct ? 0.05 : 0.25);
    links.push({
      source,
      target,
      direct,
      distance: direct
        ? Math.max(touchingDistance, anchorDistance * 0.5)
        : Math.max(touchingDistance, Math.min(anchorDistance * 0.64, touchingDistance * 1.72)),
    });
  };

  const geometryNeighbors = topojson.neighbors(worldTopology.objects.countries.geometries);
  const itemByFeatureIndex = new Map();
  items.forEach((item) => {
    const featureIndex = worldFeatures.indexOf(featureForCountry(item.node));
    if (featureIndex >= 0) itemByFeatureIndex.set(featureIndex, item);
  });
  geometryNeighbors.forEach((neighborIndexes, sourceIndex) => {
    const source = itemByFeatureIndex.get(sourceIndex);
    neighborIndexes.forEach((targetIndex) => addLink(source, itemByFeatureIndex.get(targetIndex), true));
  });

  items.forEach((item) => {
    const nearest = items
      .filter((candidate) => candidate !== item && candidate.node.parent?.data.name === item.node.parent?.data.name)
      .sort((a, b) => Math.hypot(a.anchorX - item.anchorX, a.anchorY - item.anchorY)
        - Math.hypot(b.anchorX - item.anchorX, b.anchorY - item.anchorY))
      .slice(0, 5);
    nearest.forEach((candidate) => addLink(item, candidate, false));
  });
  return links;
}

function relaxCartogramLabels(items, cellSize, columns, rows) {
  const labels = items.map((item) => ({
      item,
      anchorX: item.labelX,
      anchorY: item.labelY,
      x: item.labelX,
      y: item.labelY,
      maxDisplacement: item.displayArea >= 20 ? 3.6 : item.radius * 0.55 + 5,
    }));
  const updateMetrics = () => labels.forEach((label) => {
    const { item } = label;
    const textWidth = item.showName ? Math.max(18, (item.labelName ?? item.node.data.name).length * item.nameFontSize * 0.56) : 0;
    const flagWidth = item.hideLabel ? 0 : item.labelFontSize + 6;
    const textHeight = item.showCount ? 29 : item.showName ? 20 : item.hideLabel ? 0 : item.labelFontSize + 4;
    label.halfWidth = Math.max(textWidth, flagWidth) * 0.53 / cellSize;
    label.halfHeight = textHeight * 0.53 / cellSize;
  });
  const settle = (iterations = 220) => {
    for (let tick = 0; tick < iterations; tick += 1) {
      labels.forEach((label) => {
        if (label.item.hideLabel) return;
        label.x += (label.anchorX - label.x) * 0.065;
        label.y += (label.anchorY - label.y) * 0.065;
      });
      for (let index = 0; index < labels.length; index += 1) {
        const a = labels[index];
        if (a.item.hideLabel) continue;
        for (let otherIndex = index + 1; otherIndex < labels.length; otherIndex += 1) {
          const b = labels[otherIndex];
          if (b.item.hideLabel) continue;
          const dx = b.x - a.x || 0.001;
          const dy = b.y - a.y || 0.001;
          const overlapX = a.halfWidth + b.halfWidth + 1.15 - Math.abs(dx);
          const overlapY = a.halfHeight + b.halfHeight + 1.15 - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const aWeight = a.item.displayArea >= b.item.displayArea ? 0.28 : 0.72;
          const bWeight = 1 - aWeight;
          if (overlapX < overlapY) {
            const direction = Math.sign(dx);
            a.x -= direction * overlapX * aWeight;
            b.x += direction * overlapX * bWeight;
          } else {
            const direction = Math.sign(dy);
            a.y -= direction * overlapY * aWeight;
            b.y += direction * overlapY * bWeight;
          }
        }
      }
      labels.forEach((label) => {
        label.x = clamp(label.x, label.anchorX - label.maxDisplacement, label.anchorX + label.maxDisplacement);
        label.y = clamp(label.y, label.anchorY - label.maxDisplacement, label.anchorY + label.maxDisplacement);
        label.x = clamp(label.x, label.halfWidth + 1, columns - label.halfWidth - 1);
        label.y = clamp(label.y, label.halfHeight + 1, rows - label.halfHeight - 1);
      });
    }
  };
  const overlappingPairs = () => {
    const pairs = [];
    for (let index = 0; index < labels.length; index += 1) {
      const a = labels[index];
      if (a.item.hideLabel) continue;
      for (let otherIndex = index + 1; otherIndex < labels.length; otherIndex += 1) {
        const b = labels[otherIndex];
        if (b.item.hideLabel) continue;
        if (Math.abs(b.x - a.x) < a.halfWidth + b.halfWidth + 0.5
          && Math.abs(b.y - a.y) < a.halfHeight + b.halfHeight + 0.5) pairs.push([a, b]);
      }
    }
    return pairs;
  };
  const lessImportant = (a, b) => a.item.displayArea <= b.item.displayArea ? a : b;

  updateMetrics();
  settle();
  overlappingPairs().forEach(([a, b]) => {
    const label = lessImportant(a, b);
    label.item.showName = false;
    label.item.showCount = false;
  });
  updateMetrics();
  settle(160);
  overlappingPairs().forEach(([a, b]) => {
    lessImportant(a, b).item.hideLabel = true;
  });
  updateMetrics();
  settle(100);
  labels.forEach((label) => {
    label.item.labelX = clamp(label.x, 1, columns - 2);
    label.item.labelY = clamp(label.y, 1, rows - 2);
    label.item.labelRadius = Math.hypot(label.halfWidth, label.halfHeight);
  });
}

function declutterRenderedCartogramLabels(svgElement) {
  if (!svgElement) return;
  const groups = [...svgElement.querySelectorAll(".grid-cartogram-label")];
  const removeLowestPriorityText = (first, second) => {
    const firstArea = first.__data__?.displayArea ?? 0;
    const secondArea = second.__data__?.displayArea ?? 0;
    const target = firstArea <= secondArea ? first : second;
    const count = target.querySelector(".grid-cartogram-count");
    const name = target.querySelector(".grid-cartogram-name");
    const flag = target.querySelector(".grid-cartogram-flag");
    if (count?.textContent) count.textContent = "";
    else if (name?.textContent) name.textContent = "";
    else if (flag?.textContent) flag.textContent = "";
  };
  for (let pass = 0; pass < groups.length * 3; pass += 1) {
    const visibleText = groups.flatMap((group) => [...group.querySelectorAll("text")]
      .filter((text) => text.textContent.trim())
      .map((text) => ({ group, rect: text.getBoundingClientRect() })));
    let collision = null;
    for (let index = 0; index < visibleText.length && !collision; index += 1) {
      const a = visibleText[index];
      for (let otherIndex = index + 1; otherIndex < visibleText.length; otherIndex += 1) {
        const b = visibleText[otherIndex];
        if (a.group === b.group) continue;
        if (a.rect.left < b.rect.right + 1
          && a.rect.right + 1 > b.rect.left
          && a.rect.top < b.rect.bottom + 1
          && a.rect.bottom + 1 > b.rect.top) {
          collision = [a.group, b.group];
          break;
        }
      }
    }
    if (!collision) break;
    removeLowestPriorityText(collision[0], collision[1]);
  }
}

function updateCartogramLeaderVisibility(svgElement) {
  if (!svgElement) return;
  svgElement.querySelectorAll(".grid-label-leader").forEach((leader) => {
    const countryId = leader.getAttribute("data-country-id");
    const label = svgElement.querySelector(`.grid-cartogram-label[data-country-id="${countryId}"]`);
    leader.style.display = label?.textContent.trim() ? "" : "none";
  });
}

function cartogramGeographicAnchor(node, projected, projection) {
  const continent = node.parent?.data.name;
  if (continent === "Europe") {
    const center = projection([14, 51]);
    return [
      center[0] + (projected[0] - center[0]) * 3.45,
      center[1] + (projected[1] - center[1]) * 3.2 - 3.5,
    ];
  }
  if (continent === "Africa") {
    const center = projection([18, 13]);
    return [
      center[0] + (projected[0] - center[0]) * 0.72 - 2,
      center[1] + (projected[1] - center[1]) * 0.66 + 26,
    ];
  }
  return projected;
}

function assignCartogramShades(items, resolutionScale) {
  [...items].sort((a, b) => b.quota - a.quota).forEach((item) => {
    const nearby = items.filter((other) => other !== item
      && other.shadeIndex !== undefined
      && other.node.parent?.data.name === item.node.parent?.data.name
      && Math.hypot(other.anchorX - item.anchorX, other.anchorY - item.anchorY) < 14 * resolutionScale);
    const scores = [0, 1, 2, 3].map((shadeIndex) => d3.sum(nearby, (other) => (
      other.shadeIndex === shadeIndex
        ? 1 / Math.max(1, Math.hypot(other.anchorX - item.anchorX, other.anchorY - item.anchorY))
        : 0
    )));
    item.shadeIndex = d3.minIndex(scores);
  });
}

function cartogramCountryColor(item) {
  const continent = item.node.parent?.data.name;
  const base = d3.hsl(CARTOGRAM_CONTINENT_COLORS[continent] ?? "#77736b");
  const lightnessOffsets = [-0.065, -0.018, 0.034, 0.072];
  base.l = clamp(base.l + lightnessOffsets[item.shadeIndex ?? 0], 0.2, 0.72);
  base.s = continent === "Africa" ? 0.035 : clamp(base.s * 0.82, 0.16, 0.52);
  return base.formatHex();
}

function gridCartogramFitTransform(grid, width, height) {
  const allCells = grid.items.flatMap((item) => item.cells);
  if (!allCells.length) return d3.zoomIdentity;
  const minX = d3.min(allCells, (cell) => cell.x);
  const maxX = d3.max(allCells, (cell) => cell.x + 1);
  const minY = d3.min(allCells, (cell) => cell.y);
  const maxY = d3.max(allCells, (cell) => cell.y + 1);
  const minLabelX = d3.min(grid.items, (item) => item.labelX - (item.labelRadius ?? 0));
  const maxLabelX = d3.max(grid.items, (item) => item.labelX + (item.labelRadius ?? 0));
  const minLabelY = d3.min(grid.items, (item) => item.labelY - (item.labelRadius ?? 0));
  const maxLabelY = d3.max(grid.items, (item) => item.labelY + (item.labelRadius ?? 0));
  const padding = Math.max(7, grid.cellSize * 2.5);
  const bounds = {
    x0: grid.originX + Math.min(minX, minLabelX) * grid.cellSize - padding,
    x1: grid.originX + Math.max(maxX, maxLabelX) * grid.cellSize + padding,
    y0: grid.originY + Math.min(minY, minLabelY) * grid.cellSize - padding,
    y1: grid.originY + Math.max(maxY, maxLabelY) * grid.cellSize + padding,
  };
  const viewport = { x0: 10, x1: width - 10, y0: 116, y1: height - 60 };
  const scale = clamp(Math.min(
    (viewport.x1 - viewport.x0) / (bounds.x1 - bounds.x0),
    (viewport.y1 - viewport.y0) / (bounds.y1 - bounds.y0),
  ), 0.7, 2.9);
  const boundsCenterX = (bounds.x0 + bounds.x1) / 2;
  const boundsCenterY = (bounds.y0 + bounds.y1) / 2;
  const viewportCenterX = (viewport.x0 + viewport.x1) / 2;
  const viewportCenterY = (viewport.y0 + viewport.y1) / 2;
  return d3.zoomIdentity
    .translate(viewportCenterX - boundsCenterX * scale, viewportCenterY - boundsCenterY * scale)
    .scale(scale);
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
      if (item.allowedCell && !item.allowedCell(candidate)) return;
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
  const feature = featureForCountry(country);
  const grid = buildRegionalCuisineCartogram(cuisines, country, feature, width, height);
  const path = d3.geoPath(grid.projection);
  const continent = country.parent?.data.name;

  scene.innerHTML = `
    <section class="culinary-map regional-cartogram-view semantic-layer" aria-label="${escapeHtml(country.data.name)} regional cuisine cartogram">
      ${breadcrumbMarkup(city, country)}
      <div class="map-heading cartogram-heading">
        <p><strong>${country.data.flag} ${escapeHtml(country.data.name)}</strong> · cuisine territories</p>
        <span>Regional area = verified restaurants · position follows culinary geography</span>
      </div>
      <svg class="world-map regional-cartogram-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="Regional cuisines sized by verified restaurants and positioned by geographic origin">
        <g class="map-zoom-layer regional-cartogram-zoom-layer">
          ${feature ? `<g class="regional-country-silhouette" transform="translate(${grid.originX},${grid.originY}) scale(${grid.cellSize})"><path d="${path(feature)}"></path></g>` : ""}
          <g class="regional-territories"></g>
          <g class="regional-territory-labels"></g>
        </g>
      </svg>
      <p class="map-legend"><span class="legend-flag">${country.data.flag}</span><span>Regional territory = restaurant count</span><span class="legend-action">Select a cuisine to see its restaurants</span></p>
      <aside class="cuisine-drawer" aria-live="polite"></aside>
      ${devMenuMarkup()}
    </section>
  `;

  const nodes = d3.select(scene.querySelector(".regional-territories")).selectAll("g")
    .data(grid.items, (item) => item.node.data.id)
    .join("g")
    .attr("class", (item) => [
      "grid-cartogram-country",
      "regional-grid-territory",
      item.node.data.available === 0 ? "is-empty" : "",
      item.node.data.unclassified ? "is-unclassified" : "",
    ].filter(Boolean).join(" "))
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.node.data.name}, ${item.node.data.available} restaurants`)
    .on("click", (_, item) => selectCuisine(item.node))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCuisine(item.node);
    });
  nodes.each(function renderRegionalGridCells(item) {
    d3.select(this).selectAll("rect")
      .data(item.cells)
      .join("rect")
      .attr("x", (cell) => grid.originX + cell.x * grid.cellSize)
      .attr("y", (cell) => grid.originY + cell.y * grid.cellSize)
      .attr("width", grid.cellSize)
      .attr("height", grid.cellSize)
      .style("--territory-color", CARTOGRAM_CONTINENT_COLORS[continent] ?? "#77736b");
  });
  nodes.append("path")
    .attr("class", "grid-country-separator")
    .attr("d", (item) => gridBoundaryPath(item, grid));
  nodes.append("path")
    .attr("class", "grid-country-border")
    .attr("d", (item) => gridBoundaryPath(item, grid));

  const labels = d3.select(scene.querySelector(".regional-territory-labels")).selectAll("g")
    .data(grid.items, (item) => item.node.data.id)
    .join("g")
    .attr("class", "grid-cartogram-label regional-grid-label")
    .attr("transform", (item) => `translate(${grid.originX + (item.labelX + 0.5) * grid.cellSize},${grid.originY + (item.labelY + 0.5) * grid.cellSize})`)
    .attr("aria-hidden", "true");
  labels.append("text")
    .attr("class", "grid-cartogram-flag")
    .attr("text-anchor", "middle")
    .attr("y", -4)
    .style("font-size", (item) => `${item.labelFontSize}px`)
    .text((item) => item.hideLabel ? "" : item.node.data.emoji);
  labels.append("text")
    .attr("class", "grid-cartogram-name")
    .attr("text-anchor", "middle")
    .attr("y", 9)
    .style("font-size", (item) => `${item.nameFontSize}px`)
    .text((item) => item.showName ? item.labelName : "");
  labels.append("text")
    .attr("class", "grid-cartogram-count")
    .attr("text-anchor", "middle")
    .attr("y", 19)
    .text((item) => item.showCount ? `${item.node.data.available}` : "");

  declutterRenderedCartogramLabels(scene.querySelector(".regional-cartogram-map"));
  document.fonts?.ready.then(() => declutterRenderedCartogramLabels(scene.querySelector(".regional-cartogram-map")));
  bindMapZoom(d3.select(scene.querySelector(".regional-cartogram-map")), width, height);

  bindBreadcrumbs();
  bindDevMenu();
  if (state.cuisineId) {
    const selected = cuisines.find((node) => node.data.id === state.cuisineId);
    if (selected) selectCuisine(selected, false);
  }
}

function buildRegionalCuisineCartogram(cuisines, country, feature, width, height) {
  const columns = 180;
  const rows = 112;
  const quotaScale = 3.2;
  const cellSize = Math.min((width - 38) / columns, (height - 172) / rows);
  const gridWidth = columns * cellSize;
  const gridHeight = rows * cellSize;
  const originX = (width - gridWidth) / 2;
  const originY = 112 + Math.max(0, (height - 172 - gridHeight) / 2);
  const items = cuisines.map((node) => {
    const quota = Math.max(10, Math.round((2 + Math.sqrt(node.data.available) * 3) * quotaScale));
    return {
      node,
      quota,
      unclassified: Boolean(node.data.unclassified),
      radius: Math.sqrt(quota / Math.PI) * 0.62 + 1.2,
      shapeAspect: 1,
      cells: [],
      cellKeys: new Set(),
    };
  });
  const unclassified = items.find((item) => item.unclassified);
  const projection = d3.geoMercator();
  if (feature) {
    projection.fitExtent([[8, 6], [columns - 8, rows - 8]], feature);
  } else {
    projection
      .center([country.data.lng, country.data.lat])
      .translate([columns / 2, rows / 2])
      .scale(180);
  }
  const insideCountry = (cell) => {
    if (!feature) return true;
    const location = projection.invert([cell.x + 0.5, cell.y + 0.5]);
    return Boolean(location && d3.geoContains(feature, location));
  };
  const primaryCountryCells = feature
    ? regionalPrimaryGridComponent(columns, rows, insideCountry)
    : null;
  const insidePrimaryCountry = (cell) => !primaryCountryCells
    || primaryCountryCells.has(`${Math.round(cell.x)},${Math.round(cell.y)}`);
  const uncategorizedAnchor = unclassified
    ? regionalLowerInteriorAnchor(feature, projection, columns, rows, unclassified.radius, insidePrimaryCountry)
    : null;

  items.forEach((item) => {
    const projected = projection([item.node.data.lng, item.node.data.lat]) ?? [columns / 2, rows / 2];
    item.anchorX = item.unclassified
      ? uncategorizedAnchor[0]
      : clamp(projected[0], item.radius + 2, columns - item.radius - 2);
    item.anchorY = item.unclassified
      ? uncategorizedAnchor[1]
      : clamp(projected[1], item.radius + 2, rows - item.radius - 2);
    item.x = item.anchorX;
    item.y = item.anchorY;
  });

  const provincialItems = items.filter((item) => !item.unclassified);
  const links = [];
  const linkKeys = new Set();
  provincialItems.forEach((item) => {
    provincialItems
      .filter((candidate) => candidate !== item)
      .sort((a, b) => Math.hypot(a.anchorX - item.anchorX, a.anchorY - item.anchorY)
        - Math.hypot(b.anchorX - item.anchorX, b.anchorY - item.anchorY))
      .slice(0, 2)
      .forEach((candidate) => {
        const key = [item.node.data.id, candidate.node.data.id].sort().join("|");
        if (linkKeys.has(key)) return;
        linkKeys.add(key);
        links.push({
          source: item,
          target: candidate,
          distance: Math.max(item.radius + candidate.radius + 2, Math.hypot(item.anchorX - candidate.anchorX, item.anchorY - candidate.anchorY) * 0.72),
        });
      });
  });
  const simulation = d3.forceSimulation(items)
    .force("link", d3.forceLink(links).id((item) => item.node.data.id).distance((link) => link.distance).strength(0.34))
    .force("x", d3.forceX((item) => item.anchorX).strength((item) => item.unclassified ? 0.9 : 0.2))
    .force("y", d3.forceY((item) => item.anchorY).strength((item) => item.unclassified ? 0.9 : 0.2))
    .force("collide", d3.forceCollide((item) => item.radius + 2.2).strength(1).iterations(8))
    .stop();
  for (let tick = 0; tick < 360; tick += 1) {
    simulation.tick();
    items.forEach((item) => {
      item.x = clamp(item.x, item.radius + 2, columns - item.radius - 2);
      item.y = clamp(item.y, item.radius + 2, rows - item.radius - 2);
    });
  }

  const occupied = new Map();
  [...items].sort((a, b) => a.quota - b.quota).forEach((item) => {
    const allowedCell = item.unclassified ? insidePrimaryCountry : insideCountry;
    const seed = nearestAllowedGridCell(Math.round(item.x), Math.round(item.y), occupied, columns, rows, allowedCell);
    addGridCell(item, seed, occupied);
    item.seedX = seed.x;
    item.seedY = seed.y;
    item.anchorX = item.x;
    item.anchorY = item.y;
    item.allowedCell = allowedCell;
    item.containsTargetCell = allowedCell;
  });
  let remaining = d3.sum(items, (item) => item.quota - item.cells.length);
  let guard = remaining * 4 + 100;
  while (remaining > 0 && guard > 0) {
    guard -= 1;
    let progress = false;
    items
      .filter((item) => item.cells.length < item.quota)
      .sort((a, b) => (b.quota - b.cells.length) / b.quota - (a.quota - a.cells.length) / a.quota)
      .forEach((item) => {
        const candidate = bestGrowthCell(item, occupied, columns, rows);
        if (!candidate) return;
        addGridCell(item, candidate, occupied);
        remaining -= 1;
        progress = true;
      });
    if (!progress) break;
  }

  items.forEach((item) => {
    const centroidX = d3.mean(item.cells, (cell) => cell.x);
    const centroidY = d3.mean(item.cells, (cell) => cell.y);
    item.displayArea = item.cells.length / quotaScale;
    item.labelX = centroidX;
    item.labelY = centroidY;
    item.labelName = regionalCuisineLabel(item.node.data.name, item.displayArea);
    item.showName = true;
    item.showCount = true;
    item.labelFontSize = clamp(7 + Math.sqrt(item.displayArea) * 0.62, 9, 17);
    item.nameFontSize = clamp(6.4 + Math.sqrt(item.displayArea) * 0.38, 7, 12);
  });
  relaxCartogramLabels(items, cellSize, columns, rows);
  return { items, columns, rows, cellSize, gridWidth, gridHeight, originX, originY, projection };
}

function nearestAllowedGridCell(targetX, targetY, occupied, columns, rows, allowedCell) {
  for (let radius = 0; radius < Math.max(columns, rows); radius += 1) {
    for (let y = targetY - radius; y <= targetY + radius; y += 1) {
      for (let x = targetX - radius; x <= targetX + radius; x += 1) {
        if (x < 0 || x >= columns || y < 0 || y >= rows) continue;
        if (Math.max(Math.abs(x - targetX), Math.abs(y - targetY)) !== radius) continue;
        const candidate = { x, y };
        if (!occupied.has(`${x},${y}`) && allowedCell(candidate)) return candidate;
      }
    }
  }
  return nearestGridCell(targetX, targetY, occupied, columns, rows);
}

function regionalPrimaryGridComponent(columns, rows, insideCountry) {
  const unseen = new Set();
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      if (insideCountry({ x, y })) unseen.add(`${x},${y}`);
    }
  }
  let largest = new Set();
  while (unseen.size) {
    const start = unseen.values().next().value;
    const component = new Set([start]);
    const queue = [start];
    unseen.delete(start);
    while (queue.length) {
      const [x, y] = queue.shift().split(",").map(Number);
      gridNeighbors(x, y).forEach((neighbor) => {
        const key = `${neighbor.x},${neighbor.y}`;
        if (!unseen.has(key)) return;
        unseen.delete(key);
        component.add(key);
        queue.push(key);
      });
    }
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function regionalLowerInteriorAnchor(feature, projection, columns, rows, radius, insidePrimaryCountry) {
  if (!feature) return [columns / 2, rows * 0.68];
  const geographicCenter = d3.geoCentroid(feature);
  const projectedCenter = projection(geographicCenter) ?? [columns / 2, rows / 2];
  const [[, minY], [, maxY]] = d3.geoPath(projection).bounds(feature);
  const targetY = projectedCenter[1] + (maxY - minY) * 0.18;
  const clearance = Math.max(1.5, radius * 0.48);
  let best = null;
  let bestScore = Infinity;
  for (let y = Math.floor(projectedCenter[1]); y < rows - 3; y += 1) {
    for (let x = 3; x < columns - 3; x += 1) {
      const samples = [
        [x, y],
        [x - clearance, y],
        [x + clearance, y],
        [x, y - clearance],
        [x, y + clearance],
      ];
      const safelyInside = samples.every(([sampleX, sampleY]) => insidePrimaryCountry({
        x: Math.round(sampleX),
        y: Math.round(sampleY),
      }));
      if (!safelyInside) continue;
      const score = Math.abs(y - targetY) * 1.8 + Math.abs(x - projectedCenter[0]);
      if (score < bestScore) {
        best = [x, y];
        bestScore = score;
      }
    }
  }
  if (best) return best;
  return projectedCenter;
}

function regionalCuisineLabel(name, displayArea) {
  const concise = name
    .replace("Unclassified regional identity", "Uncategorized")
    .replace(" culinary family", "")
    .split(/\s[\/·]\s/)
    .slice(0, 2)
    .join(" · ");
  const maxCharacters = Math.round(clamp(8 + Math.sqrt(displayArea) * 2.6, 10, 24));
  return concise.length <= maxCharacters ? concise : `${concise.slice(0, Math.max(6, maxCharacters - 1)).trim()}…`;
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
