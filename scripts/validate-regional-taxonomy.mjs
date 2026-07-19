import { readFile } from "node:fs/promises";

import { restaurants } from "../data/munich-restaurants.js";

const taxonomyUrl = new URL("../data/munich-regional-cuisine-taxonomy.json", import.meta.url);
const taxonomy = JSON.parse(await readFile(taxonomyUrl, "utf8"));
const sourceById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
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
          errors.push(`${restaurant.id}: not found in the Munich source dataset.`);
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
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const countries = taxonomy.continents.flatMap((continent) => continent.countries);
  const regions = countries.flatMap((country) => country.regions);

  console.log(
    `Valid taxonomy: ${countries.length} countries, ${regions.length} regions, ${assignedRestaurantIds.size} classified restaurants.`,
  );
}
