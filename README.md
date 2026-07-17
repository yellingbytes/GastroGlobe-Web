# GastroGlobe Web — second-generation atlas

The web-focused second generation of GastroGlobe: an interactive cultural atlas for exploring the cuisines living inside metropolitan cities.

The original concept remains available at [yellingbytes/GastroGlobe](https://github.com/yellingbytes/GastroGlobe). This repository develops the spatial interaction model, semantic zoom, metropolitan editions, and real restaurant mapping independently.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:4317`.

The prototype is framework-free.

The Munich edition opens on a Google Maps basemap of Munich with the culinary world topology overlaid on the city. It includes 16 sourced restaurants with latitude/longitude data in `restaurants.js`; the final layer resolves those coordinates into Web Mercator-projected restaurant markers.

## Recommended v2 interaction direction

1. Open with a tile index of metropolitan cities—no map yet.
2. Selecting a city reveals its topological world of culinary origins.
3. Semantic zoom expands an origin into country and regional cuisine traditions.
4. The physical map appears only at the final layer, where traditions resolve into real restaurant addresses.

This keeps the concept editorial at the entrance, makes the topology the main discovery interface, and reserves Google Maps for the moment exact location becomes useful.

## Optional interactive Google Maps

Select **Google Maps setup** in the restaurant layer and enter a browser-restricted Google Maps JavaScript API key. Enable the Maps JavaScript API and allow the referrer:

```text
http://localhost:4317/*
```

The key is kept in browser `localStorage`; it is not written into the repository.
