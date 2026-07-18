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

The generated snapshot lives in `data/munich-restaurants.js`; `scripts/normalize-osm.mjs` contains the auditable cuisine taxonomy, municipal-boundary filter, exclusions, and de-duplication rules. Data is © OpenStreetMap contributors and available under the ODbL.

## Interaction model

The primary interface follows the [D3 zoomable circle-packing pattern](https://observablehq.com/@d3/zoomable-circle-packing):

1. Metropolitan editions
2. Continents inside a selected city
3. Countries inside a continent
4. Culinary regions inside a country
5. Sourced restaurants represented by each cuisine tradition

Circle area represents the number of loaded restaurant records. At every layer, the packed arrangement is rotated and reflected toward the latitude/longitude bearings of its children, preserving circle containment while making the hierarchy geographically coherent. Exact projected positions would conflict with non-overlapping, count-scaled circles, so direction is geographic while spacing remains packed. Dashed metropolitan rings are planned editions without loaded data.

Continents use the five Olympic-ring hues as a GastroGlobe palette: Europe blue, Asia yellow, Africa black, Oceania green, and the Americas red. This color-to-continent mapping is a product convention, not an official Olympic assignment.

Continent, country, and regional/style layers can open directly on the Munich Google Maps basemap. National/general restaurants use their country flag; recognized regional traditions use a representative food emoji. Nearby coordinates collapse into numbered clusters, and selecting a cluster zooms the map until more individual restaurants separate. The plotted points retain the OSM coordinates, and every selected restaurant links to both its OSM source and Google Maps search. No Google Maps API key is needed for the embedded basemap.
