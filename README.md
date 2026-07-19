# GastroGlobe Web — second-generation atlas

The web-focused second generation of GastroGlobe: an interactive cultural atlas for exploring the cuisines living inside metropolitan cities.

The original concept remains available at [yellingbytes/GastroGlobe](https://github.com/yellingbytes/GastroGlobe). This repository develops the spatial interaction model, semantic zoom, metropolitan editions, and real restaurant mapping independently.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:4317`.

The prototype is framework-free.

The Munich edition currently includes **1,198 named restaurants across 43 country cuisines** from an OpenStreetMap snapshot dated 18 July 2026. Every included record has sourced latitude/longitude data and links back to its OSM object.

“All” is defined reproducibly as named `amenity=restaurant` features whose `cuisine=*` tag resolves to one country or an unambiguous country-origin tradition inside Munich’s municipal boundary. The normalization pipeline excludes fusion tags, generic-only group labels such as `asian` or `international`, multi-country records, unnamed records, and nearby duplicate features.

The generated snapshot lives in `data/munich-restaurants.js`; `data/munich-regional-cuisine-taxonomy.json` supplies the researched regional hierarchy for China, Japan, Italy, India, Thailand, Mexico, Türkiye, Korea, Vietnam, France, and Spain. Restaurants without sufficient regional evidence remain in an explicit unclassified branch. `scripts/normalize-osm.mjs` contains the municipal-boundary filter, national cuisine normalization, exclusions, and de-duplication rules. Data is © OpenStreetMap contributors and available under the ODbL.

## Interaction model

The home screen presents one card per metropolitan edition, using a quiet continent-level treemap preview as its thumbnail. The current prototype seeds a different randomized composition for each city; these thumbnail areas are decorative and do not claim restaurant counts. Selecting a card opens the city atlas, which follows the [D3 zoomable treemap pattern](https://observablehq.com/@d3/zoomable-treemap):

1. Metropolitan editions
2. Continents inside a selected city
3. Countries inside a continent
4. Culinary regions inside a country
5. Sourced restaurants represented by each cuisine tradition

When a country has only one generic `National cuisine` category, GastroGlobe removes that redundant step and opens the country directly into its restaurants.

Rectangle area represents the number of loaded restaurant records. At the regional-cuisine layer, a small visual minimum keeps zero- and low-count traditions legible; the printed count remains authoritative. At every layer, a weighted geographic partition recursively separates children along their widest longitude or latitude spread. This preserves west/east and north/south neighborhoods. The header bar uses the standard zoomable-treemap interaction: select a child rectangle to drill down and select the header to drill up or return from a city to the metropolitan gallery. A selectable breadcrumb at the upper left exposes every active level and its siblings for direct jumps across cities, continents, countries, regions, and restaurants. Planned city cards open a zero-count continent view so absence remains explicit rather than hidden.

Continents use the five Olympic-ring hues as a GastroGlobe palette: Europe blue, Asia yellow, Africa black, Oceania green, and the Americas red. This color-to-continent mapping is a product convention, not an official Olympic assignment.

Continent, country, and regional/style layers can open directly on an interactive OpenStreetMap basemap. National/general restaurants use their country flag; recognized regional traditions use a representative food emoji. Nearby coordinates collapse into numbered clusters, and selecting a cluster zooms the map until more individual restaurants separate. The plotted points are native map layers, so they remain anchored to their OSM coordinates while panning or zooming. Every selected restaurant links to both its OSM source and Google Maps search.
