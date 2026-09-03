// Turns a Google Maps place-list CSV into a GastroGlobe city dataset.
//
// The CSV may contain multiline quoted fields, so parsing is delegated to d3-dsv rather than
// line-by-line string handling. Classification deliberately follows the OSM importer: keep only
// named places that resolve to one country cuisine or an unambiguous country-origin tradition;
// exclude fusion, generic-only, multi-country, duplicate, and out-of-city records.
//
//   node scripts/normalize-google-places-csv.mjs \
//     /path/to/restaurant-in-new-york-city.csv data/new-york-restaurants.js

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { csvParse } from "d3-dsv";

import { aliases, countries, regionTags } from "./cuisine-taxonomy.mjs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/normalize-google-places-csv.mjs <input.csv> <output.js>");
  process.exit(1);
}

const categoryRules = new Map();

function normalizeCategory(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cuisineTagForCategory(category) {
  return normalizeCategory(category)
    .replace(/\s+(?:restaurant|cuisine restaurant)$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function addCategories(countryTag, categories, regionTag = null) {
  for (const category of categories) {
    categoryRules.set(normalizeCategory(category), {
      countryTag: aliases[countryTag] ?? countryTag,
      regionTag,
      cuisineTag: cuisineTagForCategory(category),
    });
  }
}

// Country-explicit Google categories. Modified labels stay here only when the modifier does not
// change the country identity (for example, "Modern Indian" or "Authentic Japanese").
addCategories("afghan", ["Afghan restaurant"]);
addCategories("albanian", ["Albanian restaurant"]);
addCategories("algerian", ["Algerian restaurant"]);
addCategories("american", ["American restaurant", "New American restaurant", "Traditional American restaurant"]);
addCategories("argentinian", ["Argentinian restaurant"]);
addCategories("armenian", ["Armenian restaurant"]);
addCategories("australian", ["Australian restaurant"]);
addCategories("austrian", ["Austrian restaurant"]);
addCategories("azerbaijani", ["Azerbaijani restaurant"]);
addCategories("bangladeshi", ["Bangladeshi restaurant"]);
addCategories("belgian", ["Belgian restaurant"]);
addCategories("bolivian", ["Bolivian restaurant"]);
addCategories("bosnian", ["Bosnian restaurant"]);
addCategories("brazilian", ["Brazilian restaurant"]);
addCategories("british", ["British restaurant", "English restaurant"]);
addCategories("bulgarian", ["Bulgarian restaurant"]);
addCategories("burmese", ["Burmese restaurant"]);
addCategories("cambodian", ["Cambodian restaurant"]);
addCategories("canadian", ["Canadian restaurant"]);
addCategories("chinese", ["Chinese restaurant", "Delivery Chinese restaurant", "Chinese noodle restaurant", "Mandarin restaurant"]);
addCategories("chilean", ["Chilean restaurant"]);
addCategories("colombian", ["Colombian restaurant"]);
addCategories("congolese", ["Congolese restaurant"]);
addCategories("croatian", ["Croatian restaurant"]);
addCategories("cuban", ["Cuban restaurant"]);
addCategories("cypriot", ["Cypriot restaurant"]);
addCategories("czech", ["Czech restaurant"]);
addCategories("dominican", ["Dominican restaurant"]);
addCategories("dutch", ["Dutch restaurant"]);
addCategories("ecuadorian", ["Ecuadorian restaurant"]);
addCategories("egyptian", ["Egyptian restaurant"]);
addCategories("eritrean", ["Eritrean restaurant"]);
addCategories("ethiopian", ["Ethiopian restaurant"]);
addCategories("filipino", ["Filipino restaurant"]);
addCategories("french", ["French restaurant", "Modern French restaurant", "Haute French restaurant", "French steakhouse restaurant"]);
addCategories("gambian", ["Gambian restaurant"]);
addCategories("georgian", ["Georgian restaurant"]);
addCategories("german", ["German restaurant"]);
addCategories("greek", ["Greek restaurant"]);
addCategories("guatemalan", ["Guatemalan restaurant"]);
addCategories("haitian", ["Haitian restaurant"]);
addCategories("honduran", ["Honduran restaurant"]);
addCategories("hungarian", ["Hungarian restaurant"]);
addCategories("indian", ["Indian restaurant", "Modern Indian restaurant", "Indian Muslim restaurant", "Mughlai restaurant"]);
addCategories("indonesian", ["Indonesian restaurant"]);
addCategories("iraqi", ["Iraqi restaurant"]);
addCategories("irish", ["Irish restaurant"]);
addCategories("israeli", ["Israeli restaurant"]);
addCategories("italian", ["Italian restaurant"]);
addCategories("japanese", [
  "Japanese restaurant", "Authentic Japanese restaurant", "Japanese curry restaurant",
  "Japanese regional restaurant", "Japanese sweets restaurant", "Izakaya restaurant",
  "Modern izakaya restaurant", "Teppanyaki restaurant", "Tempura restaurant",
  "Tempura donburi restaurant", "Yakiniku restaurant", "Yakitori restaurant",
  "Shabu-shabu restaurant", "Sukiyaki and Shabu Shabu restaurant", "Donburi restaurant",
  "Seafood donburi restaurant", "Gyudon restaurant", "Kaiseki restaurant", "Katsudon restaurant",
  "Tonkatsu restaurant", "Yakisoba Restaurant", "Sashimi restaurant", "Temaki restaurant",
  "Unagi restaurant", "Syokudo and Teishoku restaurant", "Conveyor belt sushi restaurant",
]);
addCategories("kazakhstani", ["Kazakhstani restaurant"]);
addCategories("korean", [
  "Korean restaurant", "Korean barbecue restaurant", "Korean beef restaurant",
  "Korean rib restaurant", "Gimbap restaurant", "Gopchang restaurant", "Gomtang restaurant",
]);
addCategories("kyrghyz", ["Kyrgyz restaurant"]);
addCategories("lao", ["Laotian restaurant"]);
addCategories("lebanese", ["Lebanese restaurant"]);
addCategories("lithuanian", ["Lithuanian restaurant"]);
addCategories("malaysian", ["Malaysian restaurant"]);
addCategories("mexican", ["Mexican restaurant", "Taco restaurant", "Burrito restaurant", "Mexican torta restaurant"]);
addCategories("mongolian", ["Mongolian restaurant"]);
addCategories("moroccan", ["Moroccan restaurant"]);
addCategories("nepalese", ["Nepalese restaurant"]);
addCategories("nigerian", ["Nigerian restaurant"]);
addCategories("norwegian", ["Norwegian restaurant"]);
addCategories("pakistani", ["Pakistani restaurant"]);
addCategories("palestinian", ["Palestinian restaurant"]);
addCategories("paraguayan", ["Paraguayan restaurant"]);
addCategories("persian", ["Persian restaurant"]);
addCategories("peruvian", ["Peruvian restaurant"]);
addCategories("polish", ["Polish restaurant"]);
addCategories("portuguese", ["Portuguese restaurant"]);
addCategories("puerto_rican", ["Puerto Rican restaurant"]);
addCategories("romanian", ["Romanian restaurant"]);
addCategories("russian", ["Russian restaurant"]);
addCategories("salvadoran", ["Salvadoran restaurant"]);
addCategories("serbian", ["Serbian restaurant"]);
addCategories("singaporean", ["Singaporean restaurant"]);
addCategories("slovak", ["Slovak restaurant"]);
addCategories("south_african", ["South African restaurant"]);
addCategories("spanish", ["Spanish restaurant"]);
addCategories("sri_lankan", ["Sri Lankan restaurant"]);
addCategories("sudanese", ["Sudanese restaurant"]);
addCategories("surinamese", ["Surinamese restaurant"]);
addCategories("swedish", ["Swedish restaurant"]);
addCategories("swiss", ["Swiss restaurant"]);
addCategories("syrian", ["Syrian restaurant"]);
addCategories("thai", ["Thai restaurant"]);
addCategories("tunisian", ["Tunisian restaurant"]);
addCategories("turkish", ["Turkish restaurant"]);
addCategories("ukrainian", ["Ukrainian restaurant"]);
addCategories("uruguayan", ["Uruguayan restaurant"]);
addCategories("uzbek", ["Uzbeki restaurant", "Uzbek restaurant"]);
addCategories("venezuelan", ["Venezuelan restaurant"]);
addCategories("vietnamese", ["Vietnamese restaurant", "Pho restaurant"]);
addCategories("yemeni", ["Yemeni restaurant"]);

// Regional and country-origin traditions that Google exposes as their own categories.
addCategories("chinese", ["Cantonese restaurant"], "cantonese");
addCategories("chinese", ["Dim sum restaurant"], "dim_sum");
addCategories("chinese", ["Fujian restaurant"], "fujian");
addCategories("chinese", ["Hakka restaurant"], "hakka");
addCategories("chinese", ["Hong Kong style fast food restaurant"], "hong_kong");
addCategories("chinese", ["Hunan restaurant"], "hunan");
addCategories("chinese", ["Shanghainese restaurant"], "shanghainese");
addCategories("chinese", ["Sichuan restaurant", "Dan Dan noodle restaurant"], "sichuan");
addCategories("chinese", ["Taiwanese restaurant"], "taiwanese");
addCategories("chinese", ["Tibetan restaurant"], "tibetan");
addCategories("chinese", ["Uyghur cuisine restaurant"], "uyghur");
addCategories("italian", ["Pizza restaurant"], "pizza");
addCategories("italian", ["Neapolitan restaurant"], "neapolitan");
addCategories("italian", ["Northern Italian restaurant"], "northern_italian");
addCategories("italian", ["Roman restaurant"], "roman");
addCategories("italian", ["Sardinian restaurant"], "sardinian");
addCategories("italian", ["Sicilian restaurant"], "sicilian");
addCategories("italian", ["Southern Italian restaurant"], "southern_italian");
addCategories("italian", ["Tuscan restaurant"], "tuscan");
addCategories("italian", ["Venetian restaurant"], "venetian");
addCategories("japanese", ["Sushi restaurant"], "sushi");
addCategories("japanese", ["Ramen restaurant"], "ramen");
addCategories("japanese", ["Udon noodle restaurant"], "udon");
addCategories("spanish", ["Tapas restaurant"], "tapas");
addCategories("spanish", ["Basque restaurant"], "basque");
addCategories("spanish", ["Galician restaurant"], "galician");
addCategories("indian", ["South Indian restaurant"], "south_indian");
addCategories("indian", ["Bengali restaurant"], "bengal");
addCategories("indian", ["Goan restaurant"], "goan");
addCategories("indian", ["Gujarati restaurant"], "gujarati");
addCategories("indian", ["Hyderabadi restaurant"], "hyderabadi");
addCategories("indian", ["North Indian restaurant", "North Eastern Indian restaurant"], "north_indian");
addCategories("indian", ["Punjabi restaurant"], "punjabi");
addCategories("mexican", ["Oaxacan restaurant"], "oaxacan");
addCategories("american", ["Cajun restaurant", "Contemporary Louisiana restaurant"], "cajun");
addCategories("american", ["Californian restaurant"], "californian");
addCategories("american", ["Hawaiian restaurant"], "hawaiian");
addCategories("american", ["New England restaurant"], "new_england");
addCategories("american", ["Pacific Northwest restaurant (US)"], "pacific_northwest");
addCategories("american", ["Soul food restaurant"], "soul_food");
addCategories("american", ["Southern restaurant (US)"], "southern_us");
addCategories("american", ["Southwestern restaurant (US)"], "southwestern_us");

const hardExclusionPattern = /\b(?:fusion|nikkei|tex-mex)\b/i;

function categoryValues(row) {
  return [...new Set([
    row.main_category,
    ...String(row.categories ?? "").split(","),
  ].map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function classify(row) {
  const categories = categoryValues(row);
  if (categories.some((category) => hardExclusionPattern.test(category))) {
    return { reason: "fusion-or-ambiguous" };
  }
  const matches = categories.map((category) => categoryRules.get(normalizeCategory(category))).filter(Boolean);
  const countryIds = [...new Set(matches.map((match) => countries[match.countryTag]?.[0]).filter(Boolean))];
  if (!countryIds.length) return { reason: "generic-or-food-type" };
  if (countryIds.length > 1) return { reason: "multi-country" };

  const match = matches.find((candidate) => countries[candidate.countryTag]?.[0] === countryIds[0]);
  const country = countries[match.countryTag];
  const regionalMatch = matches.find((candidate) => candidate.regionTag && regionTags[candidate.regionTag]);
  const region = regionalMatch
    ? regionTags[regionalMatch.regionTag]
    : [match.countryTag, `${country[0]}-national`, "National cuisine", country[3], country[4]];
  const cuisine = [...new Set(matches.map((candidate) => candidate.cuisineTag).filter(Boolean))].join(";");
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
    region: {
      id: region[1],
      name: region[2],
      lat: region[3],
      lng: region[4],
    },
    cuisine,
  };
}

function coordinates(link) {
  const match = String(link ?? "").match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function nycPostalCode(address) {
  return String(address ?? "").match(/\bNY\s+(\d{5})(?:-\d{4})?\b/i)?.[1] ?? null;
}

function isNewYorkCityPostalCode(postalCode) {
  const zip = Number(postalCode);
  return (
    (zip >= 10001 && zip <= 10282) ||
    (zip >= 10301 && zip <= 10314) ||
    (zip >= 10451 && zip <= 10475) ||
    zip === 11004 || zip === 11005 ||
    (zip >= 11101 && zip <= 11109) ||
    (zip >= 11201 && zip <= 11256) ||
    (zip >= 11351 && zip <= 11697)
  );
}

function insideNewYorkCity(row, point) {
  const postalCode = nycPostalCode(row.address);
  if (postalCode) return isNewYorkCityPostalCode(postalCode);
  // A location with no usable address is accepted only inside a conservative NYC envelope.
  return !String(row.address ?? "").trim() &&
    point.lat >= 40.49 && point.lat <= 40.92 && point.lng >= -74.26 && point.lng <= -73.70;
}

function numberOrNull(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

const rows = csvParse(readFileSync(inputPath, "utf8"));
const reasons = {
  "outside-new-york": 0,
  "missing-name-coordinate-or-place-id": 0,
  "temporarily-closed": 0,
  "fusion-or-ambiguous": 0,
  "generic-or-food-type": 0,
  "multi-country": 0,
  duplicate: 0,
};
const records = [];
const seenPlaceIds = new Set();

for (const row of rows) {
  const name = String(row.name ?? "").trim();
  const placeId = String(row.place_id ?? "").trim();
  const point = coordinates(row.link);
  if (!name || !placeId || !point) {
    reasons["missing-name-coordinate-or-place-id"] += 1;
    continue;
  }
  if (!insideNewYorkCity(row, point)) {
    reasons["outside-new-york"] += 1;
    continue;
  }
  if (String(row.is_temporarily_closed ?? "").trim()) {
    reasons["temporarily-closed"] += 1;
    continue;
  }
  if (seenPlaceIds.has(placeId)) {
    reasons.duplicate += 1;
    continue;
  }
  seenPlaceIds.add(placeId);

  if (/\bfusion\b/i.test(name)) {
    reasons["fusion-or-ambiguous"] += 1;
    continue;
  }

  const classification = classify(row);
  if (!classification.country) {
    reasons[classification.reason] += 1;
    continue;
  }

  records.push({
    id: `google-${placeId}`,
    name,
    countryId: classification.country.id,
    regionId: classification.region.id,
    cuisine: classification.cuisine,
    address: String(row.address ?? "").trim() || "New York",
    lat: Number(point.lat.toFixed(7)),
    lng: Number(point.lng.toFixed(7)),
    placeId,
    rating: numberOrNull(row.rating),
    reviewCount: numberOrNull(row.reviews),
    source: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`,
    _country: classification.country,
    _region: classification.region,
  });
}

records.sort((a, b) =>
  a._country.name.localeCompare(b._country.name) ||
  a._region.name.localeCompare(b._region.name) ||
  a.name.localeCompare(b.name),
);

const countryTaxonomy = [...new Map(records.map((record) => [record.countryId, record._country])).values()];
const regionTaxonomy = [...new Map(records.map((record) => [`${record.countryId}/${record.regionId}`, {
  id: record._region.id,
  countryId: record.countryId,
  name: record._region.name,
  lat: record._region.lat,
  lng: record._region.lng,
}])).values()];
const compactRecords = records.map(({ _country, _region, ...record }) => record);
const snapshotDate = statSync(inputPath).mtime.toISOString().slice(0, 10);
const datasetMeta = {
  cityId: "new-york",
  cityName: "New York",
  snapshotDate,
  source: "Google Maps listing export",
  countryCode: "US",
  sourceFeatures: rows.length,
  includedRestaurants: compactRecords.length,
  representedCountries: countryTaxonomy.length,
  representedRegions: regionTaxonomy.length,
  exclusions: reasons,
  definition: "Named New York City places in the supplied Google Maps export that resolve to one country-specific or unambiguous country-origin cuisine; fusion, generic-only, multi-country, temporarily closed, duplicate, and non-NYC records excluded.",
};

writeFileSync(
  outputPath,
  `export const datasetMeta=${JSON.stringify(datasetMeta)};\n` +
  `export const countryTaxonomy=${JSON.stringify(countryTaxonomy)};\n` +
  `export const regionTaxonomy=${JSON.stringify(regionTaxonomy)};\n` +
  `export const restaurants=${JSON.stringify(compactRecords)};\n`,
);

console.error(JSON.stringify(datasetMeta, null, 2));
