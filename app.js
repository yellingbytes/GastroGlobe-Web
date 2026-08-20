import { buildAtlasHierarchy, countries, datasetMeta, googleMapsUrl, metropolitanEditions } from "./restaurants.js?v=navigation-experiment-1";

const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const TOPOJSON_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";
const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const scene = document.querySelector("#scene");
const cursorLabel = document.querySelector("#cursor-label");

const state = {
  visualization: "claude",
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
let cursorMoveFrame = 0;
let cursorClientX = 0;
let cursorClientY = 0;
let cityTransitionInFlight = false;
let pendingCuisineClusterReveal = null;
let activeCuisineClusterReveal = null;

const HOME_CUISINE_CLUSTER_DURATION = 1200;

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
  document.body.classList.add("home-world-view");
  scene.classList.remove("has-city-back");
  state.cityId = null;
  state.countryId = null;
  state.cuisineId = null;
  state.treeFocusId = null;
  const width = Math.max(360, scene.clientWidth || window.innerWidth || 1200);
  const height = Math.max(540, scene.clientHeight || window.innerHeight || 760);
  const compact = width < 720;
  const mapInset = compact ? 16 : 28;
  const projection = d3.geoMercator()
    .scale((width - mapInset * 2) / (Math.PI * 2))
    .translate([width / 2, height * (compact ? 0.5 : 0.54)])
    .clipExtent([[mapInset, compact ? 132 : 62], [width - mapInset, height - (compact ? 138 : 24)]]);
  const cellSize = 4;
  const pixelWorld = rasterizePixelWorld(projection, width, height, cellSize);
  const worldWidth = width - mapInset * 2;
  const worldOffsets = [-worldWidth, 0, worldWidth];
  const profiles = cityNodes.map((city) => metropolitanProfile(city));
  const wheelScale = d3.scaleSqrt()
    .domain([0, d3.max(profiles, (profile) => profile.cuisineDiversity) || 1])
    .range(compact ? [12, 32] : [16, 44]);
  const cityItems = profiles.map((profile) => {
    const anchor = projection([profile.city.data.lng, profile.city.data.lat]);
    const wheelRadius = profile.live ? wheelScale(profile.cuisineDiversity) * 0.5 : compact ? 6.5 : 8.5;
    return {
      ...profile,
      anchorX: anchor[0],
      anchorY: anchor[1],
      x: anchor[0],
      y: anchor[1],
      wheelRadius,
    };
  });
  const simulation = d3.forceSimulation(cityItems)
    .force("x", d3.forceX((item) => item.anchorX).strength(0.46))
    .force("y", d3.forceY((item) => item.anchorY).strength(0.46))
    .force("collide", d3.forceCollide((item) => item.wheelRadius + (compact ? 34 : 30)).iterations(7))
    .stop();
  for (let index = 0; index < (compact ? 300 : 220); index += 1) simulation.tick();
  cityItems.forEach((item) => {
    item.x = clamp(item.x, item.wheelRadius + 34, width - item.wheelRadius - 34);
    item.y = clamp(item.y, compact ? 152 : item.wheelRadius + 32, height - (compact ? 160 : item.wheelRadius + 38));
    if (!compact && item.x > width - 390) item.y = Math.min(item.y, height - 210);
  });
  const repeatedCityItems = worldOffsets.flatMap((worldOffset, repeatIndex) => cityItems.map((item) => ({
    ...item,
    worldOffset,
    renderX: item.x + worldOffset,
    repeatIndex: repeatIndex - 1,
  })));

  scene.innerHTML = `
    <section class="home-world-atlas semantic-layer" aria-label="World atlas of metropolitan food cultures">
      <header class="home-world-heading">
        <p class="home-world-kicker">GastroGlobe · Metropolitan food atlas</p>
        <h1>A city contains<br />a miniature world.</h1>
        <p>Choose a city to reveal the food cultures living inside it.</p>
      </header>
      <svg class="home-world-map" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="home-world-title home-world-desc">
        <title id="home-world-title">Metropolitan food cultures across the world</title>
        <desc id="home-world-desc">A grid-contour Web Mercator world map using the same continent colors as the culinary city atlas. Compact city wheels show the continent composition of each metropolitan food culture.</desc>
        <defs>
          <g id="home-world-tile">
            <g class="home-world-pixels">${pixelWorld.countries.map((country) => `<path class="home-world-pixel-country" data-home-country-index="${country.index}" data-country-name="${escapeHtml(country.name)}" data-tone="${country.index % 4}" data-continent="${country.continent}"${country.countryId ? ` data-country-id="${country.countryId}"` : ""} style="--home-country-color:${CARTOGRAM_CONTINENT_COLORS[country.continent]}" d="${country.path}"></path>`).join("")}</g>
          </g>
        </defs>
        <g class="home-world-zoom-layer">
          <g class="home-world-repeats">${worldOffsets.map((offset) => `<use href="#home-world-tile" transform="translate(${offset},0)"></use>`).join("")}</g>
          <g class="home-city-leaders"></g>
          <g class="home-city-nodes"></g>
        </g>
      </svg>
      <p class="home-world-status" aria-live="polite">${cityNodes.length} metropolitan editions · ${profiles.filter((profile) => profile.live).length} verified dataset · Web Mercator</p>
    </section>
  `;

  const svg = d3.select(scene.querySelector(".home-world-map"));
  svg.node().__homeGrid = {
    cellSize,
    countries: pixelWorld.countries,
    projection,
    worldWidth,
  };
  svg.select(".home-city-leaders")
    .selectAll("line")
    .data(repeatedCityItems.filter((item) => Math.hypot(item.x - item.anchorX, item.y - item.anchorY) > 7))
    .join("line")
    .attr("x1", (item) => item.anchorX + item.worldOffset)
    .attr("y1", (item) => item.anchorY)
    .attr("x2", (item) => item.renderX)
    .attr("y2", (item) => item.y);

  const nodes = svg.select(".home-city-nodes")
    .selectAll("g")
    .data(repeatedCityItems, (item) => `${item.city.data.id}-${item.repeatIndex}`)
    .join("g")
    .attr("class", (item) => `home-city-node ${item.live ? "is-available" : "is-preview"}`)
    .attr("transform", (item) => `translate(${item.renderX},${item.y})`)
    .attr("data-city-id", (item) => item.city.data.id)
    .attr("role", (item) => item.repeatIndex === 0 ? "button" : null)
    .attr("tabindex", (item) => item.repeatIndex === 0 ? 0 : -1)
    .attr("aria-hidden", (item) => item.repeatIndex === 0 ? null : "true")
    .attr("aria-label", (item) => item.repeatIndex === 0 ? cityNodeAriaLabel(item) : null)
    .on("click", (_, item) => activateMetropolitan(item))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activateMetropolitan(item);
    });

  nodes.append("circle")
    .attr("class", "home-city-hit")
    .attr("r", (item) => Math.max(15, item.wheelRadius + 4));
  nodes.append("g")
    .attr("class", "home-city-continent-ring")
    .selectAll("path")
    .data((item) => continentRingArcs(item))
    .join("path")
    .attr("d", (arc) => d3.arc().innerRadius(arc.innerRadius).outerRadius(arc.outerRadius).startAngle(arc.startAngle).endAngle(arc.endAngle)())
    .attr("fill", (arc) => CARTOGRAM_CONTINENT_COLORS[arc.continent]);
  nodes.append("text")
    .attr("class", "home-city-name")
    .attr("text-anchor", "middle")
    .attr("y", (item) => item.wheelRadius + 19)
    .text((item) => item.city.data.name);
  nodes.append("text")
    .attr("class", "home-city-meta")
    .attr("text-anchor", "middle")
    .attr("y", (item) => item.wheelRadius + 33)
    .text((item) => item.live ? `${item.verifiedRestaurants.toLocaleString("en")} verified` : "Preview");
  bindHomeWorldZoom(svg, width, height, worldWidth, {
    cellSize,
    scale: 1,
    focus: projection([0, 10]),
  });
}

function bindHomeWorldZoom(svg, width, height, worldWidth, initialView) {
  const layer = svg.select(".home-world-zoom-layer");
  const atlas = scene.querySelector(".home-world-atlas");
  const initialTransform = d3.zoomIdentity
    .translate(width / 2 - initialView.focus[0] * initialView.scale, height / 2 - initialView.focus[1] * initialView.scale)
    .scale(initialView.scale);
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .extent([[0, 0], [width, height]])
    .translateExtent([[-worldWidth * 1000, 0], [worldWidth * 1000, height]])
    .on("start", () => svg.classed("is-panning", true))
    .on("zoom", (event) => {
      const { k, x, y } = event.transform;
      const period = worldWidth * k;
      const wrappedX = ((x + period / 2) % period + period) % period - period / 2;
      layer.attr("transform", `translate(${wrappedX},${y}) scale(${k})`);
      layer.selectAll(".home-city-node")
        .attr("transform", (item) => `translate(${item.renderX},${item.y}) scale(${1 / k})`);
      const gridSize = initialView.cellSize * k;
      atlas.style.setProperty("--home-grid-size", `${gridSize}px`);
      atlas.style.setProperty("--home-grid-x", `${wrappedX % gridSize}px`);
      atlas.style.setProperty("--home-grid-y", `${y % gridSize}px`);
    })
    .on("end", () => svg.classed("is-panning", false));
  svg.call(zoom).on("dblclick.zoom", null);
  svg.call(zoom.transform, initialTransform);
}

function rasterizePixelWorld(projection, width, height, cellSize) {
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.scale(1 / cellSize, 1 / cellSize);
  const canvasPath = d3.geoPath(projection, context);
  const countryIndexByColor = new Map();
  worldFeatures.forEach((feature, index) => {
    if (normalizeCountryName(feature.properties?.name) === "antarctica") return;
    const code = index + 1;
    const red = (code * 67 + 17) % 251;
    const green = (code * 131 + 31) % 251;
    const blue = (code * 197 + 47) % 251;
    countryIndexByColor.set(`${red},${green},${blue}`, index);
    context.beginPath();
    canvasPath(feature);
    context.fillStyle = `rgb(${red},${green},${blue})`;
    context.fill();
  });
  context.setTransform(1, 0, 0, 1, 0, 0);

  const image = context.getImageData(0, 0, columns, rows).data;
  const ownership = new Int16Array(columns * rows);
  const landMask = new Uint8Array(columns * rows);
  ownership.fill(-1);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const ownershipIndex = row * columns + column;
      const imageOffset = ownershipIndex * 4;
      if (image[imageOffset + 3] < 24) continue;
      landMask[ownershipIndex] = 1;
      const countryIndex = countryIndexByColor.get(`${image[imageOffset]},${image[imageOffset + 1]},${image[imageOffset + 2]}`);
      if (countryIndex !== undefined) ownership[ownershipIndex] = countryIndex;
    }
  }

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const repairs = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const ownershipIndex = row * columns + column;
        if (!landMask[ownershipIndex] || ownership[ownershipIndex] >= 0) continue;
        const neighborCounts = new Map();
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            if (rowOffset === 0 && columnOffset === 0) continue;
            const neighborRow = row + rowOffset;
            const neighborColumn = column + columnOffset;
            if (neighborRow < 0 || neighborRow >= rows || neighborColumn < 0 || neighborColumn >= columns) continue;
            const neighborOwner = ownership[neighborRow * columns + neighborColumn];
            if (neighborOwner < 0) continue;
            neighborCounts.set(neighborOwner, (neighborCounts.get(neighborOwner) ?? 0) + 1);
          }
        }
        if (!neighborCounts.size) continue;
        const countryIndex = [...neighborCounts].sort((a, b) => b[1] - a[1])[0][0];
        repairs.push([ownershipIndex, countryIndex]);
      }
    }
    if (!repairs.length) break;
    repairs.forEach(([ownershipIndex, countryIndex]) => {
      ownership[ownershipIndex] = countryIndex;
    });
  }

  const cellsByCountry = new Map();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const countryIndex = ownership[row * columns + column];
      if (countryIndex < 0) continue;
      if (!cellsByCountry.has(countryIndex)) cellsByCountry.set(countryIndex, []);
      cellsByCountry.get(countryIndex).push({ column, row });
    }
  }

  const squareSize = cellSize + 0.08;
  const countries = [...cellsByCountry.entries()].map(([index, cells]) => {
    const representedCountry = homeCountryForFeature(worldFeatures[index]);
    return {
      index,
      cells,
      name: worldFeatures[index].properties?.name ?? `Country ${index + 1}`,
      countryId: representedCountry?.data.countryId ?? null,
      continent: representedCountry?.parent?.data.name ?? homeContinentForFeature(worldFeatures[index]),
      path: homeGridCellPath(cells, cellSize, squareSize),
    };
  });
  const representedIds = new Set(countries.map((country) => country.countryId).filter(Boolean));
  const occupiedCells = new Set(countries.flatMap((country) => country.cells.map((cell) => `${cell.column},${cell.row}`)));
  const nearestOpenCell = (preferredColumn, preferredRow) => {
    for (let radius = 0; radius <= 9; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          if (Math.max(Math.abs(columnOffset), Math.abs(rowOffset)) !== radius) continue;
          const column = clamp(preferredColumn + columnOffset, 0, columns - 1);
          const row = clamp(preferredRow + rowOffset, 0, rows - 1);
          const key = `${column},${row}`;
          if (occupiedCells.has(key)) continue;
          occupiedCells.add(key);
          return { column, row };
        }
      }
    }
    return { column: preferredColumn, row: preferredRow };
  };
  countryNodes.filter((node) => node.data.available > 0 && !representedIds.has(node.data.countryId)).forEach((node, offset) => {
    const projected = projection([node.data.lng, node.data.lat]);
    if (!projected) return;
    const cell = nearestOpenCell(
      clamp(Math.round(projected[0] / cellSize - 0.5), 0, columns - 1),
      clamp(Math.round(projected[1] / cellSize - 0.5), 0, rows - 1),
    );
    countries.push({
      index: worldFeatures.length + offset,
      cells: [cell],
      name: node.data.name,
      countryId: node.data.countryId,
      continent: node.parent?.data.name ?? "Asia",
      path: homeGridCellPath([cell], cellSize, squareSize),
      synthetic: true,
    });
  });
  return { countries };
}

function homeGridCellPath(cells, cellSize, squareSize = cellSize + 0.08) {
  return cells.map(({ column, row }) => {
    const x = column * cellSize;
    const y = row * cellSize;
    return `M${x},${y}h${squareSize}v${squareSize}h-${squareSize}Z`;
  }).join("");
}

function homeCountryForFeature(feature) {
  const featureName = normalizeCountryName(feature.properties?.name);
  return countryNodes.find((country) => normalizeCountryName(country.data.name) === featureName) ?? null;
}

function homeContinentForFeature(feature) {
  const featureName = normalizeCountryName(feature.properties?.name);
  const representedCountry = homeCountryForFeature(feature);
  if (representedCountry?.parent?.data.name) return representedCountry.parent.data.name;

  const explicit = new Map([
    ["greenland", "Americas"],
    ["iceland", "Europe"],
    ["russia", "Europe"],
    ["cyprus", "Europe"],
    ["australia", "Oceania"],
    ["new zealand", "Oceania"],
    ["papua new guinea", "Oceania"],
    ["fiji", "Oceania"],
    ["new caledonia", "Oceania"],
    ["solomon islands", "Oceania"],
    ["vanuatu", "Oceania"],
    ["saudi arabia", "Asia"],
    ["yemen", "Asia"],
    ["oman", "Asia"],
    ["united arab emirates", "Asia"],
    ["qatar", "Asia"],
    ["bahrain", "Asia"],
    ["kuwait", "Asia"],
    ["iraq", "Asia"],
    ["jordan", "Asia"],
  ]).get(featureName);
  if (explicit) return explicit;

  const [longitude, latitude] = d3.geoCentroid(feature);
  if (longitude < -25) return "Americas";
  if (latitude >= 34 && longitude >= -25 && longitude < 45) return "Europe";
  if (latitude < 34 && longitude >= -25 && longitude < 55) return "Africa";
  if ((longitude >= 110 && latitude < 15) || (longitude < -150 && latitude < 15)) return "Oceania";
  return "Asia";
}

function metropolitanProfile(city) {
  const live = Boolean(city.data.live);
  if (live) {
    const composition = Object.fromEntries(Object.keys(CONTINENT_COLORS).map((continent) => [continent, 0]));
    countryNodes.forEach((country) => {
      const continent = country.parent?.data.name;
      if (continent in composition) composition[continent] += country.data.available;
    });
    return {
      city,
      live,
      verifiedRestaurants: city.data.available,
      cuisineDiversity: countryNodes.filter((country) => country.data.available > 0).length,
      completeness: 1,
      composition,
      highlights: [...countryNodes].sort((a, b) => b.data.available - a.data.available).slice(0, 3).map((country) => `${country.data.flag} ${country.data.name}`),
    };
  }
  const random = seededRandom(`home-${city.data.id}`);
  const composition = Object.fromEntries(Object.keys(CONTINENT_COLORS).map((continent) => [continent, 0.18 + random()]));
  return {
    city,
    live,
    verifiedRestaurants: 0,
    cuisineDiversity: 0,
    completeness: 0,
    composition,
    highlights: [],
  };
}

function continentRingArcs(profile) {
  const entries = Object.entries(profile.composition).filter(([, value]) => value > 0);
  const total = d3.sum(entries, ([, value]) => value) || 1;
  let angle = -Math.PI / 2;
  return entries.map(([continent, value]) => {
    const startAngle = angle;
    const endAngle = angle + (value / total) * Math.PI * 2;
    angle = endAngle;
    return {
      continent,
      startAngle,
      endAngle,
      innerRadius: profile.wheelRadius * 0.42,
      outerRadius: profile.wheelRadius,
    };
  });
}

function cityNodeAriaLabel(profile) {
  if (!profile.live) return `${profile.city.data.name}, preview edition, verification pending`;
  return `${profile.city.data.name}, ${profile.verifiedRestaurants} verified restaurants across ${profile.cuisineDiversity} cuisine origins`;
}

function activateMetropolitan(profile) {
  if (profile.live) {
    openCity(profile.city.data.id);
    return;
  }
  scene.querySelectorAll(".home-city-node").forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.cityId === profile.city.data.id);
  });
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

async function openCity(cityId) {
  if (cityTransitionInFlight) return;
  const homeMap = scene.querySelector(".home-world-map");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (cityId !== "munich" || !homeMap?.__homeGrid || reduceMotion) {
    commitCityOpen(cityId);
    return;
  }

  cityTransitionInFlight = true;
  scene.setAttribute("aria-busy", "true");
  document.body.classList.add("is-home-cuisine-morphing");
  const status = scene.querySelector(".home-world-status");
  if (status) status.textContent = `${datasetMeta.includedRestaurants.toLocaleString("en")} Munich restaurants · reshaping the world`;
  try {
    const clusterReveal = captureHomeCuisineClusters(homeMap);
    pendingCuisineClusterReveal = clusterReveal;
    activeCuisineClusterReveal = clusterReveal;
    const handoffOverlay = clusterReveal ? createCuisineHandoffOverlay() : null;
    commitCityOpen(cityId);
    if (clusterReveal) await animateCuisineClustersIntoPlace(clusterReveal, handoffOverlay);
    else handoffOverlay?.remove();
  } catch (error) {
    console.error("Cuisine morph failed", error);
    commitCityOpen(cityId);
  } finally {
    cityTransitionInFlight = false;
    pendingCuisineClusterReveal = null;
    document.body.classList.remove("is-home-cuisine-morphing");
    scene.removeAttribute("aria-busy");
  }
}

function buildHomeCuisineSourcePlans(homeMap) {
  const { cellSize, countries: homeCountries, projection, worldWidth } = homeMap.__homeGrid;
  const countryNodeById = new Map(countryNodes.map((node) => [node.data.countryId, node]));
  const pathsByIndex = new Map(
    [...homeMap.querySelectorAll(".home-world-pixel-country")]
      .map((path) => [Number(path.dataset.homeCountryIndex), path]),
  );
  const plans = homeCountries.map((country) => {
    const node = country.countryId ? countryNodeById.get(country.countryId) : null;
    const restaurantCount = node?.data.available ?? 0;
    const anchor = homeCountryCellAnchor(country.cells, node, projection, cellSize);
    const path = pathsByIndex.get(country.index);
    if (path) {
      path.dataset.sourceCells = String(country.cells.length);
      path.dataset.restaurantCount = String(restaurantCount);
    }
    return {
      anchor,
      countryId: country.countryId,
      path,
      restaurantCount,
      sourceCells: country.cells,
      sourceCount: country.cells.length,
    };
  }).filter((plan) => plan.path);
  return { cellSize, plans, worldWidth };
}

function captureHomeCuisineClusters(homeMap) {
  const { cellSize, plans, worldWidth } = buildHomeCuisineSourcePlans(homeMap);
  const layer = homeMap.querySelector(".home-world-zoom-layer");
  const matrix = layer?.getScreenCTM();
  if (!matrix) return null;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const toScreen = (x, y) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  });
  const visibleAnchor = (anchor) => [-worldWidth, 0, worldWidth]
    .map((offset) => toScreen((anchor.column + 0.5) * cellSize + offset, (anchor.row + 0.5) * cellSize))
    .sort((a, b) => {
      const aVisible = a.x >= 0 && a.x <= viewportWidth && a.y >= 0 && a.y <= viewportHeight;
      const bVisible = b.x >= 0 && b.x <= viewportWidth && b.y >= 0 && b.y <= viewportHeight;
      if (aVisible !== bVisible) return aVisible ? -1 : 1;
      return Math.hypot(a.x - viewportWidth / 2, a.y - viewportHeight / 2)
        - Math.hypot(b.x - viewportWidth / 2, b.y - viewportHeight / 2);
    })[0];
  const items = plans.filter((plan) => plan.countryId && plan.restaurantCount > 0).map((plan) => {
    const anchor = visibleAnchor(plan.anchor);
    return {
      id: plan.countryId,
      sourceX: anchor.x,
      sourceY: anchor.y,
      visibleCells: plan.sourceCount,
    };
  });
  return items.length ? {
    items,
    sourceCellSize: cellSize * Math.hypot(matrix.a, matrix.b),
  } : null;
}

function createCuisineHandoffOverlay() {
  const atlas = scene.querySelector(".home-world-atlas");
  if (!atlas) return null;
  const overlay = atlas.cloneNode(true);
  overlay.classList.add("cuisine-handoff-overlay");
  overlay.setAttribute("aria-hidden", "true");
  overlay.querySelectorAll("[id]").forEach((element) => {
    element.id = `handoff-${element.id}`;
  });
  const tile = overlay.querySelector("defs > g");
  if (tile) {
    overlay.querySelectorAll("use").forEach((element) => {
      element.setAttribute("href", `#${tile.id}`);
    });
  }
  overlay.querySelectorAll("[tabindex]").forEach((element) => element.setAttribute("tabindex", "-1"));
  document.body.appendChild(overlay);
  return overlay;
}

async function fadeCuisineHandoffOverlay(overlay) {
  if (!overlay) return;
  try {
    await overlay.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 260, easing: "ease-out", fill: "forwards" },
    ).finished;
  } catch {
    // The overlay may be removed if navigation changes during the handoff.
  } finally {
    overlay.remove();
  }
}

function cuisineClusterAnimationPayload(clusterReveal, iframe) {
  const frameRect = iframe.getBoundingClientRect();
  return {
    duration: HOME_CUISINE_CLUSTER_DURATION,
    sourceCellSize: clusterReveal.sourceCellSize,
    items: clusterReveal.items.map((item) => ({
      id: item.id,
      sourceX: clamp((item.sourceX - frameRect.left) / Math.max(1, frameRect.width), 0.055, 0.945),
      sourceY: clamp((item.sourceY - frameRect.top) / Math.max(1, frameRect.height), 0.075, 0.925),
      visibleCells: item.visibleCells,
    })),
  };
}

async function animateCuisineClustersIntoPlace(clusterReveal, handoffOverlay) {
  const iframe = scene.querySelector(".claude-cartogram-frame");
  if (!iframe) {
    handoffOverlay?.remove();
    return;
  }
  try {
    const startedAt = performance.now();
    while (typeof iframe.contentWindow?.startGastroGlobeClusterReveal !== "function") {
      if (performance.now() - startedAt > 4200) return;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const payload = cuisineClusterAnimationPayload(clusterReveal, iframe);
    const animation = iframe.contentWindow.startGastroGlobeClusterReveal(payload);
    iframe.classList.remove("is-cluster-reveal-pending");
    await Promise.all([animation, fadeCuisineHandoffOverlay(handoffOverlay)]);
  } catch (error) {
    console.error("Cuisine clustering failed", error);
  } finally {
    iframe.classList.remove("is-cluster-reveal-pending");
    handoffOverlay?.remove();
  }
}

async function returnToWorld() {
  if (cityTransitionInFlight || !state.cityId) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clusterReveal = state.cityId === "munich" ? activeCuisineClusterReveal : null;
  if (!clusterReveal || reduceMotion) {
    activeCuisineClusterReveal = null;
    renderGallery();
    return;
  }

  cityTransitionInFlight = true;
  scene.setAttribute("aria-busy", "true");
  document.body.classList.add("is-home-cuisine-returning");
  try {
    await animateCuisineClustersBack(clusterReveal);
    renderGallery();
    const homeMap = scene.querySelector(".home-world-map");
    if (homeMap?.__homeGrid) await revealHomeWorldContext(homeMap);
  } catch (error) {
    console.error("Cuisine return failed", error);
    renderGallery();
  } finally {
    activeCuisineClusterReveal = null;
    cityTransitionInFlight = false;
    document.body.classList.remove("is-home-cuisine-returning");
    scene.removeAttribute("aria-busy");
  }
}

async function animateCuisineClustersBack(clusterReveal) {
  const iframe = scene.querySelector(".claude-cartogram-frame");
  if (!iframe) return;
  const startedAt = performance.now();
  while (typeof iframe.contentWindow?.startGastroGlobeClusterReturn !== "function") {
    if (performance.now() - startedAt > 4200) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  await iframe.contentWindow.startGastroGlobeClusterReturn(cuisineClusterAnimationPayload(clusterReveal, iframe));
}

async function revealHomeWorldContext(homeMap) {
  const { plans } = buildHomeCuisineSourcePlans(homeMap);
  const contextPaths = plans.filter((plan) => plan.restaurantCount <= 0).map((plan) => plan.path);
  const chrome = [
    scene.querySelector(".home-world-heading"),
    scene.querySelector(".home-city-leaders"),
    scene.querySelector(".home-city-nodes"),
    scene.querySelector(".home-world-status"),
  ].filter(Boolean);
  const elements = [...contextPaths, ...chrome];
  elements.forEach((element) => {
    element.style.opacity = "0";
  });
  document.body.classList.remove("is-home-cuisine-returning");
  const status = scene.querySelector(".home-world-status");
  if (status) status.textContent = "Returning to the world city atlas";
  const animations = elements.map((element) => element.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 360, easing: "ease-out", fill: "forwards" },
  ));
  await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  elements.forEach((element) => element.style.removeProperty("opacity"));
  const verifiedEditions = cityNodes.filter((city) => metropolitanProfile(city).live).length;
  if (status) status.textContent = `${cityNodes.length} metropolitan editions · ${verifiedEditions} verified dataset · Web Mercator`;
}

function homeCountryCellAnchor(cells, countryNode, projection, cellSize) {
  const projectedAnchor = countryNode
    ? projection([countryNode.data.lng, countryNode.data.lat])
    : null;
  const preferredColumn = projectedAnchor
    ? projectedAnchor[0] / cellSize - 0.5
    : d3.mean(cells, (cell) => cell.column);
  const preferredRow = projectedAnchor
    ? projectedAnchor[1] / cellSize - 0.5
    : d3.mean(cells, (cell) => cell.row);
  return d3.least(cells, (cell) => Math.hypot(cell.column - preferredColumn, cell.row - preferredRow)) ?? cells[0];
}

function commitCityOpen(cityId) {
  document.body.classList.remove("home-world-view");
  state.cityId = cityId;
  state.countryId = null;
  state.cuisineId = null;
  state.treeFocusId = null;
  renderCurrentVisualization();
}

function renderCurrentVisualization() {
  let render;
  if (state.visualization === "treemap") render = renderInteractiveTreemap;
  if (state.visualization === "cartogram") {
    render = state.countryId ? renderRegionalCartogram : renderCuisineCartogram;
  }
  if (state.visualization === "balloon") {
    render = state.countryId ? renderRegionalCartogram : renderSvgBalloonCartogram;
  }
  if (state.visualization === "claude") render = renderClaudeEditorialCartogram;
  if (state.visualization === "atlas") {
    render = state.countryId ? renderEditorialCountryAtlas : renderEditorialWorldAtlas;
  }
  render ??= state.countryId ? renderCountryMap : renderWorldMap;
  render();
  ensureCityBackButton();
}

function ensureCityBackButton() {
  if (!state.cityId) return;
  scene.classList.add("has-city-back");
  scene.querySelector(".city-world-back")?.remove();
  const button = document.createElement("button");
  button.className = "city-world-back";
  button.type = "button";
  button.innerHTML = `<span aria-hidden="true">←</span>`;
  button.title = "World cities";
  button.setAttribute("aria-label", "Back to the world city atlas");
  button.addEventListener("click", returnToWorld);
  scene.appendChild(button);
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
        name: "National",
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
  return "";
}

function bindDevMenu() {
  // The editorial square cartogram is now the sole product view.
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
  const cartogramView = scene.querySelector(".grid-cartogram-view");
  let labels;
  let highlightedCountryId = null;
  const setCountryHighlight = (item, active) => {
    const countryId = item.node.data.id;
    if (active) {
      if (highlightedCountryId && highlightedCountryId !== countryId) {
        svg.select(`.grid-cartogram-country[data-country-id="${highlightedCountryId}"]`).classed("is-highlighted", false);
        svg.select(`.grid-cartogram-label[data-country-id="${highlightedCountryId}"]`).classed("is-highlighted", false);
      }
      highlightedCountryId = countryId;
      cartogramView.classList.add("has-country-highlight");
      svg.select(`.grid-cartogram-country[data-country-id="${countryId}"]`).classed("is-highlighted", true);
      svg.select(`.grid-cartogram-label[data-country-id="${countryId}"]`).classed("is-highlighted", true);
    } else if (highlightedCountryId === countryId) {
      highlightedCountryId = null;
      cartogramView.classList.remove("has-country-highlight");
      svg.select(`.grid-cartogram-country[data-country-id="${countryId}"]`).classed("is-highlighted", false);
      svg.select(`.grid-cartogram-label[data-country-id="${countryId}"]`).classed("is-highlighted", false);
    }
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
  territories.append("path")
    .attr("class", "grid-country-fill")
    .attr("d", (item) => gridTerritoryFillPath(item, grid))
    .style("--territory-color", (item) => cartogramCountryColor(item));
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

function renderSvgBalloonCartogram() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  if (!city) return renderGallery();
  const live = city.data.id === "munich";
  const values = live ? countryNodes : countryNodes.map((node) => previewCountryNode(city.data.id, node));
  const width = Math.max(720, scene.clientWidth || 1200);
  const height = Math.max(520, scene.clientHeight || 760);
  const anchorFor = balloonFlatWorldAnchor(width, height);
  const sourceItems = values.filter((node) => node.data.available > 0).map((node) => {
    const sourceFeature = featureForCountry(node);
    if (!sourceFeature) return null;
    const feature = balloonDisplayFeature(sourceFeature, node);
    const flatFeature = balloonFlattenFeature(feature, node);
    const localPath = d3.geoPath(d3.geoIdentity().reflectY(true));
    const baseArea = Math.max(0.0001, localPath.area(flatFeature));
    const bounds = localPath.bounds(flatFeature);
    const centroid = [
      (bounds[0][0] + bounds[1][0]) / 2,
      (bounds[0][1] + bounds[1][1]) / 2,
    ];
    const anchor = anchorFor(node.data.lng, node.data.lat);
    return {
      node,
      feature,
      pathD: localPath(flatFeature),
      baseArea,
      bounds,
      centroid,
      anchorX: anchor[0],
      anchorY: anchor[1],
      weight: balloonCuisineWeight(node),
      allowedNeighborIds: new Set(),
    };
  }).filter(Boolean);
  const totalWeight = d3.sum(sourceItems, (item) => item.weight) || 1;
  const usableArea = Math.max(1, (width - 84) * (height - 194));
  const areaUnit = usableArea * 0.33 / totalWeight;
  sourceItems.forEach((item) => {
    item.targetArea = item.weight * areaUnit;
    item.scale = clamp(Math.sqrt(item.targetArea / item.baseArea), 0.12, 24);
    item.halfWidth = Math.max(7, (item.bounds[1][0] - item.bounds[0][0]) * item.scale / 2);
    item.halfHeight = Math.max(7, (item.bounds[1][1] - item.bounds[0][1]) * item.scale / 2);
    item.radius = Math.hypot(item.halfWidth, item.halfHeight) * 0.72;
    item.quota = item.weight;
    item.displayArea = item.weight;
    item.x = item.anchorX;
    item.y = item.anchorY;
    item.showName = item.targetArea >= 850 && item.halfWidth >= 24 && item.halfHeight >= 18;
    item.showCount = item.targetArea >= 1500 && item.halfWidth >= 32 && item.halfHeight >= 25;
  });
  const links = cartogramNeighborLinks(sourceItems, 1);
  assignCartogramShades(sourceItems, 1);
  const simulation = d3.forceSimulation(sourceItems)
    .force("link", d3.forceLink(links)
      .id((item) => item.node.data.id)
      .distance((link) => Math.max(8, link.distance * (link.preferred ? 0.82 : 0.9)))
      .strength((link) => link.preferred ? 0.46 : link.direct ? 0.25 : 0.04)
      .iterations(3))
    .force("x", d3.forceX((item) => item.anchorX).strength(0.4))
    .force("y", d3.forceY((item) => item.anchorY).strength(0.46))
    .force("collide", balloonRectangleCollisionForce(1.5))
    .stop();
  for (let tick = 0; tick < 720; tick += 1) simulation.tick();
  resolveBalloonRectangleOverlaps(sourceItems, 1.5);

  scene.innerHTML = `
    <section class="culinary-map cartogram-view svg-balloon-view semantic-layer" aria-label="${escapeHtml(city.data.name)} flat SVG country cartogram">
      ${breadcrumbMarkup(city, null)}
      <div class="map-heading cartogram-heading">
        <p><strong>${escapeHtml(city.data.name)}</strong> · flat cuisine atlas</p>
        <span>Country shape = local flat silhouette · position preserves world topology</span>
      </div>
      <svg class="world-map svg-balloon-map" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="svg-balloon-title svg-balloon-desc">
        <title id="svg-balloon-title">${escapeHtml(city.data.name)} flat cuisine country map</title>
        <desc id="svg-balloon-desc">Undistorted local country silhouettes expand with restaurant representation while retaining recognizable world positions and non-overlapping neighboring borders.</desc>
        <g class="svg-balloon-layer"></g>
      </svg>
      <p class="map-legend"><span class="legend-flag">◒</span><span>Flat SVG area = restaurants · color = continent</span><span class="legend-action">Select a country to drill down</span></p>
      ${devMenuMarkup()}
    </section>
  `;

  const svg = d3.select(scene.querySelector(".svg-balloon-map"));
  const layer = svg.select(".svg-balloon-layer");
  const countries = layer.selectAll("g")
    .data(sourceItems, (item) => item.node.data.id)
    .join("g")
    .attr("class", "svg-balloon-country")
    .attr("data-country-id", (item) => item.node.data.id)
    .attr("transform", (item) => `translate(${item.x},${item.y})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", (item) => `${item.node.data.name}, ${item.node.data.available} restaurants`)
    .style("--country-fill", (item) => cartogramCountryColor(item))
    .on("click", (_, item) => openCountry(item.node.data.countryId))
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCountry(item.node.data.countryId);
    })
    .on("pointerover", function handleBalloonPointerOver(event, item) {
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      showCursorLabel(event, `${item.node.data.flag} ${item.node.data.name} · ${item.node.data.available} restaurants`);
    })
    .on("pointermove", moveCursorLabel)
    .on("pointerout", function handleBalloonPointerOut(event) {
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      hideCursorLabel();
    });

  const countryShapes = countries.append("g")
    .attr("class", "svg-balloon-shape-scale")
    .attr("transform", (item) => `scale(${item.scale})`);
  countryShapes.append("path")
    .attr("class", "svg-balloon-country-shape")
    .attr("d", (item) => item.pathD)
    .attr("transform", (item) => `translate(${-item.centroid[0]},${-item.centroid[1]})`);

  const initialTransform = balloonRenderedFitTransform(svg.node(), width, height);
  const labelCompensation = clamp(1 / initialTransform.k, 1, 2.15);
  const labels = countries.append("g")
    .attr("class", "svg-balloon-label")
    .attr("transform", `scale(${labelCompensation})`);
  labels.append("text")
    .attr("class", "svg-balloon-flag")
    .attr("text-anchor", "middle")
    .attr("y", (item) => item.showName ? -9 : 5)
    .text((item) => item.node.data.flag);
  labels.append("text")
    .attr("class", "svg-balloon-name")
    .attr("text-anchor", "middle")
    .attr("y", 8)
    .text((item) => item.showName ? item.node.data.name : "");
  labels.append("text")
    .attr("class", "svg-balloon-count")
    .attr("text-anchor", "middle")
    .attr("y", 21)
    .text((item) => item.showCount ? `${item.node.data.available}` : "");

  const zoom = d3.zoom()
    .scaleExtent([0.35, 9])
    .on("zoom", (event) => layer.attr("transform", event.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  svg.call(zoom.transform, initialTransform);
  declutterBalloonLabels(svg.node());
  document.fonts?.ready.then(() => declutterBalloonLabels(svg.node()));
  bindBreadcrumbs();
  bindDevMenu();
}

function renderClaudeEditorialCartogram() {
  const city = cityNodes.find((node) => node.data.id === state.cityId);
  if (!city) return renderGallery();

  scene.innerHTML = `
    <section class="claude-cartogram-view semantic-layer" aria-label="${escapeHtml(city.data.name)} editorial square cuisine cartogram">
      <div class="claude-cartogram-frame-shell">
        <iframe
          class="claude-cartogram-frame${pendingCuisineClusterReveal ? " is-cluster-reveal-pending" : ""}"
          src="./experiments/claude-cartogram.html?v=morphing-6"
          title="${escapeHtml(city.data.name)} Eats the World editorial cuisine cartogram"
        ></iframe>
      </div>
    </section>
  `;
}

function balloonFlatWorldAnchor(width, height) {
  const viewport = { x0: 58, x1: width - 58, y0: 132, y1: height - 66 };
  const longitudeDomain = [-125, 150];
  const latitudeDomain = [-45, 60];
  const unit = Math.min(
    (viewport.x1 - viewport.x0) / (longitudeDomain[1] - longitudeDomain[0]),
    (viewport.y1 - viewport.y0) / (latitudeDomain[1] - latitudeDomain[0]),
  );
  const centerX = (viewport.x0 + viewport.x1) / 2;
  const centerY = (viewport.y0 + viewport.y1) / 2;
  const centerLongitude = (longitudeDomain[0] + longitudeDomain[1]) / 2;
  const centerLatitude = (latitudeDomain[0] + latitudeDomain[1]) / 2;
  return (longitude, latitude) => [
    centerX + (longitude - centerLongitude) * unit,
    centerY - (latitude - centerLatitude) * unit,
  ];
}

function balloonDisplayFeature(feature, node) {
  if (feature.geometry?.type !== "MultiPolygon") return feature;
  const anchor = [node.data.lng, node.data.lat];
  const polygons = feature.geometry.coordinates.map((coordinates) => {
    const polygon = { type: "Polygon", coordinates };
    return {
      coordinates,
      area: d3.geoArea(polygon),
      distance: d3.geoDistance(anchor, d3.geoCentroid(polygon)),
    };
  });
  const largestArea = d3.max(polygons, (polygon) => polygon.area) ?? 0;
  const kept = polygons.filter((polygon) => (
    polygon.area >= largestArea * 0.0015
    && (polygon.distance <= 0.96 || polygon.area >= largestArea * 0.12)
  ));
  return {
    ...feature,
    geometry: {
      type: "MultiPolygon",
      coordinates: (kept.length ? kept : polygons.slice(0, 1)).map((polygon) => polygon.coordinates),
    },
  };
}

function balloonFlattenFeature(feature, node) {
  const flattenRing = (ring) => {
    let previousLongitude = null;
    return ring.map(([longitude, latitude]) => {
      let localLongitude = longitude - node.data.lng;
      while (localLongitude > 180) localLongitude -= 360;
      while (localLongitude < -180) localLongitude += 360;
      if (previousLongitude !== null) {
        while (localLongitude - previousLongitude > 180) localLongitude -= 360;
        while (localLongitude - previousLongitude < -180) localLongitude += 360;
      }
      previousLongitude = localLongitude;
      return [localLongitude, latitude - node.data.lat];
    });
  };
  const flattenPolygon = (polygon) => polygon.map(flattenRing);
  const coordinates = feature.geometry.type === "Polygon"
    ? flattenPolygon(feature.geometry.coordinates)
    : feature.geometry.coordinates.map(flattenPolygon);
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates,
    },
  };
}

function balloonCuisineWeight(node) {
  const continentScale = node.parent?.data.name === "Europe" ? 1.35 : 1;
  const countryScale = {
    china: 1.68,
    japan: 1.22,
  }[node.data.countryId] ?? 1;
  return (3 + Math.pow(node.data.available, 0.61) * 3.6) * continentScale * countryScale;
}

function balloonRectangleCollisionForce(padding = 3) {
  let nodes = [];
  const force = (alpha) => {
    for (let index = 0; index < nodes.length; index += 1) {
      const first = nodes[index];
      for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
        const second = nodes[otherIndex];
        const deltaX = (second.x + second.vx) - (first.x + first.vx) || 0.001;
        const deltaY = (second.y + second.vy) - (first.y + first.vy) || 0.001;
        const overlapX = first.halfWidth + second.halfWidth + padding - Math.abs(deltaX);
        const overlapY = first.halfHeight + second.halfHeight + padding - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;
        const firstShare = second.targetArea / (first.targetArea + second.targetArea);
        const secondShare = 1 - firstShare;
        const push = balloonTopologicalPush(first, second, overlapX, overlapY, 0.72 * alpha);
        first.vx -= push.x * firstShare;
        first.vy -= push.y * firstShare;
        second.vx += push.x * secondShare;
        second.vy += push.y * secondShare;
      }
    }
  };
  force.initialize = (values) => { nodes = values; };
  return force;
}

function resolveBalloonRectangleOverlaps(items, padding = 3.5) {
  for (let pass = 0; pass < 900; pass += 1) {
    let collisions = 0;
    for (let index = 0; index < items.length; index += 1) {
      const first = items[index];
      for (let otherIndex = index + 1; otherIndex < items.length; otherIndex += 1) {
        const second = items[otherIndex];
        const deltaX = second.x - first.x || 0.001;
        const deltaY = second.y - first.y || 0.001;
        const overlapX = first.halfWidth + second.halfWidth + padding - Math.abs(deltaX);
        const overlapY = first.halfHeight + second.halfHeight + padding - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;
        collisions += 1;
        const firstShare = second.targetArea / (first.targetArea + second.targetArea);
        const secondShare = 1 - firstShare;
        const push = balloonTopologicalPush(first, second, overlapX, overlapY, 1, 0.08);
        first.x -= push.x * firstShare;
        first.y -= push.y * firstShare;
        second.x += push.x * secondShare;
        second.y += push.y * secondShare;
      }
    }
    if (pass < 600) {
      items.forEach((item) => {
        item.x += (item.anchorX - item.x) * 0.012;
        item.y += (item.anchorY - item.y) * 0.014;
      });
    } else if (!collisions) {
      break;
    }
  }
}

function balloonTopologicalPush(first, second, overlapX, overlapY, strength = 1, extra = 0) {
  let directionX = second.anchorX - first.anchorX;
  let directionY = second.anchorY - first.anchorY;
  let length = Math.hypot(directionX, directionY);
  if (length < 0.001) {
    directionX = second.x - first.x || 0.001;
    directionY = second.y - first.y || 0.001;
    length = Math.hypot(directionX, directionY);
  }
  const unitX = directionX / length;
  const unitY = directionY / length;
  const travelX = Math.abs(unitX) > 0.025 ? overlapX / Math.abs(unitX) : Infinity;
  const travelY = Math.abs(unitY) > 0.025 ? overlapY / Math.abs(unitY) : Infinity;
  const travel = (Math.min(travelX, travelY) + extra) * strength;
  return { x: unitX * travel, y: unitY * travel };
}

function balloonRenderedFitTransform(svgElement, width, height) {
  const svgRect = svgElement.getBoundingClientRect();
  const scaleX = width / Math.max(1, svgRect.width);
  const scaleY = height / Math.max(1, svgRect.height);
  const bounds = [...svgElement.querySelectorAll(".svg-balloon-country-shape")].map((shape) => {
    const rect = shape.getBoundingClientRect();
    return {
      x0: (rect.left - svgRect.left) * scaleX,
      x1: (rect.right - svgRect.left) * scaleX,
      y0: (rect.top - svgRect.top) * scaleY,
      y1: (rect.bottom - svgRect.top) * scaleY,
    };
  });
  const x0 = d3.min(bounds, (bound) => bound.x0) ?? 0;
  const x1 = d3.max(bounds, (bound) => bound.x1) ?? width;
  const y0 = d3.min(bounds, (bound) => bound.y0) ?? 0;
  const y1 = d3.max(bounds, (bound) => bound.y1) ?? height;
  const viewport = { x0: 16, x1: width - 16, y0: 132, y1: height - 112 };
  const scale = clamp(Math.min(
    (viewport.x1 - viewport.x0) / Math.max(1, x1 - x0),
    (viewport.y1 - viewport.y0) / Math.max(1, y1 - y0),
  ), 0.35, 2.8);
  return d3.zoomIdentity
    .translate(
      (viewport.x0 + viewport.x1) / 2 - (x0 + x1) / 2 * scale,
      (viewport.y0 + viewport.y1) / 2 - (y0 + y1) / 2 * scale,
    )
    .scale(scale);
}

function declutterBalloonLabels(svgElement) {
  if (!svgElement) return;
  const labels = [...svgElement.querySelectorAll(".svg-balloon-label")];
  for (let pass = 0; pass < labels.length * 2; pass += 1) {
    const visible = labels.map((label) => ({
      label,
      item: label.parentElement.__data__,
      rect: label.getBoundingClientRect(),
    })).filter((entry) => entry.label.textContent.trim() && entry.rect.width > 0 && entry.rect.height > 0);
    let collision = null;
    for (let index = 0; index < visible.length && !collision; index += 1) {
      for (let otherIndex = index + 1; otherIndex < visible.length; otherIndex += 1) {
        const first = visible[index];
        const second = visible[otherIndex];
        if (first.rect.left < second.rect.right + 2
          && first.rect.right + 2 > second.rect.left
          && first.rect.top < second.rect.bottom + 2
          && first.rect.bottom + 2 > second.rect.top) {
          collision = first.item.targetArea <= second.item.targetArea ? first : second;
          break;
        }
      }
    }
    if (!collision) break;
    const count = collision.label.querySelector(".svg-balloon-count");
    const name = collision.label.querySelector(".svg-balloon-name");
    if (count?.textContent) count.textContent = "";
    else if (name?.textContent) name.textContent = "";
    else collision.label.style.display = "none";
  }
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
  const columns = 480;
  const rows = 198;
  const resolutionScale = columns / 150;
  const quotaScale = resolutionScale ** 2;
  const cellSize = Math.min((width - 34) / columns, (height - 174) / rows);
  const gridWidth = columns * cellSize;
  const gridHeight = rows * cellSize;
  const originX = (width - gridWidth) / 2;
  const originY = 116 + Math.max(0, (height - 174 - gridHeight) / 2);
  // Equal Earth is equal-area: northern and southern countries keep comparable scale
  // instead of being enlarged or compressed simply because of latitude.
  const projection = d3.geoEqualEarth().fitExtent([[2, 2], [columns - 3, rows - 3]], { type: "Sphere" });
  const projectedPath = d3.geoPath(projection);
  const shapeContext = document.createElement("canvas").getContext("2d");
  const items = values.filter((node) => node.data.available > 0).map((node) => {
    const projected = projection([node.data.lng, node.data.lat]);
    const anchor = cartogramGeographicAnchor(node, projected, projection);
    const continentScale = node.parent?.data.name === "Europe" ? 1.35 : 1;
    const countryScale = {
      china: 1.68,
      japan: 1.22,
    }[node.data.countryId] ?? 1;
    const quota = Math.max(14, Math.round(
      (3 + Math.pow(node.data.available, 0.61) * 3.6) * continentScale * countryScale * quotaScale,
    ));
    const feature = featureForCountry(node);
    const bounds = feature ? projectedPath.bounds(feature) : [[0, 0], [1, 1]];
    const shapeWidth = Math.max(0.5, bounds[1][0] - bounds[0][0]);
    const shapeHeight = Math.max(0.5, bounds[1][1] - bounds[0][1]);
    const shapeArea = feature ? Math.max(0.2, projectedPath.area(feature)) : 1;
    const shapeCenter = feature ? projectedPath.centroid(feature) : projected;
    const shapeAspect = clamp(shapeWidth / shapeHeight, 0.24, 4.2);
    const item = {
      node,
      quota,
      anchorX: anchor[0],
      anchorY: anchor[1],
      feature,
      shapeCenter,
      shapeArea,
      shapeBounds: bounds,
      shapePath: feature && shapeContext && typeof Path2D !== "undefined" ? new Path2D(projectedPath(feature)) : null,
      shapeAspect,
      cells: [],
      cellKeys: new Set(),
      allowedNeighborIds: new Set(),
    };
    // Rasterise the country's real outline into exactly `quota` grid cells so the
    // filled territory traces the whole silhouette instead of a fraction of it.
    const stamp = buildCountrySilhouetteStamp(item, shapeContext);
    item.stampCells = stamp?.cells ?? null;
    item.stampIndex = stamp?.index ?? null;
    item.stampHalo = stamp?.halo ?? null;
    item.stampBounds = stamp?.bounds ?? null;
    // Space territories by the silhouette's own footprint. RMS spread is radius / √2 for a
    // disc, so 1.5 gives each outline a little more than its full reach — without that
    // slack a big neighbour's shape overruns a smaller country's ground (Germany over
    // France, whose cartogram area is 3.5x smaller despite the real country being larger).
    item.radius = (stamp?.spreadRadius ?? Math.sqrt(quota / Math.PI) * 0.707) * 0.82 + resolutionScale * 0.42;
    return item;
  });
  relaxCartogramAnchors(items, columns, rows, resolutionScale);
  assignCartogramShades(items, resolutionScale);

  const occupied = new Map();
  // Seed the largest territories first so their silhouettes claim contested ground
  // before smaller neighbours fill the gaps around them.
  [...items].sort((a, b) => b.quota - a.quota).forEach((item) => {
    const seed = item.stampCells
      ? bestSilhouettePlacement(item, occupied, columns, rows)
      : nearestGridCell(Math.round(item.anchorX), Math.round(item.anchorY), occupied, columns, rows, item);
    addGridCell(item, seed, occupied, columns, rows);
    item.seedX = seed.x;
    item.seedY = seed.y;
    item.containsTargetCell = item.stampIndex
      ? (cell) => item.stampIndex.has(`${cell.x - item.seedX},${cell.y - item.seedY}`)
      : null;
    // Take the whole outline now rather than racing for it cell by cell later. Growing
    // incrementally meant a country could be boxed out of its own shape by a neighbour that
    // happened to expand first, and end up as a blob beside it.
    if (item.stampIndex) claimSilhouetteCells(item, occupied, columns, rows);
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
      // Advance every territory by the same fraction of its quota per round. Growing one
      // cell at a time kept contested borders fair but made the pass quadratic, since each
      // step rescans the frontier.
      const batch = Math.max(1, Math.round(item.quota / 60));
      for (let step = 0; step < batch && item.cells.length < item.quota; step += 1) {
        const candidate = bestGrowthCell(item, occupied);
        if (!candidate) break;
        addGridCell(item, candidate, occupied, columns, rows);
        remaining -= 1;
        progress = true;
      }
    });
    if (!progress) break;
  }

  connectAllowedNeighborTerritories(items, occupied, columns, rows);

  items.forEach((item) => {
    const center = item.cells.reduce((sum, cell) => ({ x: sum.x + cell.x, y: sum.y + cell.y }), { x: 0, y: 0 });
    const centroidX = center.x / item.cells.length;
    const centroidY = center.y / item.cells.length;
    item.centroidX = centroidX;
    item.centroidY = centroidY;
    item.displayArea = item.cells.length / quotaScale;
    item.preserveFlag = item.node.data.available <= 6;
    item.labelX = item.displayArea >= 20 ? centroidX : item.seedX * 0.72 + centroidX * 0.28;
    item.labelY = item.displayArea >= 20 ? centroidY : item.seedY * 0.72 + centroidY * 0.28;
    item.showName = item.displayArea >= 4.5;
    item.showCount = item.displayArea >= 10;
    item.labelFontSize = clamp(8 + Math.sqrt(item.displayArea) * 0.62, 11, 15);
    item.nameFontSize = clamp(8 + Math.sqrt(item.displayArea) * 0.38, 11, 15);
  });
  relaxCartogramLabels(items, cellSize, columns, rows);
  window.__dbg = items.map((e) => ({
    name: e.node.data.name,
    quota: e.quota,
    cells: e.cells.length,
    stamp: e.stampCells?.length ?? null,
    onStamp: e.stampIndex ? e.cells.filter((c) => e.stampIndex.has(`${c.x - e.seedX},${c.y - e.seedY}`)).length : 0,
    seedX: e.seedX, seedY: e.seedY,
    cellList: e.cells, stampList: e.stampCells,
  }));
  return { items, columns, rows, cellSize, gridWidth, gridHeight, originX, originY };
}

function relaxCartogramAnchors(items, columns, rows, resolutionScale) {
  compactContinentAnchors(items);
  const links = cartogramNeighborLinks(items, resolutionScale);
  items.forEach((item) => {
    item.x = item.anchorX;
    item.y = item.anchorY;
    // The true projected position, kept so the bearing force can measure how far the
    // layout has rotated a country away from its real neighbours.
    item.baseX = item.anchorX;
    item.baseY = item.anchorY;
  });
  const simulation = d3.forceSimulation(items)
    .force("link", d3.forceLink(links)
      .id((item) => item.node.data.id)
      .distance((link) => link.distance)
      .strength((link) => link.preferred ? 1 : link.direct ? 0.62 : 0.12)
      .iterations(8))
    // Silhouettes need more elbow room than blobs, so hold each territory firmly at its
    // projected position — otherwise the larger collision radii scramble world geography.
    .force("x", d3.forceX((item) => item.anchorX).strength((item) => {
      const continent = item.node.parent?.data.name;
      return continent === "Europe" ? 0.46 : continent === "Asia" ? 0.56 : 0.42;
    }))
    .force("y", d3.forceY((item) => item.anchorY).strength((item) => {
      const continent = item.node.parent?.data.name;
      return continent === "Europe" ? 0.58 : continent === "Asia" ? 0.56 : 0.42;
    }))
    // Keep this pass thorough: territories that are left overlapping here have to fight for
    // cells during growth, which costs far more than the extra collision iterations do.
    .force("collide", d3.forceCollide((item) => item.radius + resolutionScale * 0.08).strength(0.98).iterations(10))
    .force("charge", d3.forceManyBody().strength(-0.025 * resolutionScale))
    // Distance forces alone let a big neighbour shove a small country right past it, so
    // Bulgaria could end up north of Romania. This holds each pair on its true bearing.
    .force("bearing", cartogramBearingForce(items))
    .stop();
  for (let tick = 0; tick < 420; tick += 1) simulation.tick();
  items.forEach((item) => {
    // Clamp against the actual raster silhouette, not its average radius. Tall, high-volume
    // countries such as Germany can extend much farther than their RMS spread and were
    // therefore clipped into a flat edge at the top of the world grid.
    const minAnchorX = item.stampBounds ? 2 - item.stampBounds.minX : item.radius + 3;
    const maxAnchorX = item.stampBounds ? columns - 3 - item.stampBounds.maxX : columns - item.radius - 4;
    const minAnchorY = item.stampBounds ? 2 - item.stampBounds.minY : item.radius + 3;
    const maxAnchorY = item.stampBounds ? rows - 3 - item.stampBounds.maxY : rows - item.radius - 4;
    item.anchorX = clamp(item.x, minAnchorX, maxAnchorX);
    item.anchorY = clamp(item.y, minAnchorY, maxAnchorY);
  });
  let t = 0, ok = 0; const bad = [];
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
    const a = items[i], b = items[j];
    if (a.node.parent?.data.name !== b.node.parent?.data.name) continue;
    const tx = Math.abs(b.baseX - a.baseX) < 4 ? 0 : Math.sign(b.baseX - a.baseX);
    const ty = Math.abs(b.baseY - a.baseY) < 4 ? 0 : Math.sign(b.baseY - a.baseY);
    t += 1;
    if ((tx === 0 || tx === Math.sign(b.anchorX - a.anchorX)) && (ty === 0 || ty === Math.sign(b.anchorY - a.anchorY))) ok += 1;
    else bad.push(`${a.node.data.name}|${b.node.data.name}`);
  }
  window.__bearing = { pct: +(ok / t * 100).toFixed(1), bad };
}

// Keeps countries on the correct side of one another. forceLink and forceCollide only
// constrain how far apart territories sit, not in which direction, so a large neighbour can
// push a small country clean past it — Bulgaria drifting north of Romania, Morocco east of
// Eritrea. For every same-continent pair this cancels the part of their offset that is
// perpendicular to the true bearing, and drives them back around each other when they have
// flipped sides entirely. Distance stays the other forces' job.
function cartogramBearingForce(items) {
  const pairs = [];
  const partnerCount = new Map(items.map((item) => [item, 0]));
  for (let index = 0; index < items.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < items.length; otherIndex += 1) {
      const source = items[index];
      const target = items[otherIndex];
      if (source.node.parent?.data.name !== target.node.parent?.data.name) continue;
      const deltaX = target.baseX - source.baseX;
      const deltaY = target.baseY - source.baseY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < 0.001) continue;
      pairs.push({
        source,
        target,
        unitX: deltaX / distance,
        unitY: deltaY / distance,
        // Close neighbours describe the map's shape most, but distant pairs still have to
        // keep their side of the continent, so the falloff stays gentle.
        weight: 1 / (1 + distance / 70),
      });
      partnerCount.set(source, partnerCount.get(source) + 1);
      partnerCount.set(target, partnerCount.get(target) + 1);
    }
  }
  // Each country is paired with every continental neighbour, so without dividing by the
  // partner count a crowded continent accumulates a huge force and the layout oscillates.
  pairs.forEach((pair) => {
    pair.share = 1 / Math.max(1, Math.max(partnerCount.get(pair.source), partnerCount.get(pair.target)));
  });

  return (alpha) => {
    pairs.forEach(({ source, target, unitX, unitY, weight, share }) => {
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const along = deltaX * unitX + deltaY * unitY;
      const perpendicularX = deltaX - along * unitX;
      const perpendicularY = deltaY - along * unitY;
      const correction = 3.4 * weight * share * alpha;
      source.vx += perpendicularX * correction;
      source.vy += perpendicularY * correction;
      target.vx -= perpendicularX * correction;
      target.vy -= perpendicularY * correction;
      if (along < 0) {
        // Fully inverted: drive them back through each other along the true bearing.
        const flip = 9 * weight * share * alpha;
        source.vx -= unitX * flip;
        source.vy -= unitY * flip;
        target.vx += unitX * flip;
        target.vy += unitY * flip;
      }
    });
  };
}

function compactContinentAnchors(items) {
  const compactness = {
    Americas: 0.72,
    Europe: 0.78,
    Africa: 0.52,
    Asia: 0.88,
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

  // Represented South American cuisines are separated by missing countries in the
  // dataset, so compact their own real geographic cluster without changing bearings.
  const southAmericanIds = new Set(["argentina", "brazil", "peru"]);
  const southAmerica = items.filter((item) => southAmericanIds.has(item.node.data.countryId));
  if (southAmerica.length > 1) {
    const centerX = d3.mean(southAmerica, (item) => item.anchorX);
    const centerY = d3.mean(southAmerica, (item) => item.anchorY);
    southAmerica.forEach((item) => {
      item.anchorX = centerX + (item.anchorX - centerX) * 0.58;
      item.anchorY = centerY + (item.anchorY - centerY) * 0.58;
    });
  }
}

function cartogramNeighborLinks(items, resolutionScale) {
  const links = [];
  const linkKeys = new Set();
  const linkByKey = new Map();
  const addLink = (source, target, direct, preferred = false, allowTouch = direct) => {
    if (!source || !target || source === target) return;
    const ids = [source.node.data.id, target.node.data.id].sort();
    const key = ids.join("|");
    const anchorDistance = Math.hypot(source.anchorX - target.anchorX, source.anchorY - target.anchorY);
    const touchingDistance = source.radius + target.radius + resolutionScale * (direct ? 0.05 : 0.25);
    if (allowTouch) {
      source.allowedNeighborIds.add(target.node.data.countryId);
      target.allowedNeighborIds.add(source.node.data.countryId);
    }
    if (linkKeys.has(key)) {
      if (preferred) {
        const link = linkByKey.get(key);
        link.preferred = true;
        link.direct = true;
        link.distance = touchingDistance;
      }
      return;
    }
    linkKeys.add(key);
    const link = {
      source,
      target,
      direct,
      preferred,
      distance: preferred
        ? touchingDistance
        : direct
        ? Math.max(touchingDistance, anchorDistance * 0.5)
        : Math.max(touchingDistance, Math.min(anchorDistance * 0.64, touchingDistance * 1.72)),
    };
    links.push(link);
    linkByKey.set(key, link);
  };

  const geometryNeighbors = topojson.neighbors(worldTopology.objects.countries.geometries);
  const itemByFeatureIndex = new Map();
  const itemByCountryId = new Map(items.map((item) => [item.node.data.countryId, item]));
  items.forEach((item) => {
    const featureIndex = worldFeatures.indexOf(featureForCountry(item.node));
    if (featureIndex >= 0) itemByFeatureIndex.set(featureIndex, item);
  });
  geometryNeighbors.forEach((neighborIndexes, sourceIndex) => {
    const source = itemByFeatureIndex.get(sourceIndex);
    neighborIndexes.forEach((targetIndex) => addLink(source, itemByFeatureIndex.get(targetIndex), true));
  });

  // The represented-country map omits Laos, Cambodia and Myanmar. Preserve the
  // recognizable mainland Southeast Asian chain across those missing intermediaries.
  [
    ["thailand", "china"],
    ["thailand", "vietnam"],
  ].forEach(([sourceId, targetId]) => {
    addLink(itemByCountryId.get(sourceId), itemByCountryId.get(targetId), true, true, true);
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
    const label = lessImportant(a, b);
    if (label.item.preserveFlag) {
      label.item.showName = false;
      label.item.showCount = false;
    } else {
      label.item.hideLabel = true;
    }
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
    const other = target === first ? second : first;
    const removeFrom = (group) => {
      const count = group.querySelector(".grid-cartogram-count");
      const name = group.querySelector(".grid-cartogram-name");
      const flag = group.querySelector(".grid-cartogram-flag");
      if (count?.textContent) count.textContent = "";
      else if (name?.textContent) name.textContent = "";
      else if (flag?.textContent && !group.__data__?.preserveFlag) flag.textContent = "";
      else return false;
      return true;
    };
    return removeFrom(target) || removeFrom(other);
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
    if (!removeLowestPriorityText(collision[0], collision[1])) break;
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
    // Britain and Ireland are islands, so they are pushed offshore into open sea rather
    // than left crowding the mainland — which also frees the room their outlines need.
    const offshoreNudge = {
      "united-kingdom": { x: -26, y: -58 },
      ireland: { x: -48, y: -42 },
      czechia: { x: 0, y: 2 },
    }[node.data.countryId] ?? { x: 0, y: 0 };
    return [
      center[0] + (projected[0] - center[0]) * 3.7 + offshoreNudge.x,
      // Reserve northern breathing room for enlarged central-European silhouettes.
      // Germany previously exhausted the grid above itself while avoiding Italy and
      // France, which turned its northern border into a hard horizontal crop.
      center[1] + (projected[1] - center[1]) * 4.15 + 12.5 + offshoreNudge.y,
    ];
  }
  if (continent === "Africa") {
    const center = projection([18, 13]);
    return [
      center[0] + (projected[0] - center[0]) * 0.72 - 2,
      center[1] + (projected[1] - center[1]) * 0.66 + 26,
    ];
  }
  if (continent === "Asia") {
    // Keep Asia on the equal-area scaffold; only Iran receives a small western/southern
    // offset to preserve the Persian plateau between Türkiye, Afghanistan and India.
    const nudge = {
      iran: { x: -6, y: 8 },
      thailand: { x: 15, y: 12 },
    }[node.data.countryId] ?? { x: 0, y: 0 };
    return [projected[0] + nudge.x, projected[1] + nudge.y];
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

// Fits a country's real projected outline to its restaurant quota: finds the smallest
// raster scale whose connected landmass can supply every cell the quota needs, so the
// drawn territory traces that country's silhouette instead of a generic blob.
function buildCountrySilhouetteStamp(item, shapeContext) {
  if (!item.shapePath || !shapeContext || !Number.isFinite(item.shapeArea)) return null;
  const target = item.quota;
  // The outline only depends on the country and how many cells it needs, so reuse it
  // across re-renders (resizing, navigating back to the map) instead of re-rasterising.
  const cacheKey = `${item.node.data.id}:${target}`;
  const cached = silhouetteStampCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const stamp = fitCountrySilhouetteStamp(item, shapeContext, target);
  silhouetteStampCache.set(cacheKey, stamp);
  return stamp;
}

const silhouetteStampCache = new Map();

function fitCountrySilhouetteStamp(item, shapeContext, target) {
  let scale = Math.sqrt(target / item.shapeArea);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  let fitted = null;

  // Cell count grows with scale², so correcting by √(target / count) converges in a
  // handful of rasterisations instead of a long bisection — each raster is a canvas
  // readback, so keeping the count low matters for load time.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const cells = silhouetteComponentCells(item, scale, shapeContext);
    const size = cells.length;
    if (size >= target && (!fitted || size < fitted.length)) fitted = cells;
    if (size >= target && size <= target * 1.06) break;
    const correction = Math.sqrt(target / Math.max(1, size));
    scale *= size >= target ? correction : Math.max(correction, 1.05);
    if (!Number.isFinite(scale) || scale <= 0) break;
  }
  if (!fitted) return null;

  const index = new Map();
  fitted.forEach((cell, order) => index.set(`${cell.x},${cell.y}`, order));
  const centroidX = d3.mean(fitted, (cell) => cell.x) ?? 0;
  const centroidY = d3.mean(fitted, (cell) => cell.y) ?? 0;
  const bounds = {
    minX: d3.min(fitted, (cell) => cell.x) ?? 0,
    maxX: d3.max(fitted, (cell) => cell.x) ?? 0,
    minY: d3.min(fitted, (cell) => cell.y) ?? 0,
    maxY: d3.max(fitted, (cell) => cell.y) ?? 0,
  };
  const spreadRadius = Math.sqrt(d3.mean(fitted, (cell) => (
    (cell.x - centroidX) ** 2 + (cell.y - centroidY) ** 2
  )) ?? 0);
  return { cells: fitted, index, bounds, spreadRadius, halo: buildSilhouetteHalo(fitted, index) };
}

// Distance rings just outside the silhouette. Overflow fills the nearest ring first, so a
// blocked country swells evenly around its shape instead of growing a lopsided bulge.
function buildSilhouetteHalo(stampCells, stampIndex, maxDistance = 14) {
  const halo = new Map();
  let frontier = stampCells;
  for (let distance = 1; distance <= maxDistance && frontier.length; distance += 1) {
    const next = [];
    frontier.forEach((cell) => {
      gridNeighbors(cell.x, cell.y).forEach((neighbor) => {
        const key = `${neighbor.x},${neighbor.y}`;
        if (stampIndex.has(key) || halo.has(key)) return;
        halo.set(key, distance);
        next.push(neighbor);
      });
    });
    frontier = next;
  }
  return halo;
}

// Rasterises the outline at `scale` and returns its largest central landmass as grid
// offsets in flood-fill order, so territory growth follows the coastline outwards while
// always staying connected.
function silhouetteComponentCells(item, scale, shapeContext) {
  const [[minX, minY], [maxX, maxY]] = item.shapeBounds;
  const width = Math.ceil((maxX - minX) * scale) + 3;
  const height = Math.ceil((maxY - minY) * scale) + 3;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return [];
  if (width < 1 || height < 1 || width * height > 260000) return [];

  // Resizing a canvas reallocates and clears it, so grow it only when necessary and reuse
  // the same buffer across every country and every fitting pass.
  const canvas = shapeContext.canvas;
  if (canvas.width < width || canvas.height < height) {
    canvas.width = Math.max(canvas.width, width);
    canvas.height = Math.max(canvas.height, height);
  }
  shapeContext.setTransform(1, 0, 0, 1, 0, 0);
  shapeContext.clearRect(0, 0, width, height);
  shapeContext.setTransform(scale, 0, 0, scale, -minX * scale + 1.5, -minY * scale + 1.5);
  shapeContext.fillStyle = "#000";
  shapeContext.fill(item.shapePath);

  const pixels = shapeContext.getImageData(0, 0, width, height).data;
  const inside = new Uint8Array(width * height);
  for (let index = 0; index < inside.length; index += 1) {
    inside[index] = pixels[index * 4 + 3] > 128 ? 1 : 0;
  }

  const centerX = clamp(Math.round((item.shapeCenter[0] - minX) * scale + 1.5), 0, width - 1);
  const centerY = clamp(Math.round((item.shapeCenter[1] - minY) * scale + 1.5), 0, height - 1);
  const seedIndex = nearestFilledPixel(inside, width, height, centerX, centerY);
  if (seedIndex < 0) return [];

  const seedX = seedIndex % width;
  const seedY = (seedIndex - seedX) / width;
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const cells = [];
  let tail = 0;
  queue[tail += 1] = seedIndex;
  seen[seedIndex] = 1;
  for (let head = 1; head <= tail; head += 1) {
    const index = queue[head];
    const x = index % width;
    const y = (index - x) / width;
    cells.push({ x: x - seedX, y: y - seedY });
    const visit = (neighborX, neighborY) => {
      if (neighborX < 0 || neighborY < 0 || neighborX >= width || neighborY >= height) return;
      const neighborIndex = neighborY * width + neighborX;
      if (seen[neighborIndex] || !inside[neighborIndex]) return;
      seen[neighborIndex] = 1;
      queue[tail += 1] = neighborIndex;
    };
    visit(x - 1, y);
    visit(x + 1, y);
    visit(x, y - 1);
    visit(x, y + 1);
  }
  return cells;
}

function nearestFilledPixel(inside, width, height, centerX, centerY) {
  const maxRadius = Math.max(width, height);
  for (let radius = 0; radius < maxRadius; radius += 1) {
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 0 || x >= width) continue;
        if (Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) !== radius) continue;
        const index = y * width + x;
        if (inside[index]) return index;
      }
    }
  }
  return -1;
}

// Claims every still-free cell of the placed outline, breadth-first from the seed so the
// territory stays in one piece even where a neighbour already holds part of the shape.
// Anything the outline cannot supply is left to the growth pass to make up.
function claimSilhouetteCells(item, occupied, columns, rows) {
  const seen = new Set([`${item.seedX},${item.seedY}`]);
  const queue = [{ x: item.seedX, y: item.seedY }];
  const claimable = [];
  for (let head = 0; head < queue.length && claimable.length < item.quota; head += 1) {
    const cell = queue[head];
    for (const neighbor of gridNeighbors(cell.x, cell.y)) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= columns || neighbor.y >= rows) continue;
      const key = `${neighbor.x},${neighbor.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (occupied.has(key)) continue;
      if (touchesDisallowedCountry(item, neighbor, occupied)) continue;
      if (!item.stampIndex.has(`${neighbor.x - item.seedX},${neighbor.y - item.seedY}`)) continue;
      queue.push(neighbor);
      claimable.push(neighbor);
    }
  }
  claimable.forEach((cell) => {
    if (item.cells.length < item.quota) addGridCell(item, cell, occupied, columns, rows);
  });
}

// Nudges a country off its exact anchor to the nearby position where the most of its
// silhouette lands on free ground, so crowded neighbours (Germany, Italy, Türkiye) keep
// their outline instead of being blocked into a blob.
function bestSilhouettePlacement(item, occupied, columns, rows) {
  const originX = Math.round(item.anchorX);
  const originY = Math.round(item.anchorY);
  const stride = Math.max(1, Math.floor(item.stampCells.length / 120));
  const sample = item.stampCells.filter((_, index) => index % stride === 0);
  // Dense parts of Europe sometimes need more than a handful of cells to place a whole
  // silhouette. Let large countries search farther while keeping small-country motion
  // restrained, so the outline wins over an artificial edge crop.
  const maxShift = Math.min(30, Math.ceil(item.radius * 0.9) + 8);
  let best = null;
  let bestScore = -Infinity;

  for (let radius = 0; radius <= maxShift; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
        const seedX = originX + offsetX;
        const seedY = originY + offsetY;
        if (seedX < 0 || seedY < 0 || seedX >= columns || seedY >= rows) continue;
        if (item.stampBounds
          && (seedX + item.stampBounds.minX < 2
            || seedX + item.stampBounds.maxX > columns - 3
            || seedY + item.stampBounds.minY < 2
            || seedY + item.stampBounds.maxY > rows - 3)) continue;
        if (occupied.has(`${seedX},${seedY}`)) continue;
        if (touchesDisallowedCountry(item, { x: seedX, y: seedY }, occupied)) continue;
        let free = 0;
        let forbiddenContacts = 0;
        for (const cell of sample) {
          const x = seedX + cell.x;
          const y = seedY + cell.y;
          if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
          if (!occupied.has(`${x},${y}`)) {
            free += 1;
            if (touchesDisallowedCountry(item, { x, y }, occupied)) forbiddenContacts += 1;
          }
        }
        const score = free - forbiddenContacts * 8 - radius * 0.6;
        if (score > bestScore) {
          bestScore = score;
          best = { x: seedX, y: seedY };
        }
      }
    }
    // A placement with the whole silhouette clear cannot be beaten further out.
    if (best && bestScore >= sample.length - radius * 0.6) break;
  }
  return best ?? nearestGridCell(originX, originY, occupied, columns, rows, item);
}

function nearestGridCell(targetX, targetY, occupied, columns, rows, item = null) {
  for (let radius = 0; radius < Math.max(columns, rows); radius += 1) {
    for (let y = targetY - radius; y <= targetY + radius; y += 1) {
      for (let x = targetX - radius; x <= targetX + radius; x += 1) {
        if (x < 0 || x >= columns || y < 0 || y >= rows) continue;
        if (Math.max(Math.abs(x - targetX), Math.abs(y - targetY)) !== radius) continue;
        const candidate = { x, y };
        if (!occupied.has(`${x},${y}`)
          && (!item || !touchesDisallowedCountry(item, candidate, occupied))) return candidate;
      }
    }
  }
  return { x: clamp(targetX, 0, columns - 1), y: clamp(targetY, 0, rows - 1) };
}

// Keeps each territory's growth frontier up to date as cells are claimed. Rebuilding it
// from every owned cell on each step made large countries quadratic to grow.
function addGridCell(item, cell, occupied, columns, rows) {
  const key = `${cell.x},${cell.y}`;
  item.cells.push(cell);
  item.cellKeys.add(key);
  occupied.set(key, item);
  if (!item.frontier) item.frontier = new Map();
  item.frontier.delete(key);
  gridNeighbors(cell.x, cell.y).forEach((neighbor) => {
    if (neighbor.x < 0 || neighbor.x >= columns || neighbor.y < 0 || neighbor.y >= rows) return;
    const neighborKey = `${neighbor.x},${neighbor.y}`;
    if (occupied.has(neighborKey) || item.cellKeys.has(neighborKey)) return;
    item.frontier.set(neighborKey, neighbor);
  });
}

function bestGrowthCell(item, occupied) {
  const candidates = item.frontier;
  if (!candidates || !candidates.size) return null;
  let best = null;
  let bestScore = Infinity;
  // Cells claimed by neighbours (or permanently out of bounds) never come back, so drop
  // them from the frontier as they are encountered.
  for (const [key, candidate] of candidates) {
    if (occupied.has(key)
      || touchesDisallowedCountry(item, candidate, occupied)
      || (item.allowedCell && !item.allowedCell(candidate))) {
      candidates.delete(key);
      continue;
    }
    // This runs for every frontier cell on every growth step, so it avoids the array and
    // template-string allocations that a gridNeighbors() call would make here.
    const { x, y } = candidate;
    const cellKeys = item.cellKeys;
    let friendlyNeighbors = 0;
    if (cellKeys.has(`${x - 1},${y}`)) friendlyNeighbors += 1;
    if (cellKeys.has(`${x + 1},${y}`)) friendlyNeighbors += 1;
    if (cellKeys.has(`${x},${y - 1}`)) friendlyNeighbors += 1;
    if (cellKeys.has(`${x},${y + 1}`)) friendlyNeighbors += 1;
    let score;
    if (item.stampIndex) {
      const offsetX = x - item.seedX;
      const offsetY = y - item.seedY;
      const offsetKey = `${offsetX},${offsetY}`;
      const stampOrder = item.stampIndex.get(offsetKey);
      if (stampOrder === undefined) {
        // Off the real outline: reached only once the silhouette is filled or blocked, then
        // taken ring by ring so the country swells evenly and keeps its recognisable shape.
        const haloDistance = item.stampHalo?.get(offsetKey) ?? 99;
        const seedDistance = offsetX ** 2 + offsetY ** 2;
        score = 1e6 + haloDistance * 1e3 + seedDistance * 0.05 - friendlyNeighbors * 6;
      } else {
        score = stampOrder - friendlyNeighbors * 1.5;
      }
    } else {
      const deltaX = candidate.x - item.anchorX;
      const deltaY = candidate.y - item.anchorY;
      const shapeDistance = deltaX ** 2 / item.shapeAspect + deltaY ** 2 * item.shapeAspect;
      const seedDistance = (candidate.x - item.seedX) ** 2 + (candidate.y - item.seedY) ** 2;
      const silhouettePenalty = item.containsTargetCell?.(candidate) ? 0 : Math.max(180, item.quota * 2.5);
      score = silhouettePenalty + shapeDistance * 0.72 + seedDistance * 0.12 - friendlyNeighbors * 5.5;
    }
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function gridNeighbors(x, y) {
  return [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }];
}

function touchesDisallowedCountry(item, cell, occupied) {
  if (!item.allowedNeighborIds) return false;
  return gridNeighbors(cell.x, cell.y).some((neighbor) => {
    const other = occupied.get(`${neighbor.x},${neighbor.y}`);
    return other
      && other !== item
      && !item.allowedNeighborIds?.has(other.node.data.countryId);
  });
}

// Close only small empty seams between verified neighbours. A short connection makes
// borders read as borders, while the placement and growth guards keep unrelated countries
// separated by paper. Long gaps are never bridged.
function connectAllowedNeighborTerritories(items, occupied, columns, rows, maxGap = 3) {
  const itemByCountryId = new Map(items.map((item) => [item.node.data.countryId, item]));
  const connectedPairs = new Set();
  items.forEach((item) => {
    item.allowedNeighborIds.forEach((neighborId) => {
      const neighbor = itemByCountryId.get(neighborId);
      if (!neighbor) return;
      const pairKey = [item.node.data.countryId, neighborId].sort().join("|");
      if (connectedPairs.has(pairKey)) return;
      connectedPairs.add(pairKey);
      const source = item.cells.length <= neighbor.cells.length ? item : neighbor;
      const target = source === item ? neighbor : item;
      const bridge = shortestEmptyBorderBridge(source, target, occupied, columns, rows, maxGap);
      bridge?.forEach((cell) => addGridCell(source, cell, occupied, columns, rows));
    });
  });
}

function shortestEmptyBorderBridge(source, target, occupied, columns, rows, maxGap) {
  const queue = [];
  const seen = new Map();
  const enqueue = (cell, parent, distance) => {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) return;
    seen.set(key, queue.length);
    queue.push({ cell, parent, distance });
  };

  for (const cell of source.cells) {
    for (const neighbor of gridNeighbors(cell.x, cell.y)) {
      if (neighbor.x < 0 || neighbor.x >= columns || neighbor.y < 0 || neighbor.y >= rows) continue;
      const occupant = occupied.get(`${neighbor.x},${neighbor.y}`);
      if (occupant === target) return [];
      if (occupant || touchesDisallowedCountry(source, neighbor, occupied)) continue;
      enqueue(neighbor, -1, 1);
    }
  }

  for (let head = 0; head < queue.length; head += 1) {
    const entry = queue[head];
    for (const neighbor of gridNeighbors(entry.cell.x, entry.cell.y)) {
      if (neighbor.x < 0 || neighbor.x >= columns || neighbor.y < 0 || neighbor.y >= rows) continue;
      const occupant = occupied.get(`${neighbor.x},${neighbor.y}`);
      if (occupant === target) {
        const path = [];
        let cursor = head;
        while (cursor >= 0) {
          path.push(queue[cursor].cell);
          cursor = queue[cursor].parent;
        }
        return path.reverse();
      }
      if (occupant || entry.distance >= maxGap || touchesDisallowedCountry(source, neighbor, occupied)) continue;
      enqueue(neighbor, head, entry.distance + 1);
    }
  }
  return null;
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

function gridTerritoryFillPath(item, grid) {
  const rows = d3.group(item.cells, (cell) => cell.y);
  const parts = [];
  [...rows.entries()].sort(([firstY], [secondY]) => firstY - secondY).forEach(([y, cells]) => {
    const sorted = cells.map((cell) => cell.x).sort((a, b) => a - b);
    let runStart = sorted[0];
    let runEnd = sorted[0];
    const appendRun = () => {
      const x = grid.originX + runStart * grid.cellSize;
      const top = grid.originY + y * grid.cellSize;
      const width = (runEnd - runStart + 1) * grid.cellSize;
      parts.push(`M${x},${top}h${width}v${grid.cellSize}h${-width}Z`);
    };
    sorted.slice(1).forEach((x) => {
      if (x === runEnd + 1) {
        runEnd = x;
      } else {
        appendRun();
        runStart = x;
        runEnd = x;
      }
    });
    appendRun();
  });
  return parts.join("");
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
    addGridCell(item, seed, occupied, columns, rows);
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
        const candidate = bestGrowthCell(item, occupied);
        if (!candidate) return;
        addGridCell(item, candidate, occupied, columns, rows);
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
    item.labelFontSize = clamp(8 + Math.sqrt(item.displayArea) * 0.62, 11, 17);
    item.nameFontSize = clamp(8 + Math.sqrt(item.displayArea) * 0.38, 11, 15);
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
    .replace("Unclassified regional identity", "National")
    .replace("Uncategorized", "National")
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
  cursorClientX = event.clientX;
  cursorClientY = event.clientY;
  if (cursorMoveFrame) return;
  cursorMoveFrame = requestAnimationFrame(() => {
    cursorMoveFrame = 0;
    cursorLabel.style.transform = `translate3d(${cursorClientX + 12}px, ${cursorClientY + 12}px, 0)`;
  });
}

function hideCursorLabel() {
  cursorLabel.classList.remove("is-visible");
  if (cursorMoveFrame) {
    cancelAnimationFrame(cursorMoveFrame);
    cursorMoveFrame = 0;
  }
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
    if (cityTransitionInFlight) return;
    if (!state.cityId) renderGallery();
    else renderCurrentVisualization();
  }, 180);
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || event.data?.type !== "gastroglobe:return-world") return;
  const iframe = scene.querySelector(".claude-cartogram-frame");
  if (!iframe || event.source !== iframe.contentWindow || !state.cityId || cityTransitionInFlight) return;
  returnToWorld();
});

initialize();
