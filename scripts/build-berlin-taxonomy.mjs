// Builds data/berlin-regional-cuisine-taxonomy.json from the Berlin base dataset plus the
// hand-researched findings in data/berlin-regional-findings.js.
//
//   node scripts/build-berlin-taxonomy.mjs > data/berlin-regional-cuisine-taxonomy.json
//
// For a completed audit, regions with zero verified restaurants are kept in the output: an
// absence that was actually looked for is a finding, and the map draws it as such. A country
// marked `zeroCountsMeaningful: false` is still mid-audit, so its empty regions are withheld
// — claiming "searched, none found" for a region nobody has searched yet would be false.

import { readFileSync } from "node:fs";

import { countryTaxonomy, restaurants } from "../data/berlin-restaurants.js";
import { regionalFindings, excludedRestaurants } from "../data/berlin-regional-findings.js";

const SNAPSHOT = "2026-08-25";
const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
const countryById = new Map(countryTaxonomy.map((country) => [country.id, country]));

const continents = new Map();

for (const [countryId, definition] of Object.entries(regionalFindings)) {
  const country = countryById.get(countryId);
  if (!country) {
    console.error(`Skipping unknown country "${countryId}" in findings.`);
    continue;
  }
  const excludedForCountry = new Set(
    (excludedRestaurants[countryId] ?? []).map((entry) => entry.id),
  );
  const countryRestaurants = restaurants.filter(
    (restaurant) => restaurant.countryId === countryId && !excludedForCountry.has(restaurant.id),
  );

  const seen = new Set();
  const regions = definition.regions.map((region) => {
    const verified = (region.restaurants ?? []).filter((entry) => {
      const source = restaurantById.get(entry.id);
      if (!source) {
        console.error(`Findings reference unknown restaurant id ${entry.id} (${entry.name}).`);
        return false;
      }
      if (source.countryId !== countryId) {
        console.error(`${entry.id} is ${source.countryId}, not ${countryId}.`);
        return false;
      }
      if (excludedForCountry.has(entry.id)) {
        console.error(`${entry.id} is both classified and excluded.`);
        return false;
      }
      if (seen.has(entry.id)) {
        console.error(`${entry.id} assigned to more than one region.`);
        return false;
      }
      seen.add(entry.id);
      return true;
    }).map((entry) => ({
      id: entry.id,
      name: restaurantById.get(entry.id).name,
      evidenceLevel: entry.evidenceLevel,
      evidence: entry.evidence,
      sourceUrls: entry.sourceUrls,
    }));

    return {
      name: region.name,
      emoji: region.emoji,
      geographicCenter: region.geographicCenter,
      restaurantCount: verified.length,
      restaurants: verified,
    };
  });

  // Two independent questions, which an earlier version of this script conflated:
  //   1. may empty regions be published?  -> only if they were actually searched for
  //   2. is the audit finished?           -> only if no records are still pending
  // China answers yes to (1) and no to (2): its zero counts are a real finding across every
  // record examined so far, but the counter-service records the widened query added have not
  // been reached yet. Vietnam answers no to both. Tying the two together would either hide
  // China's genuine absences or assert Vietnam's unsearched ones.
  const publishEmptyRegions = definition.zeroCountsMeaningful !== false;
  const publishedRegions = publishEmptyRegions ? regions : regions.filter((region) => region.restaurantCount > 0);
  const auditedCount = definition.auditedRestaurantCount ?? countryRestaurants.length;
  const pendingAuditCount = countryRestaurants.length - auditedCount;
  const partialAudit = pendingAuditCount > 0;

  const entry = {
    country: country.name,
    emoji: country.flag,
    sourceRestaurantCount: countryRestaurants.length,
    classifiedRestaurantCount: seen.size,
    unclassifiedRestaurantCount: countryRestaurants.length - seen.size,
    auditNote: definition.auditNote,
    regions: publishedRegions,
  };

  if (partialAudit) {
    // Splits "unclassified" into the part that was actually checked and the part that has
    // not been reached yet, so the two are never read as the same thing.
    entry.auditStatus = "in-progress";
    // auditedRestaurantCount counts records that were researched AND remain in the country
    // set; examinedRecordCount also counts the ones the audit removed. Subtracting the wrong
    // one from sourceRestaurantCount silently misstates how much is left to do.
    entry.examinedRecordCount = definition.examinedRecordCount;
    entry.auditedRestaurantCount = auditedCount;
    entry.pendingAuditCount = pendingAuditCount;
    entry.zeroCountsMeaningful = publishEmptyRegions;
  }

  if (!continents.has(country.continent)) continents.set(country.continent, []);
  continents.get(country.continent).push(entry);
}

const taxonomy = {
  schemaVersion: "1.0.0",
  city: "Berlin",
  country: "Germany",
  datasetSnapshot: SNAPSHOT,
  generatedAt: SNAPSHOT,
  sourceDataset: "data/berlin-restaurants.js",
  hierarchy: ["World", "Continent", "Country", "Regional Cuisine", "Restaurant"],
  methodology: {
    purpose: "Represent culinary diversity rather than political geography.",
    classificationRule:
      "A restaurant is assigned to exactly one regional cuisine only when its own website, menu, official social profile, or several independent public sources support that assignment. An OpenStreetMap cuisine tag on its own is treated as a candidate to verify, not as evidence. Dish formats alone do not establish regional identity.",
    exclusions: ["generic Asian", "fusion", "buffet", "pan-Asian", "pan-national restaurant without a dominant regional identity"],
    zeroCounts:
      "Taxonomically meaningful regional cuisines remain present when no dedicated Berlin restaurant could be verified.",
    unclassified:
      "Restaurants that are nationally tagged but lack adequate regional evidence remain outside regional counts. They are not evidence that the regional tradition is absent, only that it is not verified in this snapshot.",
    politicalGeographyNote:
      "Culinary regions may cross modern borders. The Fujian–Taiwan culinary family and the Tibetan tradition are grouped under China for analytical continuity and make no sovereignty claim.",
    evidenceLevels: {
      high: "First-party restaurant website, menu or official social profile explicitly names the regional cuisine.",
      medium:
        "Several independent public sources agree on the region, the menu repeatedly and dominantly reflects one tradition, or chef/founder origin is documented.",
    },
  },
  continents: [...continents.entries()].map(([name, countries]) => ({
    name,
    countries: countries.sort((a, b) => b.sourceRestaurantCount - a.sourceRestaurantCount),
  })),
};

process.stdout.write(`${JSON.stringify(taxonomy, null, 2)}\n`);
