import * as munichSource from "./data/munich-restaurants.js?v=2026-08-02-1";
import * as berlinSource from "./data/berlin-restaurants.js?v=2026-08-26-2";
import {
  applyMunichChinaEditorialUpdate,
  applyMunichChinaTaxonomyUpdate,
} from "./data/munich-china-editorial-overrides.js?v=2026-08-26-1";
import {
  legacyGeographicAssignments,
  researchedCountryRegions,
} from "./data/global-culinary-regions.js?v=2026-08-05-1";
import { applyBerlinEditorialUpdate } from "./data/berlin-regional-findings.js?v=2026-08-26-2";

// Every city is assembled the same way: an OpenStreetMap-derived base dataset, then any
// hand-researched regional layers on top. Munich carries more of those layers than Berlin
// only because it was audited first, not because the two are modelled differently.
const editionSpecs = [
  {
    id: "munich",
    source: munichSource,
    regionalTaxonomyUrl: "./data/munich-regional-cuisine-taxonomy.json?v=2026-08-26-1",
    applyEditorialUpdates(dataset) {
      applyMunichChinaEditorialUpdate(dataset);
    },
    applyTaxonomyUpdates(taxonomy, dataset) {
      applyMunichChinaTaxonomyUpdate(taxonomy, dataset.restaurants);
      applyResearchedCountryTaxonomies(taxonomy, dataset);
    },
  },
  {
    id: "berlin",
    source: berlinSource,
    regionalTaxonomyUrl: "./data/berlin-regional-cuisine-taxonomy.json?v=2026-08-26-2",
    applyEditorialUpdates(dataset) {
      applyBerlinEditorialUpdate(dataset);
    },
  },
];

const regionalFoodEmoji = {
  bavaria: "🥨",
  franconia: "🍺",
  swabia: "🥨",
  baden: "🍷",
  guangdong: "🥟",
  "northeast-china": "🍲",
  "gansu-lanzhou": "🍜",
  "fujian-taiwan": "🐟",
  hunan: "🥘",
  sichuan: "🌶️",
  "shanxi-shaanxi-noodles": "🍜",
  "xinjiang-uyghur": "🐑",
  yunnan: "🍄",
  tibetan: "🏔️",
  "jiangsu-zhejiang-shanghai": "🍤",
  "northern-china": "🥟",
  "campania-pizza": "🍕",
  sardinia: "🐑",
  "sushi-tradition": "🍣",
  "ramen-tradition": "🍜",
  "noodle-traditions": "🍜",
  "tapas-tradition": "🫒",
  alsace: "🥨",
  "central-anatolia": "🥟",
  "south-india": "🥞",
  bengali: "🐟",
  hawaii: "🌺",
};

const taxonomyCountryAliases = new Map([
  ["Korea", "south-korea"],
]);

function normalizeTaxonomyName(value) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function cuisineLabel(value) {
  return value
    .split(";")
    .map((part) => part.trim().replaceAll("_", " "))
    .filter(Boolean)
    .map((part) => part.replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(" · ");
}

// Rewrites a country's regional nodes from the researched culinary-genealogy report,
// carrying over only restaurant assignments that already had evidence behind them.
function applyResearchedCountryTaxonomies(taxonomy, dataset) {
  const { countryTaxonomy, regionTaxonomy, restaurants: sourceRestaurants } = dataset;
  const continentByName = new Map(taxonomy.continents.map((continent) => [continent.name, continent]));
  const sourceRegionById = new Map(regionTaxonomy.map((region) => [region.id, region]));
  const sourceRestaurantById = new Map(sourceRestaurants.map((restaurant) => [restaurant.id, restaurant]));

  for (const [countryId, definition] of Object.entries(researchedCountryRegions)) {
    const sourceCountry = countryTaxonomy.find((country) => country.id === countryId);
    if (!sourceCountry) continue;
    let continent = continentByName.get(sourceCountry.continent);
    if (!continent) {
      continent = { name: sourceCountry.continent, countries: [] };
      taxonomy.continents.push(continent);
      continentByName.set(sourceCountry.continent, continent);
    }
    let country = continent.countries.find((candidate) =>
      candidate.country === sourceCountry.name || candidate.emoji === sourceCountry.flag,
    );
    if (!country) {
      country = { country: sourceCountry.name, emoji: sourceCountry.flag, regions: [] };
      continent.countries.push(country);
    }

    const existingRegions = country.regions ?? [];
    const usedExistingRegions = new Set();
    const claimedRestaurantIds = new Set();
    const legacyAssignments = legacyGeographicAssignments[countryId] ?? {};
    const regions = definition.regions.map((regionDefinition) => {
      const acceptedNames = new Set(
        [regionDefinition.name, ...(regionDefinition.aliases ?? [])].map(normalizeTaxonomyName),
      );
      const matchingExistingRegions = existingRegions.filter((existingRegion) =>
        acceptedNames.has(normalizeTaxonomyName(existingRegion.name)),
      );
      matchingExistingRegions.forEach((existingRegion) => usedExistingRegions.add(existingRegion));
      const evidenceRestaurants = matchingExistingRegions.flatMap((existingRegion) => existingRegion.restaurants ?? []);

      for (const restaurant of sourceRestaurants) {
        if (restaurant.countryId !== countryId || claimedRestaurantIds.has(restaurant.id)) continue;
        const targetName = legacyAssignments[restaurant.regionId];
        if (!targetName || normalizeTaxonomyName(targetName) !== normalizeTaxonomyName(regionDefinition.name)) continue;
        const sourceRegion = sourceRegionById.get(restaurant.regionId);
        evidenceRestaurants.push({
          id: restaurant.id,
          name: restaurant.name,
          evidenceLevel: "dataset-geographic",
          evidence: `Existing dataset assignment to ${sourceRegion?.name ?? regionDefinition.name}.`,
          sourceUrls: [restaurant.source].filter(Boolean),
        });
      }

      const regionRestaurants = [];
      const localIds = new Set();
      for (const evidenceRestaurant of evidenceRestaurants) {
        const sourceRestaurant = sourceRestaurantById.get(evidenceRestaurant.id);
        if (!sourceRestaurant || sourceRestaurant.countryId !== countryId || localIds.has(evidenceRestaurant.id)) continue;
        localIds.add(evidenceRestaurant.id);
        claimedRestaurantIds.add(evidenceRestaurant.id);
        regionRestaurants.push({ ...evidenceRestaurant, name: sourceRestaurant.name });
      }
      return {
        name: regionDefinition.name,
        emoji: regionDefinition.emoji,
        geographicCenter: regionDefinition.geographicCenter,
        restaurantCount: regionRestaurants.length,
        restaurants: regionRestaurants,
      };
    });

    for (const existingRegion of existingRegions) {
      if (usedExistingRegions.has(existingRegion) || !(existingRegion.restaurants?.length)) continue;
      const retainedRestaurants = existingRegion.restaurants.filter((restaurant) => {
        const sourceRestaurant = sourceRestaurantById.get(restaurant.id);
        if (!sourceRestaurant || sourceRestaurant.countryId !== countryId || claimedRestaurantIds.has(restaurant.id)) return false;
        claimedRestaurantIds.add(restaurant.id);
        return true;
      });
      if (!retainedRestaurants.length) continue;
      regions.push({
        ...existingRegion,
        restaurantCount: retainedRestaurants.length,
        restaurants: retainedRestaurants,
      });
    }

    const countryRestaurants = sourceRestaurants.filter((restaurant) => restaurant.countryId === countryId);
    country.country = sourceCountry.name;
    country.emoji = sourceCountry.flag;
    country.sourceRestaurantCount = countryRestaurants.length;
    country.classifiedRestaurantCount = claimedRestaurantIds.size;
    country.unclassifiedRestaurantCount = countryRestaurants.length - claimedRestaurantIds.size;
    country.classificationLabel = definition.classificationLabel;
    country.canonicalStatus = definition.canonicalStatus;
    country.researchBasis = "deep-research-report.md · 2026-08-05";
    country.regions = regions;
    country.auditNote = "Regional nodes follow the supplied culinary-genealogy report; only pre-existing evidence-backed restaurant assignments were retained.";
  }

  taxonomy.generatedAt = "2026-08-05";
}

async function loadRegionalTaxonomy(url) {
  const response = await fetch(new URL(url, import.meta.url));
  if (!response.ok) {
    throw new Error(`Regional cuisine taxonomy could not load (${response.status}) for ${url}.`);
  }
  return response.json();
}

async function createEdition(spec) {
  // The imported dataset modules are shared live bindings, and the editorial layers mutate
  // what they are handed. Copy first so one city's overrides can never leak into another.
  const dataset = {
    datasetMeta: { ...spec.source.datasetMeta },
    countryTaxonomy: spec.source.countryTaxonomy.map((country) => ({ ...country })),
    regionTaxonomy: spec.source.regionTaxonomy.map((region) => ({ ...region })),
    restaurants: spec.source.restaurants.map((restaurant) => ({ ...restaurant })),
  };
  spec.applyEditorialUpdates?.(dataset);

  const regionalCuisineTaxonomy = await loadRegionalTaxonomy(spec.regionalTaxonomyUrl);
  spec.applyTaxonomyUpdates?.(regionalCuisineTaxonomy, dataset);

  const countryById = new Map(dataset.countryTaxonomy.map((country) => [country.id, country]));
  const regionById = new Map(dataset.regionTaxonomy.map((region) => [`${region.countryId}/${region.id}`, region]));

  const regionalCountryById = new Map(
    regionalCuisineTaxonomy.continents.flatMap((continent) =>
      continent.countries.map((country) => {
        const sourceCountry = dataset.countryTaxonomy.find((candidate) =>
          candidate.name === country.country || candidate.flag === country.emoji,
        );
        const countryId = sourceCountry?.id ?? taxonomyCountryAliases.get(country.country);
        return countryId ? [countryId, country] : null;
      }).filter(Boolean),
    ),
  );

  const restaurants = dataset.restaurants.map((restaurant) => {
    const country = countryById.get(restaurant.countryId);
    const region = regionById.get(`${restaurant.countryId}/${restaurant.regionId}`);
    return {
      ...restaurant,
      cityId: spec.id,
      country: country.name,
      continent: country.continent,
      flag: country.flag,
      symbol: regionalFoodEmoji[region.id] ?? country.flag,
      markerKind: regionalFoodEmoji[region.id] ? "food" : "flag",
      region: region.name,
      originLat: region.lat,
      originLng: region.lng,
      cuisine: cuisineLabel(restaurant.cuisine),
    };
  });

  const countries = dataset.countryTaxonomy.map((country) => {
    const countryRestaurants = restaurants.filter((restaurant) => restaurant.countryId === country.id);
    const sourceById = new Map(countryRestaurants.map((restaurant) => [restaurant.id, restaurant]));
    const regionalCountry = regionalCountryById.get(country.id);
    return {
      ...country,
      restaurants: countryRestaurants,
      regionalCuisines: regionalCountry?.regions.map((region) => ({
        name: region.name,
        emoji: region.emoji,
        geographicCenter: region.geographicCenter,
        restaurantCount: region.restaurants.length,
        restaurants: region.restaurants.map((restaurant) => sourceById.get(restaurant.id)).filter(Boolean),
      })) ?? [],
      classificationLabel: regionalCountry?.classificationLabel,
      canonicalStatus: regionalCountry?.canonicalStatus,
    };
  });

  return {
    id: spec.id,
    datasetMeta: dataset.datasetMeta,
    regionTaxonomy: dataset.regionTaxonomy,
    restaurants,
    countries,
    regionalCountryById,
  };
}

const editionList = await Promise.all(editionSpecs.map(createEdition));
const editionsById = new Map(editionList.map((edition) => [edition.id, edition]));

export const liveCityIds = editionList.map((edition) => edition.id);

export function getEdition(cityId) {
  return editionsById.get(cityId) ?? null;
}

export function isLiveCity(cityId) {
  return editionsById.has(cityId);
}

export function countriesForCity(cityId) {
  return editionsById.get(cityId)?.countries ?? [];
}

export function datasetMetaForCity(cityId) {
  return editionsById.get(cityId)?.datasetMeta ?? null;
}

export function restaurantsForCity(cityId) {
  return editionsById.get(cityId)?.restaurants ?? [];
}

// Compatibility exports for the currently deployed Munich-first app shell. Keep these
// until every consumer has moved to the city-aware accessors above.
export const countries = countriesForCity("munich");
export const datasetMeta = datasetMetaForCity("munich");

export const totalLiveRestaurants = editionList.reduce((sum, edition) => sum + edition.restaurants.length, 0);

export const metropolitanEditions = [
  { id: "munich", name: "Munich", country: "Germany", lat: 48.1351, lng: 11.582 },
  { id: "london", name: "London", country: "United Kingdom", lat: 51.5072, lng: -0.1276 },
  { id: "berlin", name: "Berlin", country: "Germany", lat: 52.52, lng: 13.405 },
  { id: "paris", name: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { id: "barcelona", name: "Barcelona", country: "Spain", lat: 41.3874, lng: 2.1686 },
  { id: "new-york", name: "New York", country: "United States", lat: 40.7128, lng: -74.006 },
  { id: "san-francisco", name: "San Francisco", country: "United States", lat: 37.7749, lng: -122.4194 },
  { id: "los-angeles", name: "Los Angeles", country: "United States", lat: 34.0522, lng: -118.2437 },
  { id: "toronto", name: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832 },
  { id: "mexico-city", name: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332 },
  { id: "sao-paulo", name: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
  { id: "cape-town", name: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241 },
  { id: "dubai", name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708 },
  { id: "beijing", name: "Beijing", country: "China", lat: 39.9042, lng: 116.4074 },
  { id: "shanghai", name: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737 },
  { id: "singapore", name: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { id: "tokyo", name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { id: "melbourne", name: "Melbourne", country: "Australia", lat: -37.8136, lng: 144.9631 },
].map((edition) => ({ ...edition, live: editionsById.has(edition.id) }));

export const continentCenters = {
  Americas: { lat: 8, lng: -82, ringHue: "red" },
  Europe: { lat: 54, lng: 15, ringHue: "blue" },
  Africa: { lat: 1, lng: 20, ringHue: "black" },
  Asia: { lat: 34, lng: 94, ringHue: "yellow" },
  Oceania: { lat: -25, lng: 140, ringHue: "green" },
};

function buildLiveMetropolitan(edition, definition) {
  return {
    ...definition,
    kind: "metropolitan",
    available: edition.restaurants.length,
    children: Object.entries(continentCenters)
      .map(([continentName, center]) => {
        const continentCountries = edition.countries.filter((country) => country.continent === continentName);
        if (!continentCountries.length) return null;
        return {
          id: `${edition.id}-continent-${continentName.toLowerCase()}`,
          name: continentName,
          kind: "continent",
          ...center,
          available: continentCountries.reduce((sum, country) => sum + country.restaurants.length, 0),
          children: continentCountries.map((country) => {
            const regionalCountry = edition.regionalCountryById.get(country.id);
            return {
              id: `country-${edition.id}-${country.id}`,
              countryId: country.id,
              name: country.name,
              flag: country.flag,
              kind: "country",
              lat: country.lat,
              lng: country.lng,
              available: country.restaurants.length,
              children: regionalCountry
                ? buildRegionalCuisineChildren(country, regionalCountry)
                : buildLegacyRegionChildren(country, edition.regionTaxonomy),
            };
          }),
        };
      })
      .filter(Boolean),
  };
}

export function buildAtlasHierarchy() {
  const children = metropolitanEditions.map((definition) => {
    const edition = editionsById.get(definition.id);
    if (edition) return buildLiveMetropolitan(edition, definition);
    return {
      ...definition,
      kind: "metropolitan",
      planned: true,
      available: 0,
      children: Object.entries(continentCenters).map(([continentName, center]) => ({
        id: `${definition.id}-continent-${continentName.toLowerCase()}`,
        name: continentName,
        kind: "continent",
        ...center,
        available: 0,
        layoutValue: 1,
        emptyEdition: true,
      })),
    };
  });

  return {
    id: "atlas-root",
    name: "Metropolitan atlas",
    kind: "root",
    available: totalLiveRestaurants,
    children,
  };
}

function buildRegionalCuisineChildren(country, regionalCountry) {
  const classifiedIds = new Set(
    regionalCountry.regions.flatMap((region) => region.restaurants.map((restaurant) => restaurant.id)),
  );
  const sourceById = new Map(country.restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const regions = regionalCountry.regions.map((region, index) => {
    const regionRestaurants = region.restaurants
      .map((restaurant) => sourceById.get(restaurant.id))
      .filter(Boolean);
    return regionalCuisineNode(country, region, regionRestaurants, index);
  });
  const unclassifiedRestaurants = country.restaurants.filter((restaurant) => !classifiedIds.has(restaurant.id));

  if (unclassifiedRestaurants.length) {
    regions.push({
      id: `region-${country.id}-national`,
      name: "National",
      emoji: country.flag,
      countryId: country.id,
      kind: "region",
      lat: country.lat,
      lng: country.lng,
      available: unclassifiedRestaurants.length,
      unclassified: true,
      children: unclassifiedRestaurants.map((restaurant) => restaurantNode(restaurant, {
        name: "National",
        emoji: country.flag,
      })),
    });
  }

  return regions;
}

function regionalCuisineNode(country, region, restaurantsInRegion, index) {
  const center = region.geographicCenter ?? { lat: country.lat, lng: country.lng };
  return {
    id: `region-${country.id}-taxonomy-${index}`,
    name: region.name,
    emoji: region.emoji,
    countryId: country.id,
    kind: "region",
    lat: center.lat,
    lng: center.lng,
    available: restaurantsInRegion.length,
    zeroCountCuisine: restaurantsInRegion.length === 0,
    children: restaurantsInRegion.map((restaurant) => restaurantNode(restaurant, region)),
  };
}

function restaurantNode(restaurant, region) {
  return {
    ...restaurant,
    region: region.name,
    symbol: region.emoji ?? restaurant.symbol,
    markerKind: region.emoji ? "food" : restaurant.markerKind,
    kind: "restaurant",
    available: 1,
    layoutValue: 1,
  };
}

function buildLegacyRegionChildren(country, regionTaxonomy) {
  const regions = regionTaxonomy
    .filter((region) => region.countryId === country.id)
    .map((region) => {
      const regionRestaurants = country.restaurants.filter((restaurant) => restaurant.regionId === region.id);
      if (!regionRestaurants.length) return null;
      return {
        id: `region-${country.id}-${region.id}`,
        name: region.name,
        countryId: country.id,
        kind: "region",
        lat: region.lat,
        lng: region.lng,
        available: regionRestaurants.length,
        children: regionRestaurants.map((restaurant) => restaurantNode(restaurant, region)),
      };
    })
    .filter(Boolean);

  // Do NOT collapse a lone "National cuisine" region into its restaurants. Every view walks
  // country -> region -> restaurant, and the cuisine drawer builds its Google Maps links from
  // region.children; handing it restaurants one level early left all 27 Georgian restaurants,
  // and every other single-region country, unreachable.
  return regions;
}

export function googleMapsUrl(restaurant) {
  // OSM leaves roughly a fifth of records without addr:street, so their address is just the city
  // and a name search drops the pin anywhere in it. Every record does carry exact coordinates,
  // so pin those instead and keep the name search only where the street is actually known.
  const hasStreetNumber = /\d/.test(restaurant.address ?? "");
  const hasCoordinates = Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng);
  const query = !hasStreetNumber && hasCoordinates
    ? `${restaurant.lat},${restaurant.lng}`
    : `${restaurant.name}, ${restaurant.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
