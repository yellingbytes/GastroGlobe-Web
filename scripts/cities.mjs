// Every metropolitan edition that has (or is being given) a real dataset.
// `boundary` is a Nominatim search response saved verbatim; the first result's `geojson`
// is used to test whether a restaurant actually falls inside the city.
export const cities = {
  munich: {
    id: "munich",
    name: "Munich",
    localName: "München",
    boundary: "../data/munich-boundary.json",
    dataset: "../data/munich-restaurants.js",
    snapshotDate: "2026-07-18",
  },
  berlin: {
    id: "berlin",
    name: "Berlin",
    localName: "Berlin",
    boundary: "../data/berlin-boundary.json",
    dataset: "../data/berlin-restaurants.js",
    snapshotDate: "2026-08-25",
  },
};

export function requireCity(id) {
  const city = cities[id];
  if (!city) {
    throw new Error(`Unknown city "${id}". Known cities: ${Object.keys(cities).join(", ")}.`);
  }
  return city;
}
