const UPDATE_DATE = "2026-08-02";

const CHINA_REGIONS = [
  { id: "sichuan", name: "Sichuan · Chongqing", taxonomyName: "Sichuan / Chongqing", emoji: "🌶️", lat: 30.65, lng: 104.07 },
  { id: "hunan", name: "Hunan", taxonomyName: "Hunan", emoji: "🥘", lat: 28.23, lng: 112.94 },
  { id: "guangdong", name: "Guangdong · Cantonese", taxonomyName: "Cantonese / Guangdong", emoji: "🥢", lat: 23.13, lng: 113.26 },
  { id: "jiangsu-zhejiang-shanghai", name: "Jiangsu · Zhejiang · Shanghai", taxonomyName: "Jiangsu / Zhejiang / Shanghai", emoji: "🍜", lat: 31.2, lng: 120.6 },
  { id: "northern-china", name: "Northern China · Beijing", taxonomyName: "Northern China / Beijing", emoji: "🥟", lat: 39.9, lng: 116.4 },
  { id: "northeast-china", name: "Northeast China · Dongbei", taxonomyName: "Northeast / Dongbei", emoji: "🍲", lat: 43.9, lng: 125.3 },
  { id: "shanxi-shaanxi-noodles", name: "Shanxi · Shaanxi noodles", taxonomyName: "Shanxi / Shaanxi noodles", emoji: "🍝", lat: 34.3416, lng: 108.9398 },
  { id: "gansu-lanzhou", name: "Gansu · Lanzhou", taxonomyName: "Gansu / Lanzhou", emoji: "🍜", lat: 36.0611, lng: 103.8343 },
  { id: "yunnan", name: "Yunnan", taxonomyName: "Yunnan", emoji: "🍄", lat: 25.04, lng: 102.72 },
  { id: "fujian-taiwan", name: "Fujian · Taiwan", taxonomyName: "Fujian / Taiwan culinary family", emoji: "🐟", lat: 24.8, lng: 119.1 },
  { id: "xinjiang-uyghur", name: "Xinjiang · Uyghur", taxonomyName: "Xinjiang / Uyghur", emoji: "🐑", lat: 43.82, lng: 87.62 },
  { id: "tibetan", name: "Tibetan", taxonomyName: "Tibetan", emoji: "🏔️", lat: 29.65, lng: 91.12 },
];

const REGION_BY_RESTAURANT_ID = new Map(Object.entries({
  "osm-node-1788814868": "guangdong",
  "osm-node-6472655594": "guangdong",
  "osm-node-4960091098": "sichuan",
  "osm-node-3338183566": "sichuan",
  "osm-node-1939700056": "northeast-china",
  "osm-node-651508502": "sichuan",
  "osm-node-5489630514": "guangdong",
  "osm-node-1741354240": "sichuan",
  "osm-node-12999991326": "sichuan",
  "osm-node-6651440000": "sichuan",
  "osm-way-122221506": "yunnan",
  "osm-node-13638405713": "xinjiang-uyghur",
  "osm-node-1134127002": "sichuan",
  "osm-node-9199499628": "shanxi-shaanxi-noodles",
  "osm-node-10555181507": "shanxi-shaanxi-noodles",
  "osm-node-3601324494": "gansu-lanzhou",
  "osm-node-701421198": "shanxi-shaanxi-noodles",
  "osm-node-326725407": "guangdong",
  "osm-node-1098713377": "sichuan",
  "osm-node-5081218862": "sichuan",
  "osm-node-4978366181": "sichuan",
  "osm-node-13649901228": "sichuan",
  "osm-node-10719538905": "fujian-taiwan",
  "osm-node-315919425": "fujian-taiwan",
  "osm-node-305717986": "xinjiang-uyghur",
  "osm-node-1091413931": "xinjiang-uyghur",
  "osm-node-3929290127": "gansu-lanzhou",
  "osm-node-1909014201": "hunan",
  "osm-node-5311718621": "sichuan",
  "osm-node-412743894": "sichuan",
  "curated-jupiter-restaurant-bar": "sichuan",
  "curated-jiao-kitchen": "sichuan",
  "curated-nihao-streetfood": "sichuan",
  "curated-xiang-ju": "hunan",
}));

const GENERIC_CHINESE_IDS = new Set([
  "osm-node-318708860",
  "osm-node-279830869",
  "osm-node-5198358434",
  "osm-way-35217621",
  "osm-node-389447123",
  "osm-node-1055335186",
  "osm-node-1726383947",
  "osm-node-1444923171",
  "osm-node-3669870109",
  "osm-node-315953454",
  "osm-node-9586451346",
  "osm-node-2595562246",
  "osm-node-6934408010",
  "osm-node-2810020835",
  "osm-node-1195737881",
  "osm-node-452068329",
  "osm-node-1660556258",
  "osm-node-11365929071",
  "osm-node-7779203018",
  "osm-node-571393848",
  "osm-node-269571504",
  "osm-way-271078180",
  "osm-node-6429412886",
  "osm-node-12739974829",
  "osm-node-7004862731",
  "osm-node-4022625874",
  "curated-chinatown-restaurant",
]);

const CURATED_ADDITIONS = [
  {
    id: "curated-chinatown-restaurant",
    name: "ChinaTown Restaurant",
    countryId: "china",
    regionId: "china-national",
    cuisine: "chinese",
    address: "Pasinger Bahnhofsplatz 3, 81241 München",
    lat: 48.14889,
    lng: 11.46069,
    source: "https://www.chinatownrestaurantundbiergartenmnchen.de/contact",
  },
  {
    id: "curated-jupiter-restaurant-bar",
    name: "Jupiter Restaurant & Bar",
    countryId: "china",
    regionId: "sichuan",
    cuisine: "chinese;sichuan",
    address: "Einsteinstraße 119, 81675 München",
    lat: 48.13613,
    lng: 11.6076,
    source: "https://jupiterrestaurantbar.order.dish.co/legal-notice",
  },
  {
    id: "curated-jiao-kitchen",
    name: "Jiao Kitchen",
    countryId: "china",
    regionId: "sichuan",
    cuisine: "chinese;sichuan",
    address: "Arabellastraße 19, 81925 München",
    lat: 48.15361,
    lng: 11.6178,
    source: "https://www.jiaokitchen.com/",
  },
  {
    id: "curated-nihao-streetfood",
    name: "Nihao Streetfood",
    countryId: "china",
    regionId: "sichuan",
    cuisine: "chinese;sichuan",
    address: "Pasinger Bahnhofsplatz 2, 81241 München",
    lat: 48.1487,
    lng: 11.46093,
    source: "https://www.nihao-kitchen.com/",
  },
  {
    id: "curated-xiang-ju",
    name: "Xiang Ju",
    countryId: "china",
    regionId: "hunan",
    cuisine: "chinese;hunan",
    address: "Metzstraße 8, 81667 München",
    lat: 48.12894,
    lng: 11.59691,
    source: "https://wolt.com/de/deu/munich/restaurant/xiang-ju",
  },
];

export function applyMunichChinaEditorialUpdate({ datasetMeta, regionTaxonomy, restaurants }) {
  for (const region of CHINA_REGIONS) {
    const existing = regionTaxonomy.find((candidate) => candidate.id === region.id);
    const sourceRegion = {
      id: region.id,
      countryId: "china",
      name: region.name,
      lat: region.lat,
      lng: region.lng,
    };
    if (existing) Object.assign(existing, sourceRegion);
    else regionTaxonomy.push(sourceRegion);
  }

  for (const restaurant of restaurants) {
    if (restaurant.countryId !== "china") continue;
    if (REGION_BY_RESTAURANT_ID.has(restaurant.id)) {
      restaurant.regionId = REGION_BY_RESTAURANT_ID.get(restaurant.id);
    } else if (GENERIC_CHINESE_IDS.has(restaurant.id)) {
      restaurant.regionId = "china-national";
    }
  }

  for (const addition of CURATED_ADDITIONS) {
    if (!restaurants.some((restaurant) => restaurant.id === addition.id)) {
      restaurants.push({ ...addition });
    }
  }

  datasetMeta.snapshotDate = UPDATE_DATE;
  datasetMeta.source = "OpenStreetMap via Overpass API with user-curated Munich additions";
  datasetMeta.includedRestaurants = restaurants.length;
  datasetMeta.representedRegions = new Set(restaurants.map((restaurant) => restaurant.regionId)).size;
}

export function applyMunichChinaTaxonomyUpdate(taxonomy, sourceRestaurants) {
  const china = taxonomy.continents
    .flatMap((continent) => continent.countries)
    .find((country) => country.country === "China");
  if (!china) return;

  const existingEvidence = new Map(
    china.regions.flatMap((region) => region.restaurants.map((restaurant) => [
      restaurant.id,
      { restaurant, regionName: region.name },
    ])),
  );
  const chinaRestaurants = sourceRestaurants.filter((restaurant) => restaurant.countryId === "china");
  const restaurantById = new Map(chinaRestaurants.map((restaurant) => [restaurant.id, restaurant]));

  china.regions = CHINA_REGIONS.map((region) => {
    const restaurantIds = [...REGION_BY_RESTAURANT_ID.entries()]
      .filter(([, regionId]) => regionId === region.id)
      .map(([restaurantId]) => restaurantId)
      .filter((restaurantId) => restaurantById.has(restaurantId));
    const restaurants = restaurantIds.map((restaurantId) => {
      const source = restaurantById.get(restaurantId);
      const previous = existingEvidence.get(restaurantId);
      return previous?.regionName === region.taxonomyName
        ? { ...previous.restaurant, name: source.name }
        : {
            id: source.id,
            name: source.name,
            evidenceLevel: "editorial",
            evidence: `Regional classification supplied for the GastroGlobe Munich update on ${UPDATE_DATE}.`,
            sourceUrls: [source.source].filter(Boolean),
          };
    });
    return {
      name: region.taxonomyName,
      emoji: region.emoji,
      geographicCenter: { lat: region.lat, lng: region.lng },
      restaurantCount: restaurants.length,
      restaurants,
    };
  });

  const classifiedIds = new Set(china.regions.flatMap((region) => region.restaurants.map((restaurant) => restaurant.id)));
  china.sourceRestaurantCount = chinaRestaurants.length;
  china.classifiedRestaurantCount = classifiedIds.size;
  china.unclassifiedRestaurantCount = chinaRestaurants.length - classifiedIds.size;
  china.auditNote = `Editorial regional-cuisine update applied ${UPDATE_DATE}; generic Chinese restaurants remain uncategorized.`;
  taxonomy.datasetSnapshot = UPDATE_DATE;
  taxonomy.generatedAt = UPDATE_DATE;
}
