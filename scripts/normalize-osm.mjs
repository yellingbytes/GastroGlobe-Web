import { readFileSync } from "node:fs";

const SNAPSHOT_DATE = "2026-07-18";
const boundary = JSON.parse(readFileSync(new URL("../data/munich-boundary.json", import.meta.url), "utf8"))[0].geojson;

const countries = {
  afghan: ["afghanistan", "Afghanistan", "Asia", 33.9391, 67.71, "🇦🇫", "🍚"],
  american: ["united-states", "United States", "Americas", 39.8283, -98.5795, "🇺🇸", "🍽️"],
  argentinian: ["argentina", "Argentina", "Americas", -38.4161, -63.6167, "🇦🇷", "🥩"],
  armenian: ["armenia", "Armenia", "Asia", 40.0691, 45.0382, "🇦🇲", "🍽️"],
  australian: ["australia", "Australia", "Oceania", -25.2744, 133.7751, "🇦🇺", "🍽️"],
  austrian: ["austria", "Austria", "Europe", 47.5162, 14.5501, "🇦🇹", "🥘"],
  bosnian: ["bosnia-herzegovina", "Bosnia & Herzegovina", "Europe", 43.9159, 17.6791, "🇧🇦", "🍽️"],
  brazilian: ["brazil", "Brazil", "Americas", -14.235, -51.9253, "🇧🇷", "🍽️"],
  british: ["united-kingdom", "United Kingdom", "Europe", 55.3781, -3.436, "🇬🇧", "🍽️"],
  bulgarian: ["bulgaria", "Bulgaria", "Europe", 42.7339, 25.4858, "🇧🇬", "🍽️"],
  chinese: ["china", "China", "Asia", 35.8617, 104.1954, "🇨🇳", "🥟"],
  croatian: ["croatia", "Croatia", "Europe", 45.1, 15.2, "🇭🇷", "🍽️"],
  czech: ["czechia", "Czechia", "Europe", 49.8175, 15.473, "🇨🇿", "🍽️"],
  eritrean: ["eritrea", "Eritrea", "Africa", 15.1794, 39.7823, "🇪🇷", "🫓"],
  ethiopian: ["ethiopia", "Ethiopia", "Africa", 9.145, 40.4897, "🇪🇹", "🫓"],
  french: ["france", "France", "Europe", 46.2276, 2.2137, "🇫🇷", "🍽️"],
  georgian: ["georgia", "Georgia", "Asia", 42.3154, 43.3569, "🇬🇪", "🥟"],
  german: ["germany", "Germany", "Europe", 51.1657, 10.4515, "🇩🇪", "🥘"],
  greek: ["greece", "Greece", "Europe", 39.0742, 21.8243, "🇬🇷", "🍽️"],
  guatemalan: ["guatemala", "Guatemala", "Americas", 15.7835, -90.2308, "🇬🇹", "🍽️"],
  hungarian: ["hungary", "Hungary", "Europe", 47.1625, 19.5033, "🇭🇺", "🍲"],
  indian: ["india", "India", "Asia", 20.5937, 78.9629, "🇮🇳", "🍛"],
  indonesian: ["indonesia", "Indonesia", "Asia", -0.7893, 113.9213, "🇮🇩", "🍚"],
  irish: ["ireland", "Ireland", "Europe", 53.1424, -7.6921, "🇮🇪", "🍽️"],
  israeli: ["israel", "Israel", "Asia", 31.0461, 34.8516, "🇮🇱", "🧆"],
  italian: ["italy", "Italy", "Europe", 41.8719, 12.5674, "🇮🇹", "🍝"],
  japanese: ["japan", "Japan", "Asia", 36.2048, 138.2529, "🇯🇵", "🍣"],
  korean: ["south-korea", "South Korea", "Asia", 35.9078, 127.7669, "🇰🇷", "🍲"],
  kyrghyz: ["kyrgyzstan", "Kyrgyzstan", "Asia", 41.2044, 74.7661, "🇰🇬", "🍽️"],
  lebanese: ["lebanon", "Lebanon", "Asia", 33.8547, 35.8623, "🇱🇧", "🧆"],
  malaysian: ["malaysia", "Malaysia", "Asia", 4.2105, 101.9758, "🇲🇾", "🍚"],
  mexican: ["mexico", "Mexico", "Americas", 23.6345, -102.5528, "🇲🇽", "🌮"],
  moroccan: ["morocco", "Morocco", "Africa", 31.7917, -7.0926, "🇲🇦", "🍲"],
  nepalese: ["nepal", "Nepal", "Asia", 28.3949, 84.124, "🇳🇵", "🥟"],
  pakistani: ["pakistan", "Pakistan", "Asia", 30.3753, 69.3451, "🇵🇰", "🍛"],
  persian: ["iran", "Iran", "Asia", 32.4279, 53.688, "🇮🇷", "🍚"],
  peruvian: ["peru", "Peru", "Americas", -9.19, -75.0152, "🇵🇪", "🐟"],
  portuguese: ["portugal", "Portugal", "Europe", 39.3999, -8.2245, "🇵🇹", "🐟"],
  romanian: ["romania", "Romania", "Europe", 45.9432, 24.9668, "🇷🇴", "🍽️"],
  russian: ["russia", "Russia", "Europe", 61.524, 105.3188, "🇷🇺", "🍽️"],
  spanish: ["spain", "Spain", "Europe", 40.4637, -3.7492, "🇪🇸", "🥘"],
  sri_lankan: ["sri-lanka", "Sri Lanka", "Asia", 7.8731, 80.7718, "🇱🇰", "🍛"],
  syrian: ["syria", "Syria", "Asia", 34.8021, 38.9968, "🇸🇾", "🧆"],
  thai: ["thailand", "Thailand", "Asia", 15.87, 100.9925, "🇹🇭", "🍜"],
  turkish: ["turkiye", "Türkiye", "Asia", 38.9637, 35.2433, "🇹🇷", "🥙"],
  ukrainian: ["ukraine", "Ukraine", "Europe", 48.3794, 31.1656, "🇺🇦", "🍲"],
  uyghur: ["china", "China", "Asia", 35.8617, 104.1954, "🇨🇳", "🍜"],
  vietnamese: ["vietnam", "Vietnam", "Asia", 14.0583, 108.2772, "🇻🇳", "🍜"],
};

const aliases = { bayrisch: "bavarian", uyghurisch: "uyghur" };
const regionTags = {
  bavarian: ["german", "bavaria", "Bavaria", 48.7904, 11.4979],
  franconian: ["german", "franconia", "Franconia", 49.45, 10.95],
  cantonese: ["chinese", "guangdong", "Guangdong · Cantonese", 23.379, 113.7633],
  pizza: ["italian", "campania-pizza", "Campania · Pizza", 40.8518, 14.2681],
  italian_pizza: ["italian", "campania-pizza", "Campania · Pizza", 40.8518, 14.2681],
  sushi: ["japanese", "sushi-tradition", "Sushi tradition", 35.6762, 139.6503],
  omakase: ["japanese", "sushi-tradition", "Sushi tradition", 35.6762, 139.6503],
  ramen: ["japanese", "ramen-tradition", "Ramen tradition", 43.0618, 141.3545],
  udon: ["japanese", "noodle-traditions", "Japanese noodle traditions", 34.3401, 134.0434],
  tapas: ["spanish", "tapas-tradition", "Tapas tradition", 40.4168, -3.7038],
};

const hardExclusions = new Set(["fusion", "japanese,peruvian", "kurdish", "senegambische (whatever this will be)"]);

function tokens(raw) {
  return raw.toLowerCase().split(/[;,]/).map((value) => aliases[value.trim()] ?? value.trim()).filter(Boolean);
}

function classify(raw) {
  const values = tokens(raw);
  if (values.some((value) => hardExclusions.has(value))) return { reason: "fusion-or-ambiguous" };
  const explicit = values.filter((value) => countries[value]);
  const regional = values.filter((value) => regionTags[value]);
  const candidates = [...explicit.map((tag) => countries[tag][0]), ...regional.map((tag) => countries[regionTags[tag][0]][0])];
  const ids = [...new Set(candidates)];
  if (!ids.length) return { reason: "generic-or-food-type" };
  if (ids.length > 1) return { reason: "multi-country" };

  const countryTag = explicit.find((tag) => countries[tag][0] === ids[0]) ?? regionTags[regional[0]]?.[0];
  const country = countries[countryTag];
  const chosenRegion = regional.map((tag) => regionTags[tag]).find((region) => countries[region[0]][0] === ids[0]);
  return {
    country: { id: country[0], name: country[1], continent: country[2], lat: country[3], lng: country[4], flag: country[5], symbol: country[6] },
    region: chosenRegion
      ? { id: chosenRegion[1], name: chosenRegion[2], lat: chosenRegion[3], lng: chosenRegion[4] }
      : { id: `${country[0]}-national`, name: "National cuisine", lat: country[3], lng: country[4] },
  };
}

function coordinate(element) {
  const point = element.type === "node" ? element : element.center;
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lon) ? { lat: point.lat, lng: point.lon } : null;
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

function insideMunich(point) {
  const polygons = boundary.type === "MultiPolygon" ? boundary.coordinates : [boundary.coordinates];
  return polygons.some((polygon) => insidePolygon(point, polygon));
}

function address(tags) {
  const line = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const city = [tags["addr:postcode"], tags["addr:city"] || "München"].filter(Boolean).join(" ");
  return [line, city].filter(Boolean).join(", ") || "Munich";
}

function completeness(element) {
  const tags = element.tags ?? {};
  return ["addr:street", "addr:housenumber", "addr:postcode", "website", "contact:website"].filter((key) => tags[key]).length;
}

function normalizedName(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

const input = JSON.parse(readFileSync(0, "utf8"));
const reasons = { "outside-munich": 0, "missing-name-or-coordinate": 0, "fusion-or-ambiguous": 0, "generic-or-food-type": 0, "multi-country": 0, duplicate: 0 };
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
  if (!insideMunich(point)) {
    reasons["outside-munich"] += 1;
    continue;
  }
  const result = classify(tags.cuisine ?? "");
  if (!result.country) {
    reasons[result.reason] += 1;
    continue;
  }
  candidates.push({ element, tags, point, ...result });
}

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

const records = [...deduped.values()].map(({ element, tags, point, country, region }) => ({
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
  address: address(tags),
  lat: Number(point.lat.toFixed(6)),
  lng: Number(point.lng.toFixed(6)),
  osmType: element.type,
  osmId: element.id,
  source: `https://www.openstreetmap.org/${element.type}/${element.id}`,
})).sort((a, b) => a.country.localeCompare(b.country) || a.region.localeCompare(b.region) || a.name.localeCompare(b.name));

const representedCountries = new Set(records.map((record) => record.countryId)).size;
const representedRegions = new Set(records.map((record) => `${record.countryId}/${record.regionId}`)).size;
const meta = {
  snapshotDate: SNAPSHOT_DATE,
  source: "OpenStreetMap via Overpass API",
  sourceFeatures: input.elements?.length ?? 0,
  includedRestaurants: records.length,
  representedCountries,
  representedRegions,
  exclusions: reasons,
  definition: "Named Munich amenity=restaurant features with a country-specific or unambiguous country-origin cuisine tag; fusion, generic-only, multi-country and duplicate features excluded.",
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
  address: record.address,
  lat: record.lat,
  lng: record.lng,
  source: record.source,
}));

process.stdout.write(`export const datasetMeta=${JSON.stringify(meta)};\nexport const countryTaxonomy=${JSON.stringify(countryTaxonomy)};\nexport const regionTaxonomy=${JSON.stringify(regionTaxonomy)};\nexport const restaurants=${JSON.stringify(compactRecords)};\n`);
