import {
  countryTaxonomy,
  datasetMeta,
  regionTaxonomy,
  restaurants as sourceRestaurants,
} from "./data/munich-restaurants.js";

const regionalTaxonomyResponse = await fetch(new URL("./data/munich-regional-cuisine-taxonomy.json", import.meta.url));
if (!regionalTaxonomyResponse.ok) {
  throw new Error(`Regional cuisine taxonomy could not load (${regionalTaxonomyResponse.status}).`);
}
const regionalCuisineTaxonomy = await regionalTaxonomyResponse.json();

const countryById = new Map(countryTaxonomy.map((country) => [country.id, country]));
const regionById = new Map(regionTaxonomy.map((region) => [`${region.countryId}/${region.id}`, region]));
const regionalFoodEmoji = {
  bavaria: "🥨",
  franconia: "🍺",
  guangdong: "🥟",
  "campania-pizza": "🍕",
  "sushi-tradition": "🍣",
  "ramen-tradition": "🍜",
  "noodle-traditions": "🍜",
  "tapas-tradition": "🫒",
};

const taxonomyCountryAliases = new Map([
  ["Korea", "south-korea"],
]);

const regionalCountryById = new Map(
  regionalCuisineTaxonomy.continents.flatMap((continent) =>
    continent.countries.map((country) => {
      const sourceCountry = countryTaxonomy.find((candidate) =>
        candidate.name === country.country || candidate.flag === country.emoji,
      );
      const countryId = sourceCountry?.id ?? taxonomyCountryAliases.get(country.country);
      return countryId ? [countryId, country] : null;
    }).filter(Boolean),
  ),
);

function cuisineLabel(value) {
  return value
    .split(";")
    .map((part) => part.trim().replaceAll("_", " "))
    .filter(Boolean)
    .map((part) => part.replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(" · ");
}

export { datasetMeta };

export const restaurants = sourceRestaurants.map((restaurant) => {
  const country = countryById.get(restaurant.countryId);
  const region = regionById.get(`${restaurant.countryId}/${restaurant.regionId}`);
  return {
    ...restaurant,
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

export const countries = countryTaxonomy.map((country) => ({
  ...country,
  restaurants: restaurants.filter((restaurant) => restaurant.countryId === country.id),
}));

export const metropolitanEditions = [
  { id: "munich", name: "Munich", country: "Germany", lat: 48.1351, lng: 11.582, live: true },
  { id: "london", name: "London", country: "United Kingdom", lat: 51.5072, lng: -0.1276 },
  { id: "berlin", name: "Berlin", country: "Germany", lat: 52.52, lng: 13.405 },
  { id: "paris", name: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { id: "new-york", name: "New York", country: "United States", lat: 40.7128, lng: -74.006 },
  { id: "toronto", name: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832 },
  { id: "mexico-city", name: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332 },
  { id: "sao-paulo", name: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
  { id: "cape-town", name: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241 },
  { id: "singapore", name: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { id: "tokyo", name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { id: "melbourne", name: "Melbourne", country: "Australia", lat: -37.8136, lng: 144.9631 },
];

export const continentCenters = {
  Americas: { lat: 8, lng: -82, ringHue: "red" },
  Europe: { lat: 54, lng: 15, ringHue: "blue" },
  Africa: { lat: 1, lng: 20, ringHue: "black" },
  Asia: { lat: 34, lng: 94, ringHue: "yellow" },
  Oceania: { lat: -25, lng: 140, ringHue: "green" },
};

export function buildAtlasHierarchy() {
  const munich = metropolitanEditions.find((edition) => edition.id === "munich");
  const liveMetropolitan = {
    ...munich,
    kind: "metropolitan",
    available: restaurants.length,
    children: Object.entries(continentCenters)
      .map(([continentName, center]) => {
        const continentCountries = countries.filter((country) => country.continent === continentName);
        if (!continentCountries.length) return null;
        return {
          id: `continent-${continentName.toLowerCase()}`,
          name: continentName,
          kind: "continent",
          ...center,
          available: continentCountries.reduce((sum, country) => sum + country.restaurants.length, 0),
          children: continentCountries.map((country) => {
            const regionalCountry = regionalCountryById.get(country.id);
            return {
              id: `country-${country.id}`,
              countryId: country.id,
              name: country.name,
              flag: country.flag,
              kind: "country",
              lat: country.lat,
              lng: country.lng,
              available: country.restaurants.length,
              children: regionalCountry
                ? buildRegionalCuisineChildren(country, regionalCountry)
                : buildLegacyRegionChildren(country),
            };
          }),
        };
      })
      .filter(Boolean),
  };

  const plannedMetropolitans = metropolitanEditions
    .filter((edition) => !edition.live)
    .map((edition) => ({
      ...edition,
      kind: "metropolitan",
      planned: true,
      available: 0,
      children: Object.entries(continentCenters).map(([continentName, center]) => ({
        id: `${edition.id}-continent-${continentName.toLowerCase()}`,
        name: continentName,
        kind: "continent",
        ...center,
        available: 0,
        layoutValue: 1,
        emptyEdition: true,
      })),
    }));

  return {
    id: "atlas-root",
    name: "Metropolitan atlas",
    kind: "root",
    available: restaurants.length,
    children: [liveMetropolitan, ...plannedMetropolitans],
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
      id: `region-${country.id}-unclassified`,
      name: "Unclassified regional identity",
      emoji: "◌",
      countryId: country.id,
      kind: "region",
      lat: country.lat,
      lng: country.lng,
      available: unclassifiedRestaurants.length,
      unclassified: true,
      children: unclassifiedRestaurants.map((restaurant) => restaurantNode(restaurant, {
        name: "Unclassified regional identity",
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

function buildLegacyRegionChildren(country) {
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

  if (regions.length === 1 && regions[0].name === "National cuisine") {
    return regions[0].children;
  }

  return regions;
}

export function googleMapsUrl(restaurant) {
  const query = encodeURIComponent(`${restaurant.name}, ${restaurant.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
