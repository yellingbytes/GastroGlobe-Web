import { countries, cuisinesForCountry, googleMapsUrl, restaurants } from "./restaurants.js";

const munich = { name: "Munich", country: "Germany", lat: 48.1351, lon: 11.582 };
const levels = ["world", "country", "map"];
const continentLinks = [
  ["mexico", "peru"],
  ["italy", "georgia"],
  ["italy", "turkey"],
  ["georgia", "turkey"],
  ["turkey", "lebanon"],
  ["lebanon", "ethiopia"],
  ["turkey", "afghanistan"],
  ["afghanistan", "india"],
  ["afghanistan", "china"],
  ["india", "china"],
  ["india", "vietnam"],
  ["china", "korea"],
  ["china", "vietnam"],
  ["china", "japan"],
  ["korea", "japan"],
];

const state = {
  level: "world",
  country: countries.find((country) => country.id === "china"),
  cuisine: null,
  restaurant: null,
  maxLevel: 0,
};

const scene = document.querySelector("#scene");
const selectionCard = document.querySelector("#selection-card");
const railContent = document.querySelector("#rail-content");
const cursorLabel = document.querySelector("#cursor-label");
const mapsDialog = document.querySelector("#maps-dialog");
const mapsForm = document.querySelector("#maps-form");
const mapsKeyInput = document.querySelector("#maps-key");

let mapInstance = null;
let mapOverlays = [];
let mapResizeObserver = null;
let googleMapsPromise = null;
let navigationLocked = false;

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function setTransitionOrigin(trigger) {
  const stageRect = document.querySelector(".visual-stage").getBoundingClientRect();
  const triggerRect = trigger?.getBoundingClientRect?.();
  const x = triggerRect ? triggerRect.left + triggerRect.width / 2 - stageRect.left : stageRect.width / 2;
  const y = triggerRect ? triggerRect.top + triggerRect.height / 2 - stageRect.top : stageRect.height / 2;
  document.documentElement.style.setProperty("--zoom-origin-x", `${Math.max(0, x)}px`);
  document.documentElement.style.setProperty("--zoom-origin-y", `${Math.max(0, y)}px`);
}

function commitLevel(level, direction = "forward", trigger = null) {
  if (navigationLocked || state.level === level) return;
  const index = levels.indexOf(level);
  setTransitionOrigin(trigger);
  document.documentElement.dataset.zoomDirection = direction;
  state.level = level;
  state.maxLevel = Math.max(state.maxLevel, index);
  navigationLocked = true;

  const update = () => render();
  if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const transition = document.startViewTransition(update);
    transition.finished.finally(() => {
      navigationLocked = false;
    });
  } else {
    update();
    window.setTimeout(() => {
      navigationLocked = false;
    }, 420);
  }
}

function activeRestaurants() {
  if (state.cuisine) return state.cuisine.restaurants;
  if (state.country) return state.country.restaurants;
  return restaurants;
}

function render() {
  cleanupMap();
  updateCopy();
  updateStageIndex();
  updateRail();
  updateSelectionCard();

  if (state.level === "world") renderWorld();
  if (state.level === "country") renderCuisineTopology();
  if (state.level === "map") renderPhysicalMap();
}

function updateCopy() {
  const visible = activeRestaurants();
  const copy = {
    world: {
      kicker: "Munich world map · 01",
      title: "The world,<br>over Munich.",
      intro: "A topological world of culinary origins sits directly on the physical city. Select a country to move closer.",
      caption: `${countries.length} origins over Munich · ${restaurants.length} restaurants`,
      key: "World topology over Google Maps",
    },
    country: {
      kicker: `${state.country.name} in Munich · 02`,
      title: "One country,<br>many cuisines.",
      intro: "The country expands in place; its cuisine traditions become the next geographic layer.",
      caption: `${state.country.restaurants.length} mapped ${state.country.restaurants.length === 1 ? "restaurant" : "restaurants"} · ${state.country.name}`,
      key: "Select a cuisine",
    },
    map: {
      kicker: `${state.cuisine?.name ?? state.country?.name ?? "All cultures"} · 03`,
      title: "Culture finds<br>its address.",
      intro: "Cuisine symbols resolve into verified restaurants at their real coordinates on the physical city.",
      caption: `${visible.length} verified ${visible.length === 1 ? "location" : "locations"} · Munich`,
      key: "Exact restaurant coordinates",
    },
  }[state.level];

  document.querySelector("#view-kicker").textContent = copy.kicker;
  document.querySelector("#view-title").innerHTML = copy.title;
  document.querySelector("#view-intro").textContent = copy.intro;
  document.querySelector("#stage-caption").textContent = copy.caption;
  document.querySelector("#key-label").textContent = copy.key;
  document.querySelector("[data-action='back']").hidden = state.level === "world";
  document.querySelector("[data-action='zoom-out']").disabled = state.level === "world";
  document.querySelector("[data-action='zoom-in']").disabled = state.level === "map";
}

function updateStageIndex() {
  const currentIndex = levels.indexOf(state.level);
  document.querySelectorAll("[data-level]").forEach((button, index) => {
    button.toggleAttribute("disabled", index > state.maxLevel);
    if (index === currentIndex) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

function updateRail() {
  const coordinateNode = document.querySelector("#coordinates");
  const visible = activeRestaurants();

  if (state.level === "map" && state.restaurant) {
    const selectedCountry = countries.find((country) => country.id === state.restaurant.countryId);
    coordinateNode.innerHTML = `${state.restaurant.lat.toFixed(5)}° N<br>${state.restaurant.lng.toFixed(5)}° E`;
    railContent.innerHTML = `
      <p class="place-number place-number-small">${state.restaurant.symbol}</p>
      <div class="metric-block">
        <p class="metric-label">Selected restaurant</p>
        <p class="metric-row metric-row-wrap"><span>${state.restaurant.name}</span></p>
        <p class="rail-address">${state.restaurant.address}</p>
        <a class="rail-source" href="${state.restaurant.source}" target="_blank" rel="noreferrer">Restaurant source ↗</a>
      </div>
      <div class="metric-block">
        <p class="metric-label">Culinary origin</p>
        <p class="metric-row"><span>${state.restaurant.cuisine}</span><span>${selectedCountry?.flag ?? ""}</span></p>
      </div>
    `;
    return;
  }

  coordinateNode.innerHTML = `${munich.lat.toFixed(4)}° N<br>${munich.lon.toFixed(4)}° E`;
  const primaryValue = state.level === "world" ? countries.length : state.level === "country" ? state.country.restaurants.length : visible.length;
  const suffix = "";
  const label = state.level === "world" ? "Culinary origins over Munich" : state.level === "country" ? "Restaurants mapped" : "Locations visible";
  railContent.innerHTML = `
    <p class="place-number">${primaryValue}<sup>${suffix}</sup></p>
    <div class="metric-block">
      <p class="metric-label">${label}</p>
      <p class="metric-row"><span>Munich edition</span><span>${restaurants.length} places</span></p>
    </div>
    <div class="metric-block">
      <p class="metric-label">Dataset</p>
      <p class="metric-row"><span>Coordinates</span><span>Verified</span></p>
      <p class="metric-row"><span>Updated</span><span>Jul 2026</span></p>
    </div>
  `;
}

function updateSelectionCard() {
  if (state.level === "world") {
    selectionCard.innerHTML = `
      <div>
        <div class="selection-name"><strong>Munich</strong><span>${countries.length} world origins</span></div>
        <p class="selection-copy">The schematic world is overlaid on the real city. Select a country, or reveal every sourced address.</p>
      </div>
      <button class="primary-action" type="button" data-action="reveal-all"><span>Reveal all ${restaurants.length}</span><span aria-hidden="true">＋</span></button>
    `;
  }

  if (state.level === "country") {
    selectionCard.innerHTML = `
      <div>
        <div class="selection-name"><strong>${state.country.name}</strong><span>${state.country.restaurants.length} mapped</span></div>
        <p class="selection-copy">Select a cuisine symbol, or project this entire country layer onto Munich.</p>
      </div>
      <button class="primary-action" type="button" data-action="reveal-country"><span>Reveal ${state.country.name}</span><span aria-hidden="true">＋</span></button>
    `;
  }

  if (state.level === "map") {
    const selected = state.restaurant ?? activeRestaurants()[0];
    state.restaurant = selected;
    selectionCard.innerHTML = `
      <div>
        <div class="selection-name"><strong>${selected.name}</strong><span>${selected.cuisine}</span></div>
        <p class="selection-copy">${selected.address}</p>
      </div>
      <div class="map-actions">
        <button class="map-settings-action" type="button" data-action="map-settings">Google Maps setup</button>
        <a class="primary-action" href="${googleMapsUrl(selected)}" target="_blank" rel="noreferrer"><span>Open in Google Maps</span><span aria-hidden="true">↗</span></a>
      </div>
    `;
  }
}

function renderWorld() {
  const iframeUrl = `https://www.google.com/maps?ll=${munich.lat},${munich.lon}&z=12&output=embed`;
  scene.innerHTML = `
    <div class="world-topology-map semantic-layer" aria-label="World culinary topology over Google Maps in Munich">
      <iframe class="google-map-iframe" src="${iframeUrl}" loading="eager" referrerpolicy="no-referrer-when-downgrade" title="Google Maps basemap of Munich" tabindex="-1"></iframe>
      <div class="topology-atlas topology-map-overlay" role="group" aria-label="Geographic topology of international restaurant origins in Munich">
        <div class="continent-field continent-field-americas" aria-hidden="true"><span>Americas</span></div>
        <div class="continent-field continent-field-europe" aria-hidden="true"><span>Europe</span></div>
        <div class="continent-field continent-field-africa" aria-hidden="true"><span>Africa</span></div>
        <div class="continent-field continent-field-asia" aria-hidden="true"><span>Asia</span></div>
        <svg class="topology-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${continentLinks.map(([fromId, toId]) => {
            const from = countries.find((country) => country.id === fromId);
            const to = countries.find((country) => country.id === toId);
            return `<line x1="${from.topo[0]}" y1="${from.topo[1]}" x2="${to.topo[0]}" y2="${to.topo[1]}"></line>`;
          }).join("")}
        </svg>
        <div class="munich-anchor" aria-hidden="true"><strong>Munich</strong><span>${restaurants.length} mapped</span></div>
        ${countries.map(countryTopologyMarkup).join("")}
      </div>
      <div class="map-source-strip">
        <span>Google Maps · Munich</span>
        <span>World topology overlay</span>
      </div>
    </div>
  `;

  scene.querySelectorAll(".topology-country").forEach((node) => {
    node.addEventListener("click", () => {
      state.country = countries.find((country) => country.id === node.dataset.country);
      state.cuisine = cuisinesForCountry(state.country.id)[0] ?? null;
      state.restaurant = null;
      commitLevel("country", "forward", node);
    });
    bindHoverLabel(node, `Zoom into ${node.dataset.name}`);
  });
}

function countryTopologyMarkup(country, index) {
  const count = country.restaurants.length;
  const size = 61 + Math.min(38, count * 13);
  const radiusVariant = ["44% 56% 51% 49%", "54% 46% 58% 42%", "48% 52% 43% 57%"][index % 3];
  return `
    <button class="topology-country continent-${country.continent.toLowerCase()}" type="button" data-country="${country.id}" data-name="${country.name}" style="left:${country.topo[0]}%;top:${country.topo[1]}%;--country-size:${size}px;--country-radius:${radiusVariant}" aria-label="Zoom into ${country.name}, ${count} mapped ${count === 1 ? "restaurant" : "restaurants"}">
      <span class="topology-flag" aria-hidden="true">${country.flag}</span>
      <strong>${country.name}</strong>
      <small>${count}</small>
    </button>
  `;
}

function renderCuisineTopology() {
  const cuisines = cuisinesForCountry(state.country.id);
  if (!cuisines.some((cuisine) => cuisine.id === state.cuisine?.id)) state.cuisine = cuisines[0];
  const positions = cuisinePositions(cuisines.length);
  const iframeUrl = `https://www.google.com/maps?ll=${munich.lat},${munich.lon}&z=13&output=embed`;
  scene.innerHTML = `
    <div class="cuisine-map-layer semantic-layer" aria-label="${state.country.name} cuisine topology over Google Maps in Munich">
      <iframe class="google-map-iframe" src="${iframeUrl}" loading="eager" referrerpolicy="no-referrer-when-downgrade" title="Google Maps basemap of Munich" tabindex="-1"></iframe>
      <div class="cuisine-topology cuisine-map-overlay" role="group" aria-label="Cuisine traditions from ${state.country.name} in Munich">
        <svg class="cuisine-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${positions.map(([x, y]) => `<line x1="50" y1="50" x2="${x}" y2="${y}"></line>`).join("")}
        </svg>
        <div class="country-focus continent-${state.country.continent.toLowerCase()}">
          <span>${state.country.flag}</span>
          <strong>${state.country.name}</strong>
          <small>${state.country.restaurants.length} in Munich</small>
        </div>
        ${cuisines.map((cuisine, index) => cuisineNodeMarkup(cuisine, positions[index])).join("")}
      </div>
      <div class="map-source-strip"><span>Google Maps · Munich</span><span>${state.country.name} cuisine layer</span></div>
    </div>
  `;

  scene.querySelectorAll(".cuisine-zoom-node").forEach((node) => {
    node.addEventListener("click", () => {
      state.cuisine = cuisines.find((cuisine) => cuisine.id === node.dataset.cuisine);
      state.restaurant = state.cuisine.restaurants[0];
      commitLevel("map", "forward", node);
    });
    bindHoverLabel(node, `Reveal ${node.dataset.name} on the map`);
  });
}

function cuisinePositions(count) {
  if (count === 1) return [[76, 50]];
  if (count === 2) return [[27, 49], [76, 49]];
  if (count === 3) return [[28, 32], [78, 35], [56, 77]];
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return [50 + Math.cos(angle) * 33, 50 + Math.sin(angle) * 33];
  });
}

function cuisineNodeMarkup(cuisine, position) {
  const [x, y] = position;
  return `
    <button class="cuisine-zoom-node" type="button" data-cuisine="${cuisine.id}" data-name="${cuisine.name}" style="left:${x}%;top:${y}%" aria-label="Reveal ${cuisine.name}, ${cuisine.restaurants.length} ${cuisine.restaurants.length === 1 ? "restaurant" : "restaurants"} on the map">
      <span class="cuisine-zoom-symbol" aria-hidden="true">${cuisine.symbol}</span>
      <strong>${cuisine.name}</strong>
      <small>${cuisine.restaurants.length} ${cuisine.restaurants.length === 1 ? "place" : "places"}</small>
    </button>
  `;
}

function renderPhysicalMap() {
  const visible = activeRestaurants();
  if (!state.restaurant || !visible.some((restaurant) => restaurant.id === state.restaurant.id)) state.restaurant = visible[0];
  const view = mapViewFor(visible);
  const mapLabel = state.cuisine?.name ?? state.country?.name ?? "international restaurants";
  const iframeUrl = `https://www.google.com/maps?ll=${view.center.lat},${view.center.lng}&z=${view.zoom}&output=embed`;

  scene.innerHTML = `
    <div class="physical-map semantic-layer" aria-label="Google map of ${mapLabel} in Munich">
      <div class="google-map-host" id="google-map" aria-hidden="true"></div>
      <iframe class="google-map-iframe" src="${iframeUrl}" loading="eager" referrerpolicy="no-referrer-when-downgrade" title="Google Maps basemap centered on Munich" tabindex="-1"></iframe>
      <div class="coordinate-overlay" role="group" aria-label="Verified restaurant locations">
        ${visible.map((restaurant) => fallbackMarkerMarkup(restaurant, view)).join("")}
      </div>
      <div class="map-source-strip">
        <span>Google Maps</span>
        <span>${visible.length} sourced coordinates</span>
        <button type="button" data-action="map-settings">Enable interactive map</button>
      </div>
    </div>
  `;

  scene.querySelectorAll(".coordinate-marker").forEach((marker) => {
    marker.addEventListener("click", () => selectRestaurant(marker.dataset.restaurant));
    bindHoverLabel(marker, marker.dataset.name);
  });

  const key = getGoogleMapsKey();
  if (key) initInteractiveGoogleMap(key, visible);

  const overlay = scene.querySelector(".coordinate-overlay");
  const refreshFallback = () => positionFallbackMarkers(overlay, visible, view);
  requestAnimationFrame(refreshFallback);
  mapResizeObserver = new ResizeObserver(refreshFallback);
  mapResizeObserver.observe(overlay);
}

function mapViewFor(list) {
  const center = list.length === 1
    ? { lat: list[0].lat, lng: list[0].lng }
    : {
        lat: list.reduce((sum, restaurant) => sum + restaurant.lat, 0) / list.length,
        lng: list.reduce((sum, restaurant) => sum + restaurant.lng, 0) / list.length,
      };
  return { center, zoom: list.length === 1 ? 15 : list.length <= 3 ? 14 : 12 };
}

function fallbackMarkerMarkup(restaurant, view) {
  return `
    <button class="coordinate-marker ${restaurant.id === state.restaurant?.id ? "is-active" : ""}" type="button" data-restaurant="${restaurant.id}" data-name="${restaurant.name}" data-lat="${restaurant.lat}" data-lng="${restaurant.lng}" aria-label="Select ${restaurant.name}">
      <span aria-hidden="true">${restaurant.symbol}</span>
      <strong>${restaurant.name}</strong>
    </button>
  `;
}

function positionFallbackMarkers(container, list, view) {
  if (!container?.isConnected) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;
  const centerPoint = worldPixel(view.center.lat, view.center.lng, view.zoom);
  list.forEach((restaurant) => {
    const point = worldPixel(restaurant.lat, restaurant.lng, view.zoom);
    const marker = container.querySelector(`[data-restaurant="${restaurant.id}"]`);
    if (!marker) return;
    marker.style.left = `${width / 2 + point.x - centerPoint.x}px`;
    marker.style.top = `${height / 2 + point.y - centerPoint.y}px`;
  });
}

function worldPixel(lat, lng, zoom) {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((Math.min(Math.max(lat, -85), 85) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function getGoogleMapsKey() {
  return window.GASTROGLOBE_CONFIG?.googleMapsApiKey || localStorage.getItem("gastroglobe.googleMapsApiKey") || "";
}

function loadGoogleMaps(key) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = "__gastroGlobeGoogleMapsReady";
    const timeout = window.setTimeout(() => reject(new Error("Google Maps timed out")), 15000);
    window[callbackName] = () => {
      window.clearTimeout(timeout);
      resolve(window.google.maps);
      delete window[callbackName];
    };
    window.gm_authFailure = () => {
      window.clearTimeout(timeout);
      reject(new Error("Google Maps authentication failed"));
    };
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callbackName}&v=weekly`;
    script.onerror = () => reject(new Error("Google Maps could not load"));
    document.head.append(script);
  });
  return googleMapsPromise;
}

async function initInteractiveGoogleMap(key, visible) {
  const host = scene.querySelector("#google-map");
  if (!host) return;
  try {
    await loadGoogleMaps(key);
    if (state.level !== "map" || !host.isConnected) return;
    const view = mapViewFor(visible);
    mapInstance = new google.maps.Map(host, {
      center: view.center,
      zoom: view.zoom,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      clickableIcons: false,
      backgroundColor: "#e8e3d8",
      styles: googleMapStyles,
    });
    host.removeAttribute("aria-hidden");
    host.classList.add("is-ready");
    scene.querySelector(".google-map-iframe")?.classList.add("is-hidden");
    scene.querySelector(".coordinate-overlay")?.classList.add("is-hidden");
    scene.querySelector(".map-source-strip span:first-child").textContent = "Google Maps · Interactive";

    if (visible.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      visible.forEach((restaurant) => bounds.extend({ lat: restaurant.lat, lng: restaurant.lng }));
      mapInstance.fitBounds(bounds, 64);
    }

    const RestaurantMapOverlay = createRestaurantMapOverlayClass();
    mapOverlays = visible.map((restaurant) => new RestaurantMapOverlay(restaurant, mapInstance));
  } catch (error) {
    const source = scene.querySelector(".map-source-strip");
    if (source) source.dataset.error = "Google Maps key needs attention";
  }
}

function createRestaurantMapOverlayClass() {
  return class RestaurantMapOverlay extends google.maps.OverlayView {
    constructor(restaurant, map) {
      super();
      this.restaurant = restaurant;
      this.button = null;
      this.setMap(map);
    }

    onAdd() {
      this.button = document.createElement("button");
      this.button.type = "button";
      this.button.dataset.restaurant = this.restaurant.id;
      this.button.className = `google-restaurant-marker ${this.restaurant.id === state.restaurant?.id ? "is-active" : ""}`;
      this.button.setAttribute("aria-label", `Select ${this.restaurant.name}`);
      this.button.innerHTML = `<span aria-hidden="true">${this.restaurant.symbol}</span><strong>${this.restaurant.name}</strong>`;
      this.button.addEventListener("click", () => selectRestaurant(this.restaurant.id));
      this.getPanes().overlayMouseTarget.append(this.button);
    }

    draw() {
      const point = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.restaurant.lat, this.restaurant.lng));
      if (!point || !this.button) return;
      this.button.style.left = `${point.x}px`;
      this.button.style.top = `${point.y}px`;
    }

    onRemove() {
      this.button?.remove();
      this.button = null;
    }
  };
}

const googleMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#e8e3d8" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5f625e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f2efe8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f4f1ea" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ded8cc" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d1cabc" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#aab8bd" }] },
];

function cleanupMap() {
  mapResizeObserver?.disconnect();
  mapResizeObserver = null;
  mapOverlays.forEach((overlay) => overlay.setMap?.(null));
  mapOverlays = [];
  mapInstance = null;
}

function selectRestaurant(id) {
  state.restaurant = restaurants.find((restaurant) => restaurant.id === id) ?? state.restaurant;
  document.querySelectorAll(".coordinate-marker, .google-restaurant-marker").forEach((marker) => marker.classList.toggle("is-active", marker.dataset.restaurant === id || marker.getAttribute("aria-label") === `Select ${state.restaurant.name}`));
  updateSelectionCard();
  updateRail();
}

function bindHoverLabel(element, label) {
  element.addEventListener("pointerenter", () => {
    cursorLabel.textContent = label;
    cursorLabel.classList.add("is-visible");
  });
  element.addEventListener("pointermove", (event) => {
    cursorLabel.style.left = `${event.clientX}px`;
    cursorLabel.style.top = `${event.clientY}px`;
  });
  element.addEventListener("pointerleave", () => cursorLabel.classList.remove("is-visible"));
}

function goBack(trigger = null) {
  if (state.level === "map" && !state.country) {
    commitLevel("world", "back", trigger);
    return;
  }
  const index = levels.indexOf(state.level);
  if (index > 0) commitLevel(levels[index - 1], "back", trigger);
}

function zoomIn(trigger = null) {
  if (state.level === "world") {
    state.country ||= countries.find((country) => country.id === "china");
    state.cuisine = cuisinesForCountry(state.country.id)[0] ?? null;
    commitLevel("country", "forward", trigger);
    return;
  }
  if (state.level === "country") {
    state.cuisine ||= cuisinesForCountry(state.country.id)[0] ?? null;
    state.restaurant = activeRestaurants()[0];
    commitLevel("map", "forward", trigger);
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  const action = target?.dataset.action;
  if (!action) return;
  if (action === "home") {
    commitLevel("world", "back", target);
  }
  if (action === "back" || action === "zoom-out") goBack(target);
  if (action === "zoom-in") zoomIn(target);
  if (action === "reveal-all") {
    state.country = null;
    state.cuisine = null;
    state.restaurant = restaurants[0];
    commitLevel("map", "forward", target);
  }
  if (action === "reveal-country") {
    state.cuisine = null;
    state.restaurant = state.country.restaurants[0];
    commitLevel("map", "forward", target);
  }
  if (action === "about") {
    const expanded = target.getAttribute("aria-expanded") === "true";
    target.setAttribute("aria-expanded", String(!expanded));
    document.querySelector("#about-drawer").setAttribute("aria-hidden", String(expanded));
  }
  if (action === "map-settings") {
    mapsKeyInput.value = getGoogleMapsKey();
    mapsDialog.showModal();
    mapsKeyInput.focus();
  }
  if (action === "close-maps-dialog") mapsDialog.close();
});

document.querySelectorAll("[data-level]").forEach((button) => {
  button.addEventListener("click", () => {
    const requested = button.dataset.level;
    if (requested === "country" && !state.country) state.country = countries.find((country) => country.id === "china");
    if (requested === "map") state.restaurant = activeRestaurants()[0];
    const direction = levels.indexOf(requested) < levels.indexOf(state.level) ? "back" : "forward";
    commitLevel(requested, direction, button);
  });
});

mapsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = mapsKeyInput.value.trim();
  if (key) localStorage.setItem("gastroglobe.googleMapsApiKey", key);
  else localStorage.removeItem("gastroglobe.googleMapsApiKey");
  mapsDialog.close();
  cleanupMap();
  googleMapsPromise = null;
  document.querySelector("#google-maps-script")?.remove();
  if (state.level === "map") renderPhysicalMap();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mapsDialog.open) {
    const aboutButton = document.querySelector("[data-action='about']");
    if (aboutButton.getAttribute("aria-expanded") === "true") {
      aboutButton.click();
      aboutButton.focus();
    } else {
      goBack();
    }
  }
});

render();
