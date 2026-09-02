// Turns a raw Overpass export of `amenity=restaurant` + `amenity=fast_food` features into a
// GastroGlobe city dataset.
//
// fast_food is included deliberately. A large part of Berlin's regionally specific Chinese and
// Vietnamese cooking (Lanzhou beef noodles, Xi'an biangbiang, banh mi) trades in counter-service
// format, and querying only amenity=restaurant silently deleted that whole class of restaurant
// before anyone could look at it. Generic Asia-Imbiss operations are still excluded, but by the
// audit on the evidence, not by the query on the shop format. amenity=cafe stays out.
//
//   node scripts/normalize-osm.mjs berlin < raw-overpass.json > data/berlin-restaurants.js
//
// Cuisine mapping lives in cuisine-taxonomy.mjs so every city is normalised the same way.

import { readFileSync } from "node:fs";

import { countries, aliases, regionTags, hardExclusions } from "./cuisine-taxonomy.mjs";
import { requireCity } from "./cities.mjs";

const cityId = process.argv[2];
if (!cityId) {
  console.error("Usage: node scripts/normalize-osm.mjs <cityId> < overpass.json > dataset.js");
  process.exit(1);
}
const city = requireCity(cityId);
if (!city.boundary) {
  console.error(`City "${cityId}" is not configured for OpenStreetMap boundary normalization.`);
  process.exit(1);
}
const boundary = JSON.parse(readFileSync(new URL(city.boundary, import.meta.url), "utf8"))[0].geojson;

function tokens(raw) {
  return raw
    .toLowerCase()
    .split(/[;,]/)
    .map((value) => aliases[value.trim()] ?? value.trim())
    .filter(Boolean);
}

function classify(raw) {
  const values = tokens(raw);
  if (values.some((value) => hardExclusions.has(value))) return { reason: "fusion-or-ambiguous" };
  const explicit = values.filter((value) => countries[value]);
  const regional = values.filter((value) => regionTags[value]);
  const candidates = [
    ...explicit.map((tag) => countries[tag][0]),
    ...regional.map((tag) => countries[regionTags[tag][0]][0]),
  ];
  const ids = [...new Set(candidates)];
  if (!ids.length) return { reason: "generic-or-food-type" };
  if (ids.length > 1) return { reason: "multi-country" };

  const countryTag = explicit.find((tag) => countries[tag][0] === ids[0]) ?? regionTags[regional[0]]?.[0];
  const country = countries[countryTag];
  const chosenRegion = regional.map((tag) => regionTags[tag]).find((region) => countries[region[0]][0] === ids[0]);
  return {
    country: {
      id: country[0],
      name: country[1],
      continent: country[2],
      lat: country[3],
      lng: country[4],
      flag: country[5],
      symbol: country[6],
    },
    region: chosenRegion
      ? { id: chosenRegion[1], name: chosenRegion[2], lat: chosenRegion[3], lng: chosenRegion[4] }
      : { id: `${country[0]}-national`, name: "National cuisine", lat: country[3], lng: country[4] },
  };
}

function coordinate(element) {
  const point = element.type === "node" ? element : element.center;
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lon)
    ? { lat: point.lat, lng: point.lon }
    : null;
}

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function insidePolygon(point, polygon) {
  return insideRing(point, polygon[0]) && !polygon.slice(1).some((hole) => insideRing(point, hole));
}

function insideCity(point) {
  const polygons = boundary.type === "MultiPolygon" ? boundary.coordinates : [boundary.coordinates];
  return polygons.some((polygon) => insidePolygon(point, polygon));
}

function address(tags) {
  const line = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const place = [tags["addr:postcode"], tags["addr:city"] || city.localName].filter(Boolean).join(" ");
  return [line, place].filter(Boolean).join(", ") || city.name;
}

function completeness(element) {
  const tags = element.tags ?? {};
  return ["addr:street", "addr:housenumber", "addr:postcode", "website", "contact:website"]
    .filter((key) => tags[key]).length;
}

function normalizedName(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

const input = JSON.parse(readFileSync(0, "utf8"));
const reasons = {
  [`outside-${city.id}`]: 0,
  "missing-name-or-coordinate": 0,
  "fusion-or-ambiguous": 0,
  "generic-or-food-type": 0,
  "multi-country": 0,
  duplicate: 0,
};
const outsideKey = `outside-${city.id}`;
const candidates = [];

for (const element of input.elements ?? []) {
  const tags = element.tags ?? {};
  const point = coordinate(element);
  if (!tags.name || !point) {
    reasons["missing-name-or-coordinate"] += 1;
    continue;
  }
  if (/\bfusion\b/i.test(tags.name)) {
    reasons["fusion-or-ambiguous"] += 1;
    continue;
  }
  if (!insideCity(point)) {
    reasons[outsideKey] += 1;
    continue;
  }
  const result = classify(tags.cuisine ?? "");
  if (!result.country) {
    reasons[result.reason] += 1;
    continue;
  }
  candidates.push({ element, tags, point, ...result });
}

// Two records with the same name within 60m are the same restaurant mapped twice; keep
// whichever carries more address/website detail.
const deduped = new Map();
for (const candidate of candidates) {
  const key = normalizedName(candidate.tags.name);
  const nearby = [...deduped.entries()].find(([, existing]) => {
    const dLat = (existing.point.lat - candidate.point.lat) * 111000;
    const dLng = (existing.point.lng - candidate.point.lng) * 74000;
    return normalizedName(existing.tags.name) === key && Math.hypot(dLat, dLng) < 60;
  });
  if (!nearby) deduped.set(`${key}-${candidate.element.id}`, candidate);
  else {
    reasons.duplicate += 1;
    if (completeness(candidate.element) > completeness(nearby[1].element)) {
      deduped.delete(nearby[0]);
      deduped.set(`${key}-${candidate.element.id}`, candidate);
    }
  }
}

const records = [...deduped.values()]
  .map(({ element, tags, point, country, region }) => ({
    id: `osm-${element.type}-${element.id}`,
    name: tags.name,
    countryId: country.id,
    country: country.name,
    continent: country.continent,
    countryLat: country.lat,
    countryLng: country.lng,
    flag: country.flag,
    symbol: country.symbol,
    regionId: region.id,
    region: region.name,
    originLat: region.lat,
    originLng: region.lng,
    cuisine: tags.cuisine,
    amenity: tags.amenity,
    address: address(tags),
    lat: Number(point.lat.toFixed(6)),
    lng: Number(point.lng.toFixed(6)),
    osmType: element.type,
    osmId: element.id,
    source: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  }))
  .sort((a, b) =>
    a.country.localeCompare(b.country) || a.region.localeCompare(b.region) || a.name.localeCompare(b.name),
  );

const meta = {
  cityId: city.id,
  cityName: city.name,
  snapshotDate: city.snapshotDate,
  source: "OpenStreetMap via Overpass API",
  sourceFeatures: input.elements?.length ?? 0,
  includedRestaurants: records.length,
  representedCountries: new Set(records.map((record) => record.countryId)).size,
  representedRegions: new Set(records.map((record) => `${record.countryId}/${record.regionId}`)).size,
  exclusions: reasons,
  definition: `Named ${city.name} amenity=restaurant and amenity=fast_food features with a country-specific or unambiguous country-origin cuisine tag; fusion, generic-only, multi-country and duplicate features excluded.`,
};

const countryTaxonomy = [...new Map(records.map((record) => [record.countryId, {
  id: record.countryId,
  name: record.country,
  continent: record.continent,
  lat: record.countryLat,
  lng: record.countryLng,
  flag: record.flag,
  symbol: record.symbol,
}])).values()];

const regionTaxonomy = [...new Map(records.map((record) => [`${record.countryId}/${record.regionId}`, {
  id: record.regionId,
  countryId: record.countryId,
  name: record.region,
  lat: record.originLat,
  lng: record.originLng,
}])).values()];

const compactRecords = records.map((record) => ({
  id: record.id,
  name: record.name,
  countryId: record.countryId,
  regionId: record.regionId,
  cuisine: record.cuisine,
  // Kept on the record so the audit can tell a sit-down restaurant from a counter-service
  // Imbiss without going back to OSM; format is evidence about the operation, not a filter.
  amenity: record.amenity,
  address: record.address,
  lat: record.lat,
  lng: record.lng,
  source: record.source,
}));

process.stdout.write(
  `export const datasetMeta=${JSON.stringify(meta)};\n` +
  `export const countryTaxonomy=${JSON.stringify(countryTaxonomy)};\n` +
  `export const regionTaxonomy=${JSON.stringify(regionTaxonomy)};\n` +
  `export const restaurants=${JSON.stringify(compactRecords)};\n`,
);
