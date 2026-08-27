// Checks every city's regional cuisine taxonomy against its own source dataset.
//
//   node scripts/validate-regional-taxonomy.mjs           # all cities
//   node scripts/validate-regional-taxonomy.mjs berlin    # one city
//
// Verifies that region counts match their restaurant lists, that classified plus
// unclassified equals the source count, that every referenced restaurant exists and is not
// claimed twice, and that names agree with the source dataset.

import { readFile } from "node:fs/promises";

import * as munichSource from "../data/munich-restaurants.js";
import * as berlinSource from "../data/berlin-restaurants.js";
import {
  applyMunichChinaEditorialUpdate,
  applyMunichChinaTaxonomyUpdate,
} from "../data/munich-china-editorial-overrides.js";
import { applyMunichRichCuisineTaxonomyUpdate } from "../data/munich-rich-cuisine-editorial-overrides.js";
import { applyBerlinEditorialUpdate } from "../data/berlin-regional-findings.js";

const editions = [
  {
    id: "munich",
    source: munichSource,
    taxonomyFile: "../data/munich-regional-cuisine-taxonomy.json",
    applyEditorialUpdates: (dataset) => applyMunichChinaEditorialUpdate(dataset),
    applyTaxonomyUpdates: (taxonomy, dataset) => {
      applyMunichChinaTaxonomyUpdate(taxonomy, dataset.restaurants);
      applyMunichRichCuisineTaxonomyUpdate(taxonomy, dataset.restaurants);
    },
  },
  {
    id: "berlin",
    source: berlinSource,
    taxonomyFile: "../data/berlin-regional-cuisine-taxonomy.json",
    applyEditorialUpdates: (dataset) => applyBerlinEditorialUpdate(dataset),
  },
];

const requested = process.argv[2];
const selected = requested ? editions.filter((edition) => edition.id === requested) : editions;
if (!selected.length) {
  console.error(`Unknown city "${requested}". Known: ${editions.map((edition) => edition.id).join(", ")}.`);
  process.exit(1);
}

let failed = false;

for (const edition of selected) {
  const dataset = {
    datasetMeta: { ...edition.source.datasetMeta },
    countryTaxonomy: edition.source.countryTaxonomy.map((country) => ({ ...country })),
    regionTaxonomy: edition.source.regionTaxonomy.map((region) => ({ ...region })),
    restaurants: edition.source.restaurants.map((restaurant) => ({ ...restaurant })),
  };
  edition.applyEditorialUpdates?.(dataset);

  const taxonomy = JSON.parse(await readFile(new URL(edition.taxonomyFile, import.meta.url), "utf8"));
  edition.applyTaxonomyUpdates?.(taxonomy, dataset);

  const sourceById = new Map(dataset.restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const assignedRestaurantIds = new Set();
  const errors = [];

  for (const continent of taxonomy.continents) {
    for (const country of continent.countries) {
      let classifiedCount = 0;

      for (const region of country.regions) {
        if (region.restaurantCount !== region.restaurants.length) {
          errors.push(
            `${country.country} / ${region.name}: restaurantCount is ${region.restaurantCount}, but the list contains ${region.restaurants.length}.`,
          );
        }

        classifiedCount += region.restaurants.length;

        for (const restaurant of region.restaurants) {
          const sourceRestaurant = sourceById.get(restaurant.id);

          if (!sourceRestaurant) {
            errors.push(`${restaurant.id}: not found in the ${edition.id} source dataset.`);
            continue;
          }

          if (assignedRestaurantIds.has(restaurant.id)) {
            errors.push(`${restaurant.id}: assigned to more than one regional cuisine.`);
          }
          assignedRestaurantIds.add(restaurant.id);

          if (sourceRestaurant.name !== restaurant.name) {
            errors.push(
              `${restaurant.id}: taxonomy name “${restaurant.name}” does not match source name “${sourceRestaurant.name}”.`,
            );
          }
        }
      }

      if (country.classifiedRestaurantCount !== classifiedCount) {
        errors.push(
          `${country.country}: classifiedRestaurantCount is ${country.classifiedRestaurantCount}, calculated ${classifiedCount}.`,
        );
      }

      if (classifiedCount + country.unclassifiedRestaurantCount !== country.sourceRestaurantCount) {
        errors.push(
          `${country.country}: classified and unclassified counts do not add up to sourceRestaurantCount.`,
        );
      }

      const actualCountryCount = dataset.restaurants.filter(
        (restaurant) => restaurant.countryId === countryIdFor(dataset, country),
      ).length;
      if (actualCountryCount && country.sourceRestaurantCount !== actualCountryCount) {
        errors.push(
          `${country.country}: sourceRestaurantCount is ${country.sourceRestaurantCount}, but the dataset holds ${actualCountryCount} restaurants for it.`,
        );
      }
    }
  }

  const countries = taxonomy.continents.flatMap((continent) => continent.countries);
  const regions = countries.flatMap((country) => country.regions);

  if (errors.length) {
    failed = true;
    console.error(`✗ ${edition.id}:\n  ${errors.join("\n  ")}`);
  } else {
    console.log(
      `✓ ${edition.id}: ${dataset.restaurants.length} restaurants, ${countries.length} countries in taxonomy, ${regions.length} regions, ${assignedRestaurantIds.size} classified.`,
    );
  }
}

function countryIdFor(dataset, country) {
  const match = dataset.countryTaxonomy.find(
    (candidate) => candidate.name === country.country || candidate.flag === country.emoji,
  );
  return match?.id ?? null;
}

if (failed) process.exitCode = 1;
